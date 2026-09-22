<?php

namespace App\Services\Succession;

use App\Enums\UserRole;
use App\Models\Succession\CriticalPosition;
use App\Models\Succession\DevelopmentAction;
use App\Models\Succession\DevelopmentPlan;
use App\Models\Succession\ReadinessAssessment;
use App\Models\Succession\SuccessionCandidate;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SuccessionService
{
    public function __construct(private readonly SuccessionAuditService $audit) {}

    public function state(User $actor): array
    {
        $this->requireOperator($actor);
        $positions = CriticalPosition::query()
            ->with(['incumbent', 'requirements', 'candidates.candidate', 'candidates.assessments', 'candidates.plans.actions', 'candidates.plans.owner'])
            ->orderByRaw("CASE criticality WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 ELSE 3 END")
            ->orderBy('position_title')->get();

        $personnel = User::query()->activePersonnel()->orderBy('name')->get()
            ->map(fn (User $person) => $this->person($person))->values()->all();
        $rows = $positions->map(fn (CriticalPosition $position) => $this->position($position))->values()->all();
        $candidates = collect($rows)->flatMap(fn (array $position) => $position['candidates'])->values();
        $activePositions = collect($rows)->where('status', 'Active');
        $accepted = $candidates->where('status', 'Accepted');
        $readyNow = $accepted->where('latestAssessment.readinessBand', 'Ready Now')->count();

        return [
            'actor' => ['id' => $actor->id, 'role' => $actor->role->value, 'canManage' => true, 'canFinalize' => true],
            'personnel' => $personnel,
            'positions' => $rows,
            'metrics' => [
                'criticalPositions' => $activePositions->count(),
                'coveredPositions' => $activePositions->filter(fn ($p) => collect($p['candidates'])->where('status', 'Accepted')->isNotEmpty())->count(),
                'readyNow' => $readyNow,
                'positionsAtRisk' => $activePositions->filter(fn ($p) => count($p['riskFlags']) > 0)->count(),
                'activeDevelopmentPlans' => $candidates->flatMap(fn ($candidate) => $candidate['plans'])->where('status', 'Active')->count(),
            ],
            'governance' => [
                'finalizers' => ['Admin', 'HR'],
                'userSuccessionWorkspace' => false,
                'userVisibility' => 'Only development work dispatched to existing Learning, Training, or development surfaces; confidential readiness and pipeline records remain hidden.',
                'decisionBoundary' => 'Succession supports governed planning. It never promotes, appoints, ranks, or changes employment records automatically.',
                'ai' => ['enabled' => false, 'reason' => 'Aevyn/Groq is intentionally deferred until an approved API is configured.'],
                'certificates' => 'Learning and Training remain the certificate owners. Succession stores immutable evidence snapshots and source links only.',
            ],
            'integration' => [
                'personnel' => 'Connected: canonical active users',
                'performance' => 'Connected: finalized reviews only',
                'competency' => 'Contract-ready: accepts finalized versioned competency snapshots',
                'learning' => 'Connected: official completions and certificate status',
                'training' => 'Connected: HR-finalized completions and certificate status',
            ],
        ];
    }

    public function savePosition(User $actor, array $data, ?CriticalPosition $position = null): CriticalPosition
    {
        $this->requireOperator($actor);
        if ($position && $position->status !== 'Draft') {
            throw ValidationException::withMessages(['position' => 'Only Draft critical positions may be edited. Archive and create a governed replacement when the success profile changes materially.']);
        }
        $incumbent = isset($data['incumbentId']) ? User::query()->activePersonnel()->find($data['incumbentId']) : null;
        if (isset($data['incumbentId']) && ! $incumbent) {
            throw ValidationException::withMessages(['incumbentId' => 'Select an active canonical personnel record.']);
        }

        return DB::transaction(function () use ($actor, $data, $position, $incumbent): CriticalPosition {
            $position ??= new CriticalPosition(['created_by' => $actor->id]);
            $position->fill([
                'position_title' => trim($data['positionTitle']), 'department' => trim($data['department']),
                'criticality' => $data['criticality'], 'incumbent_id' => $incumbent?->id,
                'business_impact' => trim($data['businessImpact']), 'vacancy_risk' => trim((string) ($data['vacancyRisk'] ?? '')) ?: null,
                'review_cycle_months' => $data['reviewCycleMonths'], 'next_review_at' => $data['nextReviewAt'] ?? null,
                'updated_by' => $actor->id,
            ])->save();
            $position->requirements()->delete();
            foreach ($data['requirements'] as $requirement) {
                $position->requirements()->create([
                    'requirement_type' => $requirement['type'], 'source_key' => $requirement['sourceKey'] ?? null,
                    'source_version' => $requirement['sourceVersion'] ?? null, 'label' => trim($requirement['label']),
                    'target_level' => $requirement['targetLevel'] ?? null, 'required' => $requirement['required'] ?? true,
                    'source_snapshot' => $requirement['sourceSnapshot'] ?? [],
                ]);
            }
            $this->audit->record($actor, $position->wasRecentlyCreated ? 'CriticalPositionCreated' : 'CriticalPositionUpdated', 'CriticalPosition', $position->id);
            return $position->fresh('requirements');
        });
    }

    public function transitionPosition(User $actor, CriticalPosition $position, string $status, ?string $reason = null): void
    {
        $this->requireOperator($actor);
        $allowed = ['Draft' => ['Active', 'Archived'], 'Active' => ['Archived']];
        if (! in_array($status, $allowed[$position->status] ?? [], true)) {
            throw ValidationException::withMessages(['status' => "A {$position->status} position cannot move to {$status}."]);
        }
        if ($status === 'Active' && ($position->requirements()->doesntExist() || trim($position->business_impact) === '')) {
            throw ValidationException::withMessages(['requirements' => 'Add at least one success-profile requirement and business impact before activation.']);
        }
        if ($status === 'Archived' && trim((string) $reason) === '') {
            throw ValidationException::withMessages(['reason' => 'An archive reason is required.']);
        }
        $position->update(['status' => $status, 'activated_at' => $status === 'Active' ? now() : $position->activated_at, 'archived_at' => $status === 'Archived' ? now() : null, 'updated_by' => $actor->id]);
        $this->audit->record($actor, 'CriticalPositionStatusChanged', 'CriticalPosition', $position->id, ['status' => $status, 'reason' => $reason]);
    }

    public function nominate(User $actor, CriticalPosition $position, int $candidateId, string $source, string $rationale): SuccessionCandidate
    {
        $this->requireOperator($actor);
        if ($position->status !== 'Active') throw ValidationException::withMessages(['position' => 'Candidates may only be nominated to an Active critical position.']);
        $person = User::query()->activePersonnel()->findOrFail($candidateId);
        if ($position->incumbent_id === $person->id) throw ValidationException::withMessages(['candidateId' => 'The current incumbent cannot be nominated as their own successor.']);
        $record = SuccessionCandidate::query()->firstOrNew(['critical_position_id' => $position->id, 'candidate_id' => $person->id]);
        if ($record->exists && ! in_array($record->status, ['Declined', 'Withdrawn'], true)) throw ValidationException::withMessages(['candidateId' => 'This person already has an active nomination for the position.']);
        $record->fill([
            'status' => 'Proposed', 'nomination_source' => $source, 'nomination_rationale' => trim($rationale),
            'personnel_snapshot' => $this->person($person), 'nominated_by' => $actor->id, 'nominated_at' => now(),
            'decided_by' => null, 'decided_at' => null, 'decision_reason' => null,
        ])->save();
        $this->audit->record($actor, 'CandidateNominated', 'SuccessionCandidate', $record->id, ['source' => $source]);
        return $record;
    }

    public function transitionCandidate(User $actor, SuccessionCandidate $candidate, string $status, ?string $reason = null): void
    {
        $this->requireOperator($actor);
        $allowed = ['Proposed' => ['Under Review', 'Declined', 'Withdrawn'], 'Under Review' => ['Accepted', 'Declined', 'Withdrawn'], 'Accepted' => ['Withdrawn'], 'Declined' => ['Proposed'], 'Withdrawn' => ['Proposed']];
        if (! in_array($status, $allowed[$candidate->status] ?? [], true)) throw ValidationException::withMessages(['status' => "A {$candidate->status} nomination cannot move to {$status}."]);
        if (in_array($status, ['Accepted', 'Declined', 'Withdrawn'], true) && trim((string) $reason) === '') throw ValidationException::withMessages(['reason' => 'A decision reason is required.']);
        if ($status === 'Accepted' && $candidate->assessments()->where('status', 'Finalized')->doesntExist()) throw ValidationException::withMessages(['assessment' => 'Finalize a readiness assessment before accepting a candidate into the pipeline.']);
        $candidate->update(['status' => $status, 'decided_by' => in_array($status, ['Accepted', 'Declined', 'Withdrawn'], true) ? $actor->id : null, 'decided_at' => in_array($status, ['Accepted', 'Declined', 'Withdrawn'], true) ? now() : null, 'decision_reason' => $reason]);
        $this->audit->record($actor, 'CandidateStatusChanged', 'SuccessionCandidate', $candidate->id, ['status' => $status, 'reason' => $reason]);
    }

    public function createAssessment(User $actor, SuccessionCandidate $candidate, array $data): ReadinessAssessment
    {
        $this->requireOperator($actor);
        if (in_array($candidate->status, ['Declined', 'Withdrawn'], true)) throw ValidationException::withMessages(['candidate' => 'Inactive nominations cannot be assessed.']);
        if ($candidate->assessments()->where('status', 'Draft')->exists()) throw ValidationException::withMessages(['assessment' => 'Complete or discard the existing Draft assessment first.']);
        $candidate->load('candidate', 'position.requirements');
        $version = ((int) $candidate->assessments()->max('version')) + 1;
        $assessment = ReadinessAssessment::query()->create([
            'succession_candidate_id' => $candidate->id, 'supersedes_id' => $candidate->assessments()->where('status', 'Finalized')->latest('version')->value('id'),
            'version' => $version, 'status' => 'Draft', 'readiness_band' => $data['readinessBand'] ?? null,
            ...$this->evidenceSnapshots($candidate->candidate),
            'requirement_snapshot' => $candidate->position->requirements->map(fn ($requirement) => [
                'type' => $requirement->requirement_type, 'sourceKey' => $requirement->source_key, 'sourceVersion' => $requirement->source_version,
                'label' => $requirement->label, 'targetLevel' => $requirement->target_level, 'required' => $requirement->required,
            ])->values()->all(),
            'development_needs' => $data['developmentNeeds'] ?? [], 'risk_flags' => $data['riskFlags'] ?? [],
            'reviewer_summary' => trim((string) ($data['reviewerSummary'] ?? '')) ?: null,
            'created_by' => $actor->id, 'updated_by' => $actor->id,
        ]);
        $this->audit->record($actor, 'ReadinessAssessmentDrafted', 'ReadinessAssessment', $assessment->id, ['version' => $version]);
        return $assessment;
    }

    public function updateAssessment(User $actor, ReadinessAssessment $assessment, array $data): void
    {
        $this->requireOperator($actor);
        if ($assessment->status !== 'Draft') throw ValidationException::withMessages(['assessment' => 'Finalized readiness snapshots are immutable. Reopen to create a new version.']);
        $assessment->update([
            'readiness_band' => $data['readinessBand'], 'development_needs' => $data['developmentNeeds'],
            'risk_flags' => $data['riskFlags'], 'reviewer_summary' => trim($data['reviewerSummary']), 'updated_by' => $actor->id,
        ]);
        $this->audit->record($actor, 'ReadinessAssessmentUpdated', 'ReadinessAssessment', $assessment->id);
    }

    public function finalizeAssessment(User $actor, ReadinessAssessment $assessment): void
    {
        $this->requireOperator($actor);
        if ($assessment->status !== 'Draft') throw ValidationException::withMessages(['assessment' => 'Only a Draft readiness assessment may be finalized.']);
        if (! $assessment->readiness_band || trim((string) $assessment->reviewer_summary) === '') throw ValidationException::withMessages(['assessment' => 'Readiness band and reviewer summary are required before finalization.']);
        $assessment->update(['status' => 'Finalized', 'finalized_by' => $actor->id, 'finalized_at' => now(), 'updated_by' => $actor->id]);
        $this->audit->record($actor, 'ReadinessAssessmentFinalized', 'ReadinessAssessment', $assessment->id, ['readinessBand' => $assessment->readiness_band]);
    }

    public function reopenAssessment(User $actor, ReadinessAssessment $assessment, string $reason): ReadinessAssessment
    {
        $this->requireOperator($actor);
        if ($assessment->status !== 'Finalized') throw ValidationException::withMessages(['assessment' => 'Only a Finalized readiness assessment may be reopened.']);
        if (trim($reason) === '') throw ValidationException::withMessages(['reason' => 'A reopen reason is required.']);
        $candidate = $assessment->candidateRecord;
        if ($candidate->assessments()->where('status', 'Draft')->exists()) throw ValidationException::withMessages(['assessment' => 'A Draft reassessment already exists.']);
        $copy = $assessment->replicate(['finalized_by', 'finalized_at']);
        $copy->id = (string) Str::uuid(); $copy->supersedes_id = $assessment->id; $copy->version = $assessment->version + 1;
        $copy->status = 'Draft'; $copy->created_by = $actor->id; $copy->updated_by = $actor->id; $copy->save();
        $this->audit->record($actor, 'ReadinessAssessmentReopened', 'ReadinessAssessment', $copy->id, ['supersedesId' => $assessment->id, 'reason' => $reason]);
        return $copy;
    }

    public function createPlan(User $actor, SuccessionCandidate $candidate, array $data): DevelopmentPlan
    {
        $this->requireOperator($actor);
        $owner = User::query()->activePersonnel()->find($data['ownerId']);
        if (! $owner) throw ValidationException::withMessages(['ownerId' => 'Select an active canonical plan owner.']);
        $assessmentId = $candidate->assessments()->where('status', 'Finalized')->whereKey($data['assessmentId'] ?? null)->value('id');
        if (($data['assessmentId'] ?? null) && ! $assessmentId) throw ValidationException::withMessages(['assessmentId' => 'Development plans may only reference a finalized readiness assessment for this candidate.']);
        $plan = DevelopmentPlan::query()->create([
            'succession_candidate_id' => $candidate->id, 'readiness_assessment_id' => $assessmentId,
            'status' => 'Draft', 'title' => trim($data['title']), 'objective' => trim($data['objective']),
            'starts_on' => $data['startsOn'] ?? null, 'target_date' => $data['targetDate'] ?? null,
            'owner_id' => $owner->id, 'created_by' => $actor->id, 'updated_by' => $actor->id,
        ]);
        $this->audit->record($actor, 'DevelopmentPlanCreated', 'DevelopmentPlan', $plan->id);
        return $plan;
    }

    public function transitionPlan(User $actor, DevelopmentPlan $plan, string $status, ?string $reason = null): void
    {
        $this->requireOperator($actor);
        $allowed = ['Draft' => ['Active', 'Cancelled'], 'Active' => ['Completed', 'Cancelled']];
        if (! in_array($status, $allowed[$plan->status] ?? [], true)) throw ValidationException::withMessages(['status' => "A {$plan->status} plan cannot move to {$status}."]);
        if ($status === 'Active' && $plan->actions()->doesntExist()) throw ValidationException::withMessages(['actions' => 'Add at least one development action before activation.']);
        if ($status === 'Completed' && $plan->actions()->where('status', '!=', 'Completed')->exists()) throw ValidationException::withMessages(['actions' => 'Complete every development action before completing the plan.']);
        if ($status === 'Cancelled' && trim((string) $reason) === '') throw ValidationException::withMessages(['reason' => 'A cancellation reason is required.']);
        $plan->update([
            'status' => $status, 'activated_by' => $status === 'Active' ? $actor->id : $plan->activated_by,
            'activated_at' => $status === 'Active' ? now() : $plan->activated_at, 'completed_at' => $status === 'Completed' ? now() : null,
            'transition_reason' => $reason, 'updated_by' => $actor->id,
        ]);
        $this->audit->record($actor, 'DevelopmentPlanStatusChanged', 'DevelopmentPlan', $plan->id, ['status' => $status, 'reason' => $reason]);
    }

    public function saveAction(User $actor, DevelopmentPlan $plan, array $data, ?DevelopmentAction $action = null): DevelopmentAction
    {
        $this->requireOperator($actor);
        if ($plan->status === 'Completed' || $plan->status === 'Cancelled') throw ValidationException::withMessages(['plan' => 'Closed development plans cannot be changed.']);
        if ($action && $action->development_plan_id !== $plan->id) throw new AuthorizationException('The development action does not belong to this plan.');
        if (($data['sourceModule'] ?? null) && ! ($data['sourceRecordId'] ?? null)) throw ValidationException::withMessages(['sourceRecordId' => 'A source record is required when an action is linked to Learning or Training.']);
        $action ??= new DevelopmentAction(['development_plan_id' => $plan->id, 'created_by' => $actor->id]);
        $action->fill([
            'action_type' => $data['actionType'], 'title' => trim($data['title']), 'description' => trim((string) ($data['description'] ?? '')) ?: null,
            'source_module' => $data['sourceModule'] ?? null, 'source_record_id' => $data['sourceRecordId'] ?? null,
            'status' => $data['status'] ?? 'Planned', 'due_on' => $data['dueOn'] ?? null,
            'completed_at' => ($data['status'] ?? null) === 'Completed' ? now() : null,
            'evidence_snapshot' => $data['evidenceSnapshot'] ?? [], 'updated_by' => $actor->id,
        ])->save();
        $this->audit->record($actor, $action->wasRecentlyCreated ? 'DevelopmentActionCreated' : 'DevelopmentActionUpdated', 'DevelopmentAction', $action->id, ['sourceModule' => $action->source_module]);
        return $action;
    }

    public function receiveEvidence(User $actor, array $data): string
    {
        $this->requireOperator($actor);
        $person = User::query()->activePersonnel()->where('personnel_key', $data['personnelKey'])->first();
        if (! $person) throw ValidationException::withMessages(['personnelKey' => 'Evidence must belong to active canonical personnel.']);
        $id = DB::transaction(function () use ($actor, $data): string {
            $existing = DB::table('succession_evidence_records')->where('source_module', $data['sourceModule'])->where('source_record_id', $data['sourceRecordId'])->lockForUpdate()->first();
            $id = $existing?->id ?? (string) Str::uuid();
            DB::table('succession_evidence_records')->updateOrInsert(
                ['source_module' => $data['sourceModule'], 'source_record_id' => $data['sourceRecordId']],
                ['id' => $id, 'personnel_key' => $data['personnelKey'], 'source_finalized_at' => $data['sourceFinalizedAt'], 'source_snapshot' => json_encode($data['sourceSnapshot'], JSON_THROW_ON_ERROR), 'received_by' => $actor->id, 'received_at' => now(), 'created_at' => $existing?->created_at ?? now(), 'updated_at' => now()],
            );
            return $id;
        });
        $this->audit->record($actor, 'FinalizedEvidenceReceived', 'SuccessionEvidence', $id, ['sourceModule' => $data['sourceModule']]);
        return $id;
    }

    private function evidenceSnapshots(User $person): array
    {
        $performance = DB::table('performance_reviews as review')
            ->join('performance_review_assignments as assignment', 'assignment.id', '=', 'review.performance_review_assignment_id')
            ->join('performance_cycles as cycle', 'cycle.id', '=', 'assignment.performance_cycle_id')
            ->where('assignment.subject_user_id', $person->id)->where('review.workflow_state', 'Finalized')->whereNotNull('review.finalized_at')
            ->orderByDesc('review.finalized_at')->limit(5)->get(['review.external_key as id', 'cycle.name as cycle', 'review.final_rating as rating', 'review.finalized_at'])
            ->map(fn ($row) => (array) $row)->values()->all();
        $competency = DB::table('succession_evidence_records')->where('source_module', 'Competency')->where('personnel_key', $person->personnel_key)
            ->orderByDesc('source_finalized_at')->limit(10)->get()->map(fn ($row) => ['sourceRecordId' => $row->source_record_id, 'finalizedAt' => $row->source_finalized_at, 'snapshot' => json_decode($row->source_snapshot, true)])->all();
        $learning = DB::table('learning_completions as completion')->join('learning_course_versions as version', 'version.id', '=', 'completion.course_version_id')
            ->leftJoin('learning_certificates as certificate', 'certificate.completion_id', '=', 'completion.id')->where('completion.learner_id', $person->id)
            ->orderByDesc('completion.completed_at')->get(['completion.id', 'version.title', 'completion.completed_at', 'completion.assessment_score', 'certificate.id as certificate_id', 'certificate.certificate_number', 'certificate.status as certificate_status', 'certificate.expires_on'])
            ->map(fn ($row) => (array) $row)->values()->all();
        $training = DB::table('training_completions as completion')->join('training_enrollments as enrollment', 'enrollment.id', '=', 'completion.enrollment_id')
            ->join('training_programs as program', 'program.id', '=', 'enrollment.program_id')->leftJoin('training_certificates as certificate', 'certificate.completion_id', '=', 'completion.id')
            ->where('enrollment.participant_id', $person->id)->orderByDesc('completion.finalized_at')
            ->get(['completion.id', 'program.title', 'completion.status', 'completion.attendance_rate', 'completion.finalized_at', 'certificate.id as certificate_id', 'certificate.certificate_number', 'certificate.status as certificate_status', 'certificate.expires_at'])
            ->map(fn ($row) => (array) $row)->values()->all();
        return [
            'performance_snapshot' => ['source' => 'Performance', 'finalizedOnly' => true, 'records' => $performance],
            'competency_snapshot' => ['source' => 'Competency', 'finalizedOnly' => true, 'records' => $competency, 'contractStatus' => $competency ? 'Connected' : 'No finalized competency snapshot received'],
            'learning_snapshot' => ['source' => 'Learning', 'certificateOwner' => 'Learning', 'records' => $learning],
            'training_snapshot' => ['source' => 'Training', 'certificateOwner' => 'Training', 'records' => $training],
        ];
    }

    private function position(CriticalPosition $position): array
    {
        $candidates = $position->candidates->map(function (SuccessionCandidate $candidate): array {
            $latest = $candidate->assessments->where('status', 'Finalized')->sortByDesc('version')->first()
                ?? $candidate->assessments->sortByDesc('version')->first();
            return [
                'id' => $candidate->id, 'positionId' => $candidate->critical_position_id, 'person' => $this->person($candidate->candidate),
                'status' => $candidate->status, 'nominationSource' => $candidate->nomination_source, 'rationale' => $candidate->nomination_rationale,
                'nominatedAt' => $candidate->nominated_at?->toIso8601String(), 'decisionReason' => $candidate->decision_reason,
                'latestAssessment' => $latest ? $this->assessment($latest) : null,
                'assessments' => $candidate->assessments->sortByDesc('version')->map(fn ($assessment) => $this->assessment($assessment))->values()->all(),
                'plans' => $candidate->plans->map(fn ($plan) => $this->plan($plan))->values()->all(),
            ];
        })->values()->all();
        $accepted = collect($candidates)->where('status', 'Accepted');
        $readyNow = $accepted->where('latestAssessment.readinessBand', 'Ready Now')->count();
        $flags = [];
        if ($position->status === 'Active' && $accepted->isEmpty()) $flags[] = 'No accepted successor';
        if ($accepted->count() === 1) $flags[] = 'Single-successor dependency';
        if ($accepted->isNotEmpty() && $readyNow === 0) $flags[] = 'No Ready Now successor';
        if ($position->next_review_at?->isPast()) $flags[] = 'Review overdue';
        return [
            'id' => $position->id, 'positionTitle' => $position->position_title, 'department' => $position->department,
            'criticality' => $position->criticality, 'status' => $position->status, 'businessImpact' => $position->business_impact,
            'vacancyRisk' => $position->vacancy_risk, 'reviewCycleMonths' => $position->review_cycle_months,
            'nextReviewAt' => $position->next_review_at?->toIso8601String(), 'incumbent' => $position->incumbent ? $this->person($position->incumbent) : null,
            'requirements' => $position->requirements->map(fn ($requirement) => ['id' => $requirement->id, 'type' => $requirement->requirement_type, 'label' => $requirement->label, 'targetLevel' => $requirement->target_level, 'required' => $requirement->required, 'sourceKey' => $requirement->source_key, 'sourceVersion' => $requirement->source_version])->values()->all(),
            'candidates' => $candidates, 'coverage' => ['accepted' => $accepted->count(), 'readyNow' => $readyNow], 'riskFlags' => $flags,
        ];
    }

    private function assessment(ReadinessAssessment $assessment): array
    {
        return ['id' => $assessment->id, 'version' => $assessment->version, 'status' => $assessment->status, 'readinessBand' => $assessment->readiness_band, 'reviewerSummary' => $assessment->reviewer_summary, 'developmentNeeds' => $assessment->development_needs ?? [], 'riskFlags' => $assessment->risk_flags ?? [], 'performance' => $assessment->performance_snapshot, 'competency' => $assessment->competency_snapshot, 'learning' => $assessment->learning_snapshot, 'training' => $assessment->training_snapshot, 'finalizedAt' => $assessment->finalized_at?->toIso8601String(), 'finalizedBy' => $assessment->finalized_by];
    }

    private function plan(DevelopmentPlan $plan): array
    {
        return ['id' => $plan->id, 'status' => $plan->status, 'title' => $plan->title, 'objective' => $plan->objective, 'startsOn' => $plan->starts_on?->toDateString(), 'targetDate' => $plan->target_date?->toDateString(), 'owner' => $plan->owner?->name, 'actions' => $plan->actions->map(fn ($action) => ['id' => $action->id, 'actionType' => $action->action_type, 'title' => $action->title, 'description' => $action->description, 'sourceModule' => $action->source_module, 'sourceRecordId' => $action->source_record_id, 'status' => $action->status, 'dueOn' => $action->due_on?->toDateString(), 'evidence' => $action->evidence_snapshot])->values()->all()];
    }

    private function person(User $person): array
    {
        return ['id' => $person->id, 'personnelKey' => $person->personnel_key, 'employeeId' => $person->employee_or_trainee_id, 'name' => $person->name, 'position' => $person->position, 'department' => $person->department, 'personType' => $person->person_type, 'managerId' => $person->manager_id];
    }

    private function requireOperator(User $actor): void
    {
        if (! in_array($actor->role, [UserRole::Admin, UserRole::HR], true)) throw new AuthorizationException('Succession Planning is restricted to Admin and HR.');
    }
}
