<?php

namespace Tests\Feature\Governance;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportExportFormatsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_export_csv_excel_json_and_print_formats(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin->value,
            'personnel_key' => 'report-export-admin',
            'employee_or_trainee_id' => 'ADM-REPORT-001',
            'department' => 'Administration',
            'position' => 'Administrator',
            'person_type' => 'Employee',
            'employment_status' => 'Employee',
        ]);

        foreach (['csv', 'excel', 'json', 'print'] as $format) {
            $response = $this->actingAs($admin)->get(route('governance.api.reports.export', [
                'report' => 'workforce-development',
                'format' => $format,
            ]));

            $response->assertOk();
            $this->assertStringContainsString('attachment;', (string) $response->headers->get('content-disposition'));
        }
    }
}
