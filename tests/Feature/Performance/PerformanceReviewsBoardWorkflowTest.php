<?php

namespace Tests\Feature\Performance;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PerformanceReviewsBoardWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $manager;
    private User $employee;
    private int $reviewId;

    protected function setUp(): void
    {
        parent::setUp();
        config(['performance.review_demo_date' => null]);

        $this->admin = $this->person('board-admin', 'board-admin@example.test', UserRole::Admin, true);
        $this->manager = $this->person('board-manager', 'board-manager@example.test', UserRole::User, true);
        $this->employee = $this->person('board-employee', 'board-employee@example.test', UserRole::User, false);

        $templateId = DB::table('performance_review_templates')->insertGetId([
            'external_key' => 'board-template',
            'name' => 'Board Employee Review',
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
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $cycleId = DB::table('performance_cycles')->insertGetId([
            'external_key' => 'board-cycle',
            'name' => 'Board Workflow Cycle',
            'cycle_type' => 'Custom',
            'performance_start_date' => now()->subMonth()->toDateString(),
            'performance_end_date' => now()->subDays(2)->toDateString(),
            'review_open_date' => now()->subDay()->toDateString(),
            'review_due_date' => now()->addWeek()->toDateString(),
            'applicable_person_types' => json_encode(['Employee'], JSON_THROW_ON_ERROR),
            'department_scopes' => json_encode([], JSON_THROW_ON_ERROR),
            'review_template_keys' => json_encode(['Employee' => 'board-template'], JSON_THROW_ON_ERROR),
            'self_evaluation_enabled' => false,
            'self_rating_enabled' => false,
            'calibration_required' => true,
            'employee_acknowledgment' => 'Required',
            'status' => 'Active',
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $assignmentId = DB::table('performance_review_assignments')->insertGetId([
            'external_key' => 'board-assignment',
            'performance_cycle_id' => $cycleId,
            'subject_user_id' => $this->employee->id,
            'evaluator_user_id' => $this->manager->id,
            'basis' => 'Reporting Relationship',
            'active' => true,
            'assigned_by_id' => $this->admin->id,
            'assigned_at' => now(),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->reviewId = DB::table('performance_reviews')->insertGetId([
            'external_key' => 'board-review',
            'performance_review_assignment_id' => $assignmentId,
            'performance_review_template_id' => $templateId,
            'status' => 'Pending',
            'workflow_state' => 'Manager Review',
            'calibration_status' => 'Pending',
            'due_date' => now()->addWeek()->toDateString(),
            'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_register_rejects_start_before_open_and_after_due(): void
    {
        foreach (['before', 'after'] as $boundary) {
            DB::table('performance_cycles')->where('external_key', 'board-cycle')->update([
                'review_open_date' => $boundary === 'before' ? now()->addDay()->toDateString() : now()->subWeek()->toDateString(),
                'review_due_date' => $boundary === 'before' ? now()->addWeek()->toDateString() : now()->subDay()->toDateString(),
            ]);
            $this->actingAs($this->manager)->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Manager Review'])->assertUnprocessable();
            $this->assertDatabaseHas('performance_reviews', ['id' => $this->reviewId, 'status' => 'Pending']);
        }
    }

    public function test_scheduled_provisioning_is_idempotent_and_preserves_evaluator_assignment(): void
    {
        $person = collect(app(\App\Support\CanonicalWorkforceReference::class)->allPeople())->first();
        $this->employee->update(['personnel_key' => $person['personnel_key']]);
        $assignment = DB::table('performance_review_assignments')->where('external_key', 'board-assignment')->first();
        DB::table('performance_reviews')->where('id', $this->reviewId)->delete();
        $service = app(\App\Services\Performance\PerformanceService::class);
        $service->provisionScheduledReviews();
        $service->provisionScheduledReviews();
        $this->assertSame(1, DB::table('performance_reviews')->where('performance_review_assignment_id', $assignment->id)->count());
        $this->assertDatabaseHas('performance_review_assignments', ['id' => $assignment->id, 'evaluator_user_id' => $this->manager->id]);
    }

    public function test_board_transition_requires_real_manager_content_and_preserves_authority(): void
    {
        $this->actingAs($this->manager)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Manager Review'])
            ->assertOk()
            ->assertJsonPath('data.reviews.0.status', 'In Progress')
            ->assertJsonPath('data.reviews.0.workflowState', 'Manager Review');

        $this->actingAs($this->manager)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Submitted'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviews');

        DB::table('performance_reviews')->where('id', $this->reviewId)->update([
            'criteria_scores' => json_encode([
                ['name' => 'Results', 'score' => 4.5],
                ['name' => 'Collaboration', 'score' => 4.0],
            ], JSON_THROW_ON_ERROR),
            'comments' => 'Board submission has complete governed scoring evidence.',
            'development_recommendations' => json_encode([], JSON_THROW_ON_ERROR),
        ]);

        $this->actingAs($this->manager)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Submitted'])
            ->assertOk()
            ->assertJsonPath('data.reviews.0.workflowState', 'Calibration Pending')
            ->assertJsonPath('data.reviews.0.rating', 4.25);

        $this->actingAs($this->employee)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Calibration Review'])
            ->assertForbidden();

        $this->actingAs($this->admin)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Calibration Review'])
            ->assertOk()
            ->assertJsonPath('data.reviews.0.workflowState', 'Calibration In Review');

        $this->actingAs($this->admin)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Finalized'])
            ->assertOk()
            ->assertJsonPath('data.reviews.0.status', 'Completed')
            ->assertJsonPath('data.reviews.0.workflowState', 'Finalized')
            ->assertJsonPath('data.reviews.0.calibrationStatus', 'Approved')
            ->assertJsonPath('data.reviews.0.rating', 4.25);

        $this->actingAs($this->manager)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Manager Review'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviews');

        $this->assertDatabaseHas('performance_review_events', [
            'performance_review_id' => $this->reviewId,
            'event_type' => 'Manager Review Started',
            'actor_user_id' => $this->manager->id,
        ]);
        $this->assertDatabaseHas('performance_review_events', [
            'performance_review_id' => $this->reviewId,
            'event_type' => 'Calibration Review Started',
            'actor_user_id' => $this->admin->id,
        ]);
        $this->assertDatabaseHas('performance_review_events', [
            'performance_review_id' => $this->reviewId,
            'event_type' => 'Calibration Approved',
            'actor_user_id' => $this->admin->id,
        ]);
    }

    public function test_board_cannot_skip_required_calibration(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/performance/api/reviews/board-review/transition', ['target' => 'Finalized'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviews');

        $this->assertDatabaseHas('performance_reviews', [
            'external_key' => 'board-review',
            'status' => 'Pending',
            'workflow_state' => 'Manager Review',
        ]);
    }

    private function person(string $key, string $email, UserRole $role, bool $evaluatorCapable): User
    {
        return User::factory()->create([
            'name' => ucwords(str_replace('-', ' ', $key)),
            'email' => $email,
            'role' => $role->value,
            'personnel_key' => $key,
            'core_person_id' => "core-{$key}",
            'employee_or_trainee_id' => strtoupper($key),
            'position' => $evaluatorCapable ? 'Manager' : 'Specialist',
            'department' => 'Operations',
            'person_type' => 'Employee',
            'employment_status' => 'Employee',
            'evaluator_capable' => $evaluatorCapable,
        ]);
    }
}
