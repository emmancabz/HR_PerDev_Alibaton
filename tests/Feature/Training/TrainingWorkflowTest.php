<?php

namespace Tests\Feature\Training;

use App\Enums\UserRole;
use App\Models\Training\TrainingAttendanceRecord;
use App\Models\Training\TrainingEnrollment;
use App\Models\Training\TrainingProgram;
use App\Models\Training\TrainingRecommendation;
use App\Models\User;
use App\Services\Training\TrainingService;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class TrainingWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $hr;
    private User $facilitator;
    private User $participant;
    private TrainingService $training;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->person('admin', UserRole::Admin, 'System Administrator', 'Administration', 'Employee');
        $this->hr = $this->person('training-officer', UserRole::HR, 'Training Officer', 'Human Resources', 'Employee');
        $this->facilitator = $this->person('facilitator', UserRole::User, 'Safety Officer', 'Operations', 'Employee');
        $this->participant = $this->person('participant', UserRole::User, 'Operations Trainee', 'Operations', 'Trainee');
        $this->training = app(TrainingService::class);
    }

    public function test_program_uses_canonical_audience_and_persists_as_draft_before_activation(): void
    {
        $program = $this->training->createProgram($this->admin, $this->payload());
        $this->assertDatabaseHas('training_programs', ['id' => $program->id, 'status' => 'Draft', 'title' => 'Operations Safety Practical']);
        $this->training->transitionProgram($this->admin, $program, 'activate');
        $this->assertSame('Active', $program->fresh()->status);

        $invalid = $this->payload();
        $invalid['audienceRules']['personTypes'] = ['Contractor invented by Training'];
        $this->expectException(ValidationException::class);
        $this->training->createProgram($this->admin, $invalid);
    }

    public function test_hr2_contract_never_auto_finalizes_training_attendance(): void
    {
        [$program, $session, $enrollment] = $this->scheduledEnrollment();
        $this->training->syncWorkforceEvidence($this->hr, $session);
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();

        $this->assertSame('Not Connected', $attendance->workforce_sync_status);
        $this->assertSame('Pending', $attendance->training_status);
        $this->assertNull($attendance->finalized_at);
        $this->assertSame('HR2 Workforce Management', $attendance->workforce_snapshot['sourceSystem']);
    }

    public function test_assigned_facilitator_prepares_attendance_and_authorized_governance_finalizes_it(): void
    {
        [, $session] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();
        $this->training->transitionSession($this->admin, $session, 'Ongoing');
        $this->training->recordAttendance($this->facilitator, $attendance, 'Present', 'Verified at the Training venue; workforce attendance evidence is not connected.');
        $this->assertSame('Manual', $attendance->fresh()->recording_source);

        try {
            $this->training->finalizeAttendance($this->facilitator, $session->fresh());
            $this->fail('A facilitator must not finalize governed attendance.');
        } catch (AuthorizationException) {
            $this->assertNull($attendance->fresh()->finalized_at);
        }

        $this->training->finalizeAttendance($this->admin, $session->fresh());
        $this->assertNotNull($attendance->fresh()->finalized_at);
        $this->assertSame($this->admin->id, $attendance->fresh()->finalized_by);
    }

    public function test_hr_finalizes_attendance_assessment_completion_and_training_certificate(): void
    {
        [, $session, $enrollment] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();
        $this->training->transitionSession($this->hr, $session, 'Ongoing');
        $this->training->recordAttendance($this->facilitator, $attendance, 'Present', 'Verified at the Training venue; HR 2 is not connected.');
        $this->training->finalizeAttendance($this->hr, $session);
        $this->training->transitionSession($this->hr, $session->fresh(), 'Completed');
        $this->training->assess($this->facilitator, $enrollment, [
            'result' => 'Passed', 'score' => 92, 'maximumScore' => 100,
            'checklist' => [['criterion' => 'Demonstrates the documented safety sequence', 'met' => true]],
            'notes' => 'Practical sequence completed under observation.',
        ]);
        $completion = $this->training->finalizeCompletion($this->hr, $enrollment, 'Passed', 'Attendance and practical assessment verified.');

        $this->assertSame('100.00', $completion->attendance_rate);
        $this->assertDatabaseHas('training_completions', ['id' => $completion->id, 'status' => 'Passed', 'finalized_by' => $this->hr->id]);
        $this->assertDatabaseHas('training_certificates', ['completion_id' => $completion->id, 'status' => 'Active']);
        $this->assertDatabaseHas('training_enrollments', ['id' => $enrollment->id, 'status' => 'Completed']);
    }

    public function test_completion_cannot_pass_below_saved_attendance_threshold(): void
    {
        [, $session, $enrollment] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();
        $this->training->transitionSession($this->hr, $session, 'Ongoing');
        $this->training->recordAttendance($this->hr, $attendance, 'Absent', 'Participant was not present; HR 2 is not connected.');
        $this->training->finalizeAttendance($this->hr, $session);
        $this->training->transitionSession($this->hr, $session->fresh(), 'Completed');
        $this->training->assess($this->hr, $enrollment, ['result' => 'Passed', 'score' => 90, 'maximumScore' => 100, 'checklist' => [], 'notes' => null]);

        $this->expectException(ValidationException::class);
        $this->training->finalizeCompletion($this->hr, $enrollment, 'Passed');
    }

    public function test_learner_state_contains_only_the_authenticated_participants_training(): void
    {
        [$program] = $this->scheduledEnrollment();
        $other = $this->person('other-participant', UserRole::User, 'Staff Professional', 'Finance', 'Employee');
        $state = $this->training->state($other);
        $participantState = $this->training->state($this->participant);

        $this->assertSame([], $state['enrollments']);
        $this->assertSame([], $state['programs']);
        $this->assertCount(1, $participantState['enrollments']);
        $this->assertSame($program->id, $participantState['programs'][0]['id']);
        $this->assertFalse($participantState['integration']['ai']['enabled']);
    }

    public function test_admin_schedules_verified_training_requirements_as_one_session(): void
    {
        $program = $this->training->createProgram($this->admin, $this->payload());
        $this->governProgram($program);
        $this->training->transitionProgram($this->admin, $program, 'activate');
        $recommendation = TrainingRecommendation::query()->create([
            'source_recommendation_id' => 'competency-training-test-1',
            'source_module' => 'Competency',
            'personnel_key' => $this->participant->personnel_key,
            'development_need' => 'Operations Safety Practical',
            'reason' => 'Validated development gap requires supervised practical application.',
            'source_snapshot' => [],
            'status' => 'Pending',
        ]);

        $starts = now()->addDays(2)->setTime(9, 0);
        $this->training->scheduleRequirements($this->admin, [
            'recommendationIds' => [$recommendation->id],
            'programId' => $program->id,
            'startsAt' => $starts,
            'endsAt' => $starts->copy()->addHours(6),
            'venue' => 'Operations Training Ground',
            'capacity' => 12,
            'facilitatorId' => $this->facilitator->id,
            'externalFacilitatorName' => null,
            'enrollmentClosesAt' => null,
        ]);

        $recommendation->refresh();
        $this->assertSame('Accepted', $recommendation->status);
        $this->assertNotNull($recommendation->linked_session_id);
        $this->assertNotNull($recommendation->linked_enrollment_id);
        $this->assertDatabaseHas('training_enrollments', ['id' => $recommendation->linked_enrollment_id, 'participant_id' => $this->participant->id]);
    }

    public function test_cancelled_requirement_driven_session_returns_the_requirement_to_scheduling(): void
    {
        $program = $this->training->createProgram($this->admin, $this->payload());
        $this->governProgram($program);
        $this->training->transitionProgram($this->admin, $program, 'activate');
        $recommendation = TrainingRecommendation::query()->create([
            'source_recommendation_id' => 'competency-training-cancel-1',
            'source_module' => 'Competency',
            'personnel_key' => $this->participant->personnel_key,
            'development_need' => 'Operations Safety Practical',
            'reason' => 'Validated practical development requirement.',
            'source_snapshot' => [],
            'status' => 'Pending',
        ]);
        $starts = now()->addDays(2)->setTime(9, 0);
        $this->training->scheduleRequirements($this->admin, [
            'recommendationIds' => [$recommendation->id],
            'programId' => $program->id,
            'startsAt' => $starts,
            'endsAt' => $starts->copy()->addHours(6),
            'venue' => 'Operations Training Ground',
            'capacity' => 12,
            'facilitatorId' => $this->facilitator->id,
            'externalFacilitatorName' => null,
            'enrollmentClosesAt' => null,
        ]);

        $sessionId = $recommendation->fresh()->linked_session_id;
        $session = \App\Models\Training\TrainingSession::query()->findOrFail($sessionId);
        $this->training->transitionSession($this->admin, $session, 'Cancelled', 'Facilitator became unavailable.');

        $recommendation->refresh();
        $this->assertSame('Pending', $recommendation->status);
        $this->assertSame($program->id, $recommendation->linked_program_id);
        $this->assertNull($recommendation->linked_session_id);
        $this->assertNull($recommendation->linked_enrollment_id);
        $this->assertDatabaseHas('training_session_participants', ['session_id' => $sessionId, 'status' => 'Cancelled']);
    }

    public function test_failed_practical_outcome_creates_retraining_requirement_and_allows_a_new_attempt(): void
    {
        [$program, $session, $enrollment] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();
        $this->training->transitionSession($this->admin, $session, 'Ongoing');
        $this->training->recordAttendance($this->facilitator, $attendance, 'Present', 'Verified at the Training venue.');
        $this->training->finalizeAttendance($this->admin, $session->fresh());
        $this->training->transitionSession($this->admin, $session->fresh(), 'Completed');
        $this->training->assess($this->facilitator, $enrollment, [
            'result' => 'Failed', 'score' => 55, 'maximumScore' => 100,
            'checklist' => [['criterion' => 'Applies the documented safety sequence', 'met' => false]],
            'notes' => 'Requires retraining before reassessment.',
        ]);

        $this->assertSame(1, $this->training->finalizeReadyParticipants($this->admin, $session->fresh()));
        $this->assertDatabaseHas('training_completions', ['enrollment_id' => $enrollment->id, 'status' => 'Failed']);
        $followUp = TrainingRecommendation::query()->where('source_module', 'Training')->firstOrFail();
        $this->assertSame('Pending', $followUp->status);
        $this->assertSame($program->id, $followUp->linked_program_id);
        $this->assertSame('Retraining', $followUp->source_snapshot['reasonType']);

        $starts = now()->addDays(10)->setTime(9, 0);
        $this->training->scheduleRequirements($this->admin, [
            'recommendationIds' => [$followUp->id],
            'programId' => $program->id,
            'startsAt' => $starts,
            'endsAt' => $starts->copy()->addHours(6),
            'venue' => 'Operations Training Ground',
            'capacity' => 12,
            'facilitatorId' => $this->facilitator->id,
            'externalFacilitatorName' => null,
            'enrollmentClosesAt' => null,
        ]);

        $followUp->refresh();
        $this->assertNotSame($enrollment->id, $followUp->linked_enrollment_id);
        $this->assertDatabaseCount('training_enrollments', 2);
    }

    public function test_absent_participant_is_finalized_incomplete_and_returns_as_a_rescheduling_requirement(): void
    {
        [, $session, $enrollment] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();
        $this->training->transitionSession($this->admin, $session, 'Ongoing');
        $this->training->recordAttendance($this->facilitator, $attendance, 'Absent', 'Participant did not attend the scheduled practical session.');
        $this->training->finalizeAttendance($this->admin, $session->fresh());
        $this->training->transitionSession($this->admin, $session->fresh(), 'Completed');

        $this->assertSame(1, $this->training->finalizeReadyParticipants($this->admin, $session->fresh()));
        $this->assertDatabaseHas('training_completions', ['enrollment_id' => $enrollment->id, 'status' => 'Incomplete']);
        $followUp = TrainingRecommendation::query()->where('source_module', 'Training')->firstOrFail();
        $this->assertSame('Pending', $followUp->status);
        $this->assertSame('Reschedule', $followUp->source_snapshot['reasonType']);
    }

    public function test_duplicate_program_enrollment_is_idempotent(): void
    {
        [$program, $session] = $this->scheduledEnrollment();
        $ids = $this->training->enroll($this->hr, $program, [$this->participant->id], [$session->id], 'HR Assignment');

        $this->assertCount(1, $ids);
        $this->assertDatabaseCount('training_enrollments', 1);
        $this->assertDatabaseCount('training_session_participants', 1);
        $this->assertDatabaseCount('training_attendance_records', 1);
    }

    public function test_facilitator_state_exposes_only_assigned_session_drafts(): void
    {
        [$program] = $this->scheduledEnrollment();
        $state = $this->training->state($this->facilitator);

        $this->assertTrue($state['actor']['canFacilitate']);
        $this->assertSame([], $state['enrollments']);
        $this->assertCount(1, $state['facilitation']);
        $this->assertCount(1, $state['facilitation'][0]['sessions']);
        $this->assertSame($program->id, $state['facilitation'][0]['programId']);
        $this->assertFalse($state['actor']['canFinalize']);
    }

    public function test_participant_can_confirm_or_withdraw_only_before_the_session_starts(): void
    {
        [, $session, $enrollment] = $this->scheduledEnrollment();
        $this->training->transitionEnrollment($this->participant, $enrollment, 'Confirmed');
        $this->assertDatabaseHas('training_enrollments', ['id' => $enrollment->id, 'status' => 'Confirmed']);

        $this->training->transitionSession($this->hr, $session, 'Ongoing');
        $this->expectException(ValidationException::class);
        $this->training->transitionEnrollment($this->participant, $enrollment->fresh(), 'Withdrawn', 'Schedule conflict.');
    }

    public function test_quarterly_trainer_evaluation_opens_after_quarter_and_is_final_once(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-08-20 09:00:00', 'Asia/Manila'));

        [, $session] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();

        $this->training->transitionSession($this->hr, $session, 'Ongoing');
        $this->training->recordAttendance($this->facilitator, $attendance, 'Present', 'Verified at the Training venue.');
        $this->training->finalizeAttendance($this->hr, $session->fresh());
        $this->training->transitionSession($this->hr, $session->fresh(), 'Completed');

        $beforeClose = $this->training->state($this->participant);
        $this->assertCount(1, $beforeClose['trainerEvaluationTasks']);
        $this->assertSame('2026-Q3', $beforeClose['trainerEvaluationTasks'][0]['quarterKey']);
        $this->assertSame('Not Open', $beforeClose['trainerEvaluationTasks'][0]['status']);

        try {
            $this->training->submitQuarterlyTrainerEvaluation(
                $this->participant,
                '2026-Q3',
                'user:'.$this->facilitator->id,
                $this->trainerEvaluationPayload(),
            );
            $this->fail('Quarterly trainer evaluation must remain closed until the quarter ends.');
        } catch (ValidationException) {
            $this->assertDatabaseCount('training_trainer_evaluations', 0);
        }

        $this->travelTo(CarbonImmutable::parse('2026-10-01 08:00:00', 'Asia/Manila'));

        $open = $this->training->state($this->participant);
        $this->assertSame('Pending', $open['trainerEvaluationTasks'][0]['status']);

        $this->training->submitQuarterlyTrainerEvaluation(
            $this->participant,
            '2026-Q3',
            'user:'.$this->facilitator->id,
            $this->trainerEvaluationPayload(),
        );

        $this->assertDatabaseHas('training_trainer_evaluations', [
            'participant_id' => $this->participant->id,
            'quarter_key' => '2026-Q3',
            'trainer_key' => 'user:'.$this->facilitator->id,
            'trainer_user_id' => $this->facilitator->id,
            'trainer_name' => $this->facilitator->name,
            'knowledge_rating' => 4,
            'clarity_rating' => 4,
            'communication_rating' => 4,
            'engagement_rating' => 4,
            'professionalism_rating' => 4,
            'practical_relevance_rating' => 4,
            'time_management_rating' => 4,
            'safety_emphasis_rating' => null,
            'facilitator_rating' => 4,
        ]);

        $done = $this->training->state($this->participant);
        $this->assertSame('Done', $done['trainerEvaluationTasks'][0]['status']);
        $this->assertArrayNotHasKey('knowledgeRating', $done['trainerEvaluationTasks'][0]);
        $this->assertArrayNotHasKey('comments', $done['trainerEvaluationTasks'][0]);

        $this->expectException(ValidationException::class);
        $this->training->submitQuarterlyTrainerEvaluation(
            $this->participant,
            '2026-Q3',
            'user:'.$this->facilitator->id,
            $this->trainerEvaluationPayload(),
        );
    }

    public function test_trainee_without_verified_attendance_has_no_quarterly_trainer_evaluation_task(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-08-20 09:00:00', 'Asia/Manila'));

        [, $session] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();

        $this->training->transitionSession($this->hr, $session, 'Ongoing');
        $this->training->recordAttendance($this->hr, $attendance, 'Absent', 'Participant did not attend.');
        $this->training->finalizeAttendance($this->hr, $session->fresh());
        $this->training->transitionSession($this->hr, $session->fresh(), 'Completed');

        $this->travelTo(CarbonImmutable::parse('2026-10-01 08:00:00', 'Asia/Manila'));

        $state = $this->training->state($this->participant);
        $this->assertSame([], $state['trainerEvaluationTasks']);

        $this->expectException(ValidationException::class);
        $this->training->submitQuarterlyTrainerEvaluation(
            $this->participant,
            '2026-Q3',
            'user:'.$this->facilitator->id,
            $this->trainerEvaluationPayload(),
        );
    }

    public function test_admin_or_hr_governance_can_revoke_a_training_certificate(): void
    {
        [, $session, $enrollment] = $this->scheduledEnrollment();
        $attendance = TrainingAttendanceRecord::query()->firstOrFail();
        $this->training->transitionSession($this->hr, $session, 'Ongoing');
        $this->training->recordAttendance($this->hr, $attendance, 'Present', 'Verified by the Training Officer.');
        $this->training->finalizeAttendance($this->hr, $session);
        $this->training->transitionSession($this->hr, $session->fresh(), 'Completed');
        $this->training->assess($this->hr, $enrollment, ['result' => 'Passed', 'score' => 90, 'maximumScore' => 100, 'checklist' => [], 'notes' => null]);
        $certificate = $this->training->finalizeCompletion($this->hr, $enrollment, 'Passed')->certificate;

        $this->training->revokeCertificate($this->admin, $certificate, 'Governance correction.');
        $this->assertDatabaseHas('training_certificates', ['id' => $certificate->id, 'status' => 'Revoked', 'revoked_by' => $this->admin->id]);
    }

    private function scheduledEnrollment(): array
    {
        $program = $this->training->createProgram($this->admin, $this->payload());
        $this->governProgram($program);
        $this->training->transitionProgram($this->admin, $program, 'activate');
        $program->refresh();
        $session = $this->training->saveSession($this->hr, $program, [
            'label' => 'Practical Session 1',
            'startsAt' => now()->addWeek()->setTime(9, 0),
            'endsAt' => now()->addWeek()->setTime(16, 0),
            'venue' => 'Operations Training Ground',
            'capacity' => 20,
            'facilitatorId' => $this->facilitator->id,
            'externalFacilitatorName' => null,
            'enrollmentClosesAt' => now()->addDays(5),
            'status' => 'Scheduled',
        ]);
        $ids = $this->training->enroll($this->hr, $program, [$this->participant->id], [$session->id], 'HR Assignment');

        return [$program, $session, TrainingEnrollment::query()->findOrFail($ids[0])];
    }

    private function payload(): array
    {
        return [
            'code' => '',
            'title' => 'Operations Safety Practical',
            'description' => 'A supervised onsite practical intervention linked to verified development needs.',
            'category' => 'Compliance',
            'deliveryType' => 'Practical',
            'objectives' => ['Apply the documented site safety sequence'],
            'audienceRules' => ['personTypes' => ['Trainee'], 'departments' => ['Operations'], 'positions' => [], 'roleProfileIds' => []],
            'completionRules' => ['attendanceThreshold' => 100, 'assessmentRequired' => true, 'passingScore' => 80, 'issueCertificate' => true, 'certificateValidityMonths' => 12],
            'relatedLearningCourseId' => null,
            'ownerId' => $this->hr->id,
            'competencies' => [],
        ];
    }

    private function person(string $key, UserRole $role, string $position, string $department, string $personType): User
    {
        return User::factory()->create([
            'personnel_key' => $key,
            'core_person_id' => 'CORE-'.strtoupper($key),
            'employee_or_trainee_id' => 'PID-'.strtoupper($key),
            'role' => $role,
            'position' => $position,
            'department' => $department,
            'person_type' => $personType,
            'employment_status' => $personType,
        ]);
    }

    private function trainerEvaluationPayload(): array
    {
        return [
            'knowledge_rating' => 4,
            'clarity_rating' => 4,
            'communication_rating' => 4,
            'engagement_rating' => 4,
            'professionalism_rating' => 4,
            'practical_relevance_rating' => 4,
            'time_management_rating' => 4,
            'safety_emphasis_rating' => null,
            'trainer_strengths' => 'Clear practical examples.',
            'trainer_improvements' => 'Allow a little more time for questions.',
            'content_rating' => 4,
            'relevance_rating' => 5,
            'organization_rating' => 4,
            'overall_satisfaction' => 4,
            'comments' => 'Useful session.',
        ];
    }

    private function governProgram(TrainingProgram $program): void
    {
        DB::table('training_program_competencies')->insertOrIgnore([
            'program_id' => $program->id,
            'competency_id' => 'test-training-competency',
            'competency_version' => 1,
            'competency_code' => 'CMP-TST',
            'competency_name' => 'Test Training Competency',
            'target_level' => 3,
            'purpose' => 'Training workflow test governance basis',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
