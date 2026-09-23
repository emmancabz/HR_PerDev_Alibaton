<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\CanonicalLearningReference;
use App\Support\CanonicalWorkforceReference;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use App\Support\SchemaPresence as Schema;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementPageController extends Controller
{
    public function __construct(
        private readonly CanonicalWorkforceReference $workforceReference,
        private readonly CanonicalLearningReference $learningReference,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()?->role === UserRole::Admin, 403);

        // User Management is a P&D personnel/account directory. Governance-only accounts,
        // anonymized identities, and archived records are intentionally excluded here.
        // Archived personnel are governed in Settings > Archive.
        $personnel = User::query()
            ->canonicalPersonnel()
            ->with('manager:id,personnel_key,name,position,department')
            ->whereNull('anonymized_at')
            ->whereNull('archived_at')
            ->orderBy('name')
            ->get();

        $directoryUsers = $personnel
            ->reject(fn (User $user): bool => $user->employment_status === 'Incoming')
            ->values();

        $lastLogins = $this->lastLoginMap();
        $failedSignIns = $this->failedSignInMap();
        $activity = $this->activityMap();
        $development = $this->developmentMap($directoryUsers);

        return Inertia::render('UserManagement', [
            'initialUserDirectoryState' => [
                'users' => $directoryUsers->map(fn (User $user): array => $this->userRow(
                    $user,
                    $lastLogins->get($user->id),
                    (int) ($failedSignIns->get($user->id) ?? 0),
                    $activity->get($user->id, collect()),
                    $development->get($user->id, $this->emptyDevelopment($user)),
                    $this->workforceReference->person($user->personnel_key),
                ))->values()->all(),
                'incomingRecords' => $this->incomingRows($personnel),
                'issues' => $this->issueRows(),
                'pendingVerifications' => [],
            ],
            // Until Core HR / HR1 is actually integrated, User Management must not invent
            // invite candidates or claim a successful external sync.
            'availablePersonnel' => [],
            'userDirectorySource' => [
                'label' => 'Persistent P&D personnel directory',
                'personnelSource' => 'Canonical users table + approved workforce reference',
                'incomingSourceConnected' => false,
            ],
        ]);
    }

    private function userRow(
        User $user,
        mixed $lastLogin,
        int $failedSignInCount,
        Collection $events,
        array $development,
        ?array $reference,
    ): array {
        $accessStatus = (string) ($user->pnd_access_status ?: 'Active');
        $accountStatus = $accessStatus === 'Suspended'
            ? 'Suspended'
            : (($accessStatus === 'Inactive' || $user->employment_status === 'Inactive')
                ? 'Inactive'
                : ($user->email_verified_at ? 'Active' : 'Pending Activation'));

        $managerName = $user->manager?->name ?: ($reference['direct_manager'] ?? null);
        $managerPosition = $user->manager?->position;
        if (! $managerPosition && $managerName) {
            $managerReference = collect($this->workforceReference->allPeople())->firstWhere('name', $managerName);
            $managerPosition = is_array($managerReference) ? ($managerReference['position'] ?? null) : null;
        }

        $activityRows = $events->map(fn (object $event): array => [
            'id' => (string) $event->id,
            'label' => $this->eventLabel((string) $event->event_type),
            'detail' => $this->eventDetail($event),
            'occurredAt' => CarbonImmutable::parse($event->occurred_at)->format('M j, Y g:i A'),
        ])->values();

        if ($user->pnd_access_changed_at) {
            $activityRows->prepend([
                'id' => 'access-'.$user->id.'-'.$user->pnd_access_changed_at->timestamp,
                'label' => match ((string) ($user->pnd_access_status ?: 'Active')) {
                    'Suspended' => 'P&D access suspended',
                    'Inactive' => 'P&D access deactivated',
                    default => 'P&D access restored',
                },
                'detail' => collect([
                    $user->pnd_access_reason,
                    $user->pnd_access_reference ? 'Reference: '.$user->pnd_access_reference : null,
                    $user->pnd_access_authorized_by ? 'Authorized by: '.$user->pnd_access_authorized_by : null,
                ])->filter()->implode(' · '),
                'occurredAt' => $user->pnd_access_changed_at->format('M j, Y g:i A'),
            ]);
        }

        if ($activityRows->isEmpty()) {
            $activityRows->push([
                'id' => 'created-'.$user->id,
                'label' => 'Account record created',
                'detail' => 'Persistent P&D personnel account created.',
                'occurredAt' => $user->created_at?->format('M j, Y g:i A') ?? 'Date unavailable',
            ]);
        }

        return [
            'id' => (string) $user->personnel_key,
            'databaseId' => $user->id,
            'corePersonId' => $user->core_person_id ?: '—',
            'employeeOrTraineeId' => $user->employee_or_trainee_id ?: '—',
            'fullName' => $user->name,
            'email' => $user->email,
            'position' => $user->position ?: ($reference['position'] ?? 'Not recorded'),
            'department' => $user->department ?: ($reference['department'] ?? 'Not recorded'),
            'accessRole' => $user->role->label(),
            'personType' => $user->person_type === 'Trainee' ? 'Trainee' : 'Employee',
            'employmentStatus' => $reference['employment_stage'] ?? ($user->employment_status ?: 'Active Employee'),
            'accountStatus' => $accountStatus,
            'activationStatus' => $user->email_verified_at ? 'Activated' : 'Invitation Pending',
            'authenticationStatus' => match ($accountStatus) {
                'Suspended', 'Inactive' => 'Restricted',
                'Pending Activation' => 'Pending Setup',
                default => 'Enabled',
            },
            'createdAt' => $user->created_at?->format('M j, Y') ?? 'Date unavailable',
            'lastLogin' => $lastLogin
                ? CarbonImmutable::parse($lastLogin)->format('M j, Y g:i A')
                : 'No recorded sign-in',
            'failedSignInCount' => $failedSignInCount,
            'mfaStatus' => $user->mfa_enabled_at ? 'Enabled' : 'Not Enrolled',
            'mfaMethod' => $this->mfaMethodLabel($user),
            'directManagerName' => $managerName ?: 'No direct supervisor recorded',
            'directManagerPosition' => $managerPosition,
            'evaluatorCapable' => (bool) $user->evaluator_capable,
            'accessChangedAt' => $user->pnd_access_changed_at?->format('M j, Y g:i A'),
            'accessReason' => $user->pnd_access_reason,
            'accessReference' => $user->pnd_access_reference,
            'accessAuthorizedBy' => $user->pnd_access_authorized_by,
            'career' => [
                'personClass' => $reference['person_class'] ?? null,
                'developmentStatus' => $reference['development_status'] ?? null,
                'promotionTrack' => $reference['promotion_track'] ?? null,
                'successionRole' => $reference['succession_role'] ?? null,
                'readiness' => $reference['readiness'] ?? null,
                'careerNote' => $reference['career_note'] ?? null,
            ],
            'development' => $development,
            'activity' => $activityRows->take(12)->all(),
            'communications' => [],
        ];
    }

    private function mfaMethodLabel(User $user): string
    {
        if (! $user->mfa_enabled_at) return 'Not configured';

        return match ((string) $user->mfa_default_method) {
            'email_number_match' => 'Email Number Match',
            'totp' => 'Authenticator App (TOTP)',
            'trusted_device' => 'Trusted Device',
            default => $user->hasTotp() ? 'Authenticator App (TOTP)' : 'Email Number Match',
        };
    }

    private function lastLoginMap(): Collection
    {
        if (! Schema::hasTable('security_audit_events')) return collect();

        return DB::table('security_audit_events')
            ->where('event_type', 'LOGIN_SUCCESS')
            ->whereNotNull('user_id')
            ->selectRaw('user_id, MAX(occurred_at) AS last_login')
            ->groupBy('user_id')
            ->pluck('last_login', 'user_id');
    }

    private function failedSignInMap(): Collection
    {
        if (! Schema::hasTable('security_audit_events')) return collect();

        return DB::table('security_audit_events')
            ->where('event_type', 'LOGIN_FAILED')
            ->where('occurred_at', '>=', now()->subDays(30))
            ->whereNotNull('user_id')
            ->selectRaw('user_id, COUNT(*) AS failed_count')
            ->groupBy('user_id')
            ->pluck('failed_count', 'user_id');
    }

    private function activityMap(): Collection
    {
        if (! Schema::hasTable('security_audit_events')) return collect();

        $lifecycleEvents = [
            'ACCOUNT_ACCESS_SUSPENDED',
            'ACCOUNT_ACCESS_DEACTIVATED',
            'ACCOUNT_ACCESS_RESTORED',
            'ACCOUNT_ACCESS_LINK_SENT',
            'ACCOUNT_ROLE_CHANGED',
            'ACCOUNT_ARCHIVED',
            'ACCOUNT_RESTORED',
            'PROFILE_UPDATED',
            'PROFILE_PHOTO_UPDATED',
            'PROFILE_PHOTO_REMOVED',
        ];

        return DB::table('security_audit_events as events')
            ->leftJoin('users as actors', 'actors.id', '=', 'events.user_id')
            ->whereIn('events.event_type', $lifecycleEvents)
            ->orderByDesc('events.occurred_at')
            ->get([
                'events.id', 'events.user_id', 'events.event_type', 'events.outcome', 'events.severity',
                'events.route_name', 'events.metadata', 'events.occurred_at', 'actors.name as actor_name',
            ])
            ->map(function (object $row): object {
                $metadata = is_string($row->metadata) ? json_decode($row->metadata, true) : (array) $row->metadata;
                $row->subject_user_id = isset($metadata['subject_user_id'])
                    ? (int) $metadata['subject_user_id']
                    : ($row->user_id ? (int) $row->user_id : null);
                return $row;
            })
            ->filter(fn (object $row): bool => (bool) $row->subject_user_id)
            ->groupBy('subject_user_id')
            ->map(fn (Collection $rows) => $rows->take(12));
    }

    private function eventLabel(string $eventType): string
    {
        return match ($eventType) {
            'ACCOUNT_ACCESS_SUSPENDED' => 'P&D access suspended',
            'ACCOUNT_ACCESS_DEACTIVATED' => 'P&D access deactivated',
            'ACCOUNT_ACCESS_RESTORED' => 'P&D access restored',
            'ACCOUNT_ACCESS_LINK_SENT' => 'Account access link sent',
            'ACCOUNT_ROLE_CHANGED' => 'P&D role changed',
            'ACCOUNT_ARCHIVED' => 'Account archived',
            'ACCOUNT_RESTORED' => 'Account restored',
            'PROFILE_UPDATED' => 'Profile updated',
            'PROFILE_PHOTO_UPDATED' => 'Profile photo updated',
            'PROFILE_PHOTO_REMOVED' => 'Profile photo removed',
            default => str($eventType)->replace('_', ' ')->title()->toString(),
        };
    }

    private function eventDetail(object $event): string
    {
        $parts = [];
        if ($event->actor_name) $parts[] = 'Performed by: '.$event->actor_name;
        if ($event->outcome && $event->outcome !== 'Success') $parts[] = 'Outcome: '.$event->outcome;
        if ($event->severity && $event->severity !== 'Info') $parts[] = 'Severity: '.$event->severity;
        return implode(' · ', $parts);
    }

    private function developmentMap(Collection $users): Collection
    {
        $ids = $users->pluck('id');
        $keys = $users->pluck('personnel_key')->filter();

        $performance = collect();
        if (Schema::hasTable('performance_reviews') && Schema::hasTable('performance_review_assignments')) {
            $performance = DB::table('performance_reviews as reviews')
                ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                ->whereIn('assignments.subject_user_id', $ids)
                ->whereNotNull('reviews.finalized_at')
                ->whereNotNull('reviews.final_rating')
                ->selectRaw('assignments.subject_user_id AS user_id, COUNT(*) AS total, AVG(reviews.final_rating) AS average_rating, MAX(reviews.finalized_at) AS latest_finalized_at')
                ->groupBy('assignments.subject_user_id')
                ->get()->keyBy('user_id');
        }

        $goals = collect();
        if (Schema::hasTable('performance_goals')) {
            $goals = DB::table('performance_goals')
                ->whereIn('user_id', $ids)
                ->whereNotIn('status', ['Completed', 'Cancelled'])
                ->selectRaw('user_id, COUNT(*) AS total')
                ->groupBy('user_id')->pluck('total', 'user_id');
        }

        $learning = collect();
        if (Schema::hasTable('learning_assignments')) {
            $learning = DB::table('learning_assignments')
                ->whereIn('learner_id', $ids)
                ->selectRaw("learner_id AS user_id, COUNT(*) AS total, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress, SUM(CASE WHEN status = 'Not Started' THEN 1 ELSE 0 END) AS not_started")
                ->groupBy('learner_id')->get()->keyBy('user_id');
        }

        $learningCertificates = collect();
        if (Schema::hasTable('learning_transcript_entries') && Schema::hasTable('learning_certificates')) {
            $learningCertificates = DB::table('learning_transcript_entries as transcript')
                ->join('learning_certificates as certificates', 'certificates.id', '=', 'transcript.certificate_id')
                ->whereIn('transcript.learner_id', $ids)
                ->where('certificates.status', '!=', 'Revoked')
                ->selectRaw('transcript.learner_id AS user_id, COUNT(*) AS total')
                ->groupBy('transcript.learner_id')->pluck('total', 'user_id');
        }

        $training = collect();
        if (Schema::hasTable('training_enrollments')) {
            $training = DB::table('training_enrollments')
                ->whereIn('participant_id', $ids)
                ->selectRaw("participant_id AS user_id, COUNT(*) AS total, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status NOT IN ('Completed','Withdrawn','Cancelled') THEN 1 ELSE 0 END) AS active")
                ->groupBy('participant_id')->get()->keyBy('user_id');
        }

        $trainingCertificates = collect();
        if (Schema::hasTable('training_completions') && Schema::hasTable('training_certificates') && Schema::hasTable('training_enrollments')) {
            $trainingCertificates = DB::table('training_certificates as certificates')
                ->join('training_completions as completions', 'completions.id', '=', 'certificates.completion_id')
                ->join('training_enrollments as enrollments', 'enrollments.id', '=', 'completions.enrollment_id')
                ->whereIn('enrollments.participant_id', $ids)
                ->where('certificates.status', '!=', 'Revoked')
                ->selectRaw('enrollments.participant_id AS user_id, COUNT(*) AS total')
                ->groupBy('enrollments.participant_id')->pluck('total', 'user_id');
        }

        $recognition = collect();
        if (Schema::hasTable('recognition_records')) {
            $recognition = DB::table('recognition_records')
                ->whereIn('recipient_id', $ids)
                ->where('status', 'Recognized')
                ->orderByDesc('recognized_at')
                ->get(['recipient_id', 'title', 'recognized_at'])
                ->groupBy('recipient_id');
        }

        $learningRecommendations = collect();
        if (Schema::hasTable('learning_requests')) {
            $learningRecommendations = DB::table('learning_requests')
                ->whereIn('personnel_key', $keys)
                ->orderByDesc('requested_at')
                ->get(['id', 'personnel_key', 'recommendation_title', 'recommendation_note', 'status'])
                ->groupBy('personnel_key');
        }

        $trainingRecommendations = collect();
        if (Schema::hasTable('training_recommendations')) {
            $trainingRecommendations = DB::table('training_recommendations')
                ->whereIn('personnel_key', $keys)
                ->orderByDesc('created_at')
                ->get(['id', 'personnel_key', 'development_need', 'reason', 'status'])
                ->groupBy('personnel_key');
        }

        return $users->mapWithKeys(function (User $user) use (
            $performance,
            $goals,
            $learning,
            $learningCertificates,
            $training,
            $trainingCertificates,
            $recognition,
            $learningRecommendations,
            $trainingRecommendations,
        ): array {
            $reference = $this->workforceReference->person($user->personnel_key) ?? [];
            $learningReference = is_array($reference['learning_snapshot'] ?? null) ? $reference['learning_snapshot'] : [];
            $canonicalLearning = $this->learningReference->person($user->personnel_key) ?? [];
            $canonicalAssignments = collect(is_array($canonicalLearning['assignments'] ?? null) ? $canonicalLearning['assignments'] : []);
            $currentCourse = $this->learningReference->currentCourse($user->personnel_key);
            $perf = $performance->get($user->id);
            $learn = $learning->get($user->id);
            $train = $training->get($user->id);
            $recognitions = collect($recognition->get($user->id, collect()));

            $recommendations = collect($learningRecommendations->get($user->personnel_key, collect()))
                ->map(fn (object $row): array => [
                    'id' => (string) $row->id,
                    'title' => (string) $row->recommendation_title,
                    'reason' => (string) $row->recommendation_note,
                    'targetModule' => 'learning',
                    'status' => $this->recommendationStatus((string) $row->status),
                    'source' => 'Learning Request',
                ])
                ->concat(collect($trainingRecommendations->get($user->personnel_key, collect()))->map(fn (object $row): array => [
                    'id' => (string) $row->id,
                    'title' => (string) $row->development_need,
                    'reason' => (string) $row->reason,
                    'targetModule' => 'training',
                    'status' => $this->recommendationStatus((string) $row->status),
                    'source' => 'Training Recommendation',
                ]))
                ->take(5)
                ->values()->all();

            // Canonical LMS V1 is the detailed Learning-history authority while the old Learning
            // seeder is being replaced. The workforce persona snapshot remains a safe count fallback.
            $hasCanonicalLearning = $canonicalAssignments->isNotEmpty();
            $hasLearningReference = $learningReference !== [];
            $learningCompleted = $hasCanonicalLearning
                ? $canonicalAssignments->where('status', 'Completed')->count()
                : ($hasLearningReference ? (int) ($learningReference['completed_courses'] ?? 0) : (int) ($learn->completed ?? 0));
            $learningInProgress = $hasCanonicalLearning
                ? $canonicalAssignments->where('status', 'In Progress')->count()
                : ($hasLearningReference ? (int) ($learningReference['in_progress_courses'] ?? 0) : (int) ($learn->in_progress ?? 0));
            $learningNotStarted = $hasCanonicalLearning
                ? $canonicalAssignments->where('status', 'Not Started')->count()
                : ($hasLearningReference ? (int) ($learningReference['not_started_courses'] ?? 0) : (int) ($learn->not_started ?? 0));
            $learningCertCount = $hasCanonicalLearning
                ? $canonicalAssignments->filter(fn (array $assignment): bool => is_array($assignment['certificate'] ?? null))->count()
                : ($hasLearningReference ? (int) ($learningReference['certificate_count'] ?? 0) : (int) ($learningCertificates->get($user->id) ?? 0));

            $successionRole = $reference['succession_role'] ?? null;
            $readiness = $reference['readiness'] ?? null;
            $promotionTrack = $reference['promotion_track'] ?? null;

            return [$user->id => [
                'performance' => [
                    'headline' => $perf ? round((float) $perf->average_rating, 2).' / 5' : 'No finalized review',
                    'detail' => $perf ? ((int) $perf->total).' finalized review'.(((int) $perf->total) === 1 ? '' : 's') : 'Performance evidence will appear after review finalization.',
                    'metric' => ((int) ($goals->get($user->id) ?? 0)).' active goal'.(((int) ($goals->get($user->id) ?? 0)) === 1 ? '' : 's'),
                ],
                'competencies' => [
                    'headline' => 'Competency profile',
                    'detail' => 'Open the governed Competency workspace for validated proficiency and gap evidence.',
                    'metric' => null,
                ],
                'learning' => [
                    'headline' => $learningCompleted.' completed · '.$learningInProgress.' in progress',
                    'detail' => $learningNotStarted.' not started',
                    'metric' => $learningCertCount.' certificate'.($learningCertCount === 1 ? '' : 's'),
                    'currentCourse' => $currentCourse,
                ],
                'training' => [
                    'headline' => $train ? ((int) $train->completed).' completed · '.((int) $train->active).' active' : 'No training record',
                    'detail' => $train ? ((int) $train->total).' total enrollment'.(((int) $train->total) === 1 ? '' : 's') : 'No persisted training enrollment is linked to this person yet.',
                    'metric' => ((int) ($trainingCertificates->get($user->id) ?? 0)).' certificate'.(((int) ($trainingCertificates->get($user->id) ?? 0)) === 1 ? '' : 's'),
                ],
                'recognition' => [
                    'headline' => $recognitions->count().' recognized record'.($recognitions->count() === 1 ? '' : 's'),
                    'detail' => $recognitions->first()?->title ?? 'No approved recognition recorded.',
                    'metric' => null,
                ],
                'succession' => [
                    'headline' => $successionRole ?: 'Not in succession pipeline',
                    'detail' => $readiness ?: ($promotionTrack ?: 'No active succession role'),
                    'metric' => $successionRole ? ($promotionTrack ?: 'Succession candidate') : null,
                ],
                'recommendations' => $recommendations,
            ]];
        });
    }

    private function recommendationStatus(string $status): string
    {
        return match (strtolower($status)) {
            'declined', 'dismissed', 'cancelled' => 'Dismissed',
            'pending', 'new' => 'Recommended',
            default => 'Under Review',
        };
    }

    private function emptyDevelopment(User $user): array
    {
        return [
            'performance' => ['headline' => 'No finalized review', 'detail' => 'No finalized performance evidence.', 'metric' => '0 active goals'],
            'competencies' => ['headline' => 'Competency profile', 'detail' => 'Open Competency for governed proficiency evidence.', 'metric' => null],
            'learning' => ['headline' => '0 completed · 0 in progress', 'detail' => '0 not started', 'metric' => '0 certificates', 'currentCourse' => null],
            'training' => ['headline' => 'No training record', 'detail' => 'No persisted training enrollment.', 'metric' => '0 certificates'],
            'recognition' => ['headline' => '0 recognized records', 'detail' => 'No approved recognition recorded.', 'metric' => null],
            'succession' => ['headline' => 'Not in succession pipeline', 'detail' => 'No active succession role', 'metric' => null],
            'recommendations' => [],
        ];
    }

    private function incomingRows(Collection $users): array
    {
        return $users
            ->filter(fn (User $user): bool => $user->employment_status === 'Incoming' && $user->hasPersonnelIdentity())
            ->map(fn (User $user): array => [
                'id' => 'incoming-'.$user->id,
                'corePersonId' => $user->core_person_id ?: '—',
                'employeeOrTraineeId' => $user->employee_or_trainee_id ?: '—',
                'fullName' => $user->name,
                'position' => $user->position ?: 'Not recorded',
                'department' => $user->department ?: 'Not recorded',
                'startDate' => 'Not recorded',
                'receivedOn' => $user->created_at?->format('M j, Y') ?? 'Date unavailable',
                'syncStatus' => 'Received',
                'sourceSystem' => 'Manual',
                'accountStatus' => $user->email_verified_at ? 'Active' : 'Pending Activation',
                'officialEmail' => $user->email,
                'linkedUserId' => $user->personnel_key,
                'note' => 'Incoming trainee record is stored in the canonical P&D personnel directory. External HR1 synchronization is not yet connected.',
            ])->values()->all();
    }

    private function issueRows(): array
    {
        if (! Schema::hasTable('security_audit_events')) return [];

        return DB::table('security_audit_events as events')
            ->leftJoin('users', 'users.id', '=', 'events.user_id')
            ->where('events.flagged', true)
            ->where('events.occurred_at', '>=', now()->subDays(30))
            ->orderByDesc('events.occurred_at')
            ->limit(30)
            ->get([
                'events.id', 'events.event_type', 'events.severity', 'events.occurred_at',
                'events.user_id', 'users.personnel_key', 'users.name', 'users.employee_or_trainee_id',
            ])
            ->filter(fn (object $row): bool => trim((string) ($row->personnel_key ?? '')) !== '')
            ->map(fn (object $row): array => [
                'id' => (string) $row->id,
                'issue' => $this->eventLabel((string) $row->event_type),
                'source' => 'System',
                'detectedOn' => CarbonImmutable::parse($row->occurred_at)->format('M j, Y g:i A'),
                'priority' => match ((string) $row->severity) {
                    'Critical', 'High' => 'High',
                    'Warning', 'Medium' => 'Medium',
                    default => 'Low',
                },
                'status' => 'Open',
                'userId' => (string) $row->personnel_key,
                'subjectName' => $row->name ?: 'Unresolved account',
                'subjectId' => $row->employee_or_trainee_id ?: '—',
            ])->values()->all();
    }
}
