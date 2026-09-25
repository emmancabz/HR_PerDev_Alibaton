<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Performance\PerformanceService;
use Database\Seeders\PerformanceSeeder;
use Database\Seeders\CanonicalPersonnelSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HRPersonnelAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_can_open_the_operational_personnel_workspace_and_performance_evaluator_page(): void
    {
        $this->seed(CanonicalPersonnelSeeder::class);

        $hr = User::query()->where('personnel_key', 'user-4')->firstOrFail();
        $hr->forceFill(['role' => UserRole::HR])->save();

        $this->actingAs($hr)
            ->get(route('hr.users.index'))
            ->assertOk();

        $this->actingAs($hr)
            ->get(route('hr.performance.evaluators'))
            ->assertOk();
    }

    public function test_hr_can_govern_non_admin_personnel_but_cannot_mutate_an_admin_account(): void
    {
        $this->seed(CanonicalPersonnelSeeder::class);

        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $admin->forceFill(['role' => UserRole::Admin])->save();

        $hr = User::query()->where('personnel_key', 'user-4')->firstOrFail();
        $hr->forceFill(['role' => UserRole::HR])->save();

        $subject = User::query()
            ->whereNotIn('id', [$admin->id, $hr->id])
            ->where('role', '!=', UserRole::Admin->value)
            ->whereNull('archived_at')
            ->firstOrFail();

        $this->assertNotSame(UserRole::Admin, $subject->role);

        $this->actingAs($hr)->patchJson(route('admin.users.access.update', $subject), [
            'status' => 'Suspended',
            'reason' => 'Authorized HR personnel access review requires temporary suspension.',
            'reference' => 'HR-ACCESS-TEST',
            'authorizedBy' => $hr->name,
        ])->assertOk();

        $this->assertSame('Suspended', $subject->fresh()->pnd_access_status);

        $this->actingAs($hr)->patchJson(route('admin.users.access.update', $admin), [
            'status' => 'Suspended',
            'reason' => 'This action must remain under Administrator governance.',
            'reference' => 'HR-ADMIN-BLOCK',
            'authorizedBy' => $hr->name,
        ])->assertForbidden();
    }
    public function test_hr_has_a_full_dashboard_and_can_configure_performance_governance(): void
    {
        $this->seed(PerformanceSeeder::class);

        $hr = User::query()->where('personnel_key', 'user-4')->firstOrFail();
        $hr->forceFill(['role' => UserRole::HR])->save();

        $this->actingAs($hr)
            ->get(route('hr.dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HRDashboard')
                ->has('dashboard.stats.activeWorkforce')
                ->has('dashboard.performance')
                ->has('dashboard.development')
                ->has('dashboard.workforceByDepartment')
            );

        $service = app(PerformanceService::class);
        $state = $service->state($hr);

        $this->assertTrue($state['actor']['capabilities']['configurePerformance']);
        $this->assertTrue($state['actor']['capabilities']['operatePerformance']);

        $synced = $service->syncConfiguration($hr, [
            'goalTemplates' => $state['goalTemplates'],
        ]);
        $this->assertSame('hr', $synced['actor']['role']);
    }

}
