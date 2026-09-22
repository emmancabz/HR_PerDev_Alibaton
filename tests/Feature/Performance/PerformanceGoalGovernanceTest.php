<?php

namespace Tests\Feature\Performance;

use App\Models\User;
use App\Services\Performance\PerformanceService;
use Database\Seeders\PerformanceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PerformanceGoalGovernanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_casually_change_formal_goal_progress_but_can_make_an_audited_correction(): void
    {
        $this->seed(PerformanceSeeder::class);

        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $service = app(PerformanceService::class);
        $goalKey = 'goal-user-gen-2-ops-kra-delivery';

        try {
            $service->updateGoalProgress($admin, $goalKey, 87, 'On Track');
            $this->fail('Admin/HR should not be able to casually edit formal goal progress.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('reason', $exception->errors());
        }

        $service->updateGoalProgress(
            $admin,
            $goalKey,
            87,
            'On Track',
            true,
            'Correcting a verified data-entry discrepancy in the stored percentage.',
            'PERF-CORR-2026-001',
        );

        $goalId = DB::table('performance_goals')->where('external_key', $goalKey)->value('id');
        $this->assertDatabaseHas('performance_goals', [
            'id' => $goalId,
            'progress' => 87.00,
            'status' => 'On Track',
        ]);
        $this->assertDatabaseHas('performance_goal_events', [
            'performance_goal_id' => $goalId,
            'actor_user_id' => $admin->id,
            'event_type' => 'Administrative Goal Correction',
            'reference' => 'PERF-CORR-2026-001',
        ]);

        $state = $service->state($admin);
        $audit = collect($state['goalAuditEvents'])->firstWhere('eventType', 'Administrative Goal Correction');
        $this->assertNotNull($audit);
        $this->assertSame($goalKey, $audit['goalId']);
        $this->assertSame(87.0, $audit['newProgress']);
        $this->assertSame('PERF-CORR-2026-001', $audit['reference']);
        $this->assertSame($admin->personnel_key, $audit['actorId']);

        $review = collect($state['reviews'])->first(
            fn (array $row): bool => $row['personId'] === 'user-gen-2' && $row['periodId'] === 'period-q3-2026'
        );
        $this->assertNotNull($review);
        $this->assertTrue(collect($review['auditTrail'] ?? [])->contains(
            fn (array $event): bool => $event['type'] === 'Administrative Goal Correction'
        ));
    }

    public function test_assigned_evaluator_can_verify_goal_progress_without_admin_correction_flag(): void
    {
        $this->seed(PerformanceSeeder::class);

        $evaluator = User::query()->where('personnel_key', 'user-gen-10')->firstOrFail(); // Antonio Ruiz
        $goalKey = 'goal-user-gen-2-ops-kra-delivery'; // Mateo Cruz

        app(PerformanceService::class)->updateGoalProgress(
            $evaluator,
            $goalKey,
            88,
            'On Track',
            false,
            'Verified against the documented operations delivery update and supervisor observation.',
            'OPS-WORK-2026-014',
        );

        $goalId = DB::table('performance_goals')->where('external_key', $goalKey)->value('id');
        $this->assertDatabaseHas('performance_goal_events', [
            'performance_goal_id' => $goalId,
            'actor_user_id' => $evaluator->id,
            'event_type' => 'Evaluator Goal Progress Verification',
        ]);
    }
}
