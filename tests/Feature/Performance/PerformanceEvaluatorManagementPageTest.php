<?php

namespace Tests\Feature\Performance;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PerformanceEvaluatorManagementPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_manage_evaluators_route_renders_the_dedicated_performance_subpage(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.performance.evaluators'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('AdminPerformance')
                ->where('performanceView', 'manage-evaluators')
            );
    }
}
