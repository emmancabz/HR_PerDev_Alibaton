<?php

namespace App\Services\Performance;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\CanonicalWorkforceReference;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PerformanceService
{
    private const REVIEW_STATUSES = ['Pending', 'In Progress', 'Completed'];

    private const CYCLE_TYPES = ['Quarterly', 'Semi-Annual', 'Annual', 'Probationary', 'Custom'];

    private const CYCLE_STATUSES = ['Draft', 'Active', 'Closed'];

    private const PIP_STATUSES = ['Active', 'On Track', 'Extended', 'Completed', 'Escalated for HR Review'];

    private const PIP_OUTCOMES = ['Expectations Met', 'Partially Met', 'Expectations Not Met'];

    private const TRAINEE_JOURNEY_STAGES = [
        'New Trainee',
        'Initial Evaluation',
        'Development Plan',
        'Learning / Training / Practical Development',
        'Re-evaluation',
        'Development Cycle Completed / Ready',
    ];

    private const LEADERSHIP_360_CRITERIA = [
        'Communication' => 20,
        'Coaching & Support' => 20,
        'Delegation' => 15,
        'Team Coordination' => 15,
        'Accountability' => 15,
        'Leadership Effectiveness' => 15,
    ];

    public function state(User $actor): array
    {
        if ($actor->isPerformanceOperator()) {
            // Routine review coverage is system-derived. Loading the governed Performance
            // state repairs any missing standard review assignments idempotently; Admin does
            // not prepare or reassign routine evaluators by hand.
            DB::transaction(fn () => $this->deriveReviewAssignments($actor), 3);
        }

        $reviewRows = $this->visibleReviewQuery($actor)
            ->whereDate('cycles.review_open_date', '<=', $this->performanceToday()->toDateString())
            ->get();
        $visibleUserIds = collect([$actor->id]);

        foreach ($reviewRows as $row) {
            $visibleUserIds->push($row->subject_user_id, $row->evaluator_user_id);
        }

        if ($actor->isPerformanceOperator()) {
            $visibleUserIds = DB::table('users')->pluck('id');
        } else {
            $visibleUserIds = $visibleUserIds
                ->merge(DB::table('performance_reporting_relationships')
                    ->where('active', true)
                    ->where(function (Builder $query) use ($actor): void {
                        $query->where('supervisor_id', $actor->id)
                            ->orWhere('direct_report_id', $actor->id);
                    })
                    ->get(['supervisor_id', 'direct_report_id'])
                    ->flatMap(fn (object $row) => [$row->supervisor_id, $row->direct_report_id]))
                ->unique();
        }

        $personnel = DB::table('users')
            ->whereIn('id', $visibleUserIds->filter()->values())
            ->whereNotNull('personnel_key')
            ->orderBy('name')
            ->get()
            ->map(fn (object $user) => $this->personnelToArray($user))
            ->values()
            ->all();

        $cycles = DB::table('performance_cycles')
            ->orderByDesc('performance_start_date')
            ->get()
            ->map(fn (object $cycle) => $this->cycleToArray($cycle))
            ->values()
            ->all();

        $reviewTemplates = DB::table('performance_review_templates')
            ->where('active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (object $template) => $this->reviewTemplateToArray($template))
            ->values()
            ->all();

        $goalTemplates = DB::table('performance_goal_templates')
            ->when(! $actor->isPerformanceOperator(), fn (Builder $query) => $query->where('active', true))
            ->orderBy('name')
            ->get()
            ->map(fn (object $template) => $this->goalTemplateToArray($template))
            ->values()
            ->all();

        $goals = $this->visibleGoalQuery($actor)
            ->get()
            ->map(fn (object $goal) => $this->goalToArray($goal))
            ->values()
            ->all();

        $reviews = $reviewRows
            ->map(fn (object $review) => $this->reviewToArray($review))
            ->values()
            ->all();

        $today = $this->performanceToday();
        $actualToday = CarbonImmutable::now(config('app.timezone'))->startOfDay();
        $demoMode = $today->toDateString() !== $actualToday->toDateString();
        $reference = app(CanonicalWorkforceReference::class)->payload();
        $workforceContext = $this->workforceContextFromReference($reference);
        $performanceCalendar = $this->runtimePerformanceCalendar(
            is_array($reference['performance_calendar'] ?? null) ? $reference['performance_calendar'] : [],
            $today,
        );
        $performanceQuarterHistory = is_array($reference['performance_quarter_history'] ?? null)
            ? $reference['performance_quarter_history']
            : [];

        return [
            'meta' => [
                'sourceOfTruth' => 'PostgreSQL',
                'identitySource' => 'Canonical users/personnel',
                'serverNow' => now(config('app.timezone'))->toIso8601String(),
                'serverDate' => $today->toDateString(),
                'actualServerDate' => $actualToday->toDateString(),
                'demoMode' => $demoMode,
                'demoScenario' => $demoMode ? 'Controlled Q3 review-workflow demonstration' : null,
            ],
            'actor' => [
                'userId' => $actor->id,
                'personnelKey' => $actor->personnel_key,
                'name' => $actor->name,
                'email' => $actor->email,
                'role' => $actor->role->value,
                'capabilities' => [
                    'monitorOrganization' => $actor->isPerformanceOperator(),
                    'configurePerformance' => $actor->isPerformanceOperator(),
                    'operatePerformance' => $actor->isPerformanceOperator(),
                    'evaluateAssignedPeople' => (bool) $actor->evaluator_capable,
                ],
            ],
            'personnel' => $personnel,
            'cycles' => $cycles,
            'reviewTemplates' => $reviewTemplates,
            'goalTemplates' => $goalTemplates,
            'goals' => $goals,
            'goalAuditEvents' => $this->goalAuditEventsForActor($actor),
            'assignments' => $this->assignmentsForActor($actor),
            'reviews' => $reviews,
            'development' => $this->developmentForActor($actor),
            'workforceContext' => $workforceContext,
            'performanceCalendar' => $performanceCalendar,
            'performanceQuarterHistory' => $performanceQuarterHistory,
            'anonymousUpwardFeedback' => [
                'enabled' => (bool) config('services.groq.performance_anonymous_feedback', false),
                'subjectSafeOnly' => true,
                'purpose' => '360 Leadership Review',
            ],
        ];
    }

    public function syncConfiguration(User $actor, array $payload, bool $preserveGoalProgress = true): array
    {
        $this->requireOperator($actor);

        DB::transaction(function () use ($actor, $payload, $preserveGoalProgress): void {
            foreach ($payload['cycles'] ?? [] as $cycle) {
                $this->upsertCycle($cycle);
            }

            foreach ($payload['reviewTemplates'] ?? [] as $template) {
                $this->upsertReviewTemplate($template);
            }

            // Goal-plan structure is source-governed. Admin configuration sync may
            // assign an existing plan to personnel, but it must never create, rename,
            // revise, reweight, archive, or otherwise mutate the canonical plan library.
            $this->assertSourceGovernedGoalTemplates($payload['goalTemplates'] ?? []);

            foreach ($payload['goals'] ?? [] as $goal) {
                $this->upsertGoal($goal, $preserveGoalProgress);
            }

            foreach ($payload['assignments'] ?? [] as $assignment) {
                $this->upsertAssignmentConfiguration($actor, $assignment);
            }

            $this->deriveReviewAssignments($actor);
        }, 3);

        return $this->state($actor);
    }

    public function syncReviews(User $actor, array $requestedReviews): array
    {
        DB::transaction(function () use ($actor, $requestedReviews): void {
            foreach ($requestedReviews as $requested) {
                $this->syncOneReview($actor, $requested);
            }
        }, 3);

        return $this->state($actor);
    }

    /**
     * Release missing formal-review records for active cycles whose review
     * window has opened. Assignments are prepared earlier; this scheduled
     * reconciliation never changes evaluator authority.
     */
    public function provisionScheduledReviews(): void
    {
        DB::transaction(function (): void {
            $cycles = DB::table('performance_cycles')
                ->where('status', 'Active')
                ->get();

            foreach ($cycles as $cycle) {
                $this->releaseOpenCycleReviews($cycle);
            }
        }, 3);
    }

    /**
     * Move one persisted review through the governed Reviews-board workflow.
     *
     * The UI uses board-stage labels (Manager Review, Submitted,
     * Calibration Review, Finalized). This endpoint deliberately reuses the
     * same server-side calibration and manager-review rules as the normal
     * review sync path so a board/header action cannot bypass governance.
     */
    public function transitionReview(User $actor, string $reviewKey, string|array $target): array
    {
        $targetStage = is_array($target)
            ? (string) ($target['target'] ?? $target['stage'] ?? $target['targetStage'] ?? $target['workflowState'] ?? '')
            : $target;

        $targetStage = trim($targetStage);
        $targetStage = match ($targetStage) {
            'Calibration In Review' => 'Calibration Review',
            'Calibration Pending' => 'Submitted',
            default => $targetStage,
        };

        if (! in_array($targetStage, ['Manager Review', 'Submitted', 'Calibration Review', 'Finalized'], true)) {
            throw ValidationException::withMessages([
                'reviews' => 'The requested review workflow transition is not supported.',
            ]);
        }

        DB::transaction(function () use ($actor, $reviewKey, $targetStage): void {
            $row = $this->visibleReviewQuery($actor)
                ->where('reviews.external_key', trim($reviewKey))
                ->first();

            if (! $row) {
                throw ValidationException::withMessages([
                    'reviews' => 'The referenced Performance review does not exist or is outside your authorized scope.',
                ]);
            }

            DB::table('performance_reviews')->where('id', $row->id)->lockForUpdate()->first();
            $row = $this->visibleReviewQuery($actor)->where('reviews.id', $row->id)->first();

            $currentStage = $this->reviewBoardStage($row);
            if ($currentStage === $targetStage) {
                throw ValidationException::withMessages([
                    'reviews' => "This review is already in {$targetStage}.",
                ]);
            }

            if ($currentStage === 'Finalized') {
                throw ValidationException::withMessages([
                    'reviews' => 'Finalized reviews can only move backward through the audited Reopen / Request Revision action.',
                ]);
            }

            if ($targetStage === 'Manager Review') {
                if ($currentStage !== 'Not Started') {
                    throw ValidationException::withMessages([
                        'reviews' => 'Only a not-started review can enter Manager Review.',
                    ]);
                }

                if ((int) $row->evaluator_user_id !== (int) $actor->id
                    || (int) $row->subject_user_id === (int) $actor->id
                    || ! $actor->evaluator_capable
                    || $actor->employment_status === 'Inactive') {
                    $this->deny('Only the assigned active evaluator may start this review.');
                }

                $cycle = DB::table('performance_cycles')->where('id', $row->cycle_database_id)->first();
                $this->assertCycleOpenForManagerReview($cycle);

                DB::table('performance_reviews')->where('id', $row->id)->update([
                    'status' => 'In Progress',
                    'workflow_state' => 'Manager Review',
                    'lock_version' => DB::raw('lock_version + 1'),
                    'updated_at' => now(),
                ]);
                $this->recordEvent($row->id, 'Manager Review Started', $actor);

                return;
            }

            if ($targetStage === 'Submitted') {
                if ($currentStage !== 'Manager Review') {
                    throw ValidationException::withMessages([
                        'reviews' => 'Only an active Manager Review can be submitted.',
                    ]);
                }
                if (! $row->calibration_required) {
                    throw ValidationException::withMessages([
                        'reviews' => 'This cycle does not require calibration; submit/finalize it through the evaluator review flow.',
                    ]);
                }

                $this->syncManagerReviewContent($actor, $row, [
                    'reviewTemplateId' => $row->template_key,
                    'competencyScores' => $this->decode($row->criteria_scores, []),
                    'comments' => $row->comments,
                    'developmentRecommendations' => $this->decode($row->development_recommendations, []),
                    'managerSubmittedAt' => now()->toIso8601String(),
                    'status' => 'In Progress',
                    'workflowState' => 'Calibration Pending',
                ]);

                return;
            }

            if ($targetStage === 'Calibration Review') {
                if ($currentStage !== 'Submitted') {
                    throw ValidationException::withMessages([
                        'reviews' => 'Only a submitted review can enter Calibration Review.',
                    ]);
                }

                $this->syncCalibration($actor, $row, [
                    'calibrationStatus' => 'In Review',
                    'calibrationHistory' => [[
                        'notes' => 'Calibration review started by authorized Admin/HR.',
                    ]],
                ]);

                return;
            }

            // Finalized
            if ($row->calibration_required) {
                if ($currentStage !== 'Calibration Review') {
                    throw ValidationException::withMessages([
                        'reviews' => 'Required calibration must be actively reviewed before finalization.',
                    ]);
                }

                $this->syncCalibration($actor, $row, [
                    'calibrationStatus' => 'Approved',
                    'calibrationHistory' => [[
                        'notes' => 'Required calibration completed; formal result approved and finalized.',
                    ]],
                ]);

                return;
            }

            if ($currentStage !== 'Manager Review') {
                throw ValidationException::withMessages([
                    'reviews' => 'Only an active Manager Review can be finalized when calibration is not required.',
                ]);
            }

            $this->syncManagerReviewContent($actor, $row, [
                'reviewTemplateId' => $row->template_key,
                'competencyScores' => $this->decode($row->criteria_scores, []),
                'comments' => $row->comments,
                'developmentRecommendations' => $this->decode($row->development_recommendations, []),
                'managerSubmittedAt' => now()->toIso8601String(),
                'status' => 'Completed',
                'workflowState' => 'Finalized',
            ]);
        }, 3);

        return $this->state($actor);
    }

    public function transitionCalibration(
        User $actor,
        string $reviewKey,
        string $target,
        ?string $notes = null,
    ): array {
        if (! in_array($target, ['In Review', 'Approved', 'Returned for Revision'], true)) {
            throw ValidationException::withMessages([
                'reviews' => 'The requested calibration transition is not supported.',
            ]);
        }

        if ($target === 'Returned for Revision' && trim((string) $notes) === '') {
            throw ValidationException::withMessages([
                'reviews' => 'A calibration revision comment is required before returning the review to the evaluator.',
            ]);
        }

        DB::transaction(function () use ($actor, $reviewKey, $target, $notes): void {
            $row = $this->visibleReviewQuery($actor)
                ->where('reviews.external_key', trim($reviewKey))
                ->first();

            if (! $row) {
                throw ValidationException::withMessages([
                    'reviews' => 'The referenced Performance review does not exist or is outside your authorized scope.',
                ]);
            }

            DB::table('performance_reviews')->where('id', $row->id)->lockForUpdate()->first();
            $row = $this->visibleReviewQuery($actor)->where('reviews.id', $row->id)->first();

            $this->syncCalibration($actor, $row, [
                'calibrationStatus' => $target,
                'calibrationHistory' => [[
                    'notes' => trim((string) $notes) ?: null,
                ]],
            ]);
        }, 3);

        return $this->state($actor);
    }

    public function updateGoalProgress(
        User $actor,
        string $goalKey,
        ?float $progress = null,
        ?string $status = null,
        bool $administrativeCorrection = false,
        ?string $reason = null,
        ?string $reference = null,
    ): array {
        DB::transaction(function () use ($actor, $goalKey, $progress, $status, $administrativeCorrection, $reason, $reference): void {
            $goal = DB::table('performance_goals as goals')
                ->join('users as subjects', 'subjects.id', '=', 'goals.user_id')
                ->join('performance_cycles as cycles', 'cycles.id', '=', 'goals.performance_cycle_id')
                ->where('goals.external_key', trim($goalKey))
                ->select([
                    'goals.*',
                    'subjects.personnel_key as subject_key',
                    'cycles.external_key as cycle_key',
                    'cycles.status as cycle_status',
                ])
                ->lockForUpdate()
                ->first();

            if (! $goal) {
                throw ValidationException::withMessages(['goals' => 'The referenced Goal/KPI does not exist.']);
            }

            if ($goal->cycle_status === 'Closed') {
                throw ValidationException::withMessages(['goals' => 'Historical Goal/KPI records are read-only.']);
            }

            $assignment = DB::table('performance_review_assignments')
                ->where('performance_cycle_id', $goal->performance_cycle_id)
                ->where('subject_user_id', $goal->user_id)
                ->where('active', true)
                ->first();

            $formalReview = $assignment
                ? DB::table('performance_reviews')->where('performance_review_assignment_id', $assignment->id)->first()
                : null;
            if ($formalReview && (
                $formalReview->manager_submitted_at !== null
                || in_array($formalReview->workflow_state, ['Calibration Pending', 'Calibration In Review', 'Finalized'], true)
                || $formalReview->status === 'Completed'
            )) {
                throw ValidationException::withMessages([
                    'goals' => 'Goal/KPI progress is locked after formal review submission. Use the governed review revision/correction process instead.',
                ]);
            }

            $assignedGoalEvaluatorId = $assignment?->goal_evaluator_user_id ?: $assignment?->evaluator_user_id;
            $isAssignedEvaluator = $assignedGoalEvaluatorId
                && (int) $assignedGoalEvaluatorId === (int) $actor->id
                && (bool) $actor->evaluator_capable
                && $actor->employment_status !== 'Inactive'
                && (int) $goal->user_id !== (int) $actor->id;

            $cleanReason = trim((string) $reason);
            $eventType = null;

            if ($isAssignedEvaluator && ! $administrativeCorrection) {
                if ($cleanReason === '') {
                    throw ValidationException::withMessages([
                        'reason' => 'Document the workplace evidence or evaluator basis used to verify Goal/KPI progress.',
                    ]);
                }
                $eventType = 'Evaluator Goal Progress Verification';
            } elseif ($actor->isPerformanceOperator() && $administrativeCorrection) {
                if ($cleanReason === '') {
                    throw ValidationException::withMessages([
                        'reason' => 'Administrative Goal/KPI corrections require a documented reason.',
                    ]);
                }
                $eventType = 'Administrative Goal Correction';
            } elseif ($actor->isPerformanceOperator()) {
                throw ValidationException::withMessages([
                    'reason' => 'Admin/HR cannot casually edit formal Goal/KPI progress. Use an administrative correction with a required reason and audit context.',
                ]);
            } else {
                $this->deny('Only the assigned direct evaluator may verify formal Goal/KPI progress.');
            }

            $nextProgress = $progress === null ? (float) $goal->progress : max(0, min(100, $progress));
            $nextStatus = $status ?? (string) $goal->status;
            if (! in_array($nextStatus, ['Not Started', 'On Track', 'At Risk', 'Completed'], true)) {
                throw ValidationException::withMessages(['status' => 'The Goal/KPI status is invalid.']);
            }

            if (round($nextProgress, 2) === round((float) $goal->progress, 2) && $nextStatus === $goal->status) {
                return;
            }

            DB::table('performance_goals')->where('id', $goal->id)->update([
                'progress' => $nextProgress,
                'status' => $nextStatus,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_at' => now(),
            ]);

            DB::table('performance_goal_events')->insert([
                'performance_goal_id' => $goal->id,
                'actor_user_id' => $actor->id,
                'event_type' => $eventType,
                'previous_progress' => $goal->progress,
                'new_progress' => $nextProgress,
                'previous_status' => $goal->status,
                'new_status' => $nextStatus,
                'reason' => $cleanReason ?: null,
                'reference' => trim((string) $reference) ?: null,
                'metadata' => json_encode([
                    'cycleId' => $goal->cycle_key,
                    'personId' => $goal->subject_key,
                    'administrativeCorrection' => $administrativeCorrection,
                ], JSON_THROW_ON_ERROR),
                'created_at' => now(),
            ]);

            if ($formalReview) {
                $this->recordEvent((int) $formalReview->id, $eventType, $actor, [
                    'reason' => $cleanReason ?: null,
                    'notes' => trim(($goal->title ?? 'Goal/KPI').' · '.(float) $goal->progress.'% → '.$nextProgress.'%'.($reference ? ' · Ref: '.trim((string) $reference) : '')),
                ]);
            }
        }, 3);

        return $this->state($actor);
    }

    public function syncDevelopment(User $actor, array $development): array
    {
        $current = $this->state($actor)['development'] ?? [];

        $currentFeedback = collect($current['feedbackRecords'] ?? [])->keyBy('id');
        $currentPips = collect($current['pips'] ?? [])->keyBy('id');
        $currentJourneys = collect($current['traineeJourneys'] ?? [])->keyBy('id');

        DB::transaction(function () use (
            $actor,
            $development,
            $currentFeedback,
            $currentPips,
            $currentJourneys
        ): void {
            foreach ($development['feedbackRecords'] ?? [] as $record) {
                $existing = $currentFeedback->get((string) ($record['id'] ?? ''));

                if (is_array($existing) && $existing == $record) {
                    continue;
                }

                $this->upsertFeedback($actor, $record);
            }

            foreach ($development['pips'] ?? [] as $pip) {
                $existing = $currentPips->get((string) ($pip['id'] ?? ''));

                if (is_array($existing) && $this->samePipSyncPayload($existing, $pip)) {
                    continue;
                }

                $this->upsertPip($actor, $pip);
            }

            foreach ($development['traineeJourneys'] ?? [] as $journey) {
                $existing = $currentJourneys->get((string) ($journey['id'] ?? ''));

                if (is_array($existing) && $this->sameTraineeJourneySyncPayload($existing, $journey)) {
                    continue;
                }

                $this->upsertTraineeJourney($actor, $journey);
            }
        }, 3);

        return $this->state($actor);
    }

    private function samePipSyncPayload(array $left, array $right): bool
    {
        $keys = [
            'id',
            'personId',
            'relatedReviewId',
            'performanceConcern',
            'expectedImprovement',
            'actionItems',
            'startDate',
            'targetEndDate',
            'assignedManagerId',
            'status',
            'milestones',
            'progressNotes',
            'developmentActions',
            'outcomeNotes',
            'hrReviewNotes',
        ];

        foreach ($keys as $key) {
            if (($left[$key] ?? null) != ($right[$key] ?? null)) {
                return false;
            }
        }

        return true;
    }

    private function sameTraineeJourneySyncPayload(array $left, array $right): bool
    {
        $keys = [
            'id',
            'traineeId',
            'cycleId',
            'currentStage',
            'milestones',
            'developmentActionIds',
        ];

        foreach ($keys as $key) {
            if (($left[$key] ?? null) != ($right[$key] ?? null)) {
                return false;
            }
        }

        return true;
    }

    public function savePip(User $actor, array $pip): array
    {
        DB::transaction(function () use ($actor, $pip): void {
            $this->upsertPip($actor, $pip);
        }, 3);

        return $this->state($actor);
    }

    public function transitionPipGovernance(User $actor, string $pipKey, string $action, array $payload): array
    {
        if (! $actor->isPerformanceOperator()) {
            $this->deny('Only authorized Admin/HR operators may govern PIP outcomes.');
        }

        DB::transaction(function () use ($actor, $pipKey, $action, $payload): void {
            $pip = DB::table('performance_improvement_plans')
                ->where('external_key', $pipKey)
                ->lockForUpdate()
                ->first();

            if (! $pip) {
                throw ValidationException::withMessages(['pip' => 'Performance Improvement Plan not found.']);
            }
            if ($pip->status === 'Completed') {
                throw ValidationException::withMessages(['pip' => 'Closed Performance Improvement Plans are read-only.']);
            }

            $today = CarbonImmutable::now(config('app.timezone'))->startOfDay();
            $currentTarget = CarbonImmutable::parse((string) $pip->target_end_date, config('app.timezone'))->startOfDay();
            if ($today->lessThan($currentTarget)) {
                throw ValidationException::withMessages([
                    'pip' => 'Outcome actions become available on or after the current Target End date.',
                ]);
            }

            $milestones = $this->decode($pip->milestones, []);
            $hasIncompleteMilestone = collect($milestones)->contains(
                fn (array $milestone): bool => ($milestone['status'] ?? 'Pending') !== 'Completed'
            );
            if ($hasIncompleteMilestone) {
                throw ValidationException::withMessages([
                    'pip' => 'Complete all required PIP owner check-ins before HR/Admin can close or extend the plan.',
                ]);
            }

            $progressNotes = $this->decode($pip->progress_notes, []);
            $authorKey = $actor->personnel_key ?: (string) $actor->id;
            $nowIso = CarbonImmutable::now(config('app.timezone'))->toIso8601String();

            if ($action === 'close') {
                $outcome = trim((string) ($payload['outcomeResult'] ?? ''));
                $note = trim((string) ($payload['hrOutcomeNote'] ?? ''));
                if (! in_array($outcome, self::PIP_OUTCOMES, true) || $note === '') {
                    throw ValidationException::withMessages([
                        'pip' => 'A valid PIP outcome and HR governance note are required to close the plan.',
                    ]);
                }

                $progressNotes[] = [
                    'id' => 'pip-governance-close-'.now()->format('YmdHisv'),
                    'authorId' => $authorKey,
                    'note' => 'PIP closed. Outcome: '.$outcome.'. HR governance note: '.$note,
                    'createdAt' => $nowIso,
                ];

                DB::table('performance_improvement_plans')->where('id', $pip->id)->update([
                    'status' => 'Completed',
                    'outcome_notes' => $outcome,
                    'hr_review_notes' => $note,
                    'progress_notes' => json_encode(array_values($progressNotes), JSON_THROW_ON_ERROR),
                    'lock_version' => DB::raw('lock_version + 1'),
                    'updated_at' => now(),
                ]);

                return;
            }

            if ($action !== 'extend') {
                throw ValidationException::withMessages(['pip' => 'Unsupported PIP governance action.']);
            }

            $reason = trim((string) ($payload['extensionReason'] ?? ''));
            $newTargetValue = trim((string) ($payload['newTargetEndDate'] ?? ''));
            $nextCheckInValue = trim((string) ($payload['nextCheckInDate'] ?? ''));
            $nextCheckInTitle = trim((string) ($payload['nextCheckInTitle'] ?? ''));
            if ($reason === '' || $newTargetValue === '' || $nextCheckInValue === '' || $nextCheckInTitle === '') {
                throw ValidationException::withMessages([
                    'pip' => 'Extension reason, new Target End, and next check-in are required.',
                ]);
            }

            $newTarget = CarbonImmutable::parse($newTargetValue, config('app.timezone'))->startOfDay();
            $extensionDays = (int) $today->diffInDays($newTarget, false);
            if ($extensionDays < 14 || $extensionDays > 60 || $newTarget->lessThanOrEqualTo($currentTarget)) {
                throw ValidationException::withMessages([
                    'pip' => 'An extension Target End must be later than the current target and 14 to 60 calendar days after the extension decision.',
                ]);
            }

            $nextCheckIn = CarbonImmutable::parse($nextCheckInValue, config('app.timezone'))->startOfDay();
            $checkInDays = (int) $today->diffInDays($nextCheckIn, false);
            if ($checkInDays < 7 || $checkInDays > 14 || $nextCheckIn->greaterThanOrEqualTo($newTarget)) {
                throw ValidationException::withMessages([
                    'pip' => 'The extension check-in must be 7 to 14 calendar days after the extension decision and before the new Target End.',
                ]);
            }

            $milestones[] = [
                'id' => 'pip-extension-checkin-'.now()->format('YmdHisv'),
                'title' => $nextCheckInTitle,
                'dueDate' => $nextCheckIn->toDateString(),
                'status' => 'Pending',
            ];
            $progressNotes[] = [
                'id' => 'pip-governance-extension-'.now()->format('YmdHisv'),
                'authorId' => $authorKey,
                'note' => 'PIP extension approved. Previous target: '.$currentTarget->toDateString().'. New target: '.$newTarget->toDateString().'. Reason: '.$reason,
                'createdAt' => $nowIso,
            ];

            DB::table('performance_improvement_plans')->where('id', $pip->id)->update([
                'status' => 'Extended',
                'target_end_date' => $newTarget->toDateString(),
                'milestones' => json_encode(array_values($milestones), JSON_THROW_ON_ERROR),
                'progress_notes' => json_encode(array_values($progressNotes), JSON_THROW_ON_ERROR),
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_at' => now(),
            ]);
        }, 3);

        return $this->state($actor);
    }

    public function submitAnonymousFeedback(User $actor, string $subjectKey, string $cycleKey, string $feedback): void
    {
        if (! config('services.groq.performance_anonymous_feedback', false)) {
            throw ValidationException::withMessages([
                'feedback' => 'Anonymous upward feedback is not enabled for this environment.',
            ]);
        }

        $subject = $this->userByKey($subjectKey);
        $cycle = $this->cycleByKey($cycleKey);

        if ($subject->id === $actor->id || ! $actor->hasPersonnelIdentity()) {
            $this->deny('You are not authorized to submit this feedback.');
        }

        $isDirectReport = DB::table('performance_reporting_relationships')
            ->where('active', true)
            ->where('supervisor_id', $subject->id)
            ->where('direct_report_id', $actor->id)
            ->exists();

        if (! $isDirectReport) {
            $this->deny('Anonymous upward feedback is limited to authorized reporting relationships.');
        }

        DB::table('performance_anonymous_feedback')->updateOrInsert(
            [
                'subject_user_id' => $subject->id,
                'evaluator_user_id' => $actor->id,
                'performance_cycle_id' => $cycle->id,
            ],
            [
                'feedback' => trim($feedback),
                'submitted_at' => now(),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );
    }

    public function anonymousFeedbackSummary(User $actor, string $subjectKey, string $cycleKey): array
    {
        $subject = $this->userByKey($subjectKey);
        $cycle = $this->cycleByKey($cycleKey);

        if ($actor->id !== $subject->id && ! $actor->isPerformanceOperator()) {
            $this->deny('You are not authorized to view this summary.');
        }

        $rows = DB::table('performance_anonymous_feedback')
            ->where('subject_user_id', $subject->id)
            ->where('performance_cycle_id', $cycle->id)
            ->orderBy('submitted_at')
            ->get(['feedback', 'submitted_at']);

        $minimum = (int) config('services.groq.anonymous_feedback_minimum', 3);

        return [
            'cycleId' => $cycleKey,
            'subjectId' => $subjectKey,
            'responseCount' => $rows->count(),
            'minimumResponses' => $minimum,
            'feedback' => $rows->count() >= $minimum
                ? $rows->map(fn (object $row) => [
                    'feedback' => $row->feedback,
                    'submittedAt' => CarbonImmutable::parse($row->submitted_at)->toIso8601String(),
                ])->values()->all()
                : [],
            'message' => $rows->count() >= $minimum
                ? 'Responses are shown without evaluator identity.'
                : 'The response threshold has not been reached. No individual feedback is shown.',
        ];
    }

    private function visibleReviewQuery(User $actor): Builder
    {
        return DB::table('performance_reviews as reviews')
            ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'assignments.performance_cycle_id')
            ->join('users as subjects', 'subjects.id', '=', 'assignments.subject_user_id')
            ->leftJoin('users as evaluators', 'evaluators.id', '=', 'assignments.evaluator_user_id')
            ->leftJoin('performance_review_templates as templates', 'templates.id', '=', 'reviews.performance_review_template_id')
            ->when(! $actor->isPerformanceOperator(), function (Builder $query) use ($actor): void {
                $query->where(function (Builder $scope) use ($actor): void {
                    $scope->where('assignments.subject_user_id', $actor->id)
                        ->orWhere('assignments.evaluator_user_id', $actor->id);
                });
            })
            ->select([
                'reviews.*',
                'assignments.id as assignment_id',
                'assignments.external_key as assignment_external_key',
                'assignments.subject_user_id',
                'assignments.evaluator_user_id',
                'assignments.basis as assignment_basis',
                'assignments.lock_version as assignment_lock_version',
                'subjects.personnel_key as subject_key',
                'evaluators.personnel_key as evaluator_key',
                'cycles.id as cycle_database_id',
                'cycles.external_key as cycle_key',
                'cycles.review_open_date',
                'cycles.review_due_date',
                'cycles.status as cycle_status',
                'cycles.calibration_required',
                'cycles.self_evaluation_enabled',
                'cycles.self_rating_enabled',
                'cycles.employee_acknowledgment',
                'templates.external_key as template_key',
                'templates.person_type as template_person_type',
                'templates.criteria as template_criteria',
            ]);
    }

    private function visibleGoalQuery(User $actor): Builder
    {
        return DB::table('performance_goals as goals')
            ->join('users', 'users.id', '=', 'goals.user_id')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'goals.performance_cycle_id')
            ->leftJoin('performance_goal_templates as templates', 'templates.id', '=', 'goals.performance_goal_template_id')
            ->when(! $actor->isPerformanceOperator(), function (Builder $query) use ($actor): void {
                $query->where(function (Builder $scope) use ($actor): void {
                    $scope->where('goals.user_id', $actor->id)
                        ->orWhereExists(function (Builder $subquery) use ($actor): void {
                            $subquery->selectRaw('1')
                                ->from('performance_review_assignments as goal_assignments')
                                ->whereColumn('goal_assignments.subject_user_id', 'goals.user_id')
                                ->whereColumn('goal_assignments.performance_cycle_id', 'goals.performance_cycle_id')
                                ->where('goal_assignments.evaluator_user_id', $actor->id)
                                ->where('goal_assignments.active', true);
                        });
                });
            })
            ->select([
                'goals.*',
                'users.personnel_key as person_key',
                'cycles.external_key as cycle_key',
                'templates.external_key as template_key',
            ]);
    }

