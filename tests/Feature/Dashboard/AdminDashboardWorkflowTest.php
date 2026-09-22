<?php

namespace Tests\Feature\Dashboard;

use App\Enums\UserRole;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminDashboardWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_dashboard_surfaces_action_oriented_governance_metrics(): void
    {
        $admin = $this->person('dashboard-admin', UserRole::Admin, 'Administration', 'System Administrator');
        $employee = $this->person('dashboard-employee', UserRole::User, 'Operations', 'Crane Operator');
        $evaluator = $this->person('dashboard-evaluator', UserRole::User, 'Operations', 'Operations Supervisor');

        $today = CarbonImmutable::today('Asia/Manila');

        // Quarterly policy migrations create canonical 2026 cycles. This test owns
        // the current-cycle fixture, so remove those empty policy rows first to
        // avoid an ambiguous overlapping quarter being selected by the dashboard.
        DB::table('performance_cycles')->delete();

        $cycleId = DB::table('performance_cycles')->insertGetId([
            'external_key' => 'dashboard-current-cycle',
            'name' => 'Dashboard Current Cycle',
            'cycle_type' => 'Quarterly',
            'performance_start_date' => $today->startOfQuarter()->toDateString(),
            'performance_end_date' => $today->endOfQuarter()->toDateString(),
            'review_open_date' => $today->toDateString(),
            'review_due_date' => $today->addDays(15)->toDateString(),
            'applicable_person_types' => json_encode(['Employee']),
            'department_scopes' => json_encode([]),
            'review_template_keys' => json_encode([]),
            'self_evaluation_enabled' => false,
            'self_rating_enabled' => false,
            'calibration_required' => true,
            'employee_acknowledgment' => 'Optional',
            'status' => 'Active',
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $assignmentId = DB::table('performance_review_assignments')->insertGetId([
            'external_key' => 'dashboard-review-assignment',
            'performance_cycle_id' => $cycleId,
            'subject_user_id' => $employee->id,
            'evaluator_user_id' => $evaluator->id,
            'basis' => 'Cycle Assignment',
            'active' => true,
            'assigned_by_id' => $admin->id,
            'assigned_at' => now(),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('performance_reviews')->insert([
            'external_key' => 'dashboard-review',
            'performance_review_assignment_id' => $assignmentId,
            'status' => 'In Progress',
            'workflow_state' => 'Calibration Pending',
            'calibration_status' => 'Pending',
            'manager_submitted_at' => now(),
            'due_date' => $today->addDays(7)->toDateString(),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('AdminDashboard')
                ->where('userName', $admin->name)
                ->where('dashboard.stats.activeWorkforce', 3)
                ->where('dashboard.stats.performanceActions', 1)
                ->where('dashboard.performance.cycleName', 'Dashboard Current Cycle')
                ->where('dashboard.performance.calibration', 1)
                ->has('dashboard.performanceSeries')
                ->has('dashboard.needsAttention')
                ->has('dashboard.development')
                ->has('dashboard.upcoming')
                ->has('dashboard.recentActivities')
                ->has('dashboard.workforceByDepartment')
            );
    }

    private function person(string $key, UserRole $role, string $department, string $position): User
    {
        return User::factory()->create([
            'personnel_key' => $key,
            'core_person_id' => strtoupper($key),
            'employee_or_trainee_id' => 'EMP-'.strtoupper(substr(md5($key), 0, 6)),
            'name' => ucwords(str_replace('-', ' ', $key)),
            'email' => "{$key}@alibaton.test",
            'role' => $role,
            'position' => $position,
            'department' => $department,
            'person_type' => 'Employee',
            'employment_status' => 'Employee',
            'pnd_access_status' => 'Active',
        ]);
    }
}
