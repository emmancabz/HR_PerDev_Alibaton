<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Performance\PerformanceService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PerformanceGoalsCanonicalSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(CanonicalPersonnelSeeder::class);

        $path = database_path('seeders/data/DEFENSE_PERFORMANCE_GOALS_V2.json');
        if (! is_file($path)) {
            throw new RuntimeException('Canonical Performance goals V2 dataset is missing.');
        }

        $dataset = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (($dataset['source_authority']['workforce_personas'] ?? null) !== 'DEFENSE_WORKFORCE_PERSONAS_V1') {
            throw new RuntimeException('Performance Goals V2 must declare the workforce reference as its authority.');
        }

        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $cycle = DB::table('performance_cycles')->where('external_key', $dataset['active_cycle_id'] ?? 'period-q3-2026')->first();
        if (! $cycle) {
            throw new RuntimeException('The active Performance cycle must exist before reconciling Goals & KPIs. Run PerformanceSeeder once if needed.');
        }

        $templateKeys = collect($dataset['goal_templates'] ?? [])->pluck('id')->filter()->values();
        $goalKeys = collect($dataset['goals'] ?? [])->pluck('id')->filter()->values();
        if ($templateKeys->isEmpty() || $goalKeys->isEmpty()) {
            throw new RuntimeException('Canonical Performance Goals V2 cannot be empty.');
        }

        DB::transaction(function () use ($admin, $cycle, $dataset, $templateKeys, $goalKeys): void {
            // Remove only non-canonical active-cycle goal rows. Historical cycles are retained.
            DB::table('performance_goals')
                ->where('performance_cycle_id', $cycle->id)
                ->when($goalKeys->isNotEmpty(), fn ($query) => $query->whereNotIn('external_key', $goalKeys))
                ->delete();

            // Retain old templates for history, but they must not appear as active plans in the current workspace.
            DB::table('performance_goal_templates')
                ->when($templateKeys->isNotEmpty(), fn ($query) => $query->whereNotIn('external_key', $templateKeys))
                ->update(['active' => false, 'updated_at' => now()]);

            app(PerformanceService::class)->syncConfiguration($admin, [
                'goalTemplates' => array_values($dataset['goal_templates'] ?? []),
                'goals' => array_values($dataset['goals'] ?? []),
            ], preserveGoalProgress: false);
        }, 3);
    }
}