    private function assignmentsForActor(User $actor): array
    {
        $relationships = DB::table('performance_reporting_relationships as relationships')
            ->join('users as supervisors', 'supervisors.id', '=', 'relationships.supervisor_id')
            ->join('users as reports', 'reports.id', '=', 'relationships.direct_report_id')
            ->when(! $actor->isPerformanceOperator(), function (Builder $query) use ($actor): void {
                $query->where(function (Builder $scope) use ($actor): void {
                    $scope->where('relationships.supervisor_id', $actor->id)
                        ->orWhere('relationships.direct_report_id', $actor->id);
                });
            })
            ->where('relationships.active', true)
            ->get([
                'relationships.*',
                'supervisors.personnel_key as supervisor_key',
                'reports.personnel_key as report_key',
            ])
            ->map(fn (object $relationship) => [
                'id' => $relationship->external_key,
                'evaluatorId' => $relationship->supervisor_key,
                'scopeType' => 'Reporting Relationship',
                'personId' => $relationship->report_key,
                'isPrimaryEvaluator' => true,
                'basis' => 'Reporting Relationship',
                'reportingRelationshipId' => $relationship->external_key,
                'createdBy' => 'HR1/Core HR relationship',
                'createdAt' => CarbonImmutable::parse($relationship->created_at)->toIso8601String(),
            ]);

        $cycleAssignments = DB::table('performance_review_assignments as assignments')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'assignments.performance_cycle_id')
            ->join('users as subjects', 'subjects.id', '=', 'assignments.subject_user_id')
            ->leftJoin('users as evaluators', 'evaluators.id', '=', 'assignments.evaluator_user_id')
            ->when(! $actor->isPerformanceOperator(), function (Builder $query) use ($actor): void {
                $query->where(function (Builder $scope) use ($actor): void {
                    $scope->where('assignments.evaluator_user_id', $actor->id)
                        ->orWhere('assignments.subject_user_id', $actor->id);
                });
            })
            ->where('assignments.active', true)
            ->get([
                'assignments.*',
                'cycles.external_key as cycle_key',
                'subjects.personnel_key as subject_key',
                'evaluators.personnel_key as evaluator_key',
            ])
            ->map(fn (object $assignment) => [
                'id' => $assignment->external_key,
                'evaluatorId' => $assignment->evaluator_key ?? '',
                'scopeType' => 'Specific Person',
                'personId' => $assignment->subject_key,
                'isPrimaryEvaluator' => true,
                'cycleIds' => [$assignment->cycle_key],
                'basis' => $assignment->basis,
                'createdBy' => 'Performance assignment',
                'createdAt' => CarbonImmutable::parse($assignment->assigned_at)->toIso8601String(),
            ]);

