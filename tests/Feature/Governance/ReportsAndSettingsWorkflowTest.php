<?php

namespace Tests\Feature\Governance;

use App\Enums\UserRole;
use App\Models\ReportExport;
use App\Models\SystemSettingAudit;
use App\Models\User;
use App\Services\Governance\SystemSettingsService;
use App\Services\Reporting\CrossModuleReportService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportsAndSettingsWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_hr_and_user_receive_the_correct_report_scope(): void
    {
        $admin = $this->person('governance-admin', UserRole::Admin, 'Administration');
        $hr = $this->person('governance-hr', UserRole::HR, 'Human Resources');
        $employee = $this->person('governance-employee', UserRole::User, 'Operations');
        $colleague = $this->person('governance-colleague', UserRole::User, 'Finance');
        $reports = app(CrossModuleReportService::class);

        $this->assertCount(6, $reports->state($admin)['catalog']);
        $this->assertCount(6, $reports->state($hr)['catalog']);
        $userState = $reports->state($employee);
        $this->assertCount(1, $userState['catalog']);
        $this->assertSame([(string) $employee->id], collect($userState['report']['rows'])->pluck('id')->all());
        $this->assertNotContains((string) $colleague->id, collect($userState['report']['rows'])->pluck('id')->all());
    }

    public function test_user_cannot_read_a_sensitive_organization_report(): void
    {
        $user = $this->person('report-user', UserRole::User, 'Operations');
        $this->expectException(AuthorizationException::class);
        app(CrossModuleReportService::class)->rows($user, 'succession-risk');
    }

    public function test_admin_and_hr_settings_authority_is_enforced_and_audited(): void
    {
        $admin = $this->person('settings-admin', UserRole::Admin, 'Administration');
        $hr = $this->person('settings-hr', UserRole::HR, 'Human Resources');
        $service = app(SystemSettingsService::class);

        $service->update($admin, ['organization.name' => 'Alibaton Construction and Logistics Incorporated'], 'Approved organization identity standard.');
        $service->update($hr, ['reporting.default_period_days' => 120], 'Approved reporting review window.');

        $this->assertDatabaseCount('system_setting_audits', 2);
        $this->assertSame('Approved organization identity standard.', SystemSettingAudit::query()->where('setting_key', 'organization.name')->firstOrFail()->reason);

        $this->expectException(AuthorizationException::class);
        $service->update($hr, ['organization.timezone' => 'UTC'], 'Attempted unauthorized organization change.');
    }

    public function test_user_settings_payload_excludes_organization_governance_data(): void
    {
        $user = $this->person('settings-user', UserRole::User, 'Operations');
        $state = app(SystemSettingsService::class)->state($user);

        $this->assertSame([], $state['integrations']);
        $this->assertSame([], $state['access_matrix']);
        $this->assertSame([], $state['audits']);
        $this->assertArrayHasKey('mfa_enabled', $state['security']);
    }

    public function test_hr2_contract_is_honest_and_never_claims_connection(): void
    {
        $admin = $this->person('integration-admin', UserRole::Admin, 'Administration');
        $state = app(SystemSettingsService::class)->state($admin);
        $hr2 = collect($state['integrations'])->firstWhere('status', 'Not Connected');

        $this->assertNotNull($hr2);
        $this->assertStringContainsString('read-only attendance evidence', strtolower($hr2['ownership']));
        $this->assertStringContainsString('Training HR finalization', $hr2['ownership']);
    }

    public function test_export_history_is_persistent_and_user_scoped(): void
    {
        $first = $this->person('export-first', UserRole::User, 'Operations');
        $second = $this->person('export-second', UserRole::User, 'Finance');
        $reports = app(CrossModuleReportService::class);
        $reports->recordExport($first, 'workforce-development', 'csv', [], 1);
        $reports->recordExport($second, 'workforce-development', 'print', [], 1);

        $this->assertDatabaseCount('report_exports', 2);
        $this->assertCount(1, $reports->state($first)['exports']);
        $this->assertSame($first->id, ReportExport::query()->where('format', 'csv')->value('actor_id'));
    }


    public function test_reports_use_current_labels_context_metrics_and_competency_summary(): void
    {
        $admin = $this->person('reports-admin-final', UserRole::Admin, 'Administration');
        $reports = app(CrossModuleReportService::class);

        $state = $reports->state($admin, ['report' => 'workforce-development', 'date_from' => null, 'date_to' => null]);

        $learning = collect($state['catalog'])->firstWhere('key', 'learning-compliance');
        $this->assertSame('Learning Completion & Certificate Status', $learning['label']);
        $this->assertArrayNotHasKey('data_sources', $state);
        $this->assertSame(
            ['People in Scope', 'Finalized Reviews', 'Competency Assessments', 'Development Completions'],
            collect($state['metrics'])->pluck('label')->all(),
        );

        $row = collect($state['report']['rows'])->firstWhere('id', (string) $admin->id);
        $this->assertNotNull($row);
        $this->assertArrayHasKey('competency_assessments', $row);
        $this->assertArrayHasKey('open_competency_gaps', $row);
    }

    public function test_every_admin_report_can_render_with_the_authoritative_schema(): void
    {
        $admin = $this->person('reports-schema-admin', UserRole::Admin, 'Administration');
        $reports = app(CrossModuleReportService::class);

        foreach (array_keys(CrossModuleReportService::REPORTS) as $reportKey) {
            $rows = $reports->rows($admin, $reportKey, ['date_from' => null, 'date_to' => null]);
            $this->assertInstanceOf(\Illuminate\Support\Collection::class, $rows, $reportKey);

            $state = $reports->state($admin, ['report' => $reportKey, 'date_from' => null, 'date_to' => null]);
            $this->assertSame($reportKey, $state['selected_report']);
            $this->assertCount(4, $state['metrics']);
        }
    }

    private function person(string $key, UserRole $role, string $department): User
    {
        return User::factory()->create([
            'personnel_key' => $key,
            'core_person_id' => strtoupper($key),
            'employee_or_trainee_id' => 'EMP-'.strtoupper(substr(md5($key), 0, 6)),
            'name' => ucwords(str_replace('-', ' ', $key)),
            'email' => "{$key}@alibaton.test",
            'role' => $role,
            'position' => $role === UserRole::User ? 'Operations Staff' : $role->label(),
            'department' => $department,
            'person_type' => 'Employee',
            'employment_status' => 'Employee',
        ]);
    }
}
