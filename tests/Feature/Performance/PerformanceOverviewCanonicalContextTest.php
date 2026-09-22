<?php

namespace Tests\Feature\Performance;

use App\Models\User;
use App\Services\Performance\PerformanceService;
use Database\Seeders\PerformanceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PerformanceOverviewCanonicalContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_performance_state_uses_the_canonical_workforce_personas_as_its_personnel_scope(): void
    {
        $this->seed(PerformanceSeeder::class);

        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $state = app(PerformanceService::class)->state($admin);

        $this->assertSame('DEFENSE_WORKFORCE_PERSONAS_V1', $state['workforceContext']['source']);
        $this->assertCount(35, $state['workforceContext']['people']);
        $this->assertCount(35, $state['personnel']);

        $alejandro = collect($state['workforceContext']['people'])
            ->firstWhere('personnelKey', 'user-gen-22');
        $this->assertNotNull($alejandro);
        $this->assertSame('Administrative Services Supervisor', $alejandro['successionRole']);
        $this->assertSame('Ready Now', $alejandro['readiness']);

        $miguel = collect($state['workforceContext']['people'])
            ->firstWhere('personnelKey', 'user-8');
        $this->assertNotNull($miguel);
        $this->assertSame('Safety Supervisor', $miguel['successionRole']);
        $this->assertSame('Ready Soon', $miguel['readiness']);
    }
}
