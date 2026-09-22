<?php

namespace Tests\Feature\Succession;

use App\Enums\UserRole;
use App\Models\Succession\ReadinessAssessment;
use App\Models\User;
use App\Services\Succession\SuccessionService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SuccessionWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $hr;
    private User $employee;
    private User $candidate;
    private SuccessionService $succession;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->person('admin-succession', UserRole::Admin, 'System Administrator', 'Administration');
        $this->hr = $this->person('hr-succession', UserRole::HR, 'HR Manager', 'Human Resources');
        $this->employee = $this->person('incumbent', UserRole::User, 'Operations Manager', 'Operations');
        $this->candidate = $this->person('candidate', UserRole::User, 'Operations Supervisor', 'Operations');
        $this->succession = app(SuccessionService::class);
    }

    public function test_only_admin_and_hr_may_access_succession_records(): void
    {
        $this->expectException(AuthorizationException::class);
        $this->succession->state($this->candidate);
    }

    public function test_critical_position_requires_a_success_profile_before_activation(): void
    {
        $position = $this->succession->savePosition($this->admin, $this->positionPayload());
        $this->assertDatabaseHas('succession_critical_positions', ['id' => $position->id, 'status' => 'Draft']);
        $this->succession->transitionPosition($this->hr, $position, 'Active');
        $this->assertSame('Active', $position->fresh()->status);
        $this->assertDatabaseHas('succession_audit_events', ['event_type' => 'CriticalPositionStatusChanged', 'actor_id' => $this->hr->id]);
    }

    public function test_candidate_cannot_be_accepted_without_a_finalized_assessment(): void
    {
        [$position, $nomination] = $this->nomination();
        $this->succession->transitionCandidate($this->admin, $nomination, 'Under Review');
        $this->expectException(ValidationException::class);
        $this->succession->transitionCandidate($this->admin, $nomination->fresh(), 'Accepted', 'Succession review approved.');
    }

    public function test_admin_and_hr_can_both_finalize_without_automatic_promotion(): void
    {
        [, $nomination] = $this->nomination();
        $this->succession->transitionCandidate($this->hr, $nomination, 'Under Review');
        $assessment = $this->succession->createAssessment($this->admin, $nomination->fresh(), $this->assessmentPayload());
        $this->succession->finalizeAssessment($this->hr, $assessment);
        $this->succession->transitionCandidate($this->admin, $nomination->fresh(), 'Accepted', 'Finalized evidence supports pipeline inclusion.');

        $this->assertDatabaseHas('succession_readiness_assessments', ['id' => $assessment->id, 'status' => 'Finalized', 'finalized_by' => $this->hr->id]);
        $this->assertDatabaseHas('succession_candidates', ['id' => $nomination->id, 'status' => 'Accepted', 'decided_by' => $this->admin->id]);
        $this->assertSame('user', $this->candidate->fresh()->role->value);
        $this->assertSame('Operations Supervisor', $this->candidate->fresh()->position);
    }

    public function test_finalized_snapshot_is_immutable_and_reopen_creates_a_version(): void
    {
        [, $nomination] = $this->nomination();
        $assessment = $this->succession->createAssessment($this->hr, $nomination, $this->assessmentPayload());
        $this->succession->finalizeAssessment($this->admin, $assessment);
        try {
            $this->succession->updateAssessment($this->hr, $assessment->fresh(), $this->assessmentPayload());
            $this->fail('A finalized readiness snapshot must be immutable.');
        } catch (ValidationException) {
            $replacement = $this->succession->reopenAssessment($this->hr, $assessment->fresh(), 'New finalized source evidence became available.');
            $this->assertSame(2, $replacement->version);
            $this->assertSame($assessment->id, $replacement->supersedes_id);
            $this->assertSame('Draft', $replacement->status);
        }
    }

    public function test_certificate_evidence_remains_owned_by_learning_and_training(): void
    {
        [, $nomination] = $this->nomination();
        $assessment = $this->succession->createAssessment($this->admin, $nomination, $this->assessmentPayload());
        $this->assertSame('Learning', $assessment->learning_snapshot['certificateOwner']);
        $this->assertSame('Training', $assessment->training_snapshot['certificateOwner']);
        $this->assertDatabaseMissing('succession_audit_events', ['event_type' => 'CertificateIssued']);
    }

    private function nomination(): array
    {
        $position = $this->succession->savePosition($this->admin, $this->positionPayload());
        $this->succession->transitionPosition($this->hr, $position, 'Active');
        return [$position, $this->succession->nominate($this->hr, $position->fresh(), $this->candidate->id, 'HR Nomination', 'Candidate has verified role exposure and will undergo governed readiness review.')];
    }

    private function positionPayload(): array
    {
        return [
            'positionTitle' => 'Operations Manager', 'department' => 'Operations', 'criticality' => 'Critical',
            'incumbentId' => $this->employee->id, 'businessImpact' => 'Coordinates operational delivery and safety-sensitive decisions.',
            'vacancyRisk' => 'Single-incumbent dependency.', 'reviewCycleMonths' => 6, 'nextReviewAt' => now()->addMonths(6),
            'requirements' => [['type' => 'Competency', 'label' => 'Operational Leadership', 'targetLevel' => 4, 'required' => true, 'sourceKey' => 'COMP-LEAD', 'sourceVersion' => '1']],
        ];
    }

    private function assessmentPayload(): array
    {
        return ['readinessBand' => 'Ready Soon', 'reviewerSummary' => 'Finalized sources show strong operational readiness with a defined leadership gap.', 'developmentNeeds' => ['Complete the approved leadership intervention'], 'riskFlags' => ['Limited exposure to multi-project planning']];
    }

    private function person(string $key, UserRole $role, string $position, string $department): User
    {
        return User::factory()->create(['personnel_key' => $key, 'core_person_id' => 'CORE-'.strtoupper($key), 'employee_or_trainee_id' => 'PID-'.strtoupper($key), 'role' => $role, 'position' => $position, 'department' => $department, 'person_type' => 'Employee', 'employment_status' => 'Employee']);
    }
}
