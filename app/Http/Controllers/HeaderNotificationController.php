<?php

namespace App\Http\Controllers;

use App\Services\Notifications\NotificationPreferenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class HeaderNotificationController extends Controller
{
    public function __construct(private readonly NotificationPreferenceService $preferences) {}

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 401);

        $role = strtolower((string) ($user->role?->value ?? $user->role ?? 'user'));
        $operator = in_array($role, ['admin', 'hr'], true);
        $preferences = $this->preferences->for($user);
        $items = collect();

        $push = function (
            string $id,
            string $category,
            string $title,
            string $description,
            string $meta,
            string $tone,
            string $href,
            int $count = 1,
        ) use ($items): void {
            if ($count <= 0) {
                return;
            }

            $items->push(compact('id', 'category', 'title', 'description', 'meta', 'tone', 'href', 'count'));
        };

        $safe = static function (callable $callback): void {
            try {
                $callback();
            } catch (Throwable $exception) {
                report($exception);
            }
        };

        if ($preferences['performance_actions'] ?? false) {
            $safe(function () use ($operator, $role, $push): void {
                if (! $operator
                    || ! Schema::hasTable('performance_reviews')
                    || ! Schema::hasTable('performance_review_assignments')
                    || ! Schema::hasTable('performance_cycles')) {
                    return;
                }

                $performanceRoute = $role === 'admin' ? 'admin.performance.index' : 'hr.performance.index';
                $reviewActions = DB::table('performance_reviews as reviews')
                    ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                    ->join('performance_cycles as cycles', 'cycles.id', '=', 'assignments.performance_cycle_id')
                    ->where('cycles.calibration_required', true)
                    ->where('cycles.status', '!=', 'Closed')
                    ->whereIn('reviews.workflow_state', ['Calibration Pending', 'Calibration In Review']);

                $awaitingCalibration = (clone $reviewActions)
                    ->where('reviews.workflow_state', 'Calibration Pending')
                    ->count();
                $inCalibration = (clone $reviewActions)
                    ->where('reviews.workflow_state', 'Calibration In Review')
                    ->count();
                $count = $awaitingCalibration + $inCalibration;

                $push(
                    'performance-calibration-action',
                    'performance_actions',
                    'Performance reviews require action',
                    $awaitingCalibration.' awaiting calibration · '.$inCalibration.' in calibration review.',
                    $count.' '.($count === 1 ? 'action required' : 'actions required'),
                    'warning',
                    $this->workspaceHref($performanceRoute, 'Reviews'),
                    $count,
                );
            });
        }

        if ($preferences['competency_actions'] ?? false) {
            $safe(function () use ($operator, $role, $push): void {
                if (! $operator || ! Schema::hasTable('competency_assessments')) {
                    return;
                }

                $pendingValidation = DB::table('competency_assessments')
                    ->whereIn('status', ['Submitted', 'Pending Validation'])
                    ->count();
                $routeName = $role === 'admin' ? 'admin.competency.index' : 'hr.competency.index';

                $push(
                    'competency-validation-action',
                    'competency_actions',
                    'Competency assessments need validation',
                    'Submitted assessment records are waiting for governance validation or finalization.',
                    $pendingValidation.' pending',
                    'warning',
                    $this->workspaceHref($routeName, 'Assessments'),
                    $pendingValidation,
                );
            });
        }

        if ($preferences['learning_actions'] ?? false) {
            $safe(function () use ($operator, $role, $user, $push): void {
                $learningRoute = $role === 'admin'
                    ? 'admin.learning.index'
                    : ($role === 'hr' ? 'hr.learning.index' : 'user.learning.index');

                if ($operator && Schema::hasTable('learning_course_versions')) {
                    $inReview = DB::table('learning_course_versions')->where('status', 'In Review')->count();
                    $approved = DB::table('learning_course_versions')->where('status', 'Approved')->count();
                    $count = $inReview + $approved;
                    $push(
                        'learning-governance-action',
                        'learning_actions',
                        'Learning courses need governance',
                        $inReview.' in review · '.$approved.' approved and awaiting publication.',
                        $count.' '.($count === 1 ? 'course' : 'courses'),
                        'warning',
                        $this->workspaceHref($learningRoute, 'Courses'),
                        $count,
                    );
                }

                if (! Schema::hasTable('learning_assignments')) {
                    return;
                }

                $base = DB::table('learning_assignments')
                    ->whereNotIn('status', ['Completed', 'Cancelled', 'Expired'])
                    ->whereNotNull('due_at');
                if (! $operator) {
                    $base->where('learner_id', $user->id);
                }

                $overdue = (clone $base)->where('due_at', '<', now())->count();
                $push(
                    'learning-overdue',
                    'learning_actions',
                    $operator ? 'Learning assignments overdue' : 'You have overdue learning',
                    $operator ? 'Assignments passed their due date and still need resolution.' : 'One or more assigned courses are past due.',
                    $overdue.' overdue',
                    'danger',
                    $this->workspaceHref($learningRoute, $operator ? 'Assignments' : null),
                    $overdue,
                );

                if (! $operator) {
                    $dueSoon = (clone $base)
                        ->whereBetween('due_at', [now(), now()->addDays(7)])
                        ->count();
                    $push(
                        'learning-due-soon',
                        'learning_actions',
                        'Learning due within 7 days',
                        'Assigned learning is approaching its due date.',
                        $dueSoon.' due soon',
                        'warning',
                        route($learningRoute),
                        $dueSoon,
                    );
                }
            });
        }

        if ($preferences['training_actions'] ?? false) {
            $safe(function () use ($operator, $role, $user, $push): void {
                $trainingRoute = $role === 'admin'
                    ? 'admin.training.index'
                    : ($role === 'hr' ? 'hr.training.index' : 'user.training.index');

                if ($operator && Schema::hasTable('training_recommendations')) {
                    $requirements = DB::table('training_recommendations')
                        ->whereIn('status', ['Pending', 'Under Review'])
                        ->count();
                    $push(
                        'training-requirements-action',
                        'training_actions',
                        'Training requirements need coordination',
                        'Development requirements are waiting for scheduling or an authorized Training decision.',
                        $requirements.' open',
                        'warning',
                        $this->workspaceHref($trainingRoute, 'Overview'),
                        $requirements,
                    );
                }

                if (! Schema::hasTable('training_sessions')) {
                    return;
                }

                if ($operator) {
                    $needsFinalization = DB::table('training_sessions')
                        ->where('ends_at', '<', now())
                        ->whereIn('status', ['Scheduled', 'Ongoing'])
                        ->count();
                    $push(
                        'training-finalization-action',
                        'training_actions',
                        'Training sessions need finalization',
                        'Sessions have ended but are still open for attendance or completion governance.',
                        $needsFinalization.' open',
                        'danger',
                        $this->workspaceHref($trainingRoute, 'Training Register'),
                        $needsFinalization,
                    );

                    $upcoming = DB::table('training_sessions')
                        ->whereBetween('starts_at', [now(), now()->addDays(7)])
                        ->whereNotIn('status', ['Draft', 'Cancelled', 'Completed'])
                        ->count();
                    $push(
                        'training-upcoming',
                        'training_actions',
                        'Training sessions in the next 7 days',
                        'Scheduled sessions are approaching and may need logistics or facilitator checks.',
                        $upcoming.' upcoming',
                        'info',
                        $this->workspaceHref($trainingRoute, 'Training Register'),
                        $upcoming,
                    );
                } elseif (Schema::hasTable('training_session_participants') && Schema::hasTable('training_enrollments')) {
                    $upcoming = DB::table('training_sessions as sessions')
                        ->join('training_session_participants as participants', 'participants.session_id', '=', 'sessions.id')
                        ->join('training_enrollments as enrollments', 'enrollments.id', '=', 'participants.enrollment_id')
                        ->where('enrollments.participant_id', $user->id)
                        ->whereBetween('sessions.starts_at', [now(), now()->addDays(7)])
                        ->whereNotIn('sessions.status', ['Draft', 'Cancelled', 'Completed'])
                        ->count();
                    $push(
                        'training-upcoming-user',
                        'training_actions',
                        'Upcoming training session',
                        'A training session assigned to you starts within 7 days.',
                        $upcoming.' upcoming',
                        'info',
                        route($trainingRoute),
                        $upcoming,
                    );
                }
            });
        }

        if ($preferences['succession_actions'] ?? false) {
            $safe(function () use ($operator, $role, $push): void {
                if (! $operator) {
                    return;
                }

                $successionRoute = $role === 'admin' ? 'admin.succession.index' : 'hr.succession.index';

                if (Schema::hasTable('succession_critical_positions')) {
                    $dueReview = DB::table('succession_critical_positions')
                        ->where('status', 'Active')
                        ->whereNotNull('next_review_at')
                        ->where('next_review_at', '<=', now())
                        ->count();
                    $push(
                        'succession-review-due',
                        'succession_actions',
                        'Succession position reviews due',
                        'Active critical positions reached their configured review date.',
                        $dueReview.' due',
                        'warning',
                        $this->workspaceHref($successionRoute, 'Succession Register'),
                        $dueReview,
                    );
                }

                if (Schema::hasTable('succession_candidates')) {
                    $candidateReviews = DB::table('succession_candidates')
                        ->whereIn('status', ['Proposed', 'Under Review'])
                        ->count();
                    $push(
                        'succession-candidate-review',
                        'succession_actions',
                        'Succession candidates need review',
                        'Candidate records are waiting for readiness review or an authorized pipeline decision.',
                        $candidateReviews.' pending',
                        'warning',
                        $this->workspaceHref($successionRoute, 'Readiness Reviews'),
                        $candidateReviews,
                    );
                }
            });
        }

        if ($preferences['recognition_actions'] ?? false) {
            $safe(function () use ($operator, $role, $user, $push): void {
                if (! Schema::hasTable('recognition_records')) {
                    return;
                }

                if ($operator) {
                    $pending = DB::table('recognition_records')->where('status', 'Pending Review')->count();
                    $recognitionRoute = $role === 'admin' ? 'admin.recognition.index' : 'hr.recognition.index';
                    $push(
                        'recognition-review',
                        'recognition_actions',
                        'Recognition nominations await review',
                        'Submitted recognitions are waiting for an Admin or HR decision.',
                        $pending.' pending review',
                        'warning',
                        $this->workspaceHref($recognitionRoute, 'Review Queue'),
                        $pending,
                    );
                    return;
                }

                $recent = DB::table('recognition_records')
                    ->where('recipient_id', $user->id)
                    ->where('status', 'Recognized')
                    ->where('recognized_at', '>=', now()->subDays(30))
                    ->count();
                $push(
                    'recognition-recent',
                    'recognition_actions',
                    'Recent recognition',
                    'Recognition was published for you during the last 30 days.',
                    $recent.' recent',
                    'success',
                    route('user.leaderboard.index'),
                    $recent,
                );
            });
        }

        if (($preferences['security_alerts'] ?? false) && $role === 'admin') {
            $safe(function () use ($push): void {
                if (! Schema::hasTable('security_audit_events')) {
                    return;
                }

                $flagged = DB::table('security_audit_events')
                    ->where('flagged', true)
                    ->where('occurred_at', '>=', now()->subDay())
                    ->count();
                $push(
                    'security-flagged',
                    'security_alerts',
                    'Flagged security activity',
                    'Security events were flagged during the last 24 hours.',
                    $flagged.' flagged',
                    'danger',
                    route('admin.settings.index', ['section' => 'security-activity']),
                    $flagged,
                );
            });
        }

        $ordered = $items
            ->sortBy(fn (array $item): int => match ($item['tone']) {
                'danger' => 0,
                'warning' => 1,
                'info' => 2,
                'success' => 3,
                default => 4,
            })
            ->values()
            ->take(12);

        $readState = collect();
        $activeIds = $ordered->pluck('id')->values()->all();

        if (Schema::hasTable('header_notification_reads')) {
            $readQuery = DB::table('header_notification_reads')
                ->where('user_id', $user->id);

            if ($activeIds === []) {
                $readQuery->delete();
            } else {
                (clone $readQuery)->whereNotIn('notification_id', $activeIds)->delete();
                $readState = (clone $readQuery)
                    ->whereIn('notification_id', $activeIds)
                    ->pluck('fingerprint', 'notification_id');
            }
        }

        $notifications = $ordered->map(function (array $item) use ($readState): array {
            $fingerprint = $this->notificationFingerprint($item);
            $item['fingerprint'] = $fingerprint;
            $item['isRead'] = $readState->get($item['id']) === $fingerprint;

            return $item;
        })->values();

        return response()->json([
            'data' => $notifications->all(),
            // totalCount is the number of active alert groups shown in the center.
            'totalCount' => $notifications->count(),
            'activeCount' => $notifications->count(),
            'unreadCount' => $notifications->where('isRead', false)->count(),
            // aggregateCount retains the total number of underlying records/actions.
            'aggregateCount' => (int) $notifications->sum('count'),
            'generatedAt' => now()->toIso8601String(),
        ]);
    }

    /**
     * The fingerprint makes a notification unread again only when its live
     * underlying state changes (count, description, destination, etc.).
     */
    private function notificationFingerprint(array $item): string
    {
        return hash('sha256', json_encode([
            'id' => $item['id'] ?? '',
            'title' => $item['title'] ?? '',
            'description' => $item['description'] ?? '',
            'meta' => $item['meta'] ?? '',
            'tone' => $item['tone'] ?? '',
            'href' => $item['href'] ?? '',
            'count' => (int) ($item['count'] ?? 0),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function workspaceHref(string $routeName, ?string $workspace): string
    {
        $href = route($routeName);

        return $workspace ? $href.'#'.rawurlencode($workspace) : $href;
    }
}
