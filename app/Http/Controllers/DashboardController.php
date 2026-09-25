<?php

namespace App\Http\Controllers;

use App\Support\SchemaPresence;
use App\Enums\UserRole;
use App\Enums\UserPersona;
use App\Services\UserWorkspace\UserPersonaResolver;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    private ?Collection $finalizedPerformanceRowsMemo = null;

    public function index(Request $request): RedirectResponse
    {
        return $this->redirectToOwnedDashboard($request->user());
    }

    public function admin(Request $request): Response
    {
        return Inertia::render('AdminDashboard', [
            'userName' => $request->user()->name,
            'dashboard' => $this->adminDashboardState($request->user()),
        ]);
    }

    public function hr(Request $request): Response
    {
        return Inertia::render('HRDashboard', [
            'userName' => $request->user()->name,
            'dashboard' => $this->hrDashboardState($request->user()),
        ]);
    }

    public function user(Request $request): Response
    {
        $user = $request->user();
        $persona = app(UserPersonaResolver::class)->resolve($user);
        $page = match ($persona) {
            UserPersona::Trainee => 'TraineeDashboard',
            UserPersona::Employee => 'EmployeeDashboard',
            UserPersona::Supervisor => 'SupervisorDashboard',
            UserPersona::Manager => 'ManagerDashboard',
        };

        return Inertia::render($page, [
            'userName' => $user->name,
            'persona' => $persona->value,
            'dashboard' => $this->userDashboardState($user),
            'team' => $this->userTeamState($user, $persona),
        ]);
    }

    public function redirectToOwnedDashboard(User $user): RedirectResponse
    {
        $role = $user->role instanceof UserRole ? $user->role : UserRole::User;

        return redirect()->route($role->dashboardRouteName());
    }

    /**
     * Build the Admin dashboard only from persisted system records.
     * No presentation-only employee, performance, training, or activity data
     * belongs in the React page.
     *
     * @return array<string, mixed>
     */
    private function adminDashboardState(User $actor, bool $forHr = false): array
    {
        $activeWorkforce = User::query()
            ->activePersonnel()
            ->when($forHr, fn ($query) => $query->where('role', '!=', UserRole::Admin->value))
            ->count();
        $performance = $this->adminPerformanceSnapshot();
        $competency = $this->adminCompetencySnapshot();
        $learning = $this->adminLearningSnapshot();
        $training = $this->adminTrainingSnapshot();
        $succession = $this->adminSuccessionSnapshot();
        $recognition = $this->adminRecognitionSnapshot();
        $security = $forHr ? ['flagged' => 0] : $this->adminSecuritySnapshot();

        return [
            'stats' => [
                'activeWorkforce' => $activeWorkforce,
                'performanceActions' => $performance['actions'],
                'competencyActions' => $competency['actions'],
                'trainingActions' => $training['actions'],
                'successionRisk' => $succession['positionsAtRisk'],
                'recognitionPending' => $recognition['pending'],
            ],
            'needsAttention' => $this->adminAttentionItems($performance, $competency, $learning, $training, $succession, $recognition, $security),
            'performance' => $performance,
            'performanceSeries' => $this->performanceSeries($this->finalizedPerformanceRows()),
            'development' => [
                'learningInProgress' => $learning['inProgress'],
                'learningOverdue' => $learning['overdue'],
                'trainingRequirements' => $training['requirements'],
                'activeSuccessionPlans' => $succession['activeDevelopmentPlans'],
            ],
            'upcoming' => $this->adminUpcomingItems($performance),
            'recentActivities' => $this->adminRecentActivities(),
            'workforceByDepartment' => $this->workforceByDepartment(excludeAdmins: $forHr),
        ];
    }

    /** @return array<string, mixed> */
    private function adminPerformanceSnapshot(): array
    {
        $empty = [
            'cycleName' => null,
            'cycleStatus' => 'No current cycle',
            'periodLabel' => 'No current quarterly performance cycle',
            'reviewWindowLabel' => 'No review window configured',
            'reviewOpenDate' => null,
            'reviewDueDate' => null,
            'total' => 0,
            'scheduled' => 0,
            'inProgress' => 0,
            'calibration' => 0,
            'finalized' => 0,
            'overdue' => 0,
            'actions' => 0,
            'averageFinalizedRating' => null,
        ];

        if (! SchemaPresence::hasTable('performance_cycles') || ! SchemaPresence::hasTable('performance_review_assignments')) {
            return $empty;
        }

        $today = CarbonImmutable::today('Asia/Manila');
        $cycle = DB::table('performance_cycles')
            ->where('cycle_type', 'Quarterly')
            ->whereDate('performance_start_date', '<=', $today->toDateString())
            ->whereDate('performance_end_date', '>=', $today->toDateString())
            ->orderByDesc('performance_start_date')
            ->first();

        $cycle ??= DB::table('performance_cycles')
            ->where('cycle_type', 'Quarterly')
            ->where('status', 'Active')
            ->orderByDesc('performance_start_date')
            ->first();

        if (! $cycle) {
            return $empty;
        }

        $assignments = DB::table('performance_review_assignments')
            ->where('performance_cycle_id', $cycle->id)
            ->where('active', true);
        $total = (clone $assignments)->count();

        $reviewBase = SchemaPresence::hasTable('performance_reviews')
            ? DB::table('performance_reviews as reviews')
                ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                ->where('assignments.performance_cycle_id', $cycle->id)
                ->where('assignments.active', true)
            : null;

        $reviewStats = $reviewBase ? (clone $reviewBase)
            ->selectRaw(<<<'SQL'
                SUM(CASE WHEN reviews.finalized_at IS NOT NULL THEN 1 ELSE 0 END) AS finalized,
                SUM(CASE WHEN reviews.finalized_at IS NULL AND reviews.workflow_state IN ('Calibration Pending', 'Calibration In Review') THEN 1 ELSE 0 END) AS calibration,
                SUM(CASE WHEN reviews.finalized_at IS NULL AND reviews.status = 'In Progress' AND reviews.workflow_state NOT IN ('Calibration Pending', 'Calibration In Review') THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN reviews.finalized_at IS NULL AND reviews.due_date IS NOT NULL AND reviews.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN reviews.finalized_at IS NULL AND (reviews.workflow_state IN ('Calibration Pending', 'Calibration In Review') OR (reviews.due_date IS NOT NULL AND reviews.due_date < ?)) THEN 1 ELSE 0 END) AS actions,
                AVG(CASE WHEN reviews.finalized_at IS NOT NULL AND reviews.final_rating IS NOT NULL THEN reviews.final_rating END) AS average_finalized_rating
            SQL, [$today->toDateString(), $today->toDateString()])
            ->first() : null;

        $finalized = (int) ($reviewStats->finalized ?? 0);
        $calibration = (int) ($reviewStats->calibration ?? 0);
        $inProgress = (int) ($reviewStats->in_progress ?? 0);
        $overdue = (int) ($reviewStats->overdue ?? 0);
        $actions = (int) ($reviewStats->actions ?? 0);
        $average = $reviewStats?->average_finalized_rating;

        $known = min($total, $finalized + $calibration + $inProgress);
        $scheduled = max(0, $total - $known);
        $periodStart = CarbonImmutable::parse($cycle->performance_start_date, 'Asia/Manila');
        $periodEnd = CarbonImmutable::parse($cycle->performance_end_date, 'Asia/Manila');
        $reviewOpen = CarbonImmutable::parse($cycle->review_open_date, 'Asia/Manila');
        $reviewDue = CarbonImmutable::parse($cycle->review_due_date, 'Asia/Manila');

        $reviewWindow = $today->lt($reviewOpen)
            ? 'Opens '.$reviewOpen->format('M j, Y')
            : ($today->lte($reviewDue) ? 'Open until '.$reviewDue->format('M j, Y') : 'Review window closed');

        return [
            'cycleName' => (string) $cycle->name,
            'cycleStatus' => 'Current',
            'periodLabel' => $periodStart->format('M j').' – '.$periodEnd->format('M j, Y'),
            'reviewWindowLabel' => $reviewWindow,
            'reviewOpenDate' => $reviewOpen->toDateString(),
            'reviewDueDate' => $reviewDue->toDateString(),
            'total' => $total,
            'scheduled' => $scheduled,
            'inProgress' => $inProgress,
            'calibration' => $calibration,
            'finalized' => $finalized,
            'overdue' => $overdue,
            'actions' => $actions,
            'averageFinalizedRating' => $average !== null ? round((float) $average, 2) : null,
        ];
    }

    /** @return array{actions:int,pending:int,reassessmentDue:int} */
    private function adminCompetencySnapshot(): array
    {
        if (! SchemaPresence::hasTable('competency_assessments')) {
            return ['actions' => 0, 'pending' => 0, 'reassessmentDue' => 0];
        }

        $stats = DB::table('competency_assessments')
            ->selectRaw(<<<'SQL'
                SUM(CASE WHEN status IN ('Submitted', 'Pending Validation') THEN 1 ELSE 0 END) AS actions,
                SUM(CASE WHEN status NOT IN ('Finalized', 'Cancelled') THEN 1 ELSE 0 END) AS pending
            SQL)
            ->first();

        return [
            'actions' => (int) ($stats->actions ?? 0),
            'pending' => (int) ($stats->pending ?? 0),
            'reassessmentDue' => 0,
        ];
    }

    /** @return array{inProgress:int,overdue:int,governance:int} */
    private function adminLearningSnapshot(): array
    {
        $inProgress = 0;
        $overdue = 0;
        $governance = 0;

        if (SchemaPresence::hasTable('learning_assignments')) {
            $assignmentStats = DB::table('learning_assignments')
                ->selectRaw(<<<'SQL'
                    SUM(CASE WHEN status IN ('Not Started', 'In Progress') THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN status IN ('Not Started', 'In Progress') AND due_at IS NOT NULL AND due_at < ? THEN 1 ELSE 0 END) AS overdue
                SQL, [now()])
                ->first();
            $inProgress = (int) ($assignmentStats->in_progress ?? 0);
            $overdue = (int) ($assignmentStats->overdue ?? 0);
        }
        if (SchemaPresence::hasTable('learning_course_versions')) {
            $governance = DB::table('learning_course_versions')
                ->whereIn('status', ['In Review', 'Approved'])
                ->count();
        }

        return compact('inProgress', 'overdue', 'governance');
    }

    /** @return array{requirements:int,pendingFinalization:int,upcoming:int,actions:int} */
    private function adminTrainingSnapshot(): array
    {
        $requirements = SchemaPresence::hasTable('training_recommendations')
            ? DB::table('training_recommendations')->whereIn('status', ['Pending', 'Under Review'])->count()
            : 0;
        $pendingFinalization = 0;
        $upcoming = 0;
        if (SchemaPresence::hasTable('training_sessions')) {
            $now = now();
            $sessionStats = DB::table('training_sessions')
                ->selectRaw(<<<'SQL'
                    SUM(CASE WHEN ends_at < ? AND status IN ('Scheduled', 'Ongoing') THEN 1 ELSE 0 END) AS pending_finalization,
                    SUM(CASE WHEN starts_at BETWEEN ? AND ? AND status NOT IN ('Draft', 'Cancelled', 'Completed') THEN 1 ELSE 0 END) AS upcoming
                SQL, [$now, $now, $now->copy()->addDays(7)])
                ->first();
            $pendingFinalization = (int) ($sessionStats->pending_finalization ?? 0);
            $upcoming = (int) ($sessionStats->upcoming ?? 0);
        }

        return [
            'requirements' => $requirements,
            'pendingFinalization' => $pendingFinalization,
            'upcoming' => $upcoming,
            'actions' => $requirements + $pendingFinalization,
        ];
    }

    /** @return array{positionsAtRisk:int,reviewsPending:int,activeDevelopmentPlans:int} */
    private function adminSuccessionSnapshot(): array
    {
        if (! SchemaPresence::hasTable('succession_critical_positions')) {
            return ['positionsAtRisk' => 0, 'reviewsPending' => 0, 'activeDevelopmentPlans' => 0];
        }

        $positions = DB::table('succession_critical_positions')
            ->where('status', 'Active')
            ->get(['id', 'next_review_at']);
        $positionIds = $positions->pluck('id');
        $accepted = SchemaPresence::hasTable('succession_candidates')
            ? DB::table('succession_candidates')
                ->whereIn('critical_position_id', $positionIds)
                ->where('status', 'Accepted')
                ->get(['id', 'critical_position_id'])
            : collect();
        $candidateIds = $accepted->pluck('id');
        $latestReadiness = collect();

        if ($candidateIds->isNotEmpty() && SchemaPresence::hasTable('succession_readiness_assessments')) {
            $latestReadiness = DB::table('succession_readiness_assessments')
                ->whereIn('succession_candidate_id', $candidateIds)
                ->where('status', 'Finalized')
                ->orderByDesc('version')
                ->get(['succession_candidate_id', 'readiness_band', 'version'])
                ->groupBy('succession_candidate_id')
                ->map(fn (Collection $rows): object => $rows->first());
        }

        $positionsAtRisk = $positions->filter(function (object $position) use ($accepted, $latestReadiness): bool {
            $positionCandidates = $accepted->where('critical_position_id', $position->id);
            $acceptedCount = $positionCandidates->count();
            $readyNow = $positionCandidates->filter(
                fn (object $candidate): bool => ($latestReadiness->get($candidate->id)?->readiness_band ?? null) === 'Ready Now'
            )->count();
            $reviewOverdue = $position->next_review_at
                ? CarbonImmutable::parse($position->next_review_at)->isPast()
                : false;

            return $acceptedCount === 0
                || $acceptedCount === 1
                || ($acceptedCount > 0 && $readyNow === 0)
                || $reviewOverdue;
        })->count();

        $reviewsPending = SchemaPresence::hasTable('succession_candidates')
            ? DB::table('succession_candidates')->whereIn('status', ['Proposed', 'Under Review'])->count()
            : 0;
        $activeDevelopmentPlans = SchemaPresence::hasTable('succession_development_plans')
            ? DB::table('succession_development_plans')->where('status', 'Active')->count()
            : 0;

        return compact('positionsAtRisk', 'reviewsPending', 'activeDevelopmentPlans');
    }

    /** @return array{pending:int} */
    private function adminRecognitionSnapshot(): array
    {
        return ['pending' => SchemaPresence::hasTable('recognition_records')
            ? DB::table('recognition_records')->where('status', 'Pending Review')->count()
            : 0];
    }

    /** @return array{flagged:int} */
    private function adminSecuritySnapshot(): array
    {
        return ['flagged' => SchemaPresence::hasTable('security_audit_events')
            ? DB::table('security_audit_events')
                ->where('flagged', true)
                ->where('occurred_at', '>=', now()->subDay())
                ->count()
            : 0];
    }

    /**
     * @param array<string, mixed> $performance
     * @param array<string, mixed> $competency
     * @param array<string, mixed> $learning
     * @param array<string, mixed> $training
     * @param array<string, mixed> $succession
     * @param array<string, mixed> $recognition
     * @param array<string, mixed> $security
     * @return array<int, array<string, mixed>>
     */
    private function adminAttentionItems(array $performance, array $competency, array $learning, array $training, array $succession, array $recognition, array $security): array
    {
        $items = collect();
        $push = function (string $id, string $module, string $title, string $detail, int $count, string $priority, string $href) use ($items): void {
            if ($count <= 0) return;
            $items->push(compact('id', 'module', 'title', 'detail', 'count', 'priority', 'href'));
        };

        $push('security', 'Security', 'Flagged security activity', 'Security events were flagged during the last 24 hours.', (int) $security['flagged'], 'High', route('admin.settings.index', ['section' => 'security-activity']));
        $push('performance', 'Performance', 'Performance reviews require action', ((int) $performance['calibration']).' calibration · '.((int) $performance['overdue']).' overdue.', (int) $performance['actions'], 'High', $this->workspaceHref('admin.performance.index', 'Reviews'));
        $push('training-finalization', 'Training', 'Training sessions need finalization', 'Sessions have ended but remain open for attendance or completion governance.', (int) $training['pendingFinalization'], 'High', $this->workspaceHref('admin.training.index', 'Training Register'));
        $push('learning-overdue', 'Learning', 'Learning assignments are overdue', 'Assigned learning passed its due date and remains unresolved.', (int) $learning['overdue'], 'High', $this->workspaceHref('admin.learning.index', 'Assignments'));
        $push('competency', 'Competency', 'Competency assessments need validation', 'Submitted assessments are waiting for governance validation or finalization.', (int) $competency['actions'], 'Medium', $this->workspaceHref('admin.competency.index', 'Assessments'));
        $push('training-requirements', 'Training', 'Training requirements need coordination', 'Development requirements are waiting for scheduling or an authorized decision.', (int) $training['requirements'], 'Medium', $this->workspaceHref('admin.training.index', 'Overview'));
        $push('succession-risk', 'Succession', 'Critical positions need succession attention', 'Active critical positions currently carry one or more coverage or review risk flags.', (int) $succession['positionsAtRisk'], 'Medium', $this->workspaceHref('admin.succession.index', 'Succession Register'));
        $push('succession-review', 'Succession', 'Succession candidates need review', 'Candidate records are waiting for readiness review or a pipeline decision.', (int) $succession['reviewsPending'], 'Medium', $this->workspaceHref('admin.succession.index', 'Readiness Reviews'));
        $push('recognition', 'Recognition', 'Recognition nominations await review', 'Submitted recognitions are waiting for an Admin/HR decision.', (int) $recognition['pending'], 'Medium', $this->workspaceHref('admin.recognition.index', 'Review Queue'));
        $push('learning-governance', 'Learning', 'Learning courses need governance', 'Course versions are in review or approved and awaiting publication.', (int) $learning['governance'], 'Medium', $this->workspaceHref('admin.learning.index', 'Courses'));

        return $items
            ->sortBy(fn (array $item): array => [$item['priority'] === 'High' ? 0 : 1, -$item['count'], $item['module']])
            ->take(8)
            ->values()
            ->all();
    }

    /** @param array<string, mixed> $performance */
    private function adminUpcomingItems(array $performance): array
    {
        $items = collect();
        $now = CarbonImmutable::now('Asia/Manila');
        $horizon = $now->addDays(30);

        if (SchemaPresence::hasTable('training_sessions') && SchemaPresence::hasTable('training_programs')) {
            DB::table('training_sessions as sessions')
                ->join('training_programs as programs', 'programs.id', '=', 'sessions.program_id')
                ->whereBetween('sessions.starts_at', [$now, $horizon])
                ->whereNotIn('sessions.status', ['Draft', 'Cancelled', 'Completed'])
                ->orderBy('sessions.starts_at')
                ->limit(5)
                ->get(['sessions.starts_at', 'sessions.venue', 'sessions.status', 'programs.title'])
                ->each(function (object $row) use ($items): void {
                    $items->push([
                        'type' => 'Training',
                        'title' => (string) $row->title,
                        'meta' => trim((string) ($row->venue ?: $row->status)),
                        'date' => CarbonImmutable::parse($row->starts_at)->toIso8601String(),
                        'href' => $this->workspaceHref('admin.training.index', 'Training Register'),
                    ]);
                });
        }

        if (SchemaPresence::hasTable('succession_critical_positions')) {
            DB::table('succession_critical_positions')
                ->where('status', 'Active')
                ->whereNotNull('next_review_at')
                ->whereBetween('next_review_at', [$now, $horizon])
                ->orderBy('next_review_at')
                ->limit(4)
                ->get(['position_title', 'department', 'next_review_at'])
                ->each(function (object $row) use ($items): void {
                    $items->push([
                        'type' => 'Succession',
                        'title' => (string) $row->position_title.' review',
                        'meta' => (string) $row->department,
                        'date' => CarbonImmutable::parse($row->next_review_at)->toIso8601String(),
                        'href' => $this->workspaceHref('admin.succession.index', 'Succession Register'),
                    ]);
                });
        }

        if (! empty($performance['reviewOpenDate'])) {
            $reviewOpen = CarbonImmutable::parse($performance['reviewOpenDate'], 'Asia/Manila')->startOfDay();
            if ($reviewOpen->gte($now->startOfDay()) && $reviewOpen->lte($horizon)) {
                $items->push([
                    'type' => 'Performance',
                    'title' => ($performance['cycleName'] ?: 'Performance cycle').' review window opens',
                    'meta' => 'Formal review workflow',
                    'date' => $reviewOpen->toIso8601String(),
                    'href' => $this->workspaceHref('admin.performance.index', 'Reviews'),
                ]);
            }
        }

        return $items
            ->sortBy(fn (array $item): int => CarbonImmutable::parse($item['date'])->timestamp)
            ->take(6)
            ->values()
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function adminRecentActivities(): array
    {
        $activities = collect($this->recentActivities())->map(function (array $activity): array {
            $href = match ($activity['route'] ?? '') {
                'admin.learning.index' => $this->workspaceHref('admin.learning.index', 'Learning Records'),
                'admin.training.index' => $this->workspaceHref('admin.training.index', 'Training Records'),
                'admin.performance.index' => $this->workspaceHref('admin.performance.index', 'Reviews'),
                'admin.recognition.index' => $this->workspaceHref('admin.recognition.index', 'Recognition Register'),
                'admin.users.index' => route('admin.users.index', $activity['params'] ?? []),
                default => route('admin.dashboard'),
            };

            return [
                'type' => $activity['type'],
                'title' => $activity['title'],
                'subtitle' => $activity['subtitle'],
                'occurredAt' => $activity['occurredAt'],
                'href' => $href,
            ];
        });

        if (SchemaPresence::hasTable('competency_finalizations') && SchemaPresence::hasTable('competency_assessments')) {
            DB::table('competency_finalizations as finalizations')
                ->join('competency_assessments as assessments', 'assessments.id', '=', 'finalizations.assessment_id')
                ->join('users as people', 'people.id', '=', 'assessments.person_id')
                ->latest('finalizations.finalized_at')
                ->limit(4)
                ->get(['people.name', 'finalizations.version', 'finalizations.finalized_at'])
                ->each(function (object $row) use ($activities): void {
                    $activities->push([
                        'type' => 'competency_finalized',
                        'title' => 'Competency assessment finalized',
                        'subtitle' => $row->name.' · version '.$row->version,
                        'occurredAt' => CarbonImmutable::parse($row->finalized_at)->toIso8601String(),
                        'href' => $this->workspaceHref('admin.competency.index', 'Assessments'),
                    ]);
                });
        }

        if (SchemaPresence::hasTable('succession_readiness_assessments') && SchemaPresence::hasTable('succession_candidates') && SchemaPresence::hasTable('succession_critical_positions')) {
            DB::table('succession_readiness_assessments as assessments')
                ->join('succession_candidates as candidates', 'candidates.id', '=', 'assessments.succession_candidate_id')
                ->join('succession_critical_positions as positions', 'positions.id', '=', 'candidates.critical_position_id')
                ->join('users as people', 'people.id', '=', 'candidates.candidate_id')
                ->where('assessments.status', 'Finalized')
                ->whereNotNull('assessments.finalized_at')
                ->latest('assessments.finalized_at')
                ->limit(4)
                ->get(['people.name', 'positions.position_title', 'assessments.readiness_band', 'assessments.finalized_at'])
                ->each(function (object $row) use ($activities): void {
                    $activities->push([
                        'type' => 'succession_finalized',
                        'title' => 'Readiness review finalized',
                        'subtitle' => $row->name.' · '.$row->position_title.' · '.($row->readiness_band ?: 'Readiness recorded'),
                        'occurredAt' => CarbonImmutable::parse($row->finalized_at)->toIso8601String(),
                        'href' => $this->workspaceHref('admin.succession.index', 'Readiness Reviews'),
                    ]);
                });
        }

        return $activities
            ->filter(fn (array $activity): bool => filled($activity['occurredAt'] ?? null))
            ->sortByDesc(fn (array $activity): int => CarbonImmutable::parse($activity['occurredAt'])->timestamp)
            ->take(8)
            ->values()
            ->all();
    }

    private function workspaceHref(string $routeName, ?string $workspace = null): string
    {
        $href = route($routeName);

        return $workspace ? $href.'#'.rawurlencode($workspace) : $href;
    }

    /** @return Collection<int, object> */
    private function finalizedPerformanceRows(): Collection
    {
        if ($this->finalizedPerformanceRowsMemo !== null) {
            return $this->finalizedPerformanceRowsMemo;
        }

        if (! SchemaPresence::hasTable('performance_reviews') || ! SchemaPresence::hasTable('performance_review_assignments')) {
            return $this->finalizedPerformanceRowsMemo = collect();
        }

        return $this->finalizedPerformanceRowsMemo = DB::table('performance_reviews as reviews')
            ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
            ->join('users as people', 'people.id', '=', 'assignments.subject_user_id')
            ->whereNotNull('reviews.final_rating')
            ->whereNotNull('reviews.finalized_at')
            ->whereNotNull('people.personnel_key')
            ->whereRaw("TRIM(people.personnel_key) <> ''")
            ->whereNull('people.archived_at')
            ->where(function ($query): void {
                $query->whereNull('people.employment_status')
                    ->orWhere('people.employment_status', '!=', 'Inactive');
            })
            ->select([
                'reviews.id',
                'reviews.final_rating',
                'reviews.finalized_at',
                'assignments.subject_user_id',
                'people.name as subject_name',
            ])
            ->orderBy('reviews.finalized_at')
            ->get();
    }

    /**
     * @param Collection<int, object> $rows
     * @return array<int, array{date:string,month:string,score:float,count:int}>
     */
    private function performanceSeries(Collection $rows): array
    {
        return $rows
            ->groupBy(function (object $row): string {
                return CarbonImmutable::parse($row->finalized_at)->format('Y-m');
            })
            ->map(function (Collection $monthRows, string $month): array {
                $date = CarbonImmutable::createFromFormat('Y-m-d', $month.'-01')->endOfMonth();

                return [
                    'date' => $date->toDateString(),
                    'month' => $date->format('M Y'),
                    'score' => round((float) $monthRows->avg('final_rating'), 2),
                    'count' => $monthRows->count(),
                ];
            })
            ->values()
            ->all();
    }

    /** @return array<int, array{id:string,date:string,status:string}> */
    private function trainingEnrollmentRows(): array
    {
        if (! SchemaPresence::hasTable('training_enrollments')) {
            return [];
        }

        return DB::table('training_enrollments as enrollments')
            ->join('users as people', 'people.id', '=', 'enrollments.participant_id')
            ->whereNotNull('people.personnel_key')
            ->whereRaw("TRIM(people.personnel_key) <> ''")
            ->select(['enrollments.id', 'enrollments.assigned_at', 'enrollments.status'])
            ->orderBy('enrollments.assigned_at')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (string) $row->id,
                'date' => CarbonImmutable::parse($row->assigned_at)->toDateString(),
                'status' => (string) $row->status,
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function recentActivities(): array
    {
        $activities = collect();

        User::query()->activePersonnel()
            ->latest('created_at')
            ->limit(4)
            ->get(['id', 'name', 'person_type', 'created_at'])
            ->each(function (User $person) use ($activities): void {
                $activities->push([
                    'type' => 'person_created',
                    'title' => $person->person_type === 'Trainee' ? 'Trainee added' : 'Personnel added',
                    'subtitle' => $person->name,
                    'occurredAt' => $person->created_at?->toIso8601String(),
                    'route' => 'admin.users.index',
                    'params' => ['search' => $person->name],
                ]);
            });

        if (SchemaPresence::hasTable('learning_completions') && SchemaPresence::hasTable('learning_course_versions')) {
            DB::table('learning_completions as completions')
                ->join('users as people', 'people.id', '=', 'completions.learner_id')
                ->join('learning_course_versions as versions', 'versions.id', '=', 'completions.course_version_id')
                ->latest('completions.completed_at')
                ->limit(4)
                ->get(['people.name', 'versions.title', 'completions.completed_at'])
                ->each(function (object $row) use ($activities): void {
                    $activities->push([
                        'type' => 'learning_completed',
                        'title' => 'Learning completed',
                        'subtitle' => $row->name.' · '.$row->title,
                        'occurredAt' => CarbonImmutable::parse($row->completed_at)->toIso8601String(),
                        'route' => 'admin.learning.index',
                        'params' => ['search' => $row->name],
                    ]);
                });
        }

        if (SchemaPresence::hasTable('training_completions') && SchemaPresence::hasTable('training_enrollments') && SchemaPresence::hasTable('training_programs')) {
            DB::table('training_completions as completions')
                ->join('training_enrollments as enrollments', 'enrollments.id', '=', 'completions.enrollment_id')
                ->join('training_programs as programs', 'programs.id', '=', 'enrollments.program_id')
                ->join('users as people', 'people.id', '=', 'enrollments.participant_id')
                ->latest('completions.finalized_at')
                ->limit(4)
                ->get(['people.name', 'programs.title', 'completions.status', 'completions.finalized_at'])
                ->each(function (object $row) use ($activities): void {
                    $activities->push([
                        'type' => 'training_completed',
                        'title' => $row->status === 'Passed' ? 'Training completed' : 'Training finalized',
                        'subtitle' => $row->name.' · '.$row->title,
                        'occurredAt' => CarbonImmutable::parse($row->finalized_at)->toIso8601String(),
                        'route' => 'admin.training.index',
                        'params' => ['search' => $row->name],
                    ]);
                });
        }

        $this->finalizedPerformanceRows()
            ->sortByDesc('finalized_at')
            ->take(4)
            ->each(function (object $row) use ($activities): void {
                $activities->push([
                    'type' => 'performance_finalized',
                    'title' => 'Performance review finalized',
                    'subtitle' => $row->subject_name.' · '.number_format((float) $row->final_rating, 2).'/5',
                    'occurredAt' => CarbonImmutable::parse($row->finalized_at)->toIso8601String(),
                    'route' => 'admin.performance.index',
                    'params' => ['search' => $row->subject_name],
                ]);
            });

        if (SchemaPresence::hasTable('recognition_records')) {
            DB::table('recognition_records as records')
                ->leftJoin('users as people', 'people.id', '=', 'records.recipient_id')
                ->where('records.status', 'Recognized')
                ->whereNotNull('records.recognized_at')
                ->latest('records.recognized_at')
                ->limit(4)
                ->get(['people.name', 'records.title', 'records.recognized_at'])
                ->each(function (object $row) use ($activities): void {
                    $activities->push([
                        'type' => 'recognition_given',
                        'title' => 'Recognition published',
                        'subtitle' => trim(((string) ($row->name ?? 'Former personnel')).' · '.$row->title),
                        'occurredAt' => CarbonImmutable::parse($row->recognized_at)->toIso8601String(),
                        'route' => 'admin.recognition.index',
                        'params' => ['search' => (string) ($row->name ?? $row->title)],
                    ]);
                });
        }

        return $activities
            ->filter(fn (array $activity): bool => filled($activity['occurredAt'] ?? null))
            ->sortByDesc(fn (array $activity): int => CarbonImmutable::parse($activity['occurredAt'])->timestamp)
            ->take(6)
            ->values()
            ->all();
    }


    /** @return array<string, mixed> */
    private function hrDashboardState(User $actor): array
    {
        // HR uses the same persisted operational command-center metrics as Admin,
        // but all drill-down links stay inside the HR-owned routes and security-only
        // administration is excluded from the HR workload.
        $state = $this->adminDashboardState($actor, forHr: true);

        $state['needsAttention'] = collect($state['needsAttention'])
            ->reject(fn (array $item): bool => ($item['module'] ?? null) === 'Security')
            ->map(fn (array $item): array => array_merge($item, [
                'href' => $this->hrOwnedHref((string) ($item['href'] ?? '')),
            ]))
            ->values()
            ->all();

        $state['upcoming'] = collect($state['upcoming'])
            ->map(fn (array $item): array => array_merge($item, [
                'href' => $this->hrOwnedHref((string) ($item['href'] ?? '')),
            ]))
            ->values()
            ->all();

        $state['recentActivities'] = collect($state['recentActivities'])
            ->map(fn (array $item): array => array_merge($item, [
                'href' => $this->hrOwnedHref((string) ($item['href'] ?? '')),
            ]))
            ->values()
            ->all();


        return $state;
    }

    private function hrOwnedHref(string $href): string
    {
        if ($href === '') {
            return route('hr.dashboard');
        }

        return str_replace('/admin/', '/hr/', $href);
    }

    /** @return array<string, mixed> */
    private function userDashboardState(User $user): array
    {
        $activeLearning = 0;
        $completedLearning = 0;
        $learningDue = [];
        if (SchemaPresence::hasTable('learning_assignments') && SchemaPresence::hasTable('learning_course_versions')) {
            $assignmentBase = DB::table('learning_assignments as assignments')
                ->join('learning_course_versions as versions', 'versions.id', '=', 'assignments.course_version_id')
                ->where('assignments.learner_id', $user->id);
            $assignmentStats = (clone $assignmentBase)
                ->selectRaw(<<<'SQL'
                    SUM(CASE WHEN assignments.status NOT IN ('Completed', 'Cancelled', 'Expired') THEN 1 ELSE 0 END) AS active_learning,
                    SUM(CASE WHEN assignments.status = 'Completed' THEN 1 ELSE 0 END) AS completed_learning
                SQL)
                ->first();
            $activeLearning = (int) ($assignmentStats->active_learning ?? 0);
            $completedLearning = (int) ($assignmentStats->completed_learning ?? 0);
            $learningDue = (clone $assignmentBase)
                ->whereNotIn('assignments.status', ['Completed', 'Cancelled', 'Expired'])
                ->orderByRaw('CASE WHEN assignments.due_at IS NULL THEN 1 ELSE 0 END')
                ->orderBy('assignments.due_at')
                ->limit(5)
                ->get(['assignments.id', 'assignments.status', 'assignments.progress_percent', 'assignments.due_at', 'versions.title'])
                ->map(fn (object $row): array => [
                    'id' => (string) $row->id,
                    'title' => (string) $row->title,
                    'status' => (string) $row->status,
                    'progress' => (int) $row->progress_percent,
                    'dueAt' => $row->due_at ? CarbonImmutable::parse($row->due_at)->toIso8601String() : null,
                ])->all();
        }

        $upcomingTrainingRows = [];
        if (SchemaPresence::hasTable('training_sessions') && SchemaPresence::hasTable('training_session_participants') && SchemaPresence::hasTable('training_enrollments') && SchemaPresence::hasTable('training_programs')) {
            $upcomingTrainingRows = DB::table('training_sessions as sessions')
                ->join('training_session_participants as participants', 'participants.session_id', '=', 'sessions.id')
                ->join('training_enrollments as enrollments', 'enrollments.id', '=', 'participants.enrollment_id')
                ->join('training_programs as programs', 'programs.id', '=', 'sessions.program_id')
                ->where('enrollments.participant_id', $user->id)
                ->where('sessions.starts_at', '>=', now())
                ->whereNotIn('sessions.status', ['Cancelled', 'Completed'])
                ->orderBy('sessions.starts_at')->limit(5)
                ->get(['sessions.id', 'sessions.label', 'sessions.starts_at', 'sessions.venue', 'programs.title'])
                ->map(fn (object $row): array => [
                    'id' => (string) $row->id,
                    'title' => (string) $row->title,
                    'sessionLabel' => (string) $row->label,
                    'startsAt' => CarbonImmutable::parse($row->starts_at)->toIso8601String(),
                    'venue' => (string) $row->venue,
                ])->all();
        }

        $latestPerformance = null;
        if (SchemaPresence::hasTable('performance_reviews') && SchemaPresence::hasTable('performance_review_assignments')) {
            $latest = DB::table('performance_reviews as reviews')
                ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                ->where('assignments.subject_user_id', $user->id)
                ->whereNotNull('reviews.finalized_at')->whereNotNull('reviews.final_rating')
                ->orderByDesc('reviews.finalized_at')
                ->first(['reviews.final_rating', 'reviews.finalized_at']);
            if ($latest) {
                $latestPerformance = [
                    'rating' => round((float) $latest->final_rating, 2),
                    'finalizedAt' => CarbonImmutable::parse($latest->finalized_at)->toIso8601String(),
                ];
            }
        }

        $recognitions = SchemaPresence::hasTable('recognition_records')
            ? DB::table('recognition_records')->where('recipient_id', $user->id)->where('status', 'Recognized')->count()
            : 0;

        return [
            'stats' => [
                'activeLearning' => $activeLearning,
                'completedLearning' => $completedLearning,
                'upcomingTraining' => count($upcomingTrainingRows),
                'recognitions' => $recognitions,
                'latestPerformance' => $latestPerformance,
            ],
            'learningDue' => $learningDue,
            'upcomingTrainings' => $upcomingTrainingRows,
        ];
    }


    /** @return array<string, mixed> */
    private function userTeamState(User $user, UserPersona $persona): array
    {
        if (! in_array($persona, [UserPersona::Supervisor, UserPersona::Manager], true)) {
            return [
                'directReports' => 0,
                'activeReviews' => 0,
            ];
        }

        $directReports = User::query()->activePersonnel()->where('manager_id', $user->id)->count();

        $activeReviews = 0;
        if (SchemaPresence::hasTable('performance_review_assignments')) {
            $activeReviews = DB::table('performance_review_assignments')
                ->where('evaluator_user_id', $user->id)
                ->where('active', true)
                ->count();
        }

        return [
            'directReports' => $directReports,
            'activeReviews' => $activeReviews,
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function recentActivitiesForRouteRole(string $role): array
    {
        return collect($this->recentActivities())->map(function (array $activity) use ($role): array {
            $activity['route'] = match ($activity['route'] ?? '') {
                'admin.learning.index' => $role.'.learning.index',
                'admin.training.index' => $role.'.training.index',
                'admin.performance.index' => $role.'.performance.index',
                'admin.recognition.index' => $role.'.recognition.index',
                'admin.users.index' => $role === 'admin' ? 'admin.users.index' : null,
                default => $activity['route'] ?? null,
            };
            return $activity;
        })->filter(fn (array $activity): bool => filled($activity['route'] ?? null))->values()->all();
    }

    /** @return array<int, array{department:string,count:int}> */
    private function workforceByDepartment(bool $excludeAdmins = false): array
    {
        return User::query()->activePersonnel()
            ->when($excludeAdmins, fn ($query) => $query->where('role', '!=', UserRole::Admin->value))
            ->whereNotNull('department')
            ->whereRaw("TRIM(department) <> ''")
            ->select('department', DB::raw('COUNT(*) as aggregate'))
            ->groupBy('department')
            ->orderByDesc('aggregate')
            ->orderBy('department')
            ->get()
            ->map(fn (User $row): array => [
                'department' => (string) $row->department,
                'count' => (int) $row->aggregate,
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function traineeRows(): array
    {
        $trainees = User::query()->activePersonnel()
            ->where('person_type', 'Trainee')
            ->orderBy('name')
            ->get();

        if ($trainees->isEmpty()) {
            return [];
        }

        $ratings = collect();
        if (SchemaPresence::hasTable('performance_reviews') && SchemaPresence::hasTable('performance_review_assignments')) {
            $ratings = DB::table('performance_reviews as reviews')
                ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                ->whereIn('assignments.subject_user_id', $trainees->pluck('id'))
                ->whereNotNull('reviews.final_rating')
                ->whereNotNull('reviews.finalized_at')
                ->orderByDesc('reviews.finalized_at')
                ->get(['assignments.subject_user_id', 'reviews.final_rating', 'reviews.finalized_at'])
                ->groupBy('subject_user_id')
                ->map(fn (Collection $rows): object => $rows->first());
        }

        $lastLogins = collect();
        if (SchemaPresence::hasTable('security_audit_events')) {
            $lastLogins = DB::table('security_audit_events')
                ->whereIn('user_id', $trainees->pluck('id'))
                ->where('event_type', 'LOGIN_SUCCESS')
                ->orderByDesc('occurred_at')
                ->get(['user_id', 'occurred_at'])
                ->groupBy('user_id')
                ->map(fn (Collection $rows): string => CarbonImmutable::parse($rows->first()->occurred_at)->toIso8601String());
        }

        return $trainees->map(function (User $person) use ($ratings, $lastLogins): array {
            $rating = $ratings->get($person->id);

            return [
                'id' => $person->id,
                'name' => $person->name,
                'employeeId' => $person->employee_or_trainee_id ?: '—',
                'email' => $person->email,
                'position' => $person->position ?: '—',
                'department' => $person->department ?: '—',
                'personType' => $person->person_type ?: 'Trainee',
                'status' => 'Active',
                'dateCreated' => $person->created_at?->toIso8601String(),
                'lastLogin' => $lastLogins->get($person->id),
                'latestPerformance' => $rating ? round((float) $rating->final_rating, 2) : null,
                'performanceFinalizedAt' => $rating ? CarbonImmutable::parse($rating->finalized_at)->toIso8601String() : null,
            ];
        })->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function upcomingTrainingRows(): array
    {
        if (! SchemaPresence::hasTable('training_sessions') || ! SchemaPresence::hasTable('training_programs')) {
            return [];
        }

        $participantCounts = SchemaPresence::hasTable('training_session_participants')
            ? DB::table('training_session_participants')
                ->select('session_id', DB::raw('COUNT(*) as aggregate'))
                ->groupBy('session_id')
                ->pluck('aggregate', 'session_id')
            : collect();

        return DB::table('training_sessions as sessions')
            ->join('training_programs as programs', 'programs.id', '=', 'sessions.program_id')
            ->where('sessions.starts_at', '>=', now())
            ->whereNotIn('sessions.status', ['Cancelled', 'Completed'])
            ->where('programs.status', 'Active')
            ->orderBy('sessions.starts_at')
            ->limit(5)
            ->get([
                'sessions.id',
                'sessions.program_id',
                'sessions.label',
                'sessions.starts_at',
                'sessions.ends_at',
                'sessions.venue',
                'sessions.capacity',
                'sessions.status',
                'programs.code as program_code',
                'programs.title as program_title',
            ])
            ->map(function (object $row) use ($participantCounts): array {
                return [
                    'id' => (string) $row->id,
                    'programId' => (string) $row->program_id,
                    'programCode' => (string) $row->program_code,
                    'title' => (string) $row->program_title,
                    'sessionLabel' => (string) $row->label,
                    'startsAt' => CarbonImmutable::parse($row->starts_at)->toIso8601String(),
                    'endsAt' => CarbonImmutable::parse($row->ends_at)->toIso8601String(),
                    'venue' => (string) $row->venue,
                    'status' => (string) $row->status,
                    'participants' => (int) ($participantCounts->get($row->id) ?? 0),
                    'capacity' => (int) $row->capacity,
                ];
            })
            ->all();
    }
}
