<?php

namespace App\Services\Performance;

use App\Enums\UserRole;
use App\Models\User;
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

    public function state(User $actor): array
    {
        $reviewRows = $this->visibleReviewQuery($actor)->get();
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

        return [
            'actor' => [
                'userId' => $actor->id,
                'personnelKey' => $actor->personnel_key,
                'name' => $actor->name,
                'email' => $actor->email,
                'role' => $actor->role->value,
                'capabilities' => [
                    'monitorOrganization' => $actor->isPerformanceOperator(),
                    'configurePerformance' => $actor->role === UserRole::Admin,
                    'operatePerformance' => $actor->isPerformanceOperator(),
                    'evaluateAssignedPeople' => (bool) $actor->evaluator_capable,
                ],
            ],
            'personnel' => $personnel,
            'cycles' => $cycles,
            'reviewTemplates' => $reviewTemplates,
            'goalTemplates' => $goalTemplates,
            'goals' => $goals,
            'assignments' => $this->assignmentsForActor($actor),
            'reviews' => $reviews,
            'development' => $this->developmentForActor($actor),
            'anonymousUpwardFeedback' => [
                'enabled' => (bool) config('services.groq.performance_anonymous_feedback', false),
                'subjectSafeOnly' => true,
            ],
        ];
    }

    public function syncConfiguration(User $actor, array $payload): array
    {
        $this->requireAdmin($actor);

        DB::transaction(function () use ($actor, $payload): void {
            foreach ($payload['cycles'] ?? [] as $cycle) {
                $this->upsertCycle($cycle);
            }

            foreach ($payload['reviewTemplates'] ?? [] as $template) {
                $this->upsertReviewTemplate($template);
            }

            foreach ($payload['goalTemplates'] ?? [] as $template) {
                $this->upsertGoalTemplate($template);
            }

            foreach ($payload['goals'] ?? [] as $goal) {
                $this->upsertGoal($goal);
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

    public function syncDevelopment(User $actor, array $development): array
    {
        DB::transaction(function () use ($actor, $development): void {
            foreach ($development['feedbackRecords'] ?? [] as $record) {
                $this->upsertFeedback($actor, $record);
            }

            foreach ($development['pips'] ?? [] as $pip) {
                $this->upsertPip($actor, $pip);
            }

            foreach ($development['traineeJourneys'] ?? [] as $journey) {
                $this->upsertTraineeJourney($actor, $journey);
            }
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
            ->join('users as evaluators', 'evaluators.id', '=', 'assignments.evaluator_user_id')
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
            ->join('users as evaluators', 'evaluators.id', '=', 'assignments.evaluator_user_id')
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
                'evaluatorId' => $assignment->evaluator_key,
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
            $this->reassignReview($actor, $row, $requested);
            $row = $this->visibleReviewQuery($actor)->where('reviews.id', $row->id)->first();
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

    private function reassignReview(User $actor, object $row, array $requested): void
    {
        $this->requireOperator($actor);

        if ($row->status === 'Completed') {
            throw ValidationException::withMessages([
                'reviews' => 'Reopen a finalized review before reassigning it.',
            ]);
        }

        $history = Arr::last($requested['assignmentHistory'] ?? []);
        $reason = trim((string) ($history['reason'] ?? ''));
        if ($reason === '') {
            throw ValidationException::withMessages(['reviews' => 'A reassignment reason is required.']);
        }

        $target = $this->userByKey((string) $requested['evaluatorId']);
        if ($target->id === $row->subject_user_id || ! $target->evaluator_capable || $target->employment_status === 'Inactive') {
            throw ValidationException::withMessages(['reviews' => 'The selected evaluator is not eligible.']);
        }

        DB::table('performance_review_assignments')->where('id', $row->assignment_id)->update([
            'evaluator_user_id' => $target->id,
            'basis' => 'Exception',
            'assigned_by_id' => $actor->id,
            'assigned_at' => now(),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ]);

        $this->recordEvent($row->id, 'Reassigned', $actor, [
            'from_evaluator_user_id' => $row->evaluator_user_id,
            'to_evaluator_user_id' => $target->id,
            'reason' => $reason,
            'notes' => $history['notes'] ?? null,
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
            $updates += [
                'status' => 'In Progress',
                'workflow_state' => 'Revision In Progress',
                'finalized_at' => null,
            ];
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

        if ($author->id !== $actor->id && ! $actor->isPerformanceOperator()) {
            $this->deny('Feedback authorship cannot be impersonated.');
        }

        if ($existing && $existing->author_user_id !== $actor->id && ! $actor->isPerformanceOperator()) {
            $this->deny('You cannot change another author’s feedback record.');
        }

        if (! $actor->isPerformanceOperator() && ! $this->hasEvaluatorScope($actor->id, $subject->id, $record['cycleId'] ?? null)) {
            $this->deny('Feedback is limited to assigned personnel.');
        }

        $visibility = in_array($record['visibility'] ?? null, ['Employee & Manager', 'Manager & HR', 'HR Only'], true)
            ? $record['visibility']
            : 'Employee & Manager';
        if ($visibility === 'HR Only' && ! $actor->isPerformanceOperator()) {
            $this->deny('Only Admin/HR may create HR-only feedback.');
        }

        $cycleId = ! empty($record['cycleId']) ? $this->cycleByKey($record['cycleId'])->id : null;
        $reviewId = ! empty($record['relatedReviewId'])
            ? DB::table('performance_reviews')->where('external_key', $record['relatedReviewId'])->value('id')
            : null;
        $values = [
            'subject_user_id' => $subject->id,
            'author_user_id' => $author->id,
            'performance_cycle_id' => $cycleId,
            'performance_review_id' => $reviewId,
            'record_type' => in_array($record['recordType'] ?? null, ['1:1 Check-in', 'Feedback Note', 'Coaching Action'], true)
                ? $record['recordType']
                : 'Feedback Note',
            'note' => trim((string) ($record['note'] ?? '')),
            'coaching_action' => trim((string) ($record['coachingAction'] ?? '')) ?: null,
            'linked_goal_keys' => json_encode(array_values($record['linkedGoalIds'] ?? []), JSON_THROW_ON_ERROR),
            'follow_up_date' => $record['followUpDate'] ?? null,
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
            ->select('reviews.*', 'assignments.subject_user_id')
            ->first();

        if (! $review || $review->subject_user_id !== $subject->id || $review->status !== 'Completed') {
            throw ValidationException::withMessages(['development' => 'A PIP must reference the subject’s finalized review.']);
        }

        if (! $existing && ! $actor->isPerformanceOperator()) {
            $this->deny('Only authorized Admin/HR operators may create a PIP.');
        }
        if ($existing && ! $actor->isPerformanceOperator() && $existing->assigned_manager_id !== $actor->id) {
            $this->deny('Only the assigned manager or Admin/HR may update this PIP.');
        }
        if (! $this->hasEvaluatorScope($manager->id, $subject->id, null)) {
            throw ValidationException::withMessages(['development' => 'The PIP manager must have a legitimate evaluator relationship.']);
        }

        $status = in_array($pip['status'] ?? null, self::PIP_STATUSES, true) ? $pip['status'] : 'Active';
        $values = [
            'subject_user_id' => $subject->id,
            'performance_review_id' => $review->id,
            'assigned_manager_id' => $manager->id,
            'performance_concern' => trim((string) ($pip['performanceConcern'] ?? '')),
            'expected_improvement' => trim((string) ($pip['expectedImprovement'] ?? '')),
            'action_items' => json_encode(array_values($pip['actionItems'] ?? []), JSON_THROW_ON_ERROR),
            'start_date' => $pip['startDate'] ?? null,
            'target_end_date' => $pip['targetEndDate'] ?? null,
            'status' => $status,
            'milestones' => json_encode(array_values($pip['milestones'] ?? []), JSON_THROW_ON_ERROR),
            'progress_notes' => json_encode(array_values($pip['progressNotes'] ?? []), JSON_THROW_ON_ERROR),
            'development_actions' => json_encode(array_values($pip['developmentActions'] ?? []), JSON_THROW_ON_ERROR),
            'outcome_notes' => trim((string) ($pip['outcomeNotes'] ?? '')) ?: null,
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
        $values = [
            'trainee_user_id' => $trainee->id,
            'performance_cycle_id' => $cycleId,
            'current_stage' => (string) ($journey['currentStage'] ?? 'New Trainee'),
            'milestones' => json_encode(array_values($journey['milestones'] ?? []), JSON_THROW_ON_ERROR),
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

    private function upsertGoal(array $goal): void
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
            'progress' => $progress,
            'status' => $goal['status'] ?? 'Not Started',
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
        if ($basis === 'Cycle Assignment') {
            return;
        }

        $evaluator = $this->userByKey((string) ($assignment['evaluatorId'] ?? ''));
        if (! $evaluator->evaluator_capable || $evaluator->employment_status === 'Inactive') {
            throw ValidationException::withMessages(['configuration' => 'The selected evaluator is not active and evaluator-capable.']);
        }

        $scopeType = $assignment['scopeType'] ?? 'Specific Person';
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
                DB::table('performance_reporting_relationships')->updateOrInsert(
                    ['external_key' => $relationshipKey],
                    [
                        'supervisor_id' => $evaluator->id,
                        'direct_report_id' => $subject->id,
                        'source' => 'Manual',
                        'active' => true,
                        'effective_from' => now()->toDateString(),
                        'effective_to' => null,
                        'created_by_id' => $actor->id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ],
                );
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
                        'configuration' => "{$subject->name} already has one primary evaluator for {$cycle->name}. Use the audited Reassign action.",
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
            ->where('reports.employment_status', '!=', 'Inactive')
            ->select([
                'relationships.id as relationship_id',
                'relationships.external_key as relationship_key',
                'supervisors.id as supervisor_id',
                'reports.id as report_id',
            ])
            ->get();

        foreach ($cycles as $cycle) {
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

                $this->ensureAssignmentAndReview($actor, $cycle, $subject, $evaluator, 'Reporting Relationship', $relationship->relationship_id);
            }
        }
    }

    private function ensureAssignmentAndReview(
        User $actor,
        object $cycle,
        User $subject,
        User $evaluator,
        string $basis,
        ?int $relationshipId = null,
    ): void {
        $assignmentKey = "assignment-{$cycle->external_key}-{$subject->personnel_key}";
        DB::table('performance_review_assignments')->updateOrInsert(
            [
                'performance_cycle_id' => $cycle->id,
                'subject_user_id' => $subject->id,
            ],
            [
                'external_key' => $assignmentKey,
                'evaluator_user_id' => $evaluator->id,
                'reporting_relationship_id' => $relationshipId,
                'basis' => $basis,
                'active' => true,
                'assigned_by_id' => $actor->id,
                'assigned_at' => now(),
                'lock_version' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $assignment = DB::table('performance_review_assignments')
            ->where('performance_cycle_id', $cycle->id)
            ->where('subject_user_id', $subject->id)
            ->first();
        if (DB::table('performance_reviews')->where('performance_review_assignment_id', $assignment->id)->exists()) {
            return;
        }

        $templateKeys = $this->decode($cycle->review_template_keys, []);
        $templateKey = $templateKeys[$subject->person_type] ?? null;
        $templateId = $templateKey
            ? DB::table('performance_review_templates')->where('external_key', $templateKey)->value('id')
            : null;
        DB::table('performance_reviews')->insert([
            'external_key' => "review-{$cycle->external_key}-{$subject->personnel_key}",
            'performance_review_assignment_id' => $assignment->id,
            'performance_review_template_id' => $templateId,
            'status' => 'Pending',
            'workflow_state' => 'Manager Review',
            'calibration_status' => $cycle->calibration_required ? 'Pending' : 'Not Required',
            'due_date' => $cycle->review_due_date,
            'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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

    private function resolveTemplate(?string $templateKey, object $cycle, User $subject): object
    {
        if (! $templateKey) {
            $keys = $this->decode($cycle->review_template_keys, []);
            $templateKey = $keys[$subject->person_type] ?? null;
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

    private function assertCycleOpenForManagerReview(object $cycle): void
    {
        if ($cycle->status !== 'Active') {
            throw ValidationException::withMessages(['reviews' => 'Manager review is available only in an active cycle.']);
        }

        $today = CarbonImmutable::today(config('app.timezone'));
        if ($today->lt(CarbonImmutable::parse($cycle->review_open_date))) {
            throw ValidationException::withMessages(['reviews' => 'The review window has not opened yet.']);
        }
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

    private function requireAdmin(User $actor): void
    {
        if ($actor->role !== UserRole::Admin) {
            $this->deny('Only Admin may change Performance configuration.');
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