        return $relationships->concat($cycleAssignments)->values()->all();
    }

    private function developmentForActor(User $actor): array
    {
        $feedback = DB::table('performance_feedback_records as feedback')
            ->join('users as subjects', 'subjects.id', '=', 'feedback.subject_user_id')
            ->join('users as authors', 'authors.id', '=', 'feedback.author_user_id')
            ->leftJoin('performance_cycles as cycles', 'cycles.id', '=', 'feedback.performance_cycle_id')
            ->leftJoin('performance_reviews as reviews', 'reviews.id', '=', 'feedback.performance_review_id')
            ->when(! $actor->isPerformanceOperator(), function (Builder $query) use ($actor): void {
                $query->where(function (Builder $scope) use ($actor): void {
                    $scope->where('feedback.author_user_id', $actor->id)
                        ->orWhere(function (Builder $employeeView) use ($actor): void {
                            $employeeView->where('feedback.subject_user_id', $actor->id)
                                ->where('feedback.visibility', 'Employee & Manager');
                        })
                        ->orWhereExists(function (Builder $assignedView) use ($actor): void {
                            $assignedView->selectRaw('1')
                                ->from('performance_review_assignments as feedback_assignments')
                                ->whereColumn('feedback_assignments.subject_user_id', 'feedback.subject_user_id')
                                ->where('feedback_assignments.evaluator_user_id', $actor->id)
                                ->where('feedback_assignments.active', true)
                                ->where('feedback.visibility', '!=', 'HR Only');
                        });
                });
            })
            ->get([
                'feedback.*',
                'subjects.personnel_key as subject_key',
                'authors.personnel_key as author_key',
                'cycles.external_key as cycle_key',
                'reviews.external_key as review_key',
            ])
            ->map(fn (object $record) => $this->feedbackToArray($record))
            ->values()
            ->all();

        $pips = DB::table('performance_improvement_plans as pips')
            ->join('users as subjects', 'subjects.id', '=', 'pips.subject_user_id')
            ->join('users as managers', 'managers.id', '=', 'pips.assigned_manager_id')
            ->join('users as creators', 'creators.id', '=', 'pips.created_by_id')
            ->join('performance_reviews as reviews', 'reviews.id', '=', 'pips.performance_review_id')
            ->when(! $actor->isPerformanceOperator(), function (Builder $query) use ($actor): void {
                $query->where(function (Builder $scope) use ($actor): void {
                    $scope->where('pips.subject_user_id', $actor->id)
                        ->orWhere('pips.assigned_manager_id', $actor->id);
                });
            })
            ->get([
                'pips.*',
                'subjects.personnel_key as subject_key',
                'managers.personnel_key as manager_key',
                'creators.personnel_key as creator_key',
                'reviews.external_key as review_key',
            ])
            ->map(fn (object $pip) => $this->pipToArray($pip, $actor))
            ->values()
            ->all();

        $journeys = DB::table('performance_trainee_journeys as journeys')
            ->join('users as trainees', 'trainees.id', '=', 'journeys.trainee_user_id')
            ->leftJoin('performance_cycles as cycles', 'cycles.id', '=', 'journeys.performance_cycle_id')
            ->when(! $actor->isPerformanceOperator(), function (Builder $query) use ($actor): void {
                $query->where(function (Builder $scope) use ($actor): void {
                    $scope->where('journeys.trainee_user_id', $actor->id)
                        ->orWhereExists(function (Builder $managerView) use ($actor): void {
                            $managerView->selectRaw('1')
                                ->from('performance_reporting_relationships as journey_relationships')
                                ->whereColumn('journey_relationships.direct_report_id', 'journeys.trainee_user_id')
                                ->where('journey_relationships.supervisor_id', $actor->id)
                                ->where('journey_relationships.active', true);
                        });
                });
            })
            ->get([
                'journeys.*',
                'trainees.personnel_key as trainee_key',
                'cycles.external_key as cycle_key',
            ])
            ->map(fn (object $journey) => $this->journeyToArray($journey))
            ->values()
            ->all();

        return [
            'feedbackRecords' => $feedback,
            'pips' => $pips,
            'traineeJourneys' => $journeys,
        ];
    }

    private function syncOneReview(User $actor, array $requested): void
    {
        $externalKey = trim((string) ($requested['id'] ?? ''));
        if ($externalKey === '') {
            throw ValidationException::withMessages(['reviews' => 'Every review needs an id.']);
        }

        $row = $this->visibleReviewQuery($actor)
            ->where('reviews.external_key', $externalKey)
            ->first();

        if (! $row) {
            $this->createAssignedReview($actor, $requested);

            return;
        }

        DB::table('performance_reviews')->where('id', $row->id)->lockForUpdate()->first();
        $row = $this->visibleReviewQuery($actor)
            ->where('reviews.id', $row->id)
            ->first();

        $requestedVersion = isset($requested['lockVersion']) ? (int) $requested['lockVersion'] : null;
        if ($requestedVersion !== null && $requestedVersion !== (int) $row->lock_version) {
            throw ValidationException::withMessages([
                'reviews' => "Review {$externalKey} changed on the server. Reload before saving again.",
            ]);
        }

        if (($requested['evaluatorId'] ?? null) !== $row->evaluator_key) {
            throw ValidationException::withMessages([
                'reviews' => 'Routine evaluator reassignment is disabled. Correct the authoritative reporting relationship instead of assigning a different manager or supervisor.',
            ]);
        }

        if ($row->status === 'Completed' && ($requested['status'] ?? 'Completed') !== 'Completed') {
            $this->reopenReview($actor, $row, $requested);
            $row = $this->visibleReviewQuery($actor)->where('reviews.id', $row->id)->first();
        }

        $this->syncCalibration($actor, $row, $requested);
        $row = $this->visibleReviewQuery($actor)->where('reviews.id', $row->id)->first();
        $this->syncSelfEvaluation($actor, $row, $requested);
        $this->syncAcknowledgment($actor, $row, $requested);
        $this->syncManagerReviewContent($actor, $row, $requested);
    }

    private function createAssignedReview(User $actor, array $requested): void
    {
        $subject = $this->userByKey((string) ($requested['personId'] ?? ''));
        $evaluator = $this->userByKey((string) ($requested['evaluatorId'] ?? ''));
        $cycle = $this->cycleByKey((string) ($requested['periodId'] ?? ''));

        if (
            $actor->id !== $evaluator->id
            || $subject->id === $actor->id
            || ! $actor->evaluator_capable
            || $actor->employment_status === 'Inactive'
        ) {
            $this->deny('Only the assigned evaluator may create this review.');
        }

        $this->assertCycleOpenForManagerReview($cycle);

        $assignment = DB::table('performance_review_assignments')
            ->where('performance_cycle_id', $cycle->id)
            ->where('subject_user_id', $subject->id)
            ->where('evaluator_user_id', $actor->id)
            ->where('active', true)
            ->lockForUpdate()
            ->first();

        if (! $assignment) {
            $this->deny('No active review assignment authorizes this evaluator and subject.');
        }

        if (DB::table('performance_reviews')->where('performance_review_assignment_id', $assignment->id)->exists()) {
            throw ValidationException::withMessages([
                'reviews' => 'One primary review already exists for this person and cycle.',
            ]);
        }

        $template = $this->resolveTemplate($requested['reviewTemplateId'] ?? null, $cycle, $subject);
        $now = now();

        DB::table('performance_reviews')->insert([
            'external_key' => trim((string) $requested['id']),
            'performance_review_assignment_id' => $assignment->id,
            'performance_review_template_id' => $template->id,
            'status' => ($requested['status'] ?? 'Pending') === 'In Progress' ? 'In Progress' : 'Pending',
            'workflow_state' => 'Manager Review',
            'calibration_status' => $cycle->calibration_required ? 'Pending' : 'Not Required',
            'due_date' => $requested['dueDate'] ?? $cycle->review_due_date,
            'linked_evidence' => json_encode($requested['linkedEvidence'] ?? [], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }


    private function reopenReview(User $actor, object $row, array $requested): void
    {
        $this->requireOperator($actor);
        $history = Arr::last($requested['revisionHistory'] ?? []);
        $reason = trim((string) ($history['reason'] ?? ''));
        if ($reason === '') {
            throw ValidationException::withMessages(['reviews' => 'A reopen or revision reason is required.']);
        }

        $version = DB::table('performance_review_events')
            ->where('performance_review_id', $row->id)
            ->whereIn('event_type', ['Reopened', 'Revision Requested'])
            ->max('revision_version');

        $this->recordEvent($row->id, ($history['action'] ?? 'Reopened') === 'Revision Requested' ? 'Revision Requested' : 'Reopened', $actor, [
            'reason' => $reason,
            'notes' => $history['notes'] ?? null,
            'snapshot' => $this->reviewSnapshot($row),
            'revision_version' => ((int) $version) + 1,
        ]);

        DB::table('performance_reviews')->where('id', $row->id)->update([
            'status' => 'In Progress',
            'workflow_state' => 'Revision In Progress',
            'calibration_status' => $row->calibration_required ? 'Returned for Revision' : 'Not Required',
            'finalized_at' => null,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ]);
    }

    private function syncCalibration(User $actor, object $row, array $requested): void
    {
        $next = (string) ($requested['calibrationStatus'] ?? $row->calibration_status);
        if ($next === $row->calibration_status) {
            return;
        }

        $this->requireOperator($actor);
        if (! $row->calibration_required) {
            throw ValidationException::withMessages(['reviews' => 'Calibration is not enabled for this cycle.']);
        }

        $allowed = match ($row->calibration_status) {
            'Pending' => ['In Review', 'Approved', 'Returned for Revision'],
            'In Review' => ['Approved', 'Returned for Revision'],
            default => [],
        };

        if (! in_array($next, $allowed, true)) {
            throw ValidationException::withMessages(['reviews' => 'The requested calibration transition is invalid.']);
        }

        $history = Arr::last($requested['calibrationHistory'] ?? []);
        $notes = trim((string) ($history['notes'] ?? '')) ?: null;
        $eventType = match ($next) {
            'In Review' => 'Calibration Review Started',
            'Approved' => 'Calibration Approved',
            default => 'Calibration Returned for Revision',
        };

        $updates = [
            'calibration_status' => $next,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ];

        if ($next === 'Approved') {
            $updates += [
                'status' => 'Completed',
                'workflow_state' => 'Finalized',
                'finalized_at' => now(),
            ];
        } elseif ($next === 'Returned for Revision') {
            $isLeadership360 = ($row->assignment_basis ?? '') === '360 Leadership Review';
            $updates += [
                'status' => 'In Progress',
                'workflow_state' => $isLeadership360 ? '360 Feedback Collection' : 'Revision In Progress',
                'finalized_at' => null,
            ];
            if ($isLeadership360) {
                $updates['manager_submitted_at'] = null;
                $updates['final_rating'] = null;
            }

            $version = DB::table('performance_review_events')
                ->where('performance_review_id', $row->id)
                ->whereIn('event_type', ['Reopened', 'Revision Requested'])
                ->max('revision_version');
            $this->recordEvent($row->id, 'Revision Requested', $actor, [
                'reason' => $notes ?: 'Returned during required calibration review.',
                'notes' => $isLeadership360
                    ? '360° Leadership Review returned to multi-source feedback collection before it can re-enter calibration.'
                    : 'Assigned evaluator must revise and resubmit before finalization.',
                'snapshot' => $this->reviewSnapshot($row),
                'revision_version' => ((int) $version) + 1,
            ]);
        } else {
            $updates['workflow_state'] = 'Calibration In Review';
        }

        DB::table('performance_reviews')->where('id', $row->id)->update($updates);
        $this->recordEvent($row->id, $eventType, $actor, ['notes' => $notes]);
    }

    private function syncSelfEvaluation(User $actor, object $row, array $requested): void
    {
        $current = $this->decode($row->self_evaluation, null);
        $next = $requested['selfEvaluation'] ?? null;
        if ($this->sameJson($current, $next)) {
            return;
        }

        if ($actor->id !== $row->subject_user_id || ! $row->self_evaluation_enabled || $row->status === 'Completed') {
            $this->deny('This self-evaluation cannot be changed.');
        }

        if (! is_array($next)) {
            throw ValidationException::withMessages(['selfEvaluation' => 'A valid self-evaluation is required.']);
        }

        $status = ($next['status'] ?? 'Draft') === 'Submitted' ? 'Submitted' : 'Draft';
        $selfRating = $row->self_rating_enabled && isset($next['selfRating'])
            ? max(1, min(5, (float) $next['selfRating']))
            : null;
        $canonical = [
            'accomplishments' => trim((string) ($next['accomplishments'] ?? '')),
            'goalProgress' => trim((string) ($next['goalProgress'] ?? '')),
            'challenges' => trim((string) ($next['challenges'] ?? '')),
            'comments' => trim((string) ($next['comments'] ?? '')),
            'status' => $status,
            'updatedAt' => now()->toIso8601String(),
        ];
        if ($selfRating !== null) {
            $canonical['selfRating'] = $selfRating;
        }
        if ($status === 'Submitted') {
            $canonical['submittedAt'] = now()->toIso8601String();
        }

        DB::table('performance_reviews')->where('id', $row->id)->update([
            'self_evaluation' => json_encode($canonical, JSON_THROW_ON_ERROR),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ]);
        $this->recordEvent($row->id, $status === 'Submitted' ? 'Self Evaluation Submitted' : 'Self Evaluation Saved', $actor);
    }

    private function syncAcknowledgment(User $actor, object $row, array $requested): void
    {
        $current = $this->decode($row->acknowledgment, null);
        $next = $requested['acknowledgment'] ?? null;
        if ($this->sameJson($current, $next)) {
            return;
        }

        if ($actor->id !== $row->subject_user_id || $row->status !== 'Completed') {
            $this->deny('Only the subject may acknowledge a finalized review.');
        }

        if ($row->employee_acknowledgment === 'Not Required') {
            throw ValidationException::withMessages(['acknowledgment' => 'Acknowledgment is disabled for this cycle.']);
        }

        $canonical = [
            'status' => 'Acknowledged',
            'actorId' => $actor->personnel_key,
            'timestamp' => now()->toIso8601String(),
            'statement' => 'Received / Viewed',
        ];
        DB::table('performance_reviews')->where('id', $row->id)->update([
            'acknowledgment' => json_encode($canonical, JSON_THROW_ON_ERROR),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ]);
        $this->recordEvent($row->id, 'Acknowledged', $actor, ['notes' => 'Received / Viewed']);
    }

    private function syncManagerReviewContent(User $actor, object $row, array $requested): void
    {
        $currentScores = $this->decode($row->criteria_scores, []);
        $nextScores = array_values($requested['competencyScores'] ?? []);
        $currentRecommendations = $this->decode($row->development_recommendations, []);
        $nextRecommendations = array_values($requested['developmentRecommendations'] ?? []);
        $contentChanged = ! $this->sameJson($currentScores, $nextScores)
            || trim((string) ($row->comments ?? '')) !== trim((string) ($requested['comments'] ?? ''))
            || ! $this->sameJson($currentRecommendations, $nextRecommendations)
            || (($requested['reviewTemplateId'] ?? $row->template_key) !== $row->template_key)
            || (($requested['managerSubmittedAt'] ?? null) !== null && $row->manager_submitted_at === null);

        if (! $contentChanged) {
            return;
        }

        if (
            $actor->id !== $row->evaluator_user_id
            || $actor->id === $row->subject_user_id
            || ! $actor->evaluator_capable
            || $actor->employment_status === 'Inactive'
        ) {
            $this->deny('Only the assigned evaluator may change manager-review content.');
        }
        if ($row->status === 'Completed' || in_array($row->workflow_state, ['Calibration Pending', 'Calibration In Review'], true)) {
            throw ValidationException::withMessages(['reviews' => 'This review is locked in its current workflow state.']);
        }

        $cycle = DB::table('performance_cycles')->where('id', $row->cycle_database_id)->first();
        $this->assertCycleOpenForManagerReview($cycle);
        $subject = User::query()->findOrFail($row->subject_user_id);
        $template = $this->resolveTemplate($requested['reviewTemplateId'] ?? $row->template_key, $cycle, $subject);
        $criteria = $this->decode($template->criteria, []);
        $scoresByName = collect($nextScores)->keyBy('name');

        foreach ($nextScores as $score) {
            $value = (float) ($score['score'] ?? 0);
            if ($value < 1 || $value > 5 || ! collect($criteria)->contains('name', $score['name'] ?? null)) {
                throw ValidationException::withMessages(['reviews' => 'Every submitted criterion score must use the configured 1–5 scale.']);
            }
        }

        $submit = ! empty($requested['managerSubmittedAt'])
            || ($requested['status'] ?? null) === 'Completed'
            || in_array($requested['workflowState'] ?? null, ['Calibration Pending', 'Finalized'], true);
        $rating = null;

        if ($submit) {
            if (count($nextScores) !== count($criteria)) {
                throw ValidationException::withMessages(['reviews' => 'Rate every configured criterion before submitting.']);
            }
            $weightedTotal = 0.0;
            $totalWeight = 0.0;
            foreach ($criteria as $criterion) {
                $score = $scoresByName->get($criterion['name']);
                if (! $score) {
                    throw ValidationException::withMessages(['reviews' => 'A configured criterion rating is missing.']);
                }
                $weight = (float) $criterion['weight'];
                $weightedTotal += (float) $score['score'] * $weight;
                $totalWeight += $weight;
            }
            if (round($totalWeight, 2) !== 100.0) {
                throw ValidationException::withMessages(['reviews' => 'The server review template must total 100%.']);
            }
            $rating = round($weightedTotal / $totalWeight, 2);
        }

        $requiresCalibration = $submit && (bool) $cycle->calibration_required;
        $updates = [
            'performance_review_template_id' => $template->id,
            'criteria_scores' => json_encode($nextScores, JSON_THROW_ON_ERROR),
            'comments' => trim((string) ($requested['comments'] ?? '')) ?: null,
            'development_recommendations' => json_encode($nextRecommendations, JSON_THROW_ON_ERROR),
            'status' => $submit && ! $requiresCalibration ? 'Completed' : 'In Progress',
            'workflow_state' => $submit
                ? ($requiresCalibration ? 'Calibration Pending' : 'Finalized')
                : ($row->workflow_state === 'Revision In Progress' ? 'Revision In Progress' : 'Manager Review'),
            'calibration_status' => $requiresCalibration ? 'Pending' : ($cycle->calibration_required ? $row->calibration_status : 'Not Required'),
            'final_rating' => $submit ? $rating : null,
            'manager_submitted_at' => $submit ? now() : $row->manager_submitted_at,
            'finalized_at' => $submit && ! $requiresCalibration ? now() : null,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ];
        DB::table('performance_reviews')->where('id', $row->id)->update($updates);
        $this->recordEvent($row->id, $submit ? 'Manager Submitted' : 'Manager Draft Saved', $actor);
    }

    private function upsertFeedback(User $actor, array $record): void
    {
        $key = trim((string) ($record['id'] ?? ''));
        $subject = $this->userByKey((string) ($record['personId'] ?? ''));
        $author = $this->userByKey((string) ($record['authorId'] ?? ''));
        $existing = DB::table('performance_feedback_records')->where('external_key', $key)->lockForUpdate()->first();
        $this->assertLockVersion($existing, $record, 'Feedback record');

        $visibility = in_array($record['visibility'] ?? null, ['Employee & Manager', 'Manager & HR', 'HR Only'], true)
            ? $record['visibility']
            : 'Employee & Manager';
        $recordType = in_array($record['recordType'] ?? null, ['1:1 Check-in', 'Feedback Note', 'Coaching Action'], true)
            ? $record['recordType']
            : 'Feedback Note';
        $cycleId = ! empty($record['cycleId']) ? $this->cycleByKey($record['cycleId'])->id : null;
        $reviewId = ! empty($record['relatedReviewId'])
            ? DB::table('performance_reviews')->where('external_key', $record['relatedReviewId'])->value('id')
            : null;
        $linkedGoalKeys = array_values($record['linkedGoalIds'] ?? []);
        $coachingAction = trim((string) ($record['coachingAction'] ?? '')) ?: null;
        $followUpDate = ! empty($record['followUpDate']) ? (string) $record['followUpDate'] : null;
        $note = trim((string) ($record['note'] ?? ''));

        if ($existing && (int) $existing->author_user_id !== (int) $actor->id && ! $actor->isPerformanceOperator()) {
            $unchanged =
                (int) $existing->subject_user_id === (int) $subject->id
                && (int) $existing->author_user_id === (int) $author->id
                && ($existing->performance_cycle_id === null ? null : (int) $existing->performance_cycle_id) === ($cycleId === null ? null : (int) $cycleId)
                && ($existing->performance_review_id === null ? null : (int) $existing->performance_review_id) === ($reviewId === null ? null : (int) $reviewId)
                && (string) $existing->record_type === $recordType
                && trim((string) $existing->note) === $note
                && (trim((string) ($existing->coaching_action ?? '')) ?: null) === $coachingAction
                && array_values($this->decode($existing->linked_goal_keys, [])) === $linkedGoalKeys
                && ($existing->follow_up_date ? (string) $existing->follow_up_date : null) === $followUpDate
                && (string) $existing->visibility === $visibility;

            if ($unchanged) {
                // Bulk Development saves echo visible records back to the server.
                // A manager may carry an unchanged governance-authored note in
                // that payload without receiving authorship rights over it.
                return;
            }

            $this->deny('You cannot change another author’s feedback record.');
        }

        if ($author->id !== $actor->id && ! $actor->isPerformanceOperator()) {
            $this->deny('Feedback authorship cannot be impersonated.');
        }

        if (! $actor->isPerformanceOperator() && ! $this->hasEvaluatorScope($actor->id, $subject->id, $record['cycleId'] ?? null)) {
            $this->deny('Feedback is limited to assigned personnel.');
        }

        if ($visibility === 'HR Only' && ! $actor->isPerformanceOperator()) {
            $this->deny('Only Admin/HR may create HR-only feedback.');
        }

        $values = [
            'subject_user_id' => $subject->id,
            'author_user_id' => $author->id,
            'performance_cycle_id' => $cycleId,
            'performance_review_id' => $reviewId,
            'record_type' => $recordType,
            'note' => $note,
            'coaching_action' => $coachingAction,
            'linked_goal_keys' => json_encode($linkedGoalKeys, JSON_THROW_ON_ERROR),
            'follow_up_date' => $followUpDate,
            'visibility' => $visibility,
            'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
            'updated_at' => now(),
        ];

        if ($existing) {
            DB::table('performance_feedback_records')->where('id', $existing->id)->update($values);
        } else {
            if ($key === '' || $values['note'] === '') {
                throw ValidationException::withMessages(['development' => 'Feedback id and note are required.']);
            }
            DB::table('performance_feedback_records')->insert($values + [
                'external_key' => $key,
                'created_at' => now(),
            ]);
        }
    }

    private function upsertPip(User $actor, array $pip): void
    {
        $key = trim((string) ($pip['id'] ?? ''));
        $existing = DB::table('performance_improvement_plans')->where('external_key', $key)->lockForUpdate()->first();
        $this->assertLockVersion($existing, $pip, 'Performance Improvement Plan');
        $subject = $this->userByKey((string) ($pip['personId'] ?? ''));
        $manager = $this->userByKey((string) ($pip['assignedManagerId'] ?? ''));
        $review = DB::table('performance_reviews as reviews')
            ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
            ->where('reviews.external_key', $pip['relatedReviewId'] ?? '')
            ->select(
                'reviews.*',
                'assignments.subject_user_id',
                'assignments.evaluator_user_id',
                'assignments.basis as assignment_basis',
            )
            ->first();

        if (! $review || $review->subject_user_id !== $subject->id || $review->status !== 'Completed') {
            throw ValidationException::withMessages(['development' => 'A PIP must reference the subject’s finalized review.']);
        }

        if (! $existing && ! $actor->isPerformanceOperator()) {
            $this->deny('Only authorized Admin/HR operators may create a PIP.');
        }
        if ($existing && ! $actor->isPerformanceOperator() && (int) $existing->assigned_manager_id !== (int) $actor->id) {
            $this->deny('Only the assigned manager or Admin/HR may update this PIP.');
        }
        $resolvedPipOwner = $this->resolvePipOwnerForReview($subject, $review);
        if (! $resolvedPipOwner || $manager->id !== $resolvedPipOwner->id) {
            throw ValidationException::withMessages([
                'development' => 'The PIP owner must match the server-resolved Review Governance or Admin/HR governance owner for this finalized review.',
            ]);
        }

        $managerFollowThrough = $existing !== null && ! $actor->isPerformanceOperator();

        if ($existing && $managerFollowThrough) {
            if (
                (int) $existing->subject_user_id !== (int) $subject->id
                || (int) $existing->performance_review_id !== (int) $review->id
                || (int) $existing->assigned_manager_id !== (int) $manager->id
            ) {
                $this->deny('Managers may update PIP follow-through only; subject, review linkage, and ownership are governed.');
            }
        }

        if ($existing) {
            if ($existing->status === 'Completed') {
                throw ValidationException::withMessages(['pip' => 'Closed Performance Improvement Plans are read-only.']);
            }

            $immutableChanged =
                trim((string) ($pip['performanceConcern'] ?? '')) !== trim((string) $existing->performance_concern)
                || trim((string) ($pip['expectedImprovement'] ?? '')) !== trim((string) $existing->expected_improvement)
                || array_values($pip['actionItems'] ?? []) !== array_values($this->decode($existing->action_items, []))
                || (string) ($pip['startDate'] ?? '') !== (string) $existing->start_date;
            if ($immutableChanged && ! $managerFollowThrough) {
                throw ValidationException::withMessages([
                    'pip' => 'The started PIP basis, concern, expected improvement, action plan, and Start Date are locked. Material changes require a governed amendment workflow.',
                ]);
            }

            if (! $managerFollowThrough && (string) ($pip['targetEndDate'] ?? '') !== (string) $existing->target_end_date) {
                throw ValidationException::withMessages([
                    'pip' => 'Target End cannot be edited directly. Use the governed Extend Plan action when the outcome review is due.',
                ]);
            }
            $requestedStatus = in_array($pip['status'] ?? null, self::PIP_STATUSES, true)
                ? (string) $pip['status']
                : (string) $existing->status;
            if ($requestedStatus !== (string) $existing->status
                && in_array($requestedStatus, ['Extended', 'Completed'], true)) {
                throw ValidationException::withMessages([
                    'pip' => 'Extended and Completed are governance outcomes. Use the HR/Admin governance action.',
                ]);
            }
            if (! $managerFollowThrough && trim((string) ($pip['outcomeNotes'] ?? '')) !== trim((string) ($existing->outcome_notes ?? ''))) {
                throw ValidationException::withMessages([
                    'pip' => 'PIP outcome cannot be edited directly. Use the governed Close PIP action.',
                ]);
            }
            if ($actor->isPerformanceOperator() && trim((string) ($pip['hrReviewNotes'] ?? '')) !== trim((string) ($existing->hr_review_notes ?? ''))) {
                throw ValidationException::withMessages([
                    'pip' => 'HR governance outcome notes are recorded only through the governed outcome workflow.',
                ]);
            }
        } elseif (($pip['status'] ?? 'Active') !== 'Active' || trim((string) ($pip['outcomeNotes'] ?? '')) !== '' || trim((string) ($pip['hrReviewNotes'] ?? '')) !== '') {
            throw ValidationException::withMessages([
                'pip' => 'A new Performance Improvement Plan must start as Active without a pre-recorded outcome.',
            ]);
        }

        $actualStart = CarbonImmutable::now(config('app.timezone'))->startOfDay();
        $targetEndValue = $managerFollowThrough
            ? (string) $existing->target_end_date
            : (string) ($pip['targetEndDate'] ?? '');
        $targetEnd = CarbonImmutable::parse($targetEndValue, config('app.timezone'))->startOfDay();
        $milestones = array_values($pip['milestones'] ?? []);

        if (! $existing) {
            $planDays = (int) $actualStart->diffInDays($targetEnd, false);
            if ($planDays < 30 || $planDays > 90) {
                throw ValidationException::withMessages([
                    'pip.targetEndDate' => 'Target End must be 30 to 90 calendar days after the PIP starts.',
                ]);
            }

            $firstMilestone = $milestones[0] ?? null;
            $firstMilestoneTitle = trim((string) ($firstMilestone['title'] ?? ''));
            $firstMilestoneDateValue = trim((string) ($firstMilestone['dueDate'] ?? ''));
            if ($firstMilestoneTitle === '' || $firstMilestoneDateValue === '') {
                throw ValidationException::withMessages([
                    'pip.milestones' => 'A first PIP check-in and check-in date are required.',
                ]);
            }

            $firstMilestoneDate = CarbonImmutable::parse($firstMilestoneDateValue, config('app.timezone'))->startOfDay();
            $checkInDays = (int) $actualStart->diffInDays($firstMilestoneDate, false);
            if ($checkInDays < 7 || $checkInDays > 14 || $firstMilestoneDate->greaterThanOrEqualTo($targetEnd)) {
                throw ValidationException::withMessages([
                    'pip.milestones' => 'The first check-in must be scheduled 7 to 14 calendar days after the PIP starts and before Target End.',
                ]);
            }
        }

        $status = in_array($pip['status'] ?? null, self::PIP_STATUSES, true) ? $pip['status'] : 'Active';
        $values = [
            'subject_user_id' => $subject->id,
            'performance_review_id' => $review->id,
            'assigned_manager_id' => $manager->id,
            'performance_concern' => $managerFollowThrough
                ? $existing->performance_concern
                : trim((string) ($pip['performanceConcern'] ?? '')),
            'expected_improvement' => $managerFollowThrough
                ? $existing->expected_improvement
                : trim((string) ($pip['expectedImprovement'] ?? '')),
            'action_items' => $managerFollowThrough
                ? $existing->action_items
                : json_encode(array_values($pip['actionItems'] ?? []), JSON_THROW_ON_ERROR),
            'start_date' => $existing ? $existing->start_date : $actualStart->toDateString(),
            'target_end_date' => $targetEnd->toDateString(),
            'status' => $status,
            'milestones' => json_encode($milestones, JSON_THROW_ON_ERROR),
            'progress_notes' => json_encode(array_values($pip['progressNotes'] ?? []), JSON_THROW_ON_ERROR),
            'development_actions' => json_encode(array_values($pip['developmentActions'] ?? []), JSON_THROW_ON_ERROR),
            'outcome_notes' => $managerFollowThrough
                ? $existing->outcome_notes
                : (trim((string) ($pip['outcomeNotes'] ?? '')) ?: null),
            'hr_review_notes' => $actor->isPerformanceOperator()
                ? (trim((string) ($pip['hrReviewNotes'] ?? '')) ?: null)
                : ($existing->hr_review_notes ?? null),
            'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
            'updated_at' => now(),
        ];

        if ($existing) {
            DB::table('performance_improvement_plans')->where('id', $existing->id)->update($values);
        } else {
            if ($key === '' || $values['performance_concern'] === '' || $values['expected_improvement'] === '') {
                throw ValidationException::withMessages(['development' => 'PIP concern and expected improvement are required.']);
            }
            DB::table('performance_improvement_plans')->insert($values + [
                'external_key' => $key,
                'created_by_id' => $actor->id,
                'created_at' => now(),
            ]);
        }
    }

    private function upsertTraineeJourney(User $actor, array $journey): void
    {
        $trainee = $this->userByKey((string) ($journey['traineeId'] ?? ''));
        if ($trainee->person_type !== 'Trainee') {
            throw ValidationException::withMessages(['development' => 'Trainee journeys require a Trainee subject.']);
        }
        if (! $actor->isPerformanceOperator() && ! $this->hasEvaluatorScope($actor->id, $trainee->id, $journey['cycleId'] ?? null)) {
            $this->deny('Only Admin/HR or the assigned evaluator may update this trainee journey.');
        }

        $cycleId = ! empty($journey['cycleId']) ? $this->cycleByKey($journey['cycleId'])->id : null;
        $key = trim((string) ($journey['id'] ?? ''));
        $existing = DB::table('performance_trainee_journeys')->where('external_key', $key)->lockForUpdate()->first();
        $this->assertLockVersion($existing, $journey, 'Trainee journey');

        $requestedStage = trim((string) ($journey['currentStage'] ?? 'New Trainee'));
        if (! in_array($requestedStage, self::TRAINEE_JOURNEY_STAGES, true)) {
            throw ValidationException::withMessages(['development' => 'The trainee journey stage is invalid.']);
        }

        $milestones = array_values($journey['milestones'] ?? []);
        $incompleteSeen = false;
        foreach ($milestones as $milestone) {
            $completed = trim((string) ($milestone['completedAt'] ?? '')) !== '';
            if (! $completed) {
                $incompleteSeen = true;
                continue;
            }
            if ($incompleteSeen) {
                throw ValidationException::withMessages([
                    'development' => 'Trainee milestones must be completed in sequence.',
                ]);
            }
        }

        if ($existing) {
            $currentStage = trim((string) $existing->current_stage);

            $nextStage = [
                'New Trainee' => 'Initial Evaluation',
                'Initial Evaluation' => 'Development Plan',
                'Development Plan' => 'Learning / Training / Practical Development',
                'Learning / Training / Practical Development' => 'Re-evaluation',
                'Re-evaluation' => 'Development Cycle Completed / Ready',
                'Development Cycle Completed / Ready' => null,
            ];

            if (
                ! array_key_exists($currentStage, $nextStage)
                || (
                    $requestedStage !== $currentStage
                    && $nextStage[$currentStage] !== $requestedStage
                )
            ) {
                throw ValidationException::withMessages([
                    'development' => 'Trainee journey stages must advance one governed step at a time.',
                ]);
            }
        }

        $values = [
            'trainee_user_id' => $trainee->id,
            'performance_cycle_id' => $cycleId,
            'current_stage' => $requestedStage,
            'milestones' => json_encode($milestones, JSON_THROW_ON_ERROR),
            'development_action_keys' => json_encode(array_values($journey['developmentActionIds'] ?? []), JSON_THROW_ON_ERROR),
            'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
            'updated_at' => now(),
        ];

        if ($existing) {
            DB::table('performance_trainee_journeys')->where('id', $existing->id)->update($values);
        } else {
            DB::table('performance_trainee_journeys')->insert($values + [
                'external_key' => $key,
                'created_at' => now(),
            ]);
        }
    }

    private function upsertCycle(array $cycle): void
    {
        $type = (string) ($cycle['cycleType'] ?? '');
        $status = (string) ($cycle['status'] ?? '');
        if (! in_array($type, self::CYCLE_TYPES, true) || ! in_array($status, self::CYCLE_STATUSES, true)) {
            throw ValidationException::withMessages(['configuration' => 'Cycle type or status is invalid.']);
        }

        $start = CarbonImmutable::parse($cycle['performanceStartDate'] ?? null);
        $end = CarbonImmutable::parse($cycle['performanceEndDate'] ?? null);
        $open = CarbonImmutable::parse($cycle['reviewOpenDate'] ?? null);
        $due = CarbonImmutable::parse($cycle['reviewDueDate'] ?? null);
        if ($end->lt($start) || $open->lt($end) || $due->lt($open)) {
            throw ValidationException::withMessages(['configuration' => 'Cycle dates must follow performance start/end, review open, then review due.']);
        }

        $key = trim((string) ($cycle['id'] ?? ''));
        $existing = DB::table('performance_cycles')->where('external_key', $key)->lockForUpdate()->first();
        $this->assertLockVersion($existing, $cycle, 'Performance Cycle');
        $values = [
            'name' => trim((string) ($cycle['cycleName'] ?? '')),
            'cycle_type' => $type,
            'performance_start_date' => $start->toDateString(),
            'performance_end_date' => $end->toDateString(),
            'review_open_date' => $open->toDateString(),
            'review_due_date' => $due->toDateString(),
            'applicable_person_types' => json_encode(array_values($cycle['applicablePersonTypes'] ?? []), JSON_THROW_ON_ERROR),
            'department_scopes' => json_encode(array_values($cycle['departmentScopes'] ?? []), JSON_THROW_ON_ERROR),
            'review_template_keys' => json_encode($cycle['reviewTemplateIds'] ?? [], JSON_THROW_ON_ERROR),
            'self_evaluation_enabled' => (bool) ($cycle['selfEvaluationEnabled'] ?? false),
            'self_rating_enabled' => (bool) ($cycle['selfRatingEnabled'] ?? false),
            'calibration_required' => (bool) ($cycle['calibrationRequired'] ?? false),
            'employee_acknowledgment' => in_array($cycle['employeeAcknowledgment'] ?? null, ['Required', 'Optional', 'Not Required'], true)
                ? $cycle['employeeAcknowledgment']
                : 'Optional',
            'probationary_milestone_months' => $cycle['probationaryMilestoneMonths'] ?? null,
            'status' => $status,
            'description' => trim((string) ($cycle['description'] ?? '')) ?: null,
            'instructions' => trim((string) ($cycle['instructions'] ?? '')) ?: null,
            'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
            'updated_at' => now(),
        ];
        DB::table('performance_cycles')->updateOrInsert(['external_key' => $key], $values + ['created_at' => $existing->created_at ?? now()]);
    }

    private function upsertReviewTemplate(array $template): void
    {
        $criteria = array_values($template['criteria'] ?? []);
        $weight = collect($criteria)->sum(fn (array $criterion) => (float) ($criterion['weight'] ?? 0));
        if (round($weight, 2) !== 100.0) {
            throw ValidationException::withMessages(['configuration' => 'Review template weights must total 100%.']);
        }
        $key = trim((string) ($template['id'] ?? ''));
        $existing = DB::table('performance_review_templates')->where('external_key', $key)->lockForUpdate()->first();
        $this->assertLockVersion($existing, $template, 'Review template');
        $ratingScale = $template['ratingScale'] ?? [
            'id' => $template['ratingScaleId'] ?? 'rating-scale-five-point',
            'levels' => [],
        ];
        DB::table('performance_review_templates')->updateOrInsert(['external_key' => $key], [
            'name' => trim((string) ($template['name'] ?? '')),
            'person_type' => $template['personType'] ?? 'Employee',
            'rating_scale_key' => $template['ratingScaleId'] ?? 'rating-scale-five-point',
            'rating_scale' => json_encode($ratingScale, JSON_THROW_ON_ERROR),
            'criteria' => json_encode($criteria, JSON_THROW_ON_ERROR),
            'active' => (bool) ($template['active'] ?? true),
            'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
            'created_at' => $existing->created_at ?? now(),
            'updated_at' => now(),
        ]);
    }

    private function assertSourceGovernedGoalTemplates(array $templates): void
    {
        $current = DB::table('performance_goal_templates')
            ->orderBy('external_key')
            ->get()
            ->map(fn (object $template) => $this->goalTemplateToArray($template))
            ->keyBy('id');

        $incoming = collect($templates)
            ->filter(fn ($template) => is_array($template) && trim((string) ($template['id'] ?? '')) !== '')
            ->keyBy(fn (array $template) => trim((string) $template['id']));

        if ($incoming->count() !== $current->count() || $incoming->keys()->sort()->values()->all() !== $current->keys()->sort()->values()->all()) {
            throw ValidationException::withMessages([
                'goalTemplates' => 'Goal Plans are maintained from authoritative company sources and cannot be created or removed from Performance configuration.',
            ]);
        }

        $normalize = static function (array $template): array {
            return [
                'id' => trim((string) ($template['id'] ?? '')),
                'name' => trim((string) ($template['name'] ?? '')),
                'applicablePersonTypes' => array_values($template['applicablePersonTypes'] ?? []),
                'departmentScopes' => array_values($template['departmentScopes'] ?? []),
                'positionScopes' => array_values($template['positionScopes'] ?? []),
                'cycleIds' => array_values($template['cycleIds'] ?? []),
                'description' => trim((string) ($template['description'] ?? '')) ?: null,
                'allowIndividualOverrides' => (bool) ($template['allowIndividualOverrides'] ?? false),
                'items' => array_values($template['items'] ?? []),
                'active' => (bool) ($template['active'] ?? false),
            ];
        };

        foreach ($current as $key => $template) {
            $candidate = $incoming->get($key);
            if (! is_array($candidate) || $normalize($candidate) != $normalize($template)) {
                throw ValidationException::withMessages([
                    'goalTemplates' => 'Goal Plan structure, scope, metrics, and weights are source-governed and read-only in this workspace.',
                ]);
            }
        }
    }

    private function upsertGoalTemplate(array $template): void
    {
        $items = array_values($template['items'] ?? []);
        $weight = collect($items)->sum(fn (array $item) => (float) ($item['weight'] ?? 0));
        if (round($weight, 2) !== 100.0) {
            throw ValidationException::withMessages(['configuration' => 'Goal template weights must total 100%.']);
        }
        $key = trim((string) ($template['id'] ?? ''));
        $existing = DB::table('performance_goal_templates')->where('external_key', $key)->lockForUpdate()->first();
        $this->assertLockVersion($existing, $template, 'Goal template');
        DB::table('performance_goal_templates')->updateOrInsert(['external_key' => $key], [
            'name' => trim((string) ($template['name'] ?? '')),
            'applicable_person_types' => json_encode(array_values($template['applicablePersonTypes'] ?? []), JSON_THROW_ON_ERROR),
            'department_scopes' => json_encode(array_values($template['departmentScopes'] ?? []), JSON_THROW_ON_ERROR),
            'position_scopes' => json_encode(array_values($template['positionScopes'] ?? []), JSON_THROW_ON_ERROR),
            'cycle_keys' => json_encode(array_values($template['cycleIds'] ?? []), JSON_THROW_ON_ERROR),
            'description' => trim((string) ($template['description'] ?? '')) ?: null,
            'allow_individual_overrides' => (bool) ($template['allowIndividualOverrides'] ?? true),
            'items' => json_encode($items, JSON_THROW_ON_ERROR),
            'active' => (bool) ($template['active'] ?? true),
            'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
            'created_at' => $existing->created_at ?? now(),
            'updated_at' => now(),
        ]);
    }

    private function upsertGoal(array $goal, bool $preserveProgress = true): void
    {
        $person = $this->userByKey((string) ($goal['personId'] ?? ''));
        $cycle = $this->cycleByKey((string) ($goal['cycleId'] ?? ''));
        $templateId = ! empty($goal['templateId'])
            ? DB::table('performance_goal_templates')->where('external_key', $goal['templateId'])->value('id')
            : null;
        $progress = max(0, min(100, (float) ($goal['progress'] ?? 0)));
        $key = trim((string) ($goal['id'] ?? ''));
        $existing = DB::table('performance_goals')->where('external_key', $key)->lockForUpdate()->first();
        $this->assertLockVersion($existing, $goal, 'Performance goal');
        DB::table('performance_goals')->updateOrInsert(['external_key' => $key], [
            'user_id' => $person->id,
            'performance_cycle_id' => $cycle->id,
            'performance_goal_template_id' => $templateId,
            'template_item_key' => $goal['templateItemId'] ?? null,
            'title' => trim((string) ($goal['title'] ?? '')),
            'metric_type' => $goal['metricType'] ?? 'Goal',
            'target' => trim((string) ($goal['target'] ?? '')),
            'unit' => trim((string) ($goal['unit'] ?? '')) ?: null,
            'weight' => (float) ($goal['weight'] ?? 0),
            // Formal progress/status is evaluator-owned. Configuration sync may define
            // structure but must never become a casual Admin progress editor.
            'progress' => $existing && $preserveProgress ? $existing->progress : $progress,
            'status' => $existing && $preserveProgress ? $existing->status : ($goal['status'] ?? 'Not Started'),
            'start_date' => $goal['startDate'] ?? $cycle->performance_start_date,
            'end_date' => $goal['endDate'] ?? $cycle->performance_end_date,
            'individual_override' => (bool) ($goal['individualOverride'] ?? false),
            'description' => trim((string) ($goal['description'] ?? '')) ?: null,
            'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
            'created_at' => $existing->created_at ?? now(),
            'updated_at' => now(),
        ]);
    }

    private function upsertAssignmentConfiguration(User $actor, array $assignment): void
    {
        $basis = $assignment['basis'] ?? null;
        $scopeType = $assignment['scopeType'] ?? 'Specific Person';

        // Review Governance is system-derived. Configuration sync may carry the
        // canonical reporting relationships used by the seeder/source, but it must
        // ignore derived cycle assignments (including 360° and smart routing rows).
        if ($scopeType !== 'Reporting Relationship' || in_array($basis, ['Cycle Assignment', '360 Leadership Review', 'Smart Department Leadership'], true)) {
            return;
        }

        $evaluator = $this->userByKey((string) ($assignment['evaluatorId'] ?? ''));
        if (! $evaluator->evaluator_capable || $evaluator->employment_status === 'Inactive') {
            throw ValidationException::withMessages(['configuration' => 'The selected evaluator is not active and evaluator-capable.']);
        }

        $subjects = match ($scopeType) {
            'Department' => User::query()
                ->where('department', $assignment['department'] ?? '')
                ->where('employment_status', '!=', 'Inactive')
                ->whereNotNull('personnel_key')
                ->get(),
            default => collect([$this->userByKey((string) ($assignment['personId'] ?? ''))]),
        };

        foreach ($subjects as $subject) {
            if ($subject->id === $evaluator->id) {
                throw ValidationException::withMessages(['configuration' => 'Official manager self-evaluation is not allowed.']);
            }

            if ($scopeType === 'Reporting Relationship') {
                $relationshipKey = trim((string) ($assignment['reportingRelationshipId'] ?? $assignment['id'] ?? ''));
                if ($relationshipKey === '') {
                    throw ValidationException::withMessages([
                        'configuration' => 'A reporting relationship must have a stable source identifier.',
                    ]);
                }

                // Configuration sync must be idempotent. The reporting table has both
                // a unique external key and a unique (supervisor, direct report, effective_from)
                // constraint. The previous updateOrInsert matched only external_key while
                // stamping effective_from with "today", so the same canonical relationship
                // could collide with an already-persisted row under the tuple constraint.
                $effectiveFrom = null;
                $effectiveFromSource = trim((string) ($assignment['effectiveFrom'] ?? $assignment['createdAt'] ?? ''));
                if ($effectiveFromSource !== '') {
                    try {
                        $effectiveFrom = CarbonImmutable::parse($effectiveFromSource)->toDateString();
                    } catch (\Throwable) {
                        $effectiveFrom = null;
                    }
                }
                $effectiveFrom ??= now()->toDateString();

                $existingRelationship = DB::table('performance_reporting_relationships')
                    ->where('supervisor_id', $evaluator->id)
                    ->where('direct_report_id', $subject->id)
                    ->whereDate('effective_from', $effectiveFrom)
                    ->first();

                if (! $existingRelationship) {
                    $existingRelationship = DB::table('performance_reporting_relationships')
                        ->where('external_key', $relationshipKey)
                        ->first();
                }

                $relationshipValues = [
                    'supervisor_id' => $evaluator->id,
                    'direct_report_id' => $subject->id,
                    'source' => 'Configuration Sync',
                    'active' => true,
                    'effective_from' => $effectiveFrom,
                    'effective_to' => null,
                    'created_by_id' => $actor->id,
                    'updated_at' => now(),
                ];

                if ($existingRelationship) {
                    DB::table('performance_reporting_relationships')
                        ->where('id', $existingRelationship->id)
                        ->update($relationshipValues);
                } else {
                    DB::table('performance_reporting_relationships')->insert([
                        'external_key' => $relationshipKey,
                        ...$relationshipValues,
                        'created_at' => now(),
                    ]);
                }

                User::query()->whereKey($subject->id)->update(['manager_id' => $evaluator->id]);
            }

            $cycleKeys = array_values($assignment['cycleIds'] ?? $assignment['periodIds'] ?? []);
            $cycles = DB::table('performance_cycles')
                ->when($cycleKeys !== [], fn (Builder $query) => $query->whereIn('external_key', $cycleKeys))
                ->whereIn('status', ['Draft', 'Active'])
                ->get();

            foreach ($cycles as $cycle) {
                if (! $this->cycleAppliesToUser($cycle, $subject)) {
                    continue;
                }
                $existing = DB::table('performance_review_assignments')
                    ->where('performance_cycle_id', $cycle->id)
                    ->where('subject_user_id', $subject->id)
                    ->lockForUpdate()
                    ->first();
                if ($existing && $existing->evaluator_user_id !== $evaluator->id) {
                    throw ValidationException::withMessages([
                        'configuration' => "{$subject->name} already has a primary evaluator for {$cycle->name}. Routine evaluator reassignment is disabled; correct the authoritative reporting relationship if the organizational structure changed.",
                    ]);
                }

                $this->ensureAssignmentAndReview(
                    $actor,
                    $cycle,
                    $subject,
                    $evaluator,
                    $scopeType === 'Reporting Relationship' ? 'Reporting Relationship' : 'Exception',
                );
            }
        }
    }

    private function deriveReviewAssignments(User $actor): void
    {
        $cycles = DB::table('performance_cycles')->whereIn('status', ['Draft', 'Active'])->get();
        $relationships = DB::table('performance_reporting_relationships as relationships')
            ->join('users as supervisors', 'supervisors.id', '=', 'relationships.supervisor_id')
            ->join('users as reports', 'reports.id', '=', 'relationships.direct_report_id')
            ->where('relationships.active', true)
            ->where('supervisors.evaluator_capable', true)
            ->where('supervisors.employment_status', '!=', 'Inactive')
            ->where('reports.employment_status', '!=', 'Inactive')
            ->select([
                'relationships.id as relationship_id',
                'relationships.external_key as relationship_key',
                'supervisors.id as supervisor_id',
                'reports.id as report_id',
            ])
            ->get();

        $leaderIds = $relationships
            ->pluck('supervisor_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
        $directReportIds = $relationships
            ->pluck('report_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
        $topScopeLeaderIds = $leaderIds
            ->reject(fn (int $leaderId) => $directReportIds->contains($leaderId))
            ->values();

        foreach ($cycles as $cycle) {
            // 1) Standard path: the recorded organizational reporting relationship is authoritative.
            foreach ($relationships as $relationship) {
                $subject = User::query()->find($relationship->report_id);
                $evaluator = User::query()->find($relationship->supervisor_id);
                if (! $subject || ! $evaluator || ! $this->cycleAppliesToUser($cycle, $subject)) {
                    continue;
                }

                $existing = DB::table('performance_review_assignments')
                    ->where('performance_cycle_id', $cycle->id)
                    ->where('subject_user_id', $subject->id)
                    ->first();
                if ($existing) {
                    continue;
                }

                $this->ensureAssignmentAndReview(
                    $actor,
                    $cycle,
                    $subject,
                    $evaluator,
                    'Reporting Relationship',
                    $relationship->relationship_id,
                );
            }

            // 2) Top-of-scope leaders are governed through a multi-source 360° Leadership Review.
            //    No unrelated manager is invented and no subordinate receives unilateral authority.
            foreach ($topScopeLeaderIds as $leaderId) {
                $subject = User::query()->find($leaderId);
                if (! $subject || ! $this->cycleAppliesToUser($cycle, $subject)) {
                    continue;
                }

                $existing = DB::table('performance_review_assignments')
                    ->where('performance_cycle_id', $cycle->id)
                    ->where('subject_user_id', $subject->id)
                    ->first();

                if (! $existing) {
                    $this->ensureAssignmentAndReview(
                        $actor,
                        $cycle,
                        $subject,
                        null,
                        '360 Leadership Review',
                    );
                }
            }

            // 3) Smart fallback for ordinary personnel whose manager field is missing from the
            //    current source. Route only when there is exactly one unambiguous top-of-scope
            //    evaluator-capable leader in the same department. This creates review authority
            //    for the cycle without rewriting manager_id or the reporting relationship table.
            $eligibleSubjects = User::query()
                ->whereNotNull('personnel_key')
                ->where('employment_status', '!=', 'Inactive')
                ->get();

            foreach ($eligibleSubjects as $subject) {
                if (! $this->cycleAppliesToUser($cycle, $subject)) {
                    continue;
                }

                if (DB::table('performance_review_assignments')
                    ->where('performance_cycle_id', $cycle->id)
                    ->where('subject_user_id', $subject->id)
                    ->exists()) {
                    continue;
                }

                // A top-of-scope leader is intentionally NOT assigned to another manager here.
                // Review Governance routes that population to the 360° Leadership Review method.
                if ($topScopeLeaderIds->contains((int) $subject->id)) {
                    continue;
                }

                $departmentLeaderIds = $topScopeLeaderIds
                    ->filter(function (int $leaderId) use ($subject): bool {
                        $leader = User::query()->find($leaderId);

                        return $leader
                            && $leader->id !== $subject->id
                            && $leader->department === $subject->department
                            && $leader->evaluator_capable
                            && $leader->employment_status !== 'Inactive';
                    })
                    ->values();

                if ($departmentLeaderIds->count() !== 1) {
                    continue;
                }

                $evaluator = User::query()->find($departmentLeaderIds->first());
                if (! $evaluator) {
                    continue;
                }

                $this->ensureAssignmentAndReview(
                    $actor,
                    $cycle,
                    $subject,
                    $evaluator,
                    'Smart Department Leadership',
                );
            }

            // Assignments exist throughout the performance period, but formal review
            // records are released only when the configured review window opens.
            $this->releaseOpenCycleReviews($cycle);
        }
    }

    private function ensureAssignmentAndReview(
        User $actor,
        object $cycle,
        User $subject,
        ?User $evaluator,
        string $basis,
        ?int $relationshipId = null,
    ): void {
        $assignmentKey = "assignment-{$cycle->external_key}-{$subject->personnel_key}";

        // state() may be requested concurrently by the browser (for example the page
        // request plus a follow-up API refresh). A SELECT-then-INSERT/updateOrInsert
        // sequence can race in PostgreSQL: both requests can observe no assignment and
        // then one loses on the one_primary_evaluator_per_cycle unique constraint.
        // Insert idempotently first, then lock the canonical row before ensuring its
        // review. Existing evaluator authority is never overwritten here.
        DB::table('performance_review_assignments')->insertOrIgnore([
            'external_key' => $assignmentKey,
            'performance_cycle_id' => $cycle->id,
            'subject_user_id' => $subject->id,
            'evaluator_user_id' => $evaluator?->id,
            'goal_evaluator_user_id' => $evaluator?->id,
            'reporting_relationship_id' => $relationshipId,
            'basis' => $basis,
            'active' => true,
            'assigned_by_id' => $actor->id,
            'assigned_at' => now(),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $assignment = DB::table('performance_review_assignments')
            ->where('performance_cycle_id', $cycle->id)
            ->where('subject_user_id', $subject->id)
            ->lockForUpdate()
            ->first();

        if (! $assignment) {
            throw ValidationException::withMessages([
                'configuration' => "Unable to resolve the governed review assignment for {$subject->name} in {$cycle->name}.",
            ]);
        }

        $this->ensureReviewForAssignment($cycle, $assignment, $subject);
    }

    private function releaseOpenCycleReviews(object $cycle): void
    {
        $today = $this->performanceToday();
        if ($today->lt(CarbonImmutable::parse($cycle->review_open_date))) {
            return;
        }

        $assignments = DB::table('performance_review_assignments')
            ->where('performance_cycle_id', $cycle->id)
            ->where('active', true)
            ->get();

        foreach ($assignments as $assignment) {
            $subject = User::query()->find($assignment->subject_user_id);
            if (! $subject || ! $this->cycleAppliesToUser($cycle, $subject)) {
                continue;
            }
            $this->ensureReviewForAssignment($cycle, $assignment, $subject);
        }
    }

    private function ensureReviewForAssignment(object $cycle, object $assignment, User $subject): void
    {
        $today = $this->performanceToday();
        if ($today->lt(CarbonImmutable::parse($cycle->review_open_date))) {
            return;
        }

        if (DB::table('performance_reviews')->where('performance_review_assignment_id', $assignment->id)->exists()) {
            if (($assignment->basis ?? '') === '360 Leadership Review') {
                $this->refreshLeadership360Review($subject, $cycle);
            }
            return;
        }

        $isLeadership360 = ($assignment->basis ?? '') === '360 Leadership Review';
        // Keep the existing person-type template foreign key populated for schema compatibility.
        // A 360° Leadership Review uses its own governed leadership criteria at runtime; the
        // standard template here is only the compatible persisted template reference.
        $templateKey = $this->defaultReviewTemplateKey($cycle, $subject);
        $templateId = $templateKey
            ? DB::table('performance_review_templates')
                ->where('external_key', $templateKey)
                ->where('person_type', $subject->person_type)
                ->where('active', true)
                ->value('id')
            : null;

        if (! $templateId) {
            // A single incomplete template mapping must not make the whole
            // Performance workspace unavailable. Keep the governed assignment
            // intact and allow Admin/HR to correct template coverage; explicit
            // evaluator review creation still validates through resolveTemplate().
            return;
        }

        DB::table('performance_reviews')->insert([
            'external_key' => "review-{$cycle->external_key}-{$subject->personnel_key}",
            'performance_review_assignment_id' => $assignment->id,
            'performance_review_template_id' => $templateId,
            'status' => 'Pending',
            'workflow_state' => $isLeadership360 ? '360 Feedback Collection' : 'Manager Review',
            'calibration_status' => $cycle->calibration_required ? 'Pending' : 'Not Required',
            'due_date' => $cycle->review_due_date,
            'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($isLeadership360) {
            $this->refreshLeadership360Review($subject, $cycle);
        }
    }

    private function leadership360TopScopeLeaderIds(): \Illuminate\Support\Collection
    {
        $relationships = DB::table('performance_reporting_relationships as relationships')
            ->join('users as supervisors', 'supervisors.id', '=', 'relationships.supervisor_id')
            ->join('users as reports', 'reports.id', '=', 'relationships.direct_report_id')
            ->where('relationships.active', true)
            ->where('supervisors.evaluator_capable', true)
            ->where('supervisors.employment_status', '!=', 'Inactive')
            ->where('reports.employment_status', '!=', 'Inactive')
            ->get(['relationships.supervisor_id', 'relationships.direct_report_id']);

        $leaderIds = $relationships->pluck('supervisor_id')->map(fn ($id) => (int) $id)->unique();
        $reportIds = $relationships->pluck('direct_report_id')->map(fn ($id) => (int) $id)->unique();

        return $leaderIds->reject(fn (int $id) => $reportIds->contains($id))->values();
    }

    private function leadership360SourceRole(User $actor, User $subject): ?string
    {
        if ($actor->id === $subject->id) {
            return 'Self';
        }

        $isDirectReport = DB::table('performance_reporting_relationships')
            ->where('active', true)
            ->where('supervisor_id', $subject->id)
            ->where('direct_report_id', $actor->id)
            ->exists();
        if ($isDirectReport) {
            return 'Direct Report';
        }

        $topLeaders = $this->leadership360TopScopeLeaderIds();
        if ($topLeaders->contains((int) $actor->id) && $topLeaders->contains((int) $subject->id)) {
            return 'Peer Leader';
        }

        return null;
    }

    private function ensureOpenLeadership360Routing(): void
    {
        $today = $this->performanceToday();
        $cycles = DB::table('performance_cycles')
            ->where('status', 'Active')
            ->whereDate('review_open_date', '<=', $today->toDateString())
            ->get();
        $topLeaderIds = $this->leadership360TopScopeLeaderIds();

        foreach ($cycles as $cycle) {
            foreach ($topLeaderIds as $leaderId) {
                $subject = User::query()->find($leaderId);
                if (! $subject || ! $this->cycleAppliesToUser($cycle, $subject)) {
                    continue;
                }

                DB::table('performance_review_assignments')->insertOrIgnore([
                    'external_key' => "assignment-{$cycle->external_key}-{$subject->personnel_key}",
                    'performance_cycle_id' => $cycle->id,
                    'subject_user_id' => $subject->id,
                    'evaluator_user_id' => null,
                    'reporting_relationship_id' => null,
                    'basis' => '360 Leadership Review',
                    'active' => true,
                    'assigned_by_id' => null,
                    'assigned_at' => now(),
                    'lock_version' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $assignment = DB::table('performance_review_assignments')
                    ->where('performance_cycle_id', $cycle->id)
                    ->where('subject_user_id', $subject->id)
                    ->first();

                if ($assignment && ($assignment->basis ?? '') === '360 Leadership Review') {
                    $this->ensureReviewForAssignment($cycle, $assignment, $subject);
                }
            }
        }
    }

    public function leadership360Tasks(User $actor): array
    {
        if (! $actor->hasPersonnelIdentity() || $actor->employment_status === 'Inactive') {
            return [];
        }

        DB::transaction(fn () => $this->ensureOpenLeadership360Routing(), 3);

        $today = $this->performanceToday();
        $cycles = DB::table('performance_cycles')
            ->where('status', 'Active')
            ->whereDate('review_open_date', '<=', $today->toDateString())
            ->get();
        $topLeaderIds = $this->leadership360TopScopeLeaderIds();
        $tasks = [];

        foreach ($cycles as $cycle) {
            foreach ($topLeaderIds as $leaderId) {
                $subject = User::query()->find($leaderId);
                if (! $subject || ! $this->cycleAppliesToUser($cycle, $subject)) {
                    continue;
                }
                $sourceRole = $this->leadership360SourceRole($actor, $subject);
                if (! $sourceRole) {
                    continue;
                }

                $existing = DB::table('performance_anonymous_feedback')
                    ->where('subject_user_id', $subject->id)
                    ->where('evaluator_user_id', $actor->id)
                    ->where('performance_cycle_id', $cycle->id)
                    ->first();
                $payload = $existing ? $this->decode($existing->feedback, null) : null;

                $tasks[] = [
                    'id' => "360-{$cycle->external_key}-{$subject->personnel_key}-{$actor->personnel_key}",
                    'subjectId' => $subject->personnel_key,
                    'subjectName' => $subject->name,
                    'subjectPosition' => $subject->position,
                    'subjectDepartment' => $subject->department,
                    'cycleId' => $cycle->external_key,
                    'cycleName' => $cycle->name,
                    'sourceRole' => $sourceRole,
                    'dueDate' => (string) $cycle->review_due_date,
                    'criteria' => collect(self::LEADERSHIP_360_CRITERIA)->map(fn (int $weight, string $name) => [
                        'name' => $name,
                        'weight' => $weight,
                    ])->values()->all(),
                    'submitted' => is_array($payload) && ($payload['kind'] ?? null) === 'leadership360',
                    'ratings' => is_array($payload) ? ($payload['ratings'] ?? []) : [],
                    'comment' => is_array($payload) ? (string) ($payload['comment'] ?? '') : '',
                ];
            }
        }

        return $tasks;
    }

    public function submitLeadership360Feedback(User $actor, string $subjectKey, string $cycleKey, array $ratings, ?string $comment = null): array
    {
        $subject = $this->userByKey($subjectKey);
        $cycle = $this->cycleByKey($cycleKey);
        $today = $this->performanceToday();
        DB::transaction(fn () => $this->ensureOpenLeadership360Routing(), 3);

        if ($cycle->status !== 'Active' || $today->lt(CarbonImmutable::parse($cycle->review_open_date))) {
            throw ValidationException::withMessages(['feedback' => 'Leadership feedback is available only after the formal review window opens.']);
        }
        if (! $this->leadership360TopScopeLeaderIds()->contains((int) $subject->id)) {
            throw ValidationException::withMessages(['feedback' => 'This person is not routed to a 360° Leadership Review.']);
        }

        $sourceRole = $this->leadership360SourceRole($actor, $subject);
        if (! $sourceRole) {
            $this->deny('You are not an authorized feedback source for this leadership review.');
        }

        $canonicalRatings = [];
        foreach (self::LEADERSHIP_360_CRITERIA as $criterion => $weight) {
            $value = isset($ratings[$criterion]) ? (float) $ratings[$criterion] : 0.0;
            if ($value < 1 || $value > 5) {
                throw ValidationException::withMessages(['ratings' => "Rate {$criterion} from 1 to 5."]);
            }
            $canonicalRatings[$criterion] = $value;
        }

        DB::table('performance_anonymous_feedback')->updateOrInsert(
            [
                'subject_user_id' => $subject->id,
                'evaluator_user_id' => $actor->id,
                'performance_cycle_id' => $cycle->id,
            ],
            [
                'feedback' => json_encode([
                    'kind' => 'leadership360',
                    'sourceRole' => $sourceRole,
                    'ratings' => $canonicalRatings,
                    'comment' => trim((string) $comment),
                ], JSON_THROW_ON_ERROR),
                'submitted_at' => now(),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );

        $this->refreshLeadership360Review($subject, $cycle, true);

        return $this->leadership360Tasks($actor);
    }

    private function leadership360Summary(User $subject, object $cycle): array
    {
        $rows = DB::table('performance_anonymous_feedback')
            ->where('subject_user_id', $subject->id)
            ->where('performance_cycle_id', $cycle->id)
            ->get(['feedback', 'evaluator_user_id']);

        $valid = collect();
        foreach ($rows as $row) {
            $payload = $this->decode($row->feedback, null);
            if (! is_array($payload) || ($payload['kind'] ?? null) !== 'leadership360' || ! is_array($payload['ratings'] ?? null)) {
                continue;
            }
            $valid->push(['payload' => $payload, 'evaluatorUserId' => (int) $row->evaluator_user_id]);
        }

        $directReportIds = DB::table('performance_reporting_relationships')
            ->where('active', true)
            ->where('supervisor_id', $subject->id)
            ->pluck('direct_report_id')
            ->map(fn ($id) => (int) $id)
            ->unique();
        $peerLeaderIds = $this->leadership360TopScopeLeaderIds()
            ->reject(fn (int $id) => $id === (int) $subject->id)
            ->values();

        $selfCount = $valid->filter(fn (array $row) => $row['evaluatorUserId'] === (int) $subject->id)->count();
        $directCount = $valid->filter(fn (array $row) => $directReportIds->contains($row['evaluatorUserId']))->count();
        $peerCount = $valid->filter(fn (array $row) => $peerLeaderIds->contains($row['evaluatorUserId']))->count();
        $requiredDirect = min(2, $directReportIds->count());
        $requiredPeer = min(2, $peerLeaderIds->count());
        $coverageReady = $selfCount >= 1 && $directCount >= $requiredDirect && $peerCount >= $requiredPeer;

        $scores = [];
        foreach (self::LEADERSHIP_360_CRITERIA as $criterion => $weight) {
            $values = $valid->map(fn (array $row) => (float) ($row['payload']['ratings'][$criterion] ?? 0))
                ->filter(fn (float $value) => $value >= 1 && $value <= 5)
                ->values();
            if ($values->count() > 0) {
                $scores[] = ['name' => $criterion, 'score' => round($values->avg(), 2), 'weight' => $weight];
            }
        }

        $rating = null;
        if ($coverageReady && count($scores) === count(self::LEADERSHIP_360_CRITERIA)) {
            $weighted = 0.0;
            foreach ($scores as $score) {
                $weighted += $score['score'] * ($score['weight'] / 100);
            }
            $rating = round($weighted, 2);
        }

        return [
            'responseCount' => $valid->count(),
            'selfResponses' => $selfCount,
            'directReportResponses' => $directCount,
            'peerLeaderResponses' => $peerCount,
            'requiredSelfResponses' => 1,
            'requiredDirectReportResponses' => $requiredDirect,
            'requiredPeerLeaderResponses' => $requiredPeer,
            'coverageReady' => $coverageReady,
            'criteria' => collect(self::LEADERSHIP_360_CRITERIA)->map(fn (int $weight, string $name) => ['name' => $name, 'weight' => $weight])->values()->all(),
            'scores' => $scores,
            'submittedRating' => $rating,
        ];
    }

    private function refreshLeadership360Review(User $subject, object $cycle, bool $allowRevisionResubmit = false): void
    {
        $assignment = DB::table('performance_review_assignments')
            ->where('performance_cycle_id', $cycle->id)
            ->where('subject_user_id', $subject->id)
            ->where('basis', '360 Leadership Review')
            ->first();
        if (! $assignment) {
            return;
        }

        $review = DB::table('performance_reviews')
            ->where('performance_review_assignment_id', $assignment->id)
            ->first();
        if (! $review || $review->status === 'Completed' || $review->calibration_status === 'In Review') {
            return;
        }
        if ($review->calibration_status === 'Returned for Revision' && ! $allowRevisionResubmit) {
            return;
        }

        $summary = $this->leadership360Summary($subject, $cycle);
        $updates = [
            'linked_evidence' => json_encode([[
                'source' => '360 Leadership Feedback',
                'title' => $summary['responseCount'].' confidential multi-source responses',
                'dateCompleted' => now()->toDateString(),
            ]], JSON_THROW_ON_ERROR),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ];

        if ($summary['coverageReady'] && $summary['submittedRating'] !== null) {
            $updates += [
                'status' => 'In Progress',
                'workflow_state' => 'Calibration Pending',
                'calibration_status' => 'Pending',
                'criteria_scores' => json_encode(array_map(fn (array $score) => [
                    'name' => $score['name'],
                    'score' => $score['score'],
                ], $summary['scores']), JSON_THROW_ON_ERROR),
                'final_rating' => $summary['submittedRating'],
                'comments' => 'Governed 360° Leadership Review reached the required self, direct-report, and peer-leadership feedback coverage. Individual contributor identities are not disclosed in the formal review record.',
                'manager_submitted_at' => now(),
            ];
        } else {
            $updates += [
                'status' => $summary['responseCount'] > 0 ? 'In Progress' : 'Pending',
                'workflow_state' => '360 Feedback Collection',
                'manager_submitted_at' => null,
                'final_rating' => null,
            ];
        }

        DB::table('performance_reviews')->where('id', $review->id)->update($updates);
    }

    private function workforceContextFromReference(array $reference): array
    {
        $people = collect(Arr::wrap($reference['people'] ?? []))
            ->filter(fn ($person): bool => is_array($person) && trim((string) ($person['personnel_key'] ?? '')) !== '')
            ->map(function (array $person): array {
                $goal = is_array($person['performance_goal_context'] ?? null)
                    ? $person['performance_goal_context']
                    : [];
                $evaluator = is_array($person['performance_evaluator_context'] ?? null)
                    ? $person['performance_evaluator_context']
                    : [];

                return [
                    'personnelKey' => (string) $person['personnel_key'],
                    'name' => (string) ($person['name'] ?? ''),
                    'department' => (string) ($person['department'] ?? ''),
                    'position' => (string) ($person['position'] ?? ''),
                    'personClass' => (string) ($person['person_class'] ?? ''),
                    'developmentStatus' => (string) ($person['development_status'] ?? ''),
                    'promotionTrack' => (string) ($person['promotion_track'] ?? ''),
                    'successionRole' => $person['succession_role'] ?? null,
                    'readiness' => $person['readiness'] ?? null,
                    'performanceGoalContext' => $goal === [] ? null : [
                        'activeCycleId' => (string) ($goal['active_cycle_id'] ?? ''),
                        'goalPlanId' => isset($goal['goal_plan_id']) ? (string) $goal['goal_plan_id'] : null,
                        'goalPlanName' => isset($goal['goal_plan_name']) ? (string) $goal['goal_plan_name'] : null,
                        'assignmentStatus' => (string) ($goal['assignment_status'] ?? ''),
                        'formalProgressAuthority' => isset($goal['formal_progress_authority'])
                            ? (string) $goal['formal_progress_authority']
                            : null,
                        'formalProgressAuthorityStatus' => (string) ($goal['formal_progress_authority_status'] ?? ''),
                    ],
                    'performanceEvaluatorContext' => $evaluator === [] ? null : [
                        'defaultEvaluatorName' => isset($evaluator['default_evaluator_name'])
                            ? (string) $evaluator['default_evaluator_name']
                            : null,
                        'defaultEvaluatorPersonnelKey' => isset($evaluator['default_evaluator_personnel_key'])
                            ? (string) $evaluator['default_evaluator_personnel_key']
                            : null,
                        'assignmentStatus' => (string) ($evaluator['assignment_status'] ?? ''),
                        'assignmentBasis' => (string) ($evaluator['assignment_basis'] ?? ''),
                        'requiresExplicitAssignment' => (bool) ($evaluator['requires_explicit_assignment'] ?? false),
                    ],
                ];
            })
            ->values()
            ->all();

        return [
            'source' => 'DEFENSE_WORKFORCE_PERSONAS_V1',
            'asOfDate' => (string) ($reference['as_of_date'] ?? ''),
            'people' => $people,
        ];
    }

    private function runtimePerformanceCalendar(array $calendar, CarbonImmutable $today): array
    {
        $date = $today->toDateString();
        $quarters = collect(Arr::wrap($calendar['quarters'] ?? []))
            ->filter(fn ($quarter): bool => is_array($quarter) && trim((string) ($quarter['cycle_id'] ?? '')) !== '')
            ->map(function (array $quarter) use ($date): array {
                $cycleId = (string) $quarter['cycle_id'];
                $dbCycle = DB::table('performance_cycles')->where('external_key', $cycleId)->first();
                $performanceStart = (string) ($quarter['performance_start'] ?? '');
                $reviewEnd = (string) ($quarter['review_end'] ?? '');

                if ($dbCycle?->status === 'Closed') {
                    $status = 'Finalized';
                    $readOnly = true;
                } elseif ($performanceStart !== '' && $date < $performanceStart) {
                    $status = 'Upcoming';
                    $readOnly = true;
                } elseif ($reviewEnd !== '' && $date <= $reviewEnd) {
                    $status = 'Current';
                    $readOnly = false;
                } else {
                    $assignmentCount = $dbCycle
                        ? DB::table('performance_review_assignments')->where('performance_cycle_id', $dbCycle->id)->where('active', true)->count()
                        : 0;
                    $finalizedCount = $dbCycle
                        ? DB::table('performance_reviews as reviews')
                            ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                            ->where('assignments.performance_cycle_id', $dbCycle->id)
                            ->where('assignments.active', true)
                            ->where('reviews.status', 'Completed')
                            ->count()
                        : 0;
                    $unfinished = $assignmentCount > $finalizedCount;
                    $status = $unfinished ? 'Current' : 'Finalized';
                    $readOnly = ! $unfinished;
                }

                return [
                    'cycle_id' => $cycleId,
                    'year' => (int) ($quarter['year'] ?? 0),
                    'quarter' => (string) ($quarter['quarter'] ?? ''),
                    'status' => $status,
                    'performance_start' => (string) ($quarter['performance_start'] ?? ''),
                    'performance_end' => (string) ($quarter['performance_end'] ?? ''),
                    'review_start' => (string) ($quarter['review_start'] ?? ''),
                    'review_end' => (string) ($quarter['review_end'] ?? ''),
                    'read_only' => $readOnly,
                    'planning_only' => $status === 'Upcoming',
                ];
            })
            ->values()
            ->all();

        $currentPerformance = collect($quarters)->first(fn (array $quarter): bool =>
            $date >= $quarter['performance_start'] && $date <= $quarter['performance_end']
        );
        $defaultCycleId = $currentPerformance['cycle_id'] ?? ($calendar['default_cycle_id'] ?? '');

        return [
            'available_years' => array_values(array_map('intval', Arr::wrap($calendar['available_years'] ?? []))),
            'default_year' => (int) ($calendar['default_year'] ?? (int) substr($date, 0, 4)),
            'historical_data_before_2026' => (bool) ($calendar['historical_data_before_2026'] ?? false),
            'historical_data_before_2026_note' => $calendar['historical_data_before_2026_note'] ?? null,
            'default_cycle_id' => (string) $defaultCycleId,
            'quarters' => $quarters,
            'selector_rule' => $calendar['selector_rule'] ?? null,
        ];
    }

    private function goalAuditEventsForActor(User $actor): array
    {
        $query = DB::table('performance_goal_events as events')
            ->join('performance_goals as goals', 'goals.id', '=', 'events.performance_goal_id')
            ->join('users as subjects', 'subjects.id', '=', 'goals.user_id')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'goals.performance_cycle_id')
            ->leftJoin('users as actors', 'actors.id', '=', 'events.actor_user_id');

        if (! $actor->isPerformanceOperator()) {
            $query->where(function (Builder $scope) use ($actor): void {
                $scope->where('goals.user_id', $actor->id)
                    ->orWhereExists(function (Builder $subquery) use ($actor): void {
                        $subquery->selectRaw('1')
                            ->from('performance_review_assignments as assignments')
                            ->whereColumn('assignments.subject_user_id', 'goals.user_id')
                            ->whereColumn('assignments.performance_cycle_id', 'goals.performance_cycle_id')
                            ->where(function (Builder $authority) use ($actor): void {
                                $authority->where('assignments.goal_evaluator_user_id', $actor->id)
                                    ->orWhere('assignments.evaluator_user_id', $actor->id);
                            })
                            ->where('assignments.active', true);
                    });
            });
        }

        return $query
            ->orderByDesc('events.created_at')
            ->get([
                'events.*',
                'goals.external_key as goal_key',
                'goals.title as goal_title',
                'subjects.personnel_key as subject_key',
                'cycles.external_key as cycle_key',
                'actors.personnel_key as actor_key',
                'actors.name as actor_name',
                'actors.role as actor_role',
            ])
            ->map(fn (object $event) => [
                'id' => 'goal-event-'.$event->id,
                'goalId' => $event->goal_key,
                'personId' => $event->subject_key,
                'cycleId' => $event->cycle_key,
                'goalTitle' => $event->goal_title,
                'eventType' => $event->event_type,
                'previousProgress' => $event->previous_progress !== null ? (float) $event->previous_progress : null,
                'newProgress' => $event->new_progress !== null ? (float) $event->new_progress : null,
                'previousStatus' => $event->previous_status,
                'newStatus' => $event->new_status,
                'reason' => $event->reason,
                'reference' => $event->reference,
                'actorId' => $event->actor_key,
                'actorName' => $event->actor_name ?? 'System',
                'actorRole' => $event->actor_role,
                'createdAt' => CarbonImmutable::parse($event->created_at)->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    private function personnelToArray(object $user): array
    {
        return [
            'id' => $user->personnel_key,
            'corePersonId' => $user->core_person_id,
            'employeeOrTraineeId' => $user->employee_or_trainee_id,
            'fullName' => $user->name,
            'email' => $user->email,
            'position' => $user->position ?? 'Unspecified',
            'department' => $user->department ?? 'Unspecified',
            'accessRole' => $user->role instanceof UserRole ? $user->role->label() : UserRole::from($user->role)->label(),
            'personType' => $user->person_type ?? 'Employee',
            'employmentStatus' => $user->employment_status ?? 'Employee',
            'evaluatorCapable' => (bool) ($user->evaluator_capable ?? false),
        ];
    }

    private function cycleToArray(object $cycle): array
    {
        return [
            'id' => $cycle->external_key,
            'cycleName' => $cycle->name,
            'cycleType' => $cycle->cycle_type,
            'performanceStartDate' => (string) $cycle->performance_start_date,
            'performanceEndDate' => (string) $cycle->performance_end_date,
            'reviewOpenDate' => (string) $cycle->review_open_date,
            'reviewDueDate' => (string) $cycle->review_due_date,
            'applicablePersonTypes' => $this->decode($cycle->applicable_person_types, []),
            'departmentScopes' => $this->decode($cycle->department_scopes, []),
            'reviewTemplateIds' => $this->decode($cycle->review_template_keys, []),
            'selfEvaluationEnabled' => (bool) $cycle->self_evaluation_enabled,
            'selfRatingEnabled' => (bool) $cycle->self_rating_enabled,
            'calibrationRequired' => (bool) $cycle->calibration_required,
            'employeeAcknowledgment' => $cycle->employee_acknowledgment,
            'probationaryMilestoneMonths' => $cycle->probationary_milestone_months,
            'status' => $cycle->status,
            'description' => $cycle->description,
            'instructions' => $cycle->instructions,
            'lockVersion' => (int) $cycle->lock_version,
        ];
    }

    private function reviewTemplateToArray(object $template): array
    {
        return [
            'id' => $template->external_key,
            'name' => $template->name,
            'personType' => $template->person_type,
            'ratingScaleId' => $template->rating_scale_key,
            'criteria' => $this->decode($template->criteria, []),
            'active' => (bool) $template->active,
            'lockVersion' => (int) $template->lock_version,
        ];
    }

    private function goalTemplateToArray(object $template): array
    {
        return [
            'id' => $template->external_key,
            'name' => $template->name,
            'applicablePersonTypes' => $this->decode($template->applicable_person_types, []),
            'departmentScopes' => $this->decode($template->department_scopes, []),
            'positionScopes' => $this->decode($template->position_scopes, []),
            'cycleIds' => $this->decode($template->cycle_keys, []),
            'description' => $template->description,
            'allowIndividualOverrides' => (bool) $template->allow_individual_overrides,
            'items' => $this->decode($template->items, []),
            'active' => (bool) $template->active,
            'lockVersion' => (int) $template->lock_version,
        ];
    }

    private function goalToArray(object $goal): array
    {
        return [
            'id' => $goal->external_key,
            'personId' => $goal->person_key,
            'cycleId' => $goal->cycle_key,
            'templateId' => $goal->template_key,
            'templateItemId' => $goal->template_item_key,
            'title' => $goal->title,
            'metricType' => $goal->metric_type,
            'target' => $goal->target,
            'unit' => $goal->unit,
            'weight' => (float) $goal->weight,
            'progress' => (float) $goal->progress,
            'status' => $goal->status,
            'startDate' => (string) $goal->start_date,
            'endDate' => (string) $goal->end_date,
            'individualOverride' => (bool) $goal->individual_override,
            'description' => $goal->description,
            'lockVersion' => (int) $goal->lock_version,
        ];
    }

    private function reviewToArray(object $review): array
    {
        $events = DB::table('performance_review_events as events')
            ->leftJoin('users as actors', 'actors.id', '=', 'events.actor_user_id')
            ->leftJoin('users as from_evaluators', 'from_evaluators.id', '=', 'events.from_evaluator_user_id')
            ->leftJoin('users as to_evaluators', 'to_evaluators.id', '=', 'events.to_evaluator_user_id')
            ->where('events.performance_review_id', $review->id)
            ->orderBy('events.occurred_at')
            ->get([
                'events.*',
                'actors.name as actor_name',
                'from_evaluators.personnel_key as from_evaluator_key',
                'to_evaluators.personnel_key as to_evaluator_key',
            ]);

        $assignmentHistory = $events->where('event_type', 'Reassigned')->map(fn (object $event) => [
            'fromEvaluatorId' => $event->from_evaluator_key,
            'toEvaluatorId' => $event->to_evaluator_key,
            'reason' => $event->reason,
            'actor' => $event->actor_name ?? 'System',
            'timestamp' => CarbonImmutable::parse($event->occurred_at)->toIso8601String(),
        ])->values()->all();

        $revisionHistory = $events->whereIn('event_type', ['Reopened', 'Revision Requested'])->map(fn (object $event) => [
            'action' => $event->event_type,
            'version' => (int) ($event->revision_version ?? 1),
            'reason' => $event->reason,
            'actor' => $event->actor_name ?? 'System',
            'timestamp' => CarbonImmutable::parse($event->occurred_at)->toIso8601String(),
            'notes' => $event->notes,
            'snapshot' => $this->decode($event->snapshot, []),
        ])->values()->all();

        $calibrationHistory = $events->filter(fn (object $event) => str_starts_with($event->event_type, 'Calibration'))->map(fn (object $event) => [
            'action' => match ($event->event_type) {
                'Calibration Review Started' => 'Review Started',
                'Calibration Approved' => 'Approved',
                'Calibration Returned for Revision' => 'Returned for Revision',
                default => 'Submitted',
            },
            'actor' => $event->actor_name ?? 'System',
            'timestamp' => CarbonImmutable::parse($event->occurred_at)->toIso8601String(),
            'notes' => $event->notes,
        ])->values()->all();

        $reviewAuditTrail = $events->map(fn (object $event) => [
            'type' => $event->event_type,
            'actor' => $event->actor_name ?? 'System',
            'timestamp' => CarbonImmutable::parse($event->occurred_at)->toIso8601String(),
            'reason' => $event->reason,
            'notes' => $event->notes,
        ]);

        $goalAuditTrail = DB::table('performance_goal_events as goal_events')
            ->join('performance_goals as goals', 'goals.id', '=', 'goal_events.performance_goal_id')
            ->leftJoin('users as actors', 'actors.id', '=', 'goal_events.actor_user_id')
            ->where('goals.user_id', $review->subject_user_id)
            ->where('goals.performance_cycle_id', $review->cycle_database_id)
            ->orderBy('goal_events.created_at')
            ->get([
                'goal_events.*',
                'goals.title as goal_title',
                'actors.name as actor_name',
            ])
            ->map(fn (object $event) => [
                'type' => $event->event_type,
                'actor' => $event->actor_name ?? 'System',
                'timestamp' => CarbonImmutable::parse($event->created_at)->toIso8601String(),
                'reason' => $event->reason,
                'notes' => trim(($event->goal_title ?? 'Goal/KPI').' · '.(($event->previous_progress ?? null) !== null ? $event->previous_progress.'% → '.$event->new_progress.'%' : 'status updated')),
            ]);

        return [
            'id' => $review->external_key,
            'personId' => $review->subject_key,
            'evaluatorId' => $review->evaluator_key,
            'periodId' => $review->cycle_key,
            'reviewTemplateId' => $review->template_key,
            'rating' => $review->final_rating !== null ? (float) $review->final_rating : null,
            'status' => $review->status,
            'dateEvaluated' => $review->finalized_at ? CarbonImmutable::parse($review->finalized_at)->format('M j, Y') : null,
            'dueDate' => $review->due_date ? (string) $review->due_date : null,
            'competencyScores' => $this->decode($review->criteria_scores, []),
            'comments' => $review->comments,
            'developmentRecommendations' => $this->decode($review->development_recommendations, []),
            'linkedEvidence' => $this->decode($review->linked_evidence, []),
            'selfEvaluation' => $this->decode($review->self_evaluation, null),
            'managerSubmittedAt' => $review->manager_submitted_at ? CarbonImmutable::parse($review->manager_submitted_at)->toIso8601String() : null,
            'finalizedAt' => $review->finalized_at ? CarbonImmutable::parse($review->finalized_at)->toIso8601String() : null,
            'workflowState' => $review->workflow_state,
            'calibrationStatus' => $review->calibration_status,
            'calibrationHistory' => $calibrationHistory,
            'acknowledgment' => $this->decode($review->acknowledgment, null),
            'assignmentHistory' => $assignmentHistory,
            'revisionHistory' => $revisionHistory,
            'auditTrail' => $reviewAuditTrail->concat($goalAuditTrail)->sortBy('timestamp')->values()->all(),
            'reviewMethod' => ($review->assignment_basis ?? '') === '360 Leadership Review' ? '360° Leadership Review' : 'Manager Review',
            'leadership360' => ($review->assignment_basis ?? '') === '360 Leadership Review'
                ? $this->leadership360Summary(User::query()->findOrFail($review->subject_user_id), DB::table('performance_cycles')->where('id', $review->cycle_database_id)->first())
                : null,
            'pipOwner' => $this->pipOwnerContextForReview($review),
            'lockVersion' => (int) $review->lock_version,
        ];
    }

    private function feedbackToArray(object $record): array
    {
        return [
            'id' => $record->external_key,
            'personId' => $record->subject_key,
            'authorId' => $record->author_key,
            'cycleId' => $record->cycle_key,
            'relatedReviewId' => $record->review_key,
            'recordType' => $record->record_type,
            'note' => $record->note,
            'coachingAction' => $record->coaching_action,
            'linkedGoalIds' => $this->decode($record->linked_goal_keys, []),
            'followUpDate' => $record->follow_up_date ? (string) $record->follow_up_date : null,
            'visibility' => $record->visibility,
            'createdAt' => CarbonImmutable::parse($record->created_at)->toIso8601String(),
            'updatedAt' => CarbonImmutable::parse($record->updated_at)->toIso8601String(),
            'lockVersion' => (int) $record->lock_version,
        ];
    }

    private function pipToArray(object $pip, User $actor): array
    {
        return [
            'id' => $pip->external_key,
            'personId' => $pip->subject_key,
            'relatedReviewId' => $pip->review_key,
            'performanceConcern' => $pip->performance_concern,
            'expectedImprovement' => $pip->expected_improvement,
            'actionItems' => $this->decode($pip->action_items, []),
            'startDate' => (string) $pip->start_date,
            'targetEndDate' => (string) $pip->target_end_date,
            'assignedManagerId' => $pip->manager_key,
            'status' => $pip->status,
            'milestones' => $this->decode($pip->milestones, []),
            'progressNotes' => $this->decode($pip->progress_notes, []),
            'developmentActions' => $this->decode($pip->development_actions, []),
            'outcomeNotes' => $pip->outcome_notes,
            'hrReviewNotes' => $actor->isPerformanceOperator() ? $pip->hr_review_notes : null,
            'createdBy' => $pip->creator_key,
            'createdAt' => CarbonImmutable::parse($pip->created_at)->toIso8601String(),
            'updatedAt' => CarbonImmutable::parse($pip->updated_at)->toIso8601String(),
            'lockVersion' => (int) $pip->lock_version,
        ];
    }

    private function journeyToArray(object $journey): array
    {
        return [
            'id' => $journey->external_key,
            'traineeId' => $journey->trainee_key,
            'cycleId' => $journey->cycle_key,
            'currentStage' => $journey->current_stage,
            'milestones' => $this->decode($journey->milestones, []),
            'developmentActionIds' => $this->decode($journey->development_action_keys, []),
            'updatedAt' => CarbonImmutable::parse($journey->updated_at)->toIso8601String(),
            'lockVersion' => (int) $journey->lock_version,
        ];
    }

    private function resolvePipOwnerForReview(User $subject, object $review): ?User
    {
        $evaluatorId = isset($review->evaluator_user_id) ? (int) $review->evaluator_user_id : 0;
        if ($evaluatorId > 0 && $evaluatorId !== $subject->id) {
            $evaluator = User::query()->activePersonnel()->find($evaluatorId);
            if ($evaluator) {
                return $evaluator;
            }
        }

        $reportingSupervisorId = DB::table('performance_reporting_relationships')
            ->where('direct_report_id', $subject->id)
            ->where('active', true)
            ->value('supervisor_id');
        if ($reportingSupervisorId && (int) $reportingSupervisorId !== $subject->id) {
            $supervisor = User::query()->activePersonnel()->find((int) $reportingSupervisorId);
            if ($supervisor) {
                return $supervisor;
            }
        }

        $isLeadership360 = (string) ($review->assignment_basis ?? '') === '360 Leadership Review';
        if (! $isLeadership360) {
            return null;
        }

        $preferredRoles = match ($subject->role) {
            UserRole::HR => [UserRole::Admin],
            UserRole::Admin => [UserRole::HR],
            default => [UserRole::HR, UserRole::Admin],
        };

        foreach ($preferredRoles as $role) {
            $owner = User::query()
                ->activePersonnel()
                ->where('role', $role->value)
                ->where('id', '!=', $subject->id)
                ->orderBy('id')
                ->first();
            if ($owner) {
                return $owner;
            }
        }

        return null;
    }

    private function pipOwnerContextForReview(object $review): array
    {
        $subject = User::query()->find($review->subject_user_id);
        if (! $subject) {
            return [
                'id' => null,
                'name' => null,
                'authorityType' => null,
                'source' => null,
                'assignmentBasis' => null,
            ];
        }

        $owner = $this->resolvePipOwnerForReview($subject, $review);
        if (! $owner) {
            return [
                'id' => null,
                'name' => null,
                'authorityType' => null,
                'source' => null,
                'assignmentBasis' => null,
            ];
        }

        $leadership360 = (string) ($review->assignment_basis ?? '') === '360 Leadership Review';
        $usesGovernanceSponsor = $leadership360 && empty($review->evaluator_user_id);

        return [
            'id' => $owner->personnel_key,
            'name' => $owner->name,
            'authorityType' => $usesGovernanceSponsor ? 'Governance Sponsor' : 'Evaluator',
            'source' => $usesGovernanceSponsor ? 'Admin/HR Governance' : 'Review Governance',
            'assignmentBasis' => $usesGovernanceSponsor
                ? 'Leadership 360 review has no single evaluator; the server resolves a non-self Admin/HR governance owner for PIP follow-through.'
                : 'Assigned evaluator or recorded reporting relationship.',
        ];
    }

    private function hasEvaluatorScope(int $evaluatorId, int $subjectId, ?string $cycleKey): bool
    {
        if ($evaluatorId === $subjectId) {
            return false;
        }

        if ($cycleKey) {
            return DB::table('performance_review_assignments as assignments')
                ->join('performance_cycles as cycles', 'cycles.id', '=', 'assignments.performance_cycle_id')
                ->where('cycles.external_key', $cycleKey)
                ->where('assignments.evaluator_user_id', $evaluatorId)
                ->where('assignments.subject_user_id', $subjectId)
                ->where('assignments.active', true)
                ->exists();
        }

        return DB::table('performance_reporting_relationships')
            ->where('supervisor_id', $evaluatorId)
            ->where('direct_report_id', $subjectId)
            ->where('active', true)
            ->exists()
            || DB::table('performance_review_assignments')
                ->where('evaluator_user_id', $evaluatorId)
                ->where('subject_user_id', $subjectId)
                ->where('active', true)
                ->exists();
    }

    private function cycleAppliesToUser(object $cycle, User $user): bool
    {
        $personTypes = $this->decode($cycle->applicable_person_types, []);
        $departments = $this->decode($cycle->department_scopes, []);

        return in_array($user->person_type, $personTypes, true)
            && ($departments === [] || in_array($user->department, $departments, true));
    }

    private function defaultReviewTemplateKey(object $cycle, User $subject): ?string
    {
        $cycleKeys = $this->decode($cycle->review_template_keys, []);
        $fallback = $cycleKeys[$subject->person_type] ?? null;

        if ($subject->person_type !== 'Employee') {
            return $fallback;
        }

        $functionKey = match ($subject->department) {
            'Crane Operations' => 'review-template-employee-crane-operations',
            'Logistics' => 'review-template-employee-logistics',
            'Operations' => 'review-template-employee-operations',
            'Finance' => 'review-template-employee-finance',
            'Contracts' => 'review-template-employee-contracts',
            'Safety & Compliance' => 'review-template-employee-safety',
            'Administration' => 'review-template-employee-administration',
            'Information Technology' => 'review-template-employee-it',
            'Human Resources' => 'review-template-employee-hr',
            default => null,
        };

        if ($functionKey && DB::table('performance_review_templates')
            ->where('external_key', $functionKey)
            ->where('person_type', 'Employee')
            ->where('active', true)
            ->exists()) {
            return $functionKey;
        }

        return $fallback;
    }

    private function resolveTemplate(?string $templateKey, object $cycle, User $subject): object
    {
        if (! $templateKey) {
            $templateKey = $this->defaultReviewTemplateKey($cycle, $subject);
        }

        $template = DB::table('performance_review_templates')
            ->where('external_key', $templateKey)
            ->where('person_type', $subject->person_type)
            ->where('active', true)
            ->first();

        if (! $template) {
            throw ValidationException::withMessages(['reviews' => 'No compatible active review template was found.']);
        }

        return $template;
    }

    private function performanceToday(): CarbonImmutable
    {
        $configured = trim((string) config('performance.review_demo_date', ''));
        if ($configured !== '') {
            try {
                return CarbonImmutable::parse($configured, config('app.timezone'))->startOfDay();
            } catch (\Throwable) {
                // Invalid demo configuration must never break production date handling.
            }
        }

        return CarbonImmutable::now(config('app.timezone'))->startOfDay();
    }

    private function assertCycleOpenForManagerReview(object $cycle): void
    {
        if ($cycle->status !== 'Active') {
            throw ValidationException::withMessages(['reviews' => 'Manager review is available only in an active cycle.']);
        }

        $today = $this->performanceToday();
        if ($today->lt(CarbonImmutable::parse($cycle->review_open_date))) {
            throw ValidationException::withMessages(['reviews' => 'The review window has not opened yet.']);
        }

        if ($today->gt(CarbonImmutable::parse($cycle->review_due_date))) {
            throw ValidationException::withMessages(['reviews' => 'The review window has already closed.']);
        }
    }

    private function reviewBoardStage(object $review): string
    {
        if ($review->status === 'Completed' || $review->workflow_state === 'Finalized') {
            return 'Finalized';
        }

        if ($review->workflow_state === 'Calibration In Review' || $review->calibration_status === 'In Review') {
            return 'Calibration Review';
        }

        if ($review->workflow_state === 'Calibration Pending'
            || ($review->calibration_required && $review->manager_submitted_at !== null && $review->calibration_status === 'Pending')) {
            return 'Submitted';
        }

        $scores = $this->decode($review->criteria_scores, []);
        $hasManagerActivity = $review->status === 'In Progress'
            || $review->manager_submitted_at !== null
            || count($scores) > 0
            || trim((string) ($review->comments ?? '')) !== '';

        return $hasManagerActivity ? 'Manager Review' : 'Not Started';
    }

    private function reviewSnapshot(object $review): array
    {
        return [
            'rating' => $review->final_rating !== null ? (float) $review->final_rating : null,
            'competencyScores' => $this->decode($review->criteria_scores, []),
            'comments' => $review->comments,
            'developmentRecommendations' => $this->decode($review->development_recommendations, []),
            'managerSubmittedAt' => $review->manager_submitted_at,
            'finalizedAt' => $review->finalized_at,
            'calibrationStatus' => $review->calibration_status,
        ];
    }

    private function recordEvent(int $reviewId, string $type, User $actor, array $attributes = []): void
    {
        DB::table('performance_review_events')->insert([
            'performance_review_id' => $reviewId,
            'event_type' => $type,
            'actor_user_id' => $actor->id,
            'from_evaluator_user_id' => $attributes['from_evaluator_user_id'] ?? null,
            'to_evaluator_user_id' => $attributes['to_evaluator_user_id'] ?? null,
            'reason' => $attributes['reason'] ?? null,
            'notes' => $attributes['notes'] ?? null,
            'snapshot' => isset($attributes['snapshot'])
                ? json_encode($attributes['snapshot'], JSON_THROW_ON_ERROR)
                : null,
            'revision_version' => $attributes['revision_version'] ?? null,
            'occurred_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function userByKey(string $key): User
    {
        $user = User::query()->where('personnel_key', trim($key))->first();
        if (! $user) {
            throw ValidationException::withMessages(['personnel' => 'The referenced personnel record does not exist.']);
        }

        return $user;
    }

    private function cycleByKey(string $key): object
    {
        $cycle = DB::table('performance_cycles')->where('external_key', trim($key))->first();
        if (! $cycle) {
            throw ValidationException::withMessages(['cycle' => 'The referenced Performance Cycle does not exist.']);
        }

        return $cycle;
    }

    private function decode(mixed $value, mixed $default): mixed
    {
        if ($value === null) {
            return $default;
        }
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $default;
    }

    private function sameJson(mixed $left, mixed $right): bool
    {
        return json_encode($left, JSON_PRESERVE_ZERO_FRACTION) === json_encode($right, JSON_PRESERVE_ZERO_FRACTION);
    }

    private function assertLockVersion(?object $existing, array $payload, string $label): void
    {
        if (! $existing || ! array_key_exists('lockVersion', $payload)) {
            return;
        }

        if ((int) $payload['lockVersion'] !== (int) $existing->lock_version) {
            throw ValidationException::withMessages([
                'version' => "{$label} changed on the server. Reload before saving again.",
            ]);
        }
    }

    private function requireOperator(User $actor): void
    {
        if (! $actor->isPerformanceOperator()) {
            $this->deny('This action requires authorized Admin/HR access.');
        }
    }

    private function deny(string $message): never
    {
        abort(403, $message);
    }
}