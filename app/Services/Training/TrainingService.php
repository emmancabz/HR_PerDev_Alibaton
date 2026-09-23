<?php

namespace App\Services\Training;

use App\Contracts\Training\WorkforceAttendanceGateway;
use App\Enums\UserRole;
use App\Models\Training\TrainingAssessment;
use App\Models\Training\TrainingAttendanceRecord;
use App\Models\Training\TrainingCertificate;
use App\Models\Training\TrainingCompletion;
use App\Models\Training\TrainingEnrollment;
use App\Models\Training\TrainingFeedback;
use App\Models\Training\TrainingProgram;
use App\Models\Training\TrainingRecommendation;
use App\Models\Training\TrainingSession;
use App\Models\Training\TrainingSessionParticipant;
use App\Models\User;
use App\Services\Learning\LearningCatalogService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use App\Support\SchemaPresence as Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TrainingService
{
    public function __construct(
        private readonly WorkforceAttendanceGateway $workforce,
        private readonly LearningCatalogService $catalog,
        private readonly TrainingAuditService $audit,
    ) {}

    public function state(User $actor): array
    {
        $this->advanceScheduledSessions();
        $operator = $this->isOperator($actor);
        $facilitatedSessionIds = $operator
            ? collect()
            : TrainingSession::query()->where('facilitator_id', $actor->id)->pluck('id');
        $enrollmentScope = TrainingEnrollment::query();
        if (! $operator) {
            $enrollmentScope->where('participant_id', $actor->id);
        }

        $enrollments = $enrollmentScope->with(['participant', 'program', 'sessionParticipants.session.facilitator', 'sessionParticipants.attendance', 'assessment', 'completion.certificate'])
            ->orderByDesc('assigned_at')->get();
        $programIds = $operator
            ? null
            : $enrollments->pluck('program_id')->merge(
                TrainingSession::query()->whereIn('id', $facilitatedSessionIds)->pluck('program_id'),
            )->unique()->values();
        $programs = TrainingProgram::query()->with(['owner', 'competencies', 'sessions.facilitator'])
            ->when($programIds !== null, fn ($query) => $query->whereIn('id', $programIds))
            ->orderByDesc('updated_at')->get();
        $sessionIds = $programs->flatMap(fn (TrainingProgram $program) => $program->sessions->pluck('id'))->unique();
        $feedback = TrainingFeedback::query()
            ->whereIn('session_id', $sessionIds)
            ->when(! $operator, fn ($query) => $query->where('participant_id', $actor->id))
            ->get();
        $facilitation = $facilitatedSessionIds->isEmpty()
            ? collect()
            : TrainingEnrollment::query()
                ->whereHas('sessionParticipants', fn ($query) => $query->whereIn('session_id', $facilitatedSessionIds))
                ->with([
                    'participant', 'program',
                    'sessionParticipants' => fn ($query) => $query->whereIn('session_id', $facilitatedSessionIds),
                    'sessionParticipants.session.facilitator', 'sessionParticipants.attendance',
                    'assessment', 'completion.certificate',
                ])->orderByDesc('assigned_at')->get();

        return [
            'actor' => [
                'id' => $actor->id,
                'role' => $actor->role->value,
                'canManage' => $operator,
                'canFinalize' => in_array($actor->role, [UserRole::Admin, UserRole::HR], true),
                'canFacilitate' => $facilitatedSessionIds->isNotEmpty(),
            ],
            'integration' => [
                'workforceAttendance' => [
                    'status' => 'Not Connected',
                    'sourceSystem' => config('training.workforce_attendance.source_system'),
                    'contractVersion' => config('training.workforce_attendance.contract_version'),
                    'ownership' => 'Supporting workforce evidence only; finalization remains under authorized Training governance.',
                ],
                'ai' => ['enabled' => false, 'reason' => 'Groq/Aevyn is intentionally outside the finalized Training scope.'],
            ],
            'personnel' => $operator ? $this->personnel() : [],
            'catalog' => [
                'competencies' => $operator ? $this->catalog->competencies() : [],
                'roleProfiles' => $operator ? $this->catalog->roleProfiles() : [],
                'learningCourses' => $operator ? $this->publishedLearningCourses() : [],
            ],
            'programs' => $programs->map(fn (TrainingProgram $program) => $this->programPayload($program))->values()->all(),
            'enrollments' => $enrollments->map(fn (TrainingEnrollment $enrollment) => $this->enrollmentPayload($enrollment))->values()->all(),
            'facilitation' => $facilitation->map(fn (TrainingEnrollment $enrollment) => $this->enrollmentPayload($enrollment))->values()->all(),
            'feedback' => $feedback->map(fn (TrainingFeedback $row) => [
                'id' => $row->id,
                'sessionId' => $row->session_id,
                'participantId' => $row->participant_id,
                'contentRating' => $row->content_rating,
                'facilitatorRating' => $row->facilitator_rating,
                'relevanceRating' => $row->relevance_rating,
                'organizationRating' => $row->organization_rating,
                'overallSatisfaction' => $row->overall_satisfaction,
                'comments' => $row->comments,
                'submittedAt' => $row->submitted_at?->toIso8601String(),
            ])->values()->all(),
            'recommendations' => $operator ? TrainingRecommendation::query()->latest()->get()->map(fn (TrainingRecommendation $row) => $this->recommendationPayload($row, $programs))->all() : [],
        ];
    }

    public function createProgram(User $actor, array $data): TrainingProgram
    {
        $this->requireOperator($actor);
        $payload = $this->validatedProgramPayload($data);

        return DB::transaction(function () use ($actor, $data, $payload) {
            $program = TrainingProgram::query()->create(array_merge($payload, [
                'code' => $this->programCode($data['code'] ?? null),
                'status' => 'Draft',
                'owner_id' => $data['ownerId'] ?? $actor->id,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]));
            $this->syncCompetencies($program, $data['competencies'] ?? []);
            $this->audit->record($actor, 'ProgramCreated', 'TrainingProgram', $program->id, ['code' => $program->code]);

            return $program->fresh(['competencies']);
        });
    }

    public function updateProgram(User $actor, TrainingProgram $program, array $data): void
    {
        $this->requireOperator($actor);
        if ($program->status !== 'Draft') {
            throw ValidationException::withMessages(['program' => 'Only Draft programs can be edited. Archive and replace an active program instead of rewriting historical delivery rules.']);
        }
        $payload = $this->validatedProgramPayload($data);
        DB::transaction(function () use ($actor, $program, $data, $payload): void {
            $program->update(array_merge($payload, [
                'code' => $data['code'] ?: $program->code,
                'owner_id' => $data['ownerId'] ?? $program->owner_id,
                'updated_by' => $actor->id,
            ]));
            $this->syncCompetencies($program, $data['competencies'] ?? []);
            $this->audit->record($actor, 'ProgramUpdated', 'TrainingProgram', $program->id);
        });
    }

    public function transitionProgram(User $actor, TrainingProgram $program, string $action, ?string $reason = null): void
    {
        $this->requireOperator($actor);
        $allowed = [
            'activate' => ['from' => ['Draft'], 'to' => 'Active'],
            'archive' => ['from' => ['Active'], 'to' => 'Archived'],
            'cancel' => ['from' => ['Draft', 'Active'], 'to' => 'Cancelled'],
        ];
        $transition = $allowed[$action] ?? null;
        if (! $transition || ! in_array($program->status, $transition['from'], true)) {
            throw ValidationException::withMessages(['status' => "The {$action} transition is not allowed from {$program->status}."]);
        }
        if ($action === 'activate') {
            $audience = $program->audience_rules ?? [];
            if (collect(['personTypes', 'departments', 'positions', 'roleProfileIds'])->every(fn ($key) => empty($audience[$key] ?? []))) {
                throw ValidationException::withMessages(['audienceRules' => 'Choose at least one canonical audience scope before activation.']);
            }
        }
        if ($action === 'cancel' && trim((string) $reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A cancellation reason is required.']);
        }
        $program->update([
            'status' => $transition['to'],
            'updated_by' => $actor->id,
            'activated_at' => $action === 'activate' ? now() : $program->activated_at,
            'archived_at' => $action === 'archive' ? now() : $program->archived_at,
            'cancelled_at' => $action === 'cancel' ? now() : $program->cancelled_at,
            'cancellation_reason' => $action === 'cancel' ? $reason : $program->cancellation_reason,
        ]);
        $this->audit->record($actor, 'Program'.Str::studly($action), 'TrainingProgram', $program->id, ['reason' => $reason]);
    }

    public function saveSession(User $actor, TrainingProgram $program, array $data, ?TrainingSession $session = null): TrainingSession
    {
        $this->requireOperator($actor);
        if ($program->status !== 'Active') {
            throw ValidationException::withMessages(['program' => 'Sessions can only be scheduled for an Active program.']);
        }
        if ($session && $session->program_id !== $program->id) {
            throw ValidationException::withMessages(['session' => 'The session does not belong to this program.']);
        }
        if ($session && in_array($session->status, ['Ongoing', 'Completed', 'Cancelled'], true)) {
            throw ValidationException::withMessages(['session' => 'This session is locked and cannot be edited.']);
        }
        $facilitatorId = $data['facilitatorId'] ?? null;
        $external = trim((string) ($data['externalFacilitatorName'] ?? '')) ?: null;
        if (! $facilitatorId && ! $external) {
            throw ValidationException::withMessages(['facilitatorId' => 'Choose an active internal facilitator or provide a verified external facilitator name.']);
        }
        if ($facilitatorId) {
            $facilitator = User::query()->activePersonnel()->find($facilitatorId);
            if (! $facilitator) {
                throw ValidationException::withMessages(['facilitatorId' => 'Choose an active canonical personnel record as facilitator.']);
            }
            $conflict = TrainingSession::query()->where('facilitator_id', $facilitatorId)
                ->whereIn('status', ['Scheduled', 'Ongoing'])
                ->when($session, fn ($query) => $query->whereKeyNot($session->id))
                ->where('starts_at', '<', $data['endsAt'])->where('ends_at', '>', $data['startsAt'])->exists();
            if ($conflict) {
                throw ValidationException::withMessages(['startsAt' => 'The facilitator already has an overlapping Training session.']);
            }
        }

        $payload = [
            'program_id' => $program->id,
            'label' => trim($data['label']),
            'starts_at' => $data['startsAt'],
            'ends_at' => $data['endsAt'],
            'venue' => trim($data['venue']),
            'capacity' => (int) $data['capacity'],
            'facilitator_id' => $facilitatorId,
            'external_facilitator_name' => $external,
            'enrollment_closes_at' => $data['enrollmentClosesAt'] ?? null,
            'status' => $data['status'] ?? 'Scheduled',
            'updated_by' => $actor->id,
        ];
        $saved = $session;
        if ($saved) {
            if ($saved->participants()->count() > $payload['capacity']) {
                throw ValidationException::withMessages(['capacity' => 'Capacity cannot be lower than the current participant count.']);
            }
            $saved->update($payload);
        } else {
            $saved = TrainingSession::query()->create(array_merge($payload, ['created_by' => $actor->id]));
        }
        $this->audit->record($actor, $session ? 'SessionUpdated' : 'SessionCreated', 'TrainingSession', $saved->id);

        return $saved->fresh(['facilitator']);
    }

    public function transitionSession(User $actor, TrainingSession $session, string $status, ?string $reason = null): void
    {
        $this->requireOperator($actor);
        $transitions = [
            'Draft' => ['Scheduled', 'Cancelled'],
            'Scheduled' => ['Ongoing', 'Cancelled'],
            'Ongoing' => ['Completed', 'Cancelled'],
        ];
        if (! in_array($status, $transitions[$session->status] ?? [], true)) {
            throw ValidationException::withMessages(['status' => "A {$session->status} session cannot move to {$status}."]);
        }
        if ($status === 'Cancelled' && trim((string) $reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A cancellation reason is required.']);
        }
        if ($status === 'Completed' && ! $session->attendance_finalized_at) {
            throw ValidationException::withMessages(['attendance' => 'Finalize session attendance before marking the session Completed.']);
        }
        $from = $session->status;
        DB::transaction(function () use ($actor, $session, $status, $reason, $from): void {
            $session->update([
                'status' => $status,
                'updated_by' => $actor->id,
                'cancelled_at' => $status === 'Cancelled' ? now() : null,
                'cancellation_reason' => $status === 'Cancelled' ? $reason : null,
            ]);

            if ($status === 'Cancelled') {
                $affectedEnrollmentIds = $session->participants()->pluck('enrollment_id');
                $session->participants()->whereNotIn('status', ['Withdrawn', 'Cancelled'])->update(['status' => 'Cancelled']);
                if ($affectedEnrollmentIds->isNotEmpty()) {
                    TrainingAssessment::query()->whereIn('enrollment_id', $affectedEnrollmentIds)->whereNull('finalized_at')->delete();
                }
                TrainingRecommendation::query()->where('linked_session_id', $session->id)->where('status', 'Accepted')->get()
                    ->each(function (TrainingRecommendation $recommendation) use ($actor, $reason): void {
                        $recommendation->update([
                            'status' => 'Pending',
                            'linked_session_id' => null,
                            'linked_enrollment_id' => null,
                            'action_reason' => 'Returned to scheduling after a cancelled Training session. '.$reason,
                            'acted_by' => $actor->id,
                            'acted_at' => now(),
                        ]);
                        $this->audit->record($actor, 'RecommendationReopened', 'TrainingRecommendation', $recommendation->id, ['reason' => $reason]);
                    });
            }

            $this->audit->record($actor, 'SessionStatusChanged', 'TrainingSession', $session->id, ['from' => $from, 'to' => $status, 'reason' => $reason]);
        });
    }

    public function enroll(User $actor, TrainingProgram $program, array $participantIds, array $sessionIds, string $source, ?string $reason = null): array
    {
        $this->requireOperator($actor);
        if ($program->status !== 'Active') {
            throw ValidationException::withMessages(['program' => 'Participants can only be assigned to an Active program.']);
        }
        $sessions = $program->sessions()->whereIn('id', $sessionIds)->whereIn('status', ['Draft', 'Scheduled'])->get();
        if ($sessions->count() !== count(array_unique($sessionIds))) {
            throw ValidationException::withMessages(['sessionIds' => 'Choose only assignable sessions from this program.']);
        }
        $participants = User::query()->activePersonnel()->whereIn('id', $participantIds)->where('role', '!=', UserRole::Admin->value)->get();
        if ($participants->count() !== count(array_unique($participantIds))) {
            throw ValidationException::withMessages(['participantIds' => 'Choose only active canonical learner personnel.']);
        }
        foreach ($participants as $participant) {
            if (! $this->matchesAudience($participant, $program->audience_rules ?? [])) {
                throw ValidationException::withMessages(['participantIds' => "{$participant->name} is outside the saved program audience."]);
            }
        }
        foreach ($sessions as $session) {
            $newCount = collect($participantIds)->reject(fn ($id) => TrainingEnrollment::query()->where('program_id', $program->id)->where('participant_id', $id)
                ->whereHas('sessionParticipants', fn ($query) => $query->where('session_id', $session->id)
                    ->whereNotIn('status', ['Withdrawn', 'Cancelled']))->exists())->count();
            $activeCount = $session->participants()->whereNotIn('status', ['Withdrawn', 'Cancelled'])->count();
            if ($activeCount + $newCount > $session->capacity) {
                throw ValidationException::withMessages(['participantIds' => "{$session->label} does not have enough available capacity."]);
            }
        }

        return DB::transaction(function () use ($actor, $program, $participants, $sessions, $source, $reason) {
            $ids = [];
            foreach ($participants as $participant) {
                $enrollment = TrainingEnrollment::query()
                    ->where('program_id', $program->id)
                    ->where('participant_id', $participant->id)
                    ->whereDoesntHave('completion')
                    ->latest('assigned_at')
                    ->first();
                if (! $enrollment) {
                    $enrollment = TrainingEnrollment::query()->create([
                        'program_id' => $program->id,
                        'participant_id' => $participant->id,
                        'source' => $source,
                        'status' => 'Assigned',
                        'personnel_snapshot' => $this->personnelSnapshot($participant),
                        'assigned_by' => $actor->id,
                        'assigned_at' => now(),
                    ]);
                }
                if (! $enrollment->wasRecentlyCreated && in_array($enrollment->status, ['Withdrawn', 'Cancelled'], true)) {
                    $enrollment->update([
                        'source' => $source,
                        'status' => 'Assigned',
                        'assigned_by' => $actor->id,
                        'assigned_at' => now(),
                        'confirmed_at' => null,
                        'withdrawn_at' => null,
                        'withdrawal_reason' => null,
                    ]);
                }
                foreach ($sessions as $session) {
                    $link = TrainingSessionParticipant::query()->firstOrCreate(
                        ['session_id' => $session->id, 'enrollment_id' => $enrollment->id],
                        ['status' => 'Assigned'],
                    );
                    if (! $link->wasRecentlyCreated && in_array($link->status, ['Withdrawn', 'Cancelled'], true)) {
                        $link->update(['status' => 'Assigned']);
                    }
                    TrainingAttendanceRecord::query()->firstOrCreate(
                        ['session_participant_id' => $link->id],
                        ['workforce_sync_status' => 'Not Connected', 'training_status' => 'Pending', 'recording_source' => 'Manual'],
                    );
                }
                $ids[] = $enrollment->id;
                $this->audit->record($actor, 'ParticipantAssigned', 'TrainingEnrollment', $enrollment->id, ['source' => $source, 'reason' => $reason]);
            }

            return $ids;
        });
    }

    public function scheduleRequirements(User $actor, array $data): void
    {
        $this->requireOperator($actor);
        $recommendationIds = collect($data['recommendationIds'] ?? [])->filter()->unique()->values();
        if ($recommendationIds->isEmpty()) {
            throw ValidationException::withMessages(['recommendationIds' => 'Choose at least one ready Training requirement.']);
        }

        $program = TrainingProgram::query()->with('competencies')->whereKey($data['programId'] ?? null)->where('status', 'Active')->first();
        if (! $program) {
            throw ValidationException::withMessages(['programId' => 'Choose an active governed Training definition.']);
        }
        if (! $program->related_learning_course_id && $program->competencies->isEmpty()) {
            throw ValidationException::withMessages(['programId' => 'This Training definition has no governed learning or competency basis. Resolve the definition before scheduling it.']);
        }

        $recommendations = TrainingRecommendation::query()
            ->whereIn('id', $recommendationIds)
            ->whereIn('status', ['Pending', 'Under Review'])
            ->get();
        if ($recommendations->count() !== $recommendationIds->count()) {
            throw ValidationException::withMessages(['recommendationIds' => 'One or more Training requirements are no longer available for scheduling. Refresh and try again.']);
        }

        $programs = TrainingProgram::query()->with('competencies')->where('status', 'Active')->get();
        $people = collect();
        foreach ($recommendations as $recommendation) {
            $person = User::query()->activePersonnel()->where('personnel_key', $recommendation->personnel_key)->first();
            if (! $person || $person->role === UserRole::Admin) {
                throw ValidationException::withMessages(['recommendationIds' => 'Every scheduled requirement must belong to active learner personnel.']);
            }
            $recommended = $this->recommendedProgramFor($recommendation, $programs);
            if ($recommended && $recommended->id !== $program->id) {
                throw ValidationException::withMessages(['programId' => "{$person->name}'s requirement is mapped to {$recommended->title}, not {$program->title}."]);
            }
            if (! $this->matchesAudience($person, $program->audience_rules ?? [])) {
                throw ValidationException::withMessages(['recommendationIds' => "{$person->name} is outside the governed audience for {$program->title}."]);
            }
            $prerequisite = $this->prerequisiteState($person, $program);
            if (! $prerequisite['complete']) {
                $label = $prerequisite['title'] ?: 'required learning';
                throw ValidationException::withMessages(['recommendationIds' => "{$person->name} is still waiting for {$label} before practical/facilitated Training can be scheduled."]);
            }
            $people->put($person->id, $person);
        }

        if ((int) ($data['capacity'] ?? 0) < $people->count()) {
            throw ValidationException::withMessages(['capacity' => 'Session capacity cannot be lower than the selected ready participants.']);
        }

        DB::transaction(function () use ($actor, $data, $program, $recommendations, $people): void {
            $startsAt = $data['startsAt'];
            $label = trim((string) ($data['label'] ?? ''));
            if ($label === '') {
                $baseLabel = 'Training Session '.\Carbon\CarbonImmutable::parse($startsAt, 'Asia/Manila')->format('M j, Y · H:i');
                $label = $baseLabel;
                $batch = 2;
                while ($program->sessions()->where('label', $label)->exists()) {
                    $label = $baseLabel.' · Batch '.$batch++;
                }
            }

            $session = $this->saveSession($actor, $program, [
                'label' => $label,
                'startsAt' => $data['startsAt'],
                'endsAt' => $data['endsAt'],
                'venue' => $data['venue'],
                'capacity' => (int) $data['capacity'],
                'facilitatorId' => $data['facilitatorId'] ?? null,
                'externalFacilitatorName' => $data['externalFacilitatorName'] ?? null,
                'enrollmentClosesAt' => $data['enrollmentClosesAt'] ?? null,
                'status' => 'Scheduled',
            ]);

            $sourceLabels = $recommendations->pluck('source_module')->unique();
            $enrollmentSource = $sourceLabels->count() === 1
                ? match ($sourceLabels->first()) {
                    'Competency' => 'Competency Recommendation',
                    'Performance' => 'Performance Development',
                    default => 'Development Requirement',
                }
                : 'Development Requirement';

            $this->enroll(
                $actor,
                $program,
                $people->keys()->map(fn ($id) => (int) $id)->all(),
                [$session->id],
                $enrollmentSource,
                'Scheduled from verified development requirements.',
            );

            foreach ($recommendations as $recommendation) {
                $person = $people->first(fn (User $row) => $row->personnel_key === $recommendation->personnel_key);
                $enrollment = $person
                    ? TrainingEnrollment::query()->where('program_id', $program->id)->where('participant_id', $person->id)
                        ->whereHas('sessionParticipants', fn ($query) => $query->where('session_id', $session->id))->latest('assigned_at')->first()
                    : null;
                $this->actRecommendation($actor, $recommendation, [
                    'action' => 'Accepted',
                    'programId' => $program->id,
                    'sessionId' => $session->id,
                    'enrollmentId' => $enrollment?->id,
                    'reason' => 'Scheduled into a governed Training session.',
                ]);
            }
        });
    }

    public function finalizeReadyParticipants(User $actor, TrainingSession $session): int
    {
        $this->requireTrainingFinalizer($actor);
        if ($session->status !== 'Completed') {
            throw ValidationException::withMessages(['session' => 'Ready participants can only be finalized after the Training session is Completed.']);
        }

        $enrollments = TrainingEnrollment::query()
            ->whereHas('sessionParticipants', fn ($query) => $query->where('session_id', $session->id)->whereNotIn('status', ['Withdrawn', 'Cancelled']))
            ->with(['program.competencies', 'participant', 'sessionParticipants.session', 'sessionParticipants.attendance', 'assessment', 'completion'])
            ->get();

        $finalized = 0;
        foreach ($enrollments as $enrollment) {
            if ($enrollment->completion) continue;
            $rules = $enrollment->program->completion_rules ?? [];
            $requiredSessions = $enrollment->sessionParticipants
                ->filter(fn ($link) => $link->session?->status !== 'Cancelled' && ! in_array($link->status, ['Withdrawn', 'Cancelled'], true));
            if ($requiredSessions->isEmpty()
                || $requiredSessions->contains(fn ($link) => $link->session?->status !== 'Completed' || ! $link->attendance?->finalized_at)) {
                continue;
            }
            $attended = $requiredSessions->filter(fn ($link) => in_array($link->attendance->training_status, ['Present', 'Late'], true))->count();
            $partial = $requiredSessions->where('attendance.training_status', 'Partial')->count();
            $attendanceRate = (($attended + ($partial * 0.5)) / $requiredSessions->count()) * 100;
            $threshold = (int) ($rules['attendanceThreshold'] ?? 100);
            $assessmentResult = $enrollment->assessment?->result;
            $decision = match (true) {
                $attendanceRate < $threshold => 'Incomplete',
                ($rules['assessmentRequired'] ?? false) && in_array($assessmentResult, ['Failed', 'Needs Improvement'], true) => 'Failed',
                ($rules['assessmentRequired'] ?? false) && $assessmentResult !== 'Passed' => null,
                default => 'Passed',
            };
            if (! $decision) continue;
            try {
                $note = match ($decision) {
                    'Passed' => 'Verified attendance and practical/facilitated outcome satisfied the governed completion rules.',
                    'Failed' => 'The practical/facilitated outcome requires retraining before this development requirement can be satisfied.',
                    default => 'The participant did not complete this session and remains eligible for governed rescheduling.',
                };
                $this->finalizeCompletion($actor, $enrollment, $decision, $note);
                $finalized++;
            } catch (ValidationException) {
                // Leave participants with incomplete evidence, absence, or failed requirements unresolved.
            }
        }

        return $finalized;
    }

    public function transitionEnrollment(User $actor, TrainingEnrollment $enrollment, string $status, ?string $reason = null): void
    {
        $enrollment->load('sessionParticipants.session');
        $isOwner = $enrollment->participant_id === $actor->id;
        if (! $this->isOperator($actor) && ! $isOwner) {
            throw new AuthorizationException('You may only update your own Training enrollment.');
        }
        $allowed = [
            'Assigned' => ['Confirmed', 'Withdrawn', 'Cancelled'],
            'Confirmed' => ['Withdrawn', 'Cancelled'],
        ];
        if (! in_array($status, $allowed[$enrollment->status] ?? [], true)) {
            throw ValidationException::withMessages(['status' => "A {$enrollment->status} enrollment cannot move to {$status}."]);
        }
        if ($status === 'Cancelled' && ! $this->isOperator($actor)) {
            throw new AuthorizationException('Only a Training operator may cancel an enrollment.');
        }
        if (in_array($status, ['Withdrawn', 'Cancelled'], true) && trim((string) $reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required to withdraw or cancel an enrollment.']);
        }
        if (in_array($status, ['Withdrawn', 'Cancelled'], true)
            && $enrollment->sessionParticipants->contains(fn ($link) => in_array($link->session?->status, ['Ongoing', 'Completed'], true))) {
            throw ValidationException::withMessages(['status' => 'An enrollment cannot be withdrawn or cancelled after an assigned session has started.']);
        }

        DB::transaction(function () use ($actor, $enrollment, $status, $reason): void {
            $enrollment->update([
                'status' => $status,
                'confirmed_at' => $status === 'Confirmed' ? now() : $enrollment->confirmed_at,
                'withdrawn_at' => in_array($status, ['Withdrawn', 'Cancelled'], true) ? now() : null,
                'withdrawal_reason' => in_array($status, ['Withdrawn', 'Cancelled'], true) ? $reason : null,
            ]);
            $enrollment->sessionParticipants()->update(['status' => $status]);
            $this->audit->record($actor, 'EnrollmentStatusChanged', 'TrainingEnrollment', $enrollment->id, [
                'status' => $status,
                'reason' => $reason,
            ]);
        });
    }

    public function syncWorkforceEvidence(User $actor, TrainingSession $session): void
    {
        $this->requireOperator($actor);
        $session->load('participants.enrollment.participant', 'participants.attendance');
        foreach ($session->participants as $link) {
            $evidence = $this->workforce->evidence($session, $link->enrollment->participant);
            $link->attendance()->updateOrCreate([], [
                'workforce_sync_status' => $evidence['status'],
                'workforce_external_id' => $evidence['externalId'],
                'workforce_snapshot' => $evidence['snapshot'],
                'workforce_sync_error' => $evidence['error'],
                'workforce_synced_at' => $evidence['status'] === 'Synced' ? now() : null,
            ]);
        }
        $this->audit->record($actor, 'WorkforceEvidenceSyncRequested', 'TrainingSession', $session->id, ['contractStatus' => 'Not Connected']);
    }

    public function recordAttendance(User $actor, TrainingAttendanceRecord $attendance, string $status, ?string $note = null): void
    {
        $attendance->load('sessionParticipant.session', 'sessionParticipant.enrollment');
        $this->requireDraftContributor($actor, $attendance->sessionParticipant->session);
        if ($attendance->finalized_at) {
            throw ValidationException::withMessages(['attendance' => 'Finalized attendance is locked.']);
        }
        if (in_array($attendance->sessionParticipant->enrollment->status, ['Withdrawn', 'Cancelled'], true)) {
            throw ValidationException::withMessages(['attendance' => 'Attendance cannot be recorded for a withdrawn or cancelled enrollment.']);
        }
        if ($status !== 'Pending' && trim((string) $note) === '' && $attendance->workforce_sync_status !== 'Synced') {
            throw ValidationException::withMessages(['note' => 'Add a note because HR 2 evidence is not connected or synced.']);
        }
        $attendance->update([
            'training_status' => $status,
            'recording_source' => $attendance->workforce_sync_status === 'Synced' ? 'Workforce Reference + Human Confirmation' : 'Manual',
            'note' => $note,
            'marked_by' => $actor->id,
            'marked_at' => now(),
            'lock_version' => $attendance->lock_version + 1,
        ]);
        $this->audit->record($actor, 'AttendanceMarked', 'TrainingAttendanceRecord', $attendance->id, ['status' => $status]);
    }

    public function finalizeAttendance(User $actor, TrainingSession $session): void
    {
        $this->requireTrainingFinalizer($actor);
        $session->load('participants.attendance');
        if ($session->status === 'Cancelled') {
            throw ValidationException::withMessages(['session' => 'Cancelled sessions do not have Training attendance.']);
        }
        if ($session->status !== 'Ongoing') {
            throw ValidationException::withMessages(['session' => 'Attendance may only be finalized while the Training session is Ongoing.']);
        }
        $participants = $session->participants->whereNotIn('status', ['Withdrawn', 'Cancelled']);
        if ($participants->isEmpty()) {
            throw ValidationException::withMessages(['attendance' => 'Assign at least one participant before finalization.']);
        }
        if ($participants->contains(fn ($link) => ! $link->attendance || $link->attendance->training_status === 'Pending')) {
            throw ValidationException::withMessages(['attendance' => 'Every participant must have a non-Pending Training attendance status.']);
        }
        DB::transaction(function () use ($actor, $session, $participants): void {
            foreach ($participants as $link) {
                $link->attendance->update(['finalized_by' => $actor->id, 'finalized_at' => now(), 'lock_version' => $link->attendance->lock_version + 1]);
                $link->update(['status' => in_array($link->attendance->training_status, ['Present', 'Late', 'Partial'], true) ? 'Attended' : 'Did Not Attend']);
            }
            $session->update(['attendance_finalized_by' => $actor->id, 'attendance_finalized_at' => now(), 'updated_by' => $actor->id]);
            $this->audit->record($actor, 'AttendanceFinalized', 'TrainingSession', $session->id);
        });
    }

    public function assess(User $actor, TrainingEnrollment $enrollment, array $data): void
    {
        $enrollment->load('program', 'sessionParticipants.session');
        $this->requireEnrollmentContributor($actor, $enrollment);
        if ($enrollment->completion) {
            throw ValidationException::withMessages(['assessment' => 'The finalized completion locks this assessment.']);
        }
        if (in_array($enrollment->status, ['Withdrawn', 'Cancelled'], true)) {
            throw ValidationException::withMessages(['assessment' => 'Withdrawn or cancelled enrollments cannot be assessed.']);
        }
        TrainingAssessment::query()->updateOrCreate(['enrollment_id' => $enrollment->id], [
            'result' => $data['result'],
            'score' => $data['score'] ?? null,
            'maximum_score' => $data['maximumScore'] ?? null,
            'checklist' => $data['checklist'] ?? [],
            'notes' => $data['notes'] ?? null,
            'assessed_by' => $actor->id,
            'assessed_at' => now(),
        ]);
        $this->audit->record($actor, 'AssessmentSaved', 'TrainingEnrollment', $enrollment->id, ['result' => $data['result']]);
    }

    public function finalizeCompletion(User $actor, TrainingEnrollment $enrollment, string $status, ?string $note = null): TrainingCompletion
    {
        $this->requireTrainingFinalizer($actor);
        $enrollment->load('program.competencies', 'participant', 'sessionParticipants.session', 'sessionParticipants.attendance', 'assessment', 'completion');
        if ($enrollment->completion) {
            throw ValidationException::withMessages(['completion' => 'Completion has already been finalized and is immutable.']);
        }
        if (in_array($enrollment->status, ['Withdrawn', 'Cancelled'], true)) {
            throw ValidationException::withMessages(['enrollment' => 'Withdrawn or cancelled enrollments cannot receive a completion decision.']);
        }
        $requiredSessions = $enrollment->sessionParticipants->where('session.status', '!=', 'Cancelled');
        if ($requiredSessions->isEmpty() || $requiredSessions->contains(fn ($link) => ! $link->attendance?->finalized_at)) {
            throw ValidationException::withMessages(['attendance' => 'All assigned non-cancelled sessions must have finalized attendance.']);
        }
        if ($requiredSessions->contains(fn ($link) => $link->session?->status !== 'Completed')) {
            throw ValidationException::withMessages(['session' => 'All assigned non-cancelled sessions must be marked Completed before the final completion decision.']);
        }
        $attended = $requiredSessions->filter(fn ($link) => in_array($link->attendance->training_status, ['Present', 'Late'], true))->count();
        $partial = $requiredSessions->where('attendance.training_status', 'Partial')->count();
        $rate = round((($attended + ($partial * 0.5)) / $requiredSessions->count()) * 100, 2);
        $rules = $enrollment->program->completion_rules ?? [];
        $threshold = (int) ($rules['attendanceThreshold'] ?? 100);
        if ($status === 'Passed' && $rate < $threshold) {
            throw ValidationException::withMessages(['status' => "Attendance is {$rate}%, below the required {$threshold}%."]);
        }
        if ($status === 'Passed' && ($rules['assessmentRequired'] ?? false) && (! $enrollment->assessment || $enrollment->assessment->result === 'Pending')) {
            throw ValidationException::withMessages(['assessment' => 'A participant assessment is required before completion.']);
        }
        if ($status === 'Passed' && ($rules['assessmentRequired'] ?? false) && $enrollment->assessment->result !== 'Passed') {
            throw ValidationException::withMessages(['status' => 'A participant cannot Pass while the required assessment is not Passed.']);
        }
        $passingScore = $rules['passingScore'] ?? null;
        if ($status === 'Passed' && $passingScore !== null) {
            if ($enrollment->assessment?->score === null || ! $enrollment->assessment?->maximum_score) {
                throw ValidationException::withMessages(['assessment' => 'A scored assessment is required by the saved passing-score rule.']);
            }
            $scoreRate = ((float) $enrollment->assessment->score / (float) $enrollment->assessment->maximum_score) * 100;
            if ($scoreRate < (float) $passingScore) {
                throw ValidationException::withMessages(['status' => "The assessment score is below the saved {$passingScore}% passing score."]);
            }
        }

        return DB::transaction(function () use ($actor, $enrollment, $status, $note, $rate, $requiredSessions, $rules) {
            if ($enrollment->assessment) {
                $enrollment->assessment->update(['finalized_by' => $actor->id, 'finalized_at' => now()]);
            }
            $completion = TrainingCompletion::query()->create([
                'enrollment_id' => $enrollment->id,
                'status' => $status,
                'attendance_rate' => $rate,
                'attendance_snapshot' => $requiredSessions->map(fn ($link) => [
                    'sessionId' => $link->session_id,
                    'sessionLabel' => $link->session->label,
                    'status' => $link->attendance->training_status,
                    'source' => $link->attendance->recording_source,
                    'finalizedAt' => $link->attendance->finalized_at?->toIso8601String(),
                ])->values()->all(),
                'assessment_snapshot' => $enrollment->assessment?->toArray() ?? [],
                'program_snapshot' => [
                    'id' => $enrollment->program->id,
                    'code' => $enrollment->program->code,
                    'title' => $enrollment->program->title,
                    'completionRules' => $rules,
                    'competencies' => $enrollment->program->competencies->toArray(),
                ],
                'personnel_snapshot' => $enrollment->personnel_snapshot,
                'finalization_note' => $note,
                'finalized_by' => $actor->id,
                'finalized_at' => now(),
            ]);
            $enrollment->update(['status' => $status === 'Passed' ? 'Completed' : 'Did Not Complete']);
            if ($status === 'Passed' && ($rules['issueCertificate'] ?? false)) {
                $months = $rules['certificateValidityMonths'] ?? null;
                TrainingCertificate::query()->create([
                    'completion_id' => $completion->id,
                    'certificate_number' => 'TRN-CERT-'.now()->format('Ym').'-'.strtoupper(Str::random(8)),
                    'status' => 'Active',
                    'issued_at' => now(),
                    'expires_at' => $months ? now()->addMonths((int) $months) : null,
                ]);
            }
            if (in_array($status, ['Failed', 'Incomplete'], true)) {
                $this->createFollowUpRequirement($enrollment, $completion, $status);
            }

            $this->audit->record($actor, 'CompletionFinalized', 'TrainingCompletion', $completion->id, ['status' => $status, 'attendanceRate' => $rate]);

            return $completion->fresh('certificate');
        });
    }

    public function revokeCertificate(User $actor, TrainingCertificate $certificate, string $reason): void
    {
        $this->requireTrainingFinalizer($actor);
        if ($certificate->status !== 'Active') {
            throw ValidationException::withMessages(['certificate' => 'Only an Active Training certificate may be revoked.']);
        }
        if (trim($reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A revocation reason is required.']);
        }
        $certificate->update([
            'status' => 'Revoked',
            'revoked_at' => now(),
            'revoked_by' => $actor->id,
            'revocation_reason' => trim($reason),
        ]);
        $this->audit->record($actor, 'CertificateRevoked', 'TrainingCertificate', $certificate->id, ['reason' => trim($reason)]);
    }

    public function submitFeedback(User $actor, TrainingSession $session, array $data): void
    {
        $eligible = TrainingSessionParticipant::query()->where('session_id', $session->id)
            ->whereHas('enrollment', fn ($query) => $query->where('participant_id', $actor->id)
                ->whereNotIn('status', ['Withdrawn', 'Cancelled']))->exists();
        if (! $eligible) {
            throw new AuthorizationException('Only assigned participants may submit feedback for this session.');
        }
        if (! in_array($session->status, ['Ongoing', 'Completed'], true)) {
            throw ValidationException::withMessages(['session' => 'Feedback opens when a session is Ongoing or Completed.']);
        }
        TrainingFeedback::query()->updateOrCreate(['session_id' => $session->id, 'participant_id' => $actor->id], array_merge($data, ['submitted_at' => now()]));
        $this->audit->record($actor, 'FeedbackSubmitted', 'TrainingSession', $session->id);
    }

    public function receiveRecommendation(User $actor, array $data): TrainingRecommendation
    {
        $this->requireOperator($actor);
        $person = User::query()->activePersonnel()->where('personnel_key', $data['personnelKey'])->first();
        if (! $person || $person->role === UserRole::Admin) {
            throw ValidationException::withMessages(['personnelKey' => 'Choose an active canonical learner personnel record.']);
        }

        return TrainingRecommendation::query()->firstOrCreate(
            ['source_recommendation_id' => $data['sourceRecommendationId']],
            [
                'source_module' => $data['sourceModule'],
                'personnel_key' => $data['personnelKey'],
                'development_need' => $data['developmentNeed'],
                'reason' => $data['reason'],
                'source_snapshot' => $data['sourceSnapshot'] ?? [],
                'status' => 'Pending',
            ],
        );
    }

    public function actRecommendation(User $actor, TrainingRecommendation $recommendation, array $data): void
    {
        $this->requireOperator($actor);
        if (! in_array($recommendation->status, ['Pending', 'Under Review'], true)) {
            throw ValidationException::withMessages(['recommendation' => 'This recommendation already has a final decision.']);
        }
        if ($data['action'] === 'Accepted' && empty($data['programId'])) {
            throw ValidationException::withMessages(['programId' => 'Link an Active Training program before acceptance.']);
        }
        if ($data['action'] === 'Accepted') {
            $program = TrainingProgram::query()->whereKey($data['programId'])->where('status', 'Active')->first();
            if (! $program) {
                throw ValidationException::withMessages(['programId' => 'Link only an Active Training program.']);
            }
            if (! empty($data['sessionId']) && ! $program->sessions()->whereKey($data['sessionId'])->exists()) {
                throw ValidationException::withMessages(['sessionId' => 'The linked session must belong to the selected program.']);
            }
            if (! empty($data['enrollmentId'])) {
                $person = User::query()->where('personnel_key', $recommendation->personnel_key)->first();
                $validEnrollment = $person && TrainingEnrollment::query()->whereKey($data['enrollmentId'])
                    ->where('program_id', $program->id)->where('participant_id', $person->id)->exists();
                if (! $validEnrollment) {
                    throw ValidationException::withMessages(['enrollmentId' => 'The linked enrollment must belong to the recommended person and selected program.']);
                }
            }
        }
        $recommendation->update([
            'status' => $data['action'],
            'linked_program_id' => $data['programId'] ?? null,
            'linked_session_id' => $data['sessionId'] ?? null,
            'linked_enrollment_id' => $data['enrollmentId'] ?? null,
            'action_reason' => $data['reason'] ?? null,
            'acted_by' => $actor->id,
            'acted_at' => now(),
        ]);
        $this->audit->record($actor, 'Recommendation'.$data['action'], 'TrainingRecommendation', $recommendation->id, ['reason' => $data['reason'] ?? null]);
    }

    private function validatedProgramPayload(array $data): array
    {
        $audience = $data['audienceRules'];
        $active = $this->personnelCollection();
        $knownTypes = $active->pluck('person_type')->filter()->unique();
        $aliases = ['Employees' => 'Employee', 'Trainees' => 'Trainee'];
        $audience['personTypes'] = collect($audience['personTypes'] ?? [])->map(fn ($type) => $aliases[$type] ?? trim((string) $type))->filter()->unique()->sort()->values()->all();
        foreach ($audience['personTypes'] as $type) {
            if (! $knownTypes->contains($type)) {
                throw ValidationException::withMessages(['audienceRules.personTypes' => "{$type} is not an active canonical personnel type."]);
            }
        }
        foreach (($audience['departments'] ?? []) as $department) {
            if (! $active->pluck('department')->filter()->unique()->contains($department)) {
                throw ValidationException::withMessages(['audienceRules.departments' => "{$department} is not an active canonical department."]);
            }
        }
        foreach (($audience['positions'] ?? []) as $position) {
            if (! $active->pluck('position')->filter()->unique()->contains($position)) {
                throw ValidationException::withMessages(['audienceRules.positions' => "{$position} is not an active canonical position."]);
            }
        }
        $this->catalog->validateRoleProfiles($audience['roleProfileIds'] ?? []);

        return [
            'title' => trim($data['title']),
            'description' => trim($data['description']),
            'category' => trim($data['category']),
            'delivery_type' => $data['deliveryType'],
            'objectives' => collect($data['objectives'])->map(fn ($value) => trim($value))->filter()->values()->all(),
            'audience_rules' => [
                'personTypes' => $audience['personTypes'],
                'departments' => array_values(array_unique($audience['departments'] ?? [])),
                'positions' => array_values(array_unique($audience['positions'] ?? [])),
                'roleProfileIds' => array_values(array_unique($audience['roleProfileIds'] ?? [])),
            ],
            'completion_rules' => $data['completionRules'],
            'related_learning_course_id' => $data['relatedLearningCourseId'] ?? null,
        ];
    }

    private function syncCompetencies(TrainingProgram $program, array $mappings): void
    {
        $program->competencies()->delete();
        foreach ($mappings as $mapping) {
            $canonical = $this->catalog->competency((string) $mapping['id']);
            if (! $canonical) {
                throw ValidationException::withMessages(['competencies' => 'Choose only active canonical Competency definitions.']);
            }
            $program->competencies()->create([
                'competency_id' => $canonical['id'],
                'competency_version' => (int) ($canonical['version'] ?? config('learning_catalog.competency_version', $mapping['version'])),
                'competency_code' => $canonical['code'],
                'competency_name' => $canonical['name'],
                'target_level' => $mapping['targetLevel'],
                'purpose' => $mapping['purpose'] ?? null,
            ]);
        }
    }

    private function matchesAudience(User $user, array $rules): bool
    {
        $match = fn (string $key, ?string $value) => empty($rules[$key] ?? []) || in_array($value, $rules[$key], true);

        return $match('personTypes', $user->person_type)
            && $match('departments', $user->department)
            && $match('positions', $user->position)
            && $this->catalog->userMatchesProfiles($user, $rules['roleProfileIds'] ?? []);
    }

    private function programPayload(TrainingProgram $program): array
    {
        return [
            'id' => $program->id,
            'code' => $program->code,
            'title' => $program->title,
            'description' => $program->description,
            'category' => $program->category,
            'deliveryType' => $program->delivery_type,
            'status' => $program->status,
            'objectives' => $program->objectives ?? [],
            'audienceRules' => $program->audience_rules ?? [],
            'completionRules' => $program->completion_rules ?? [],
            'relatedLearningCourseId' => $program->related_learning_course_id,
            'owner' => $program->owner?->name,
            'competencies' => $program->competencies->map(fn ($row) => [
                'id' => $row->competency_id,
                'version' => $row->competency_version,
                'code' => $row->competency_code,
                'name' => $row->competency_name,
                'targetLevel' => $row->target_level,
                'purpose' => $row->purpose,
            ])->values()->all(),
            'sessions' => $program->sessions->map(fn (TrainingSession $session) => [
                'id' => $session->id,
                'programId' => $session->program_id,
                'label' => $session->label,
                'startsAt' => $session->starts_at?->toIso8601String(),
                'endsAt' => $session->ends_at?->toIso8601String(),
                'venue' => $session->venue,
                'capacity' => $session->capacity,
                'facilitatorId' => $session->facilitator_id,
                'facilitator' => $session->facilitator?->name ?? $session->external_facilitator_name,
                'externalFacilitatorName' => $session->external_facilitator_name,
                'enrollmentClosesAt' => $session->enrollment_closes_at?->toIso8601String(),
                'status' => $session->status,
                'attendanceFinalizedAt' => $session->attendance_finalized_at?->toIso8601String(),
                'participantCount' => $session->participants()->whereNotIn('status', ['Withdrawn', 'Cancelled'])->count(),
                'cancellationReason' => $session->cancellation_reason,
            ])->values()->all(),
            'updatedAt' => $program->updated_at?->toIso8601String(),
        ];
    }

    private function enrollmentPayload(TrainingEnrollment $enrollment): array
    {
        return [
            'id' => $enrollment->id,
            'programId' => $enrollment->program_id,
            'participantId' => $enrollment->participant_id,
            'participant' => $enrollment->participant?->name ?? ($enrollment->personnel_snapshot['name'] ?? 'Unknown'),
            'personnelKey' => $enrollment->participant?->personnel_key ?? ($enrollment->personnel_snapshot['personnelKey'] ?? null),
            'employeeId' => $enrollment->participant?->employee_or_trainee_id ?? ($enrollment->personnel_snapshot['employeeId'] ?? null),
            'personType' => $enrollment->participant?->person_type ?? ($enrollment->personnel_snapshot['personType'] ?? null),
            'department' => $enrollment->participant?->department ?? ($enrollment->personnel_snapshot['department'] ?? null),
            'position' => $enrollment->participant?->position ?? ($enrollment->personnel_snapshot['position'] ?? null),
            'source' => $enrollment->source,
            'status' => $enrollment->status,
            'assignedAt' => $enrollment->assigned_at?->toIso8601String(),
            'sessions' => $enrollment->sessionParticipants->map(fn (TrainingSessionParticipant $link) => [
                'id' => $link->id,
                'sessionId' => $link->session_id,
                'label' => $link->session?->label,
                'startsAt' => $link->session?->starts_at?->toIso8601String(),
                'endsAt' => $link->session?->ends_at?->toIso8601String(),
                'venue' => $link->session?->venue,
                'facilitator' => $link->session?->facilitator?->name ?? $link->session?->external_facilitator_name,
                'sessionStatus' => $link->session?->status,
                'participationStatus' => $link->status,
                'attendance' => $link->attendance ? [
                    'id' => $link->attendance->id,
                    'trainingStatus' => $link->attendance->training_status,
                    'recordingSource' => $link->attendance->recording_source,
                    'note' => $link->attendance->note,
                    'finalizedAt' => $link->attendance->finalized_at?->toIso8601String(),
                    'workforceSyncStatus' => $link->attendance->workforce_sync_status,
                    'workforceSnapshot' => $link->attendance->workforce_snapshot ?? [],
                    'workforceSyncError' => $link->attendance->workforce_sync_error,
                ] : null,
            ])->values()->all(),
            'assessment' => $enrollment->assessment ? [
                'id' => $enrollment->assessment->id,
                'result' => $enrollment->assessment->result,
                'score' => $enrollment->assessment->score,
                'maximumScore' => $enrollment->assessment->maximum_score,
                'checklist' => $enrollment->assessment->checklist ?? [],
                'notes' => $enrollment->assessment->notes,
                'finalizedAt' => $enrollment->assessment->finalized_at?->toIso8601String(),
            ] : null,
            'completion' => $enrollment->completion ? [
                'id' => $enrollment->completion->id,
                'status' => $enrollment->completion->status,
                'attendanceRate' => $enrollment->completion->attendance_rate,
                'finalizedAt' => $enrollment->completion->finalized_at?->toIso8601String(),
                'certificate' => $enrollment->completion->certificate ? [
                    'id' => $enrollment->completion->certificate->id,
                    'number' => $enrollment->completion->certificate->certificate_number,
                    'status' => $enrollment->completion->certificate->status === 'Active'
                        && $enrollment->completion->certificate->expires_at?->isPast()
                        ? 'Expired'
                        : $enrollment->completion->certificate->status,
                    'issuedAt' => $enrollment->completion->certificate->issued_at?->toIso8601String(),
                    'expiresAt' => $enrollment->completion->certificate->expires_at?->toIso8601String(),
                ] : null,
            ] : null,
        ];
    }

    private function recommendationPayload(TrainingRecommendation $row, EloquentCollection $programs): array
    {
        $person = User::query()->activePersonnel()->where('personnel_key', $row->personnel_key)->first();
        $program = $this->recommendedProgramFor($row, $programs);
        $prerequisite = $person && $program
            ? $this->prerequisiteState($person, $program)
            : ['complete' => false, 'status' => $program ? 'Personnel unavailable' : 'Training definition required', 'title' => null];

        $readiness = match (true) {
            $row->status === 'Rejected' => 'Closed',
            ! empty($row->linked_session_id) => 'Scheduled',
            ! $program => 'Needs Mapping',
            ! $prerequisite['complete'] => 'Waiting',
            default => 'Ready',
        };

        return [
            'id' => $row->id,
            'sourceRecommendationId' => $row->source_recommendation_id,
            'sourceModule' => $row->source_module,
            'sourceLabel' => match ($row->source_module) {
                'Competency' => 'Competency Gap',
                'Performance' => 'Performance Development',
                'Learning' => 'Learning Requirement',
                'Compliance' => 'Compliance / Refresher',
                'Training' => (($row->source_snapshot ?? [])['reasonType'] ?? null) === 'Reschedule' ? 'Rescheduling' : 'Retraining',
                default => 'Development Requirement',
            },
            'personnelKey' => $row->personnel_key,
            'participantId' => $person?->id,
            'participant' => $person?->name ?? 'Unavailable personnel',
            'employeeId' => $person?->employee_or_trainee_id,
            'department' => $person?->department ?? '',
            'position' => $person?->position ?? '',
            'developmentNeed' => $row->development_need,
            'reason' => $row->reason,
            'status' => $row->status,
            'readiness' => $readiness,
            'prerequisiteStatus' => $prerequisite['status'],
            'prerequisiteTitle' => $prerequisite['title'],
            'recommendedProgramId' => $program?->id,
            'recommendedProgramTitle' => $program?->title,
            'linkedProgramId' => $row->linked_program_id,
            'linkedSessionId' => $row->linked_session_id,
            'linkedEnrollmentId' => $row->linked_enrollment_id,
            'actionReason' => $row->action_reason,
            'sourceSnapshot' => $row->source_snapshot ?? [],
            'createdAt' => $row->created_at?->toIso8601String(),
        ];
    }

    private function recommendedProgramFor(TrainingRecommendation $recommendation, EloquentCollection $programs): ?TrainingProgram
    {
        if ($recommendation->linked_program_id) {
            $linked = $programs->firstWhere('id', $recommendation->linked_program_id);
            if ($linked) return $linked;
        }

        $active = $programs->where('status', 'Active')->filter(
            fn (TrainingProgram $program) => (bool) $program->related_learning_course_id || $program->competencies->isNotEmpty(),
        );
        $snapshot = $recommendation->source_snapshot ?? [];
        $competencyId = (string) ($snapshot['competencyId'] ?? $snapshot['competency_id'] ?? '');
        $requiredLevel = (int) ($snapshot['requiredLevel'] ?? $snapshot['required_level'] ?? 0);
        if ($competencyId !== '') {
            $matched = $active->filter(fn (TrainingProgram $program) => $program->competencies->contains(
                fn ($mapping) => $mapping->competency_id === $competencyId
                    && ($requiredLevel === 0 || (int) $mapping->target_level >= $requiredLevel),
            ));
            if ($matched->isNotEmpty()) {
                return $matched->sortBy(fn (TrainingProgram $program) => (int) optional($program->competencies->firstWhere('competency_id', $competencyId))->target_level)->first();
            }
        }

        $need = Str::lower(trim($recommendation->development_need));
        if ($need !== '') {
            return $active->first(fn (TrainingProgram $program) => str_contains($need, Str::lower($program->title)) || str_contains(Str::lower($program->title), $need));
        }

        return null;
    }

    private function prerequisiteState(User $person, TrainingProgram $program): array
    {
        if (! $program->related_learning_course_id) {
            return ['complete' => true, 'status' => 'Not required', 'title' => null];
        }
        if (! Schema::hasTable('learning_courses') || ! Schema::hasTable('learning_completions')) {
            return ['complete' => false, 'status' => 'Learning verification unavailable', 'title' => null];
        }

        $course = DB::table('learning_courses')
            ->leftJoin('learning_course_versions', 'learning_courses.current_published_version_id', '=', 'learning_course_versions.id')
            ->where('learning_courses.id', $program->related_learning_course_id)
            ->first(['learning_courses.id', 'learning_course_versions.title']);
        $title = $course?->title;
        $completed = DB::table('learning_completions')
            ->where('learner_id', $person->id)
            ->where('course_id', $program->related_learning_course_id)
            ->exists();
        if ($completed) {
            return ['complete' => true, 'status' => 'Completed', 'title' => $title];
        }

        $assignmentStatus = Schema::hasTable('learning_assignments')
            ? DB::table('learning_assignments')->where('learner_id', $person->id)->where('course_id', $program->related_learning_course_id)
                ->whereNotIn('status', ['Cancelled', 'Expired'])->orderByDesc('assigned_at')->value('status')
            : null;

        return [
            'complete' => false,
            'status' => $assignmentStatus ? "Waiting — {$assignmentStatus}" : 'Waiting — Not assigned',
            'title' => $title,
        ];
    }

    private function createFollowUpRequirement(TrainingEnrollment $enrollment, TrainingCompletion $completion, string $status): void
    {
        $participant = $enrollment->participant;
        if (! $participant?->personnel_key) return;

        $reschedule = $status === 'Incomplete';
        TrainingRecommendation::query()->firstOrCreate(
            ['source_recommendation_id' => 'training-followup:'.$completion->id],
            [
                'source_module' => 'Training',
                'personnel_key' => $participant->personnel_key,
                'development_need' => $enrollment->program->title,
                'reason' => $reschedule
                    ? 'The previous facilitated/practical session was not completed. Schedule the participant into the next eligible session.'
                    : 'The previous practical/facilitated outcome did not satisfy the completion standard. Retraining is required before reassessment.',
                'source_snapshot' => [
                    'reasonType' => $reschedule ? 'Reschedule' : 'Retraining',
                    'previousCompletionId' => $completion->id,
                    'previousEnrollmentId' => $enrollment->id,
                    'programId' => $enrollment->program->id,
                ],
                'status' => 'Pending',
                'linked_program_id' => $enrollment->program->id,
            ],
        );
    }

    private function personnel(): array
    {
        return $this->personnelCollection()->map(fn (User $user) => [
            'id' => $user->id,
            'personnelKey' => $user->personnel_key,
            'employeeId' => $user->employee_or_trainee_id,
            'name' => $user->name,
            'email' => $user->email,
            'personType' => $user->person_type,
            'department' => $user->department,
            'position' => $user->position,
            'role' => $user->role->value,
        ])->values()->all();
    }

    private function advanceScheduledSessions(): void
    {
        TrainingSession::query()
            ->where('status', 'Scheduled')
            ->where('starts_at', '<=', now())
            ->get()
            ->each(function (TrainingSession $session): void {
                $session->update(['status' => 'Ongoing']);
                $this->audit->record(null, 'SessionAutoStarted', 'TrainingSession', $session->id, [
                    'scheduledStart' => $session->starts_at?->toIso8601String(),
                ]);
            });
    }

    private function personnelCollection(): EloquentCollection
    {
        return User::query()->activePersonnel()->where('role', '!=', UserRole::Admin->value)->orderBy('name')->get();
    }

    private function publishedLearningCourses(): array
    {
        return DB::table('learning_courses')->join('learning_course_versions', 'learning_courses.current_published_version_id', '=', 'learning_course_versions.id')
            ->whereNull('learning_courses.archived_at')->orderBy('learning_course_versions.title')
            ->get(['learning_courses.id', 'learning_courses.code', 'learning_course_versions.id as version_id', 'learning_course_versions.title'])
            ->map(fn ($row) => ['id' => $row->id, 'versionId' => $row->version_id, 'code' => $row->code, 'title' => $row->title])->all();
    }

    private function personnelSnapshot(User $user): array
    {
        return [
            'personnelKey' => $user->personnel_key,
            'employeeId' => $user->employee_or_trainee_id,
            'name' => $user->name,
            'email' => $user->email,
            'personType' => $user->person_type,
            'department' => $user->department,
            'position' => $user->position,
        ];
    }

    private function programCode(?string $requested): string
    {
        $requested = strtoupper(trim((string) $requested));
        if ($requested !== '') {
            return $requested;
        }
        do {
            $code = 'TRN-'.now()->format('Y').'-'.strtoupper(Str::random(6));
        } while (TrainingProgram::query()->where('code', $code)->exists());

        return $code;
    }

    private function isOperator(User $actor): bool
    {
        return in_array($actor->role, [UserRole::Admin, UserRole::HR], true);
    }

    private function requireOperator(User $actor): void
    {
        if (! $this->isOperator($actor)) throw new AuthorizationException('Training Management is limited to Admin and HR operators.');
    }

    private function requireTrainingFinalizer(User $actor): void
    {
        if (! in_array($actor->role, [UserRole::Admin, UserRole::HR], true)) {
            throw new AuthorizationException('Only authorized Training governance may finalize attendance, completion, or certificates.');
        }
    }

    private function requireDraftContributor(User $actor, TrainingSession $session): void
    {
        if ($actor->role === UserRole::HR || $session->facilitator_id === $actor->id) return;
        throw new AuthorizationException('Only HR or the assigned facilitator may prepare draft attendance.');
    }

    private function requireEnrollmentContributor(User $actor, TrainingEnrollment $enrollment): void
    {
        if ($actor->role === UserRole::HR) return;
        if ($enrollment->sessionParticipants->contains(fn ($link) => $link->session?->facilitator_id === $actor->id)) return;
        throw new AuthorizationException('Only HR or an assigned facilitator may prepare the participant assessment.');
    }
}
