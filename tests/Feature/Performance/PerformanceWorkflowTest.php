<?php

namespace Tests\Feature\Performance;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PerformanceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $manager;

    private User $employee;

    private int $cycleId;

    private int $templateId;

    private int $assignmentId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->makePerson('admin-1', 'admin@example.test', UserRole::Admin, true);
        $this->manager = $this->makePerson('manager-1', 'manager@example.test', UserRole::User, true);
        $this->employee = $this->makePerson('employee-1', 'employee@example.test', UserRole::User, false);

        $now = now();
        $this->templateId = DB::table('performance_review_templates')->insertGetId([
            'external_key' => 'template-employee',
            'name' => 'Employee Review',
            'person_type' => 'Employee',
            'rating_scale_key' => 'five-point',
            'rating_scale' => json_encode([
                ['value' => 1, 'label' => 'Needs Improvement'],
                ['value' => 5, 'label' => 'Exceptional'],
            ], JSON_THROW_ON_ERROR),
            'criteria' => json_encode([
                ['name' => 'Results', 'weight' => 50],
                ['name' => 'Collaboration', 'weight' => 50],
            ], JSON_THROW_ON_ERROR),
            'active' => true,
            'lock_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->cycleId = DB::table('performance_cycles')->insertGetId([
            'external_key' => 'cycle-active',
            'name' => 'Active Test Cycle',
            'cycle_type' => 'Quarterly',
            'performance_start_date' => now()->subMonth()->toDateString(),
            'performance_end_date' => now()->addMonth()->toDateString(),
            'review_open_date' => now()->subDay()->toDateString(),
            'review_due_date' => now()->addWeek()->toDateString(),
            'applicable_person_types' => json_encode(['Employee'], JSON_THROW_ON_ERROR),
            'department_scopes' => json_encode([], JSON_THROW_ON_ERROR),
            'review_template_keys' => json_encode(['Employee' => 'template-employee'], JSON_THROW_ON_ERROR),
            'self_evaluation_enabled' => true,
            'self_rating_enabled' => true,
            'calibration_required' => false,
            'employee_acknowledgment' => 'Required',
            'status' => 'Active',
            'lock_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('performance_reporting_relationships')->insert([
            'external_key' => 'relationship-manager-employee',
            'supervisor_id' => $this->manager->id,
            'direct_report_id' => $this->employee->id,
            'source' => 'Core HR',
            'active' => true,
            'effective_from' => now()->subYear()->toDateString(),
            'created_by_id' => $this->admin->id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->assignmentId = DB::table('performance_review_assignments')->insertGetId([
            'external_key' => 'assignment-active-employee',
            'performance_cycle_id' => $this->cycleId,
            'subject_user_id' => $this->employee->id,
            'evaluator_user_id' => $this->manager->id,
            'basis' => 'Reporting Relationship',
            'active' => true,
            'assigned_by_id' => $this->admin->id,
            'assigned_at' => $now,
            'lock_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('performance_reviews')->insert([
            'external_key' => 'review-active-employee',
            'performance_review_assignment_id' => $this->assignmentId,
            'performance_review_template_id' => $this->templateId,
            'status' => 'Pending',
            'workflow_state' => 'Manager Review',
            'calibration_status' => 'Not Required',
            'due_date' => now()->addWeek()->toDateString(),
            'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function test_admin_monitoring_access_does_not_grant_evaluator_authority(): void
    {
        $response = $this->actingAs($this->admin)->putJson('/performance/api/reviews', [
            'reviews' => [$this->completedReviewPayload()],
        ]);

        $response->assertForbidden();
        $this->assertDatabaseHas('performance_reviews', [
            'external_key' => 'review-active-employee',
            'status' => 'Pending',
            'final_rating' => null,
        ]);
    }

    public function test_hr_operational_access_does_not_grant_admin_configuration_authority(): void
    {
        $hr = $this->makePerson('hr-1', 'hr@example.test', UserRole::HR, false);

        $response = $this->actingAs($hr)->putJson('/performance/api/configuration', [
            'cycles' => [],
            'reviewTemplates' => [],
            'goalTemplates' => [],
            'goals' => [],
            'assignments' => [],
        ]);

        $response->assertForbidden();
    }

    public function test_assigned_evaluator_can_submit_and_server_recalculates_rating(): void
    {
        $payload = $this->completedReviewPayload();
        $payload['rating'] = 1;

        $response = $this->actingAs($this->manager)->putJson('/performance/api/reviews', [
            'reviews' => [$payload],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.reviews.0.status', 'Completed')
            ->assertJsonPath('data.reviews.0.workflowState', 'Finalized')
            ->assertJsonPath('data.reviews.0.rating', 4.25);

        $this->assertDatabaseHas('performance_reviews', [
            'external_key' => 'review-active-employee',
            'status' => 'Completed',
            'final_rating' => 4.25,
            'lock_version' => 2,
        ]);
        $this->assertDatabaseHas('performance_review_events', [
            'performance_review_id' => DB::table('performance_reviews')
                ->where('external_key', 'review-active-employee')
                ->value('id'),
            'event_type' => 'Manager Submitted',
            'actor_user_id' => $this->manager->id,
        ]);
    }

    public function test_stale_review_version_is_rejected(): void
    {
        DB::table('performance_reviews')
            ->where('external_key', 'review-active-employee')
            ->update(['lock_version' => 2]);

        $response = $this->actingAs($this->manager)->putJson('/performance/api/reviews', [
            'reviews' => [$this->completedReviewPayload()],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviews');
    }

    public function test_only_subject_can_acknowledge_a_finalized_review(): void
    {
        $this->actingAs($this->manager)->putJson('/performance/api/reviews', [
            'reviews' => [$this->completedReviewPayload()],
        ])->assertOk();

        $payload = $this->completedReviewPayload();
        $payload['lockVersion'] = 2;
        $payload['acknowledgment'] = [
            'status' => 'Acknowledged',
            'actorId' => 'forged-id',
            'timestamp' => now()->subYear()->toIso8601String(),
            'statement' => 'Forged statement',
        ];

        $response = $this->actingAs($this->employee)->putJson('/performance/api/reviews', [
            'reviews' => [$payload],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.reviews.0.acknowledgment.actorId', 'employee-1')
            ->assertJsonPath('data.reviews.0.acknowledgment.statement', 'Received / Viewed');

        $this->assertDatabaseHas('performance_review_events', [
            'event_type' => 'Acknowledged',
            'actor_user_id' => $this->employee->id,
        ]);
    }

    public function test_database_enforces_one_primary_evaluator_per_person_and_cycle(): void
    {
        $otherManager = $this->makePerson('manager-2', 'manager2@example.test', UserRole::User, true);

        $this->expectException(QueryException::class);

        DB::table('performance_review_assignments')->insert([
            'external_key' => 'duplicate-assignment',
            'performance_cycle_id' => $this->cycleId,
            'subject_user_id' => $this->employee->id,
            'evaluator_user_id' => $otherManager->id,
            'basis' => 'Exception',
            'active' => true,
            'assigned_by_id' => $this->admin->id,
            'assigned_at' => now(),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_anonymous_summary_uses_threshold_and_never_returns_evaluator_ids(): void
    {
        config([
            'services.groq.performance_anonymous_feedback' => true,
            'services.groq.anonymous_feedback_minimum' => 3,
        ]);

        $directReports = [$this->employee];
        for ($index = 2; $index <= 3; $index++) {
            $report = $this->makePerson("employee-{$index}", "employee{$index}@example.test", UserRole::User, false);
            $directReports[] = $report;
            DB::table('performance_reporting_relationships')->insert([
                'external_key' => "relationship-manager-employee-{$index}",
                'supervisor_id' => $this->manager->id,
                'direct_report_id' => $report->id,
                'source' => 'Core HR',
                'active' => true,
                'effective_from' => now()->subYear()->toDateString(),
                'created_by_id' => $this->admin->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($directReports as $index => $report) {
            $this->actingAs($report)->postJson('/performance/api/anonymous-feedback', [
                'subjectId' => 'manager-1',
                'cycleId' => 'cycle-active',
                'feedback' => "Constructive upward feedback response number {$index}.",
            ])->assertCreated();
        }

        $response = $this->actingAs($this->manager)
            ->getJson('/performance/api/anonymous-feedback/manager-1/cycle-active');

        $response
            ->assertOk()
            ->assertJsonPath('data.responseCount', 3)
            ->assertJsonCount(3, 'data.feedback')
            ->assertJsonMissingPath('data.feedback.0.evaluatorId')
            ->assertJsonMissingPath('data.feedback.0.evaluatorUserId');
    }

    private function makePerson(string $personnelKey, string $email, UserRole $role, bool $evaluatorCapable): User
    {
        return User::factory()->create([
            'name' => ucfirst(str_replace('-', ' ', $personnelKey)),
            'email' => $email,
            'role' => $role->value,
            'personnel_key' => $personnelKey,
            'core_person_id' => "core-{$personnelKey}",
            'employee_or_trainee_id' => strtoupper($personnelKey),
            'position' => $evaluatorCapable ? 'Manager' : 'Specialist',
            'department' => 'Operations',
            'person_type' => 'Employee',
            'employment_status' => 'Employee',
            'evaluator_capable' => $evaluatorCapable,
        ]);
    }

    private function completedReviewPayload(): array
    {
        return [
            'id' => 'review-active-employee',
            'personId' => 'employee-1',
            'evaluatorId' => 'manager-1',
            'periodId' => 'cycle-active',
            'reviewTemplateId' => 'template-employee',
            'status' => 'Completed',
            'workflowState' => 'Finalized',
            'calibrationStatus' => 'Not Required',
            'competencyScores' => [
                ['name' => 'Results', 'score' => 4.5],
                ['name' => 'Collaboration', 'score' => 4],
            ],
            'comments' => 'Consistent delivery and strong collaboration.',
            'developmentRecommendations' => ['Continue leading cross-team delivery.'],
            'linkedEvidence' => [],
            'managerSubmittedAt' => now()->toIso8601String(),
            'lockVersion' => 1,
        ];
    }
}