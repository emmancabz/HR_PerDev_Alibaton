<?php

namespace Tests\Feature\Search;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class GlobalSearchWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_global_search_finds_people_authoritative_competency_reports_and_settings(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin->value,
            'name' => 'Search Administrator',
            'email' => 'search.admin@alibaton.test',
        ]);

        User::factory()->create([
            'role' => UserRole::User->value,
            'personnel_key' => 'search-person-001',
            'employee_or_trainee_id' => 'EMP-SEARCH-001',
            'name' => 'Marisol Searchable',
            'email' => 'marisol.searchable@alibaton.test',
            'position' => 'Crane Operator',
            'department' => 'Operations',
            'person_type' => 'Employee',
        ]);

        DB::table('competency_definitions')->insert([
            'id' => 'cmp-search-rigging',
            'status' => 'Published',
            'lineage_id' => 'cmp-search-rigging',
            'version' => 1,
            'payload' => json_encode([
                'id' => 'cmp-search-rigging',
                'code' => 'RIG-SEARCH',
                'name' => 'Rigging Search Competency',
                'category' => 'Operations',
                'definition' => 'Safe rigging and signaling practice.',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson(route('global-search', ['q' => 'Marisol Searchable']))
            ->assertOk()
            ->assertJsonFragment(['label' => 'Marisol Searchable', 'group' => 'People']);

        $this->actingAs($admin)
            ->getJson(route('global-search', ['q' => 'Rigging Search']))
            ->assertOk()
            ->assertJsonFragment(['group' => 'Competency', 'module' => 'Competency Framework']);

        $this->actingAs($admin)
            ->getJson(route('global-search', ['q' => 'Notifications']))
            ->assertOk()
            ->assertJsonFragment(['label' => 'Notifications & Alerts', 'group' => 'Settings']);

        $this->actingAs($admin)
            ->getJson(route('global-search', ['q' => 'Succession Coverage']))
            ->assertOk()
            ->assertJsonFragment(['label' => 'Succession Coverage & Risk', 'group' => 'Reports']);
    }
}
