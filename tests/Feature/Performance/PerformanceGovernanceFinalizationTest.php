<?php

namespace Tests\Feature\Performance;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PerformanceGovernanceFinalizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $manager;
    private User $otherManager;
    private User $employee;
    private User $trainee;
    private int $cycleId;
    private int $reviewId;
    private int $assignmentId;

    protected function setUp(): void
    {
        parent::setUp();
        config(['performance.review_demo_date' => null]);

        $this->admin = $this->person('gov-admin', UserRole::Admin, true, 'Employee');
        $this->manager = $this->person('gov-manager', UserRole::User, true, 'Employee');
        $this->otherManager = $this->person('gov-manager-2', UserRole::User, true, 'Employee');
        $this->employee = $this->person('gov-employee', UserRole::User, false, 'Employee');
        $this->trainee = $this->person('gov-trainee', UserRole::User, false, 'Trainee');

        $templateId = DB::table('performance_review_templates')->insertGetId([
            'external_key' => 'gov-template',
            'name' => 'Governed Review',
            'person_type' => 'Employee',
            'rating_scale_key' => 'five-point',
            'rating_scale' => json_encode([['value' => 1], ['value' => 5]], JSON_THROW_ON_ERROR),
            'criteria' => json_encode([
                ['name' => 'Results', 'weight' => 50],
                ['name' => 'Quality', 'weight' => 50],
            ], JSON_THROW_ON_ERROR),
            'active' => true,
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->cycleId = DB::table('performance_cycles')->insertGetId([
            'external_key' => 'gov-cycle',
            'name' => 'Governance Cycle',
            'cycle_type' => 'Quarterly',
            'performance_start_date' => now()->subMonth()->toDateString(),
            'performance_end_date' => now()->subDays(2)->toDateString(),
            'review_open_date' => now()->subDay()->toDateString(),
            'review_due_date' => now()->addWeek()->toDateString(),
            'applicable_person_types' => json_encode(['Employee'], JSON_THROW_ON_ERROR),
            'department_scopes' => json_encode([], JSON_THROW_ON_ERROR),
            'review_template_keys' => json_encode(['Employee' => 'gov-template'], JSON_THROW_ON_ERROR),
            'self_evaluation_enabled' => false,
            'self_rating_enabled' => false,
            'calibration_required' => true,
            'employee_acknowledgment' => 'Required',
            'status' => 'Active',
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([[$this->employee, 'employee'], [$this->trainee, 'trainee']] as [$person, $suffix]) {
            DB::table('performance_reporting_relationships')->insert([
                'external_key' => "gov-relationship-{$suffix}",
                'supervisor_id' => $this->manager->id,
                'direct_report_id' => $person->id,
                'source' => 'Core HR',
                'active' => true,
                'effective_from' => now()->subYear()->toDateString(),
                'created_by_id' => $this->admin->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->assignmentId = DB::table('performance_review_assignments')->insertGetId([
            'external_key' => 'gov-assignment',
            'performance_cycle_id' => $this->cycleId,
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
            'external_key' => 'gov-review',
            'performance_review_assignment_id' => $this->assignmentId,
            'performance_review_template_id' => $templateId,
            'status' => 'In Progress',
            'workflow_state' => 'Manager Review',
            'calibration_status' => 'Pending',
            'criteria_scores' => json_encode([
                ['name' => 'Results', 'score' => 4],
                ['name' => 'Quality', 'score' => 4],
            ], JSON_THROW_ON_ERROR),
            'due_date' => now()->addWeek()->toDateString(),
            'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('performance_goals')->insert([
            'external_key' => 'gov-goal',
            'user_id' => $this->employee->id,
            'performance_cycle_id' => $this->cycleId,
            'title' => 'Governed delivery goal',
            'metric_type' => 'Goal',
            'target' => 'Complete agreed delivery',
            'weight' => 100,
            'progress' => 20,
            'status' => 'Not Started',
            'start_date' => now()->subMonth()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
            'individual_override' => false,
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_routine_reassignment_endpoints_are_not_exposed_and_generic_review_sync_rejects_evaluator_changes(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/performance/api/reviews/gov-review/reassign', [
                'evaluatorId' => 'gov-manager-2',
                'reason' => 'Attempted routine reassignment.',
            ])
            ->assertNotFound();

        $this->actingAs($this->admin)
            ->putJson('/performance/api/evaluator-assignments', [
                'personId' => 'gov-employee',
                'cycleId' => 'gov-cycle',
                'evaluatorId' => 'gov-manager-2',
                'scope' => 'Formal Review Only',
                'reason' => 'Attempted routine reassignment.',
            ])
            ->assertNotFound();

        $review = collect($this->actingAs($this->admin)->getJson('/performance/api/state')->json('data.reviews'))
            ->firstWhere('id', 'gov-review');
        $this->assertNotNull($review);
        $review['evaluatorId'] = 'gov-manager-2';

        $this->actingAs($this->admin)
            ->putJson('/performance/api/reviews', ['reviews' => [$review]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviews');

        $this->assertDatabaseHas('performance_review_assignments', [
            'id' => $this->assignmentId,
            'evaluator_user_id' => $this->manager->id,
        ]);
    }

    public function test_reporting_relationship_is_the_automatic_default_for_new_cycle_assignment(): void
    {
        $employeeWithoutCycleAssignment = $this->person('gov-employee-2', UserRole::User, false, 'Employee');
        DB::table('performance_reporting_relationships')->insert([
            'external_key' => 'gov-relationship-employee-2',
            'supervisor_id' => $this->manager->id,
            'direct_report_id' => $employeeWithoutCycleAssignment->id,
            'source' => 'Core HR',
            'active' => true,
            'effective_from' => now()->subYear()->toDateString(),
            'created_by_id' => $this->admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->admin)->getJson('/performance/api/state')->assertOk();

        $this->assertDatabaseHas('performance_review_assignments', [
            'performance_cycle_id' => $this->cycleId,
            'subject_user_id' => $employeeWithoutCycleAssignment->id,
            'evaluator_user_id' => $this->manager->id,
            'goal_evaluator_user_id' => $this->manager->id,
            'basis' => 'Reporting Relationship',
        ]);
    }

    public function test_top_of_scope_manager_is_routed_to_360_instead_of_an_unrelated_manager(): void
    {
        $this->actingAs($this->admin)->getJson('/performance/api/state')->assertOk();

        $this->assertDatabaseHas('performance_review_assignments', [
            'performance_cycle_id' => $this->cycleId,
            'subject_user_id' => $this->manager->id,
            'evaluator_user_id' => null,
            'goal_evaluator_user_id' => null,
            'basis' => '360 Leadership Review',
        ]);
    }

    public function test_calibration_actions_surface_in_header_notifications_instead_of_a_duplicate_reviews_queue(): void
    {
        DB::table('performance_reviews')->where('id', $this->reviewId)->update([
            'workflow_state' => 'Calibration Pending',
            'calibration_status' => 'Pending',
            'manager_submitted_at' => now(),
            'final_rating' => 4.25,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/header-notifications')
            ->assertOk();

        $notification = collect($response->json('data'))
            ->firstWhere('id', 'performance-calibration-action');

        $this->assertNotNull($notification);
        $this->assertSame('Performance reviews require action', $notification['title']);
        $this->assertSame('1 action required', $notification['meta']);
        $this->assertSame(1, $notification['count']);
        $this->assertStringContainsString('/admin/performance#Reviews', $notification['href']);
        $this->assertStringContainsString('1 awaiting calibration', $notification['description']);
    }

public function test_header_notification_read_state_tracks_the_live_notification_fingerprint(): void
{
    DB::table('performance_reviews')->where('id', $this->reviewId)->update([
        'workflow_state' => 'Calibration Pending',
        'calibration_status' => 'Pending',
        'manager_submitted_at' => now(),
        'final_rating' => 4.25,
    ]);

    $first = $this->actingAs($this->admin)
        ->getJson('/api/header-notifications')
        ->assertOk();

    $notification = collect($first->json('data'))
        ->firstWhere('id', 'performance-calibration-action');

    $this->assertNotNull($notification);
    $this->assertFalse($notification['isRead']);
    $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $notification['fingerprint']);
    $this->assertGreaterThanOrEqual(1, $first->json('unreadCount'));

    $this->postJson('/api/header-notifications/read', [
        'notifications' => [[
            'id' => $notification['id'],
            'fingerprint' => $notification['fingerprint'],
        ]],
    ])->assertOk()->assertJson(['markedRead' => 1]);

    $second = $this->getJson('/api/header-notifications')->assertOk();
    $sameNotification = collect($second->json('data'))
        ->firstWhere('id', 'performance-calibration-action');

    $this->assertTrue($sameNotification['isRead']);
    $this->assertSame($notification['fingerprint'], $sameNotification['fingerprint']);

    DB::table('performance_reviews')->where('id', $this->reviewId)->update([
        'workflow_state' => 'Calibration In Review',
        'calibration_status' => 'In Review',
    ]);

    $third = $this->getJson('/api/header-notifications')->assertOk();
    $changedNotification = collect($third->json('data'))
        ->firstWhere('id', 'performance-calibration-action');

    $this->assertFalse($changedNotification['isRead']);
    $this->assertNotSame($notification['fingerprint'], $changedNotification['fingerprint']);
}

    public function test_header_notifications_respect_saved_performance_notification_preference(): void
    {
        $this->admin->forceFill([
            'notification_preferences' => [
                'performance_actions' => false,
            ],
        ])->save();

        DB::table('performance_reviews')->where('id', $this->reviewId)->update([
            'workflow_state' => 'Calibration Pending',
            'calibration_status' => 'Pending',
            'manager_submitted_at' => now(),
            'final_rating' => 4.25,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/header-notifications')
            ->assertOk();

        $this->assertNull(
            collect($response->json('data'))->firstWhere('id', 'performance-calibration-action')
        );
    }

    public function test_calibration_return_is_audited_and_creates_revision_snapshot(): void
    {
        DB::table('performance_reviews')->where('id', $this->reviewId)->update([
            'workflow_state' => 'Calibration In Review',
            'calibration_status' => 'In Review',
            'manager_submitted_at' => now(),
            'final_rating' => 4,
        ]);

        $this->actingAs($this->admin)
            ->patchJson('/performance/api/reviews/gov-review/calibration', [
                'target' => 'Returned for Revision',
                'notes' => 'Clarify the evidence before approval.',
            ])
            ->assertOk()
            ->assertJsonPath('data.reviews.0.workflowState', 'Revision In Progress')
            ->assertJsonPath('data.reviews.0.calibrationStatus', 'Returned for Revision')
            ->assertJsonPath('data.reviews.0.revisionHistory.0.action', 'Revision Requested');

        $this->assertDatabaseHas('performance_review_events', [
            'performance_review_id' => $this->reviewId,
            'event_type' => 'Calibration Returned for Revision',
            'actor_user_id' => $this->admin->id,
        ]);
        $this->assertDatabaseHas('performance_review_events', [
            'performance_review_id' => $this->reviewId,
            'event_type' => 'Revision Requested',
            'actor_user_id' => $this->admin->id,
        ]);
    }

    public function test_goal_progress_is_manager_owned_audited_and_locked_after_submission(): void
    {
        $this->actingAs($this->manager)
            ->patchJson('/performance/api/goals/gov-goal/progress', [
                'progress' => 65,
                'status' => 'On Track',
                'reason' => 'Verified from the documented delivery update and manager observation.',
                'reference' => 'GOV-WORK-001',
            ])
            ->assertOk()
            ->assertJsonPath('data.goals.0.progress', 65)
            ->assertJsonPath('data.goals.0.status', 'On Track');

        $this->assertDatabaseHas('performance_review_events', [
            'performance_review_id' => $this->reviewId,
            'event_type' => 'Evaluator Goal Progress Verification',
            'actor_user_id' => $this->manager->id,
        ]);

        $configuration = $this->actingAs($this->admin)->getJson('/performance/api/state')->json('data');
        $configuration['goals'][0]['progress'] = 99;
        $configuration['goals'][0]['status'] = 'Completed';
        $this->actingAs($this->admin)->putJson('/performance/api/configuration', [
            'reviewTemplates' => $configuration['reviewTemplates'],
            'goalTemplates' => $configuration['goalTemplates'],
            'goals' => $configuration['goals'],
            'assignments' => $configuration['assignments'],
        ])->assertOk()
            ->assertJsonPath('data.goals.0.progress', 65)
            ->assertJsonPath('data.goals.0.status', 'On Track');

        $this->actingAs($this->employee)
            ->patchJson('/performance/api/goals/gov-goal/progress', ['progress' => 70])
            ->assertForbidden();

        DB::table('performance_reviews')->where('id', $this->reviewId)->update([
            'manager_submitted_at' => now(),
            'workflow_state' => 'Calibration Pending',
        ]);

        $this->actingAs($this->manager)
            ->patchJson('/performance/api/goals/gov-goal/progress', [
                'progress' => 75,
                'reason' => 'Attempted verified update after formal manager submission.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('goals');
    }

    public function test_manager_follow_through_cannot_rewrite_pip_governance_and_unchanged_visible_feedback_does_not_block_save(): void
    {
        DB::table('performance_reviews')->where('id', $this->reviewId)->update([
            'status' => 'Completed',
            'workflow_state' => 'Finalized',
            'calibration_status' => 'Approved',
            'finalized_at' => now(),
        ]);

        DB::table('performance_feedback_records')->insert([
            'external_key' => 'gov-feedback',
            'subject_user_id' => $this->employee->id,
            'author_user_id' => $this->admin->id,
            'performance_cycle_id' => $this->cycleId,
            'performance_review_id' => $this->reviewId,
            'record_type' => 'Feedback Note',
            'note' => 'Governance-owned visible feedback.',
            'linked_goal_keys' => json_encode([], JSON_THROW_ON_ERROR),
            'visibility' => 'Manager & HR',
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('performance_improvement_plans')->insert([
            'external_key' => 'gov-pip',
            'subject_user_id' => $this->employee->id,
            'performance_review_id' => $this->reviewId,
            'assigned_manager_id' => $this->manager->id,
            'created_by_id' => $this->admin->id,
            'performance_concern' => 'Original governed concern',
            'expected_improvement' => 'Original governed expectation',
            'action_items' => json_encode(['Weekly check-in'], JSON_THROW_ON_ERROR),
            'start_date' => now()->toDateString(),
            'target_end_date' => now()->addMonth()->toDateString(),
            'status' => 'Active',
            'milestones' => json_encode([], JSON_THROW_ON_ERROR),
            'progress_notes' => json_encode([], JSON_THROW_ON_ERROR),
            'development_actions' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $development = $this->actingAs($this->manager)
            ->getJson('/performance/api/state')
            ->json('data.development');
        $pipIndex = array_search('gov-pip', array_column($development['pips'], 'id'), true);
        $this->assertNotFalse($pipIndex, 'Governed PIP was not returned in the manager development state.');

        $development['pips'][$pipIndex]['performanceConcern'] = 'Attempted manager rewrite';
        $development['pips'][$pipIndex]['status'] = 'On Track';
        $development['pips'][$pipIndex]['progressNotes'][] = [
            'id' => 'manager-note-1',
            'authorId' => 'gov-manager',
            'note' => 'Follow-up completed with the employee.',
            'createdAt' => now()->toIso8601String(),
        ];

        $this->actingAs($this->manager)
            ->putJson('/performance/api/development', ['development' => $development])
            ->assertOk();

        $this->assertDatabaseHas('performance_improvement_plans', [
            'external_key' => 'gov-pip',
            'performance_concern' => 'Original governed concern',
            'status' => 'On Track',
        ]);
        $notes = json_decode(DB::table('performance_improvement_plans')->where('external_key', 'gov-pip')->value('progress_notes'), true);
        $this->assertSame('gov-manager', $notes[0]['authorId']);
    }

    public function test_trainee_stages_and_milestones_are_sequential_and_server_enforced(): void
    {
        DB::table('performance_trainee_journeys')->insert([
            'external_key' => 'gov-trainee-journey',
            'trainee_user_id' => $this->trainee->id,
            'current_stage' => 'Development Plan',
            'milestones' => json_encode([
                ['id' => 'm1', 'title' => 'Initial review', 'completedAt' => now()->subDay()->toIso8601String()],
                ['id' => 'm2', 'title' => 'Development activities'],
                ['id' => 'm3', 'title' => 'Re-evaluation'],
            ], JSON_THROW_ON_ERROR),
            'development_action_keys' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $development = $this->actingAs($this->manager)
            ->getJson('/performance/api/state')
            ->json('data.development');
        $journeyIndex = array_search('gov-trainee-journey', array_column($development['traineeJourneys'], 'id'), true);
        $this->assertNotFalse($journeyIndex, 'Governed trainee journey was not returned in the manager development state.');

        $development['traineeJourneys'][$journeyIndex]['currentStage'] = 'Re-evaluation';

        $this->actingAs($this->manager)
            ->putJson('/performance/api/development', ['development' => $development])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('development');

        $development = $this->actingAs($this->manager)
            ->getJson('/performance/api/state')
            ->json('data.development');
        $journeyIndex = array_search('gov-trainee-journey', array_column($development['traineeJourneys'], 'id'), true);
        $this->assertNotFalse($journeyIndex);

        $development['traineeJourneys'][$journeyIndex]['milestones'][2]['completedAt'] = now()->toIso8601String();

        $this->actingAs($this->manager)
            ->putJson('/performance/api/development', ['development' => $development])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('development');

        $development = $this->actingAs($this->manager)
            ->getJson('/performance/api/state')
            ->json('data.development');
        $journeyIndex = array_search('gov-trainee-journey', array_column($development['traineeJourneys'], 'id'), true);
        $this->assertNotFalse($journeyIndex);

        $development['traineeJourneys'][$journeyIndex]['currentStage'] = 'Learning / Training / Practical Development';
        $development['traineeJourneys'][$journeyIndex]['milestones'][1]['completedAt'] = now()->toIso8601String();

        $response = $this->actingAs($this->manager)
            ->putJson('/performance/api/development', ['development' => $development])
            ->assertOk();

        $journey = collect($response->json('data.development.traineeJourneys'))
            ->firstWhere('id', 'gov-trainee-journey');

        $this->assertNotNull($journey);
        $this->assertSame(
            'Learning / Training / Practical Development',
            $journey['currentStage']
        );
    }

    private function person(string $key, UserRole $role, bool $evaluatorCapable, string $personType): User
    {
        return User::factory()->create([
            'name' => ucwords(str_replace('-', ' ', $key)),
            'email' => "{$key}@example.test",
            'role' => $role->value,
            'personnel_key' => $key,
            'core_person_id' => "core-{$key}",
            'employee_or_trainee_id' => strtoupper($key),
            'position' => $evaluatorCapable ? 'Manager' : ($personType === 'Trainee' ? 'Trainee' : 'Specialist'),
            'department' => 'Operations',
            'person_type' => $personType,
            'employment_status' => $personType,
            'evaluator_capable' => $evaluatorCapable,
        ]);
    }
    public function test_admin_cannot_mutate_source_governed_goal_plan_library_through_configuration_sync(): void
    {
        DB::table('performance_goal_templates')->insert([
            'external_key' => 'gov-source-goal-plan',
            'name' => 'Source Governed Operations Plan',
            'applicable_person_types' => json_encode(['Employee'], JSON_THROW_ON_ERROR),
            'department_scopes' => json_encode(['Operations'], JSON_THROW_ON_ERROR),
            'position_scopes' => json_encode([], JSON_THROW_ON_ERROR),
            'cycle_keys' => json_encode(['gov-cycle'], JSON_THROW_ON_ERROR),
            'description' => 'Canonical company-source goal plan.',
            'allow_individual_overrides' => false,
            'items' => json_encode([
                [
                    'id' => 'gov-source-kpi',
                    'metricType' => 'KPI',
                    'title' => 'Delivery Accuracy',
                    'target' => 'Meet the governed delivery requirement',
                    'unit' => '% compliant work',
                    'weight' => 100,
                ],
            ], JSON_THROW_ON_ERROR),
            'active' => true,
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $state = $this->actingAs($this->admin)
            ->getJson('/performance/api/state')
            ->assertOk()
            ->json('data');

        $state['goalTemplates'][0]['name'] = 'Manual Admin Rewrite';
        $state['goalTemplates'][0]['items'][0]['weight'] = 90;

        $this->actingAs($this->admin)->putJson('/performance/api/configuration', [
            'reviewTemplates' => $state['reviewTemplates'],
            'goalTemplates' => $state['goalTemplates'],
            'goals' => $state['goals'],
            'assignments' => $state['assignments'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('goalTemplates');

        $this->assertDatabaseHas('performance_goal_templates', [
            'external_key' => 'gov-source-goal-plan',
            'name' => 'Source Governed Operations Plan',
            'active' => true,
        ]);
    }

    public function test_regular_performance_cycles_are_policy_generated_and_cannot_be_changed_manually(): void
    {
        $state = $this->actingAs($this->admin)->getJson('/performance/api/state')->assertOk()->json('data');
        $cycle = $state['cycles'][0] ?? null;
        $this->assertNotNull($cycle);

        $this->actingAs($this->admin)->putJson('/performance/api/configuration', [
            'cycles' => [$cycle],
            'reviewTemplates' => $state['reviewTemplates'],
            'goalTemplates' => $state['goalTemplates'],
            'goals' => $state['goals'],
            'assignments' => $state['assignments'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('cycles');
    }

}
