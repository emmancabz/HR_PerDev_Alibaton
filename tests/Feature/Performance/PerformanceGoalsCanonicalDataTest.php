<?php

namespace Tests\Feature\Performance;

use Tests\TestCase;

class PerformanceGoalsCanonicalDataTest extends TestCase
{
    public function test_phase_two_goal_dataset_covers_every_workforce_person_with_a_valid_100_percent_plan(): void
    {
        $workforce = json_decode(
            (string) file_get_contents(database_path('seeders/data/DEFENSE_WORKFORCE_PERSONAS_V1.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $dataset = json_decode(
            (string) file_get_contents(database_path('seeders/data/DEFENSE_PERFORMANCE_GOALS_V2.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $this->assertSame('DEFENSE_WORKFORCE_PERSONAS_V1', $dataset['source_authority']['workforce_personas']);
        $this->assertCount(35, $workforce['people']);
        $this->assertCount(10, $dataset['goal_templates']);
        $this->assertCount(140, $dataset['goals']);

        $templateById = collect($dataset['goal_templates'])->keyBy('id');
        foreach ($templateById as $template) {
            $this->assertTrue((bool) $template['active']);
            $this->assertSame(100, (int) collect($template['items'])->sum('weight'));
            $this->assertCount(4, $template['items']);
            $this->assertFalse((bool) ($template['allowIndividualOverrides'] ?? true));
        }

        $canonicalKeys = collect($workforce['people'])->pluck('personnel_key')->sort()->values();
        $goalKeys = collect($dataset['goals'])->pluck('personId')->unique()->sort()->values();
        $this->assertSame($canonicalKeys->all(), $goalKeys->all());

        foreach ($canonicalKeys as $personnelKey) {
            $goals = collect($dataset['goals'])->where('personId', $personnelKey)->values();
            $this->assertCount(4, $goals, "{$personnelKey} must have one complete active-cycle goal plan.");
            $this->assertSame(100, (int) $goals->sum('weight'), "{$personnelKey} goal weights must total 100%.");
            $this->assertCount(1, $goals->pluck('templateId')->unique());
            $this->assertTrue($templateById->has($goals->first()['templateId']));
        }
    }

    public function test_performance_goals_do_not_use_lms_completion_as_a_goal_score(): void
    {
        $dataset = json_decode(
            (string) file_get_contents(database_path('seeders/data/DEFENSE_PERFORMANCE_GOALS_V2.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $goalText = strtolower(json_encode($dataset['goals'], JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString('post-test', $goalText);
        $this->assertStringNotContainsString('certificate', $goalText);
        $this->assertStringNotContainsString('course completion', $goalText);
    }

    public function test_workforce_reference_contains_explicit_performance_evaluator_governance(): void
    {
        $workforce = json_decode(
            (string) file_get_contents(database_path('seeders/data/DEFENSE_WORKFORCE_PERSONAS_V1.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $this->assertArrayHasKey('performance_evaluator_governance', $workforce);
        $people = collect($workforce['people']);
        $this->assertCount(35, $people);
        $this->assertSame(24, $people->filter(fn (array $person): bool => ! (bool) $person['performance_evaluator_context']['requires_explicit_assignment'])->count());
        $this->assertSame(11, $people->filter(fn (array $person): bool => (bool) $person['performance_evaluator_context']['requires_explicit_assignment'])->count());

        foreach ($people as $person) {
            $context = $person['performance_evaluator_context'] ?? null;
            $this->assertIsArray($context);
            if (! empty($person['direct_manager'])) {
                $this->assertSame($person['direct_manager'], $context['default_evaluator_name']);
                $this->assertFalse((bool) $context['requires_explicit_assignment']);
            } else {
                $this->assertNull($context['default_evaluator_name']);
                $this->assertTrue((bool) $context['requires_explicit_assignment']);
            }

            $goalContext = $person['performance_goal_context'] ?? null;
            $this->assertIsArray($goalContext, "{$person['personnel_key']} must have governed Performance goal context.");
            $this->assertSame(4, (int) $goalContext['metric_count']);
            $this->assertSame(100, (int) $goalContext['total_weight']);
            $this->assertSame('Assigned', $goalContext['assignment_status']);
            $this->assertSame('Performance Management', $goalContext['progress_data_owner']);
            $this->assertFalse((bool) $goalContext['lms_score_dependency']);
        }
    }
    public function test_workforce_reference_exposes_governed_2026_quarter_selector_history(): void
    {
        $workforce = json_decode(
            (string) file_get_contents(database_path('seeders/data/DEFENSE_WORKFORCE_PERSONAS_V1.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $calendar = $workforce['performance_calendar'] ?? null;
        $this->assertIsArray($calendar);
        $this->assertSame([2026], $calendar['available_years']);
        $this->assertSame(2026, (int) $calendar['default_year']);
        $this->assertSame('period-q3-2026', $calendar['default_cycle_id']);
        $this->assertCount(4, $calendar['quarters']);

        $quarters = collect($calendar['quarters'])->keyBy('cycle_id');
        $this->assertSame('Finalized', $quarters['period-q1-2026']['status']);
        $this->assertTrue((bool) $quarters['period-q1-2026']['read_only']);
        $this->assertSame('Finalized', $quarters['period-q2-2026']['status']);
        $this->assertTrue((bool) $quarters['period-q2-2026']['read_only']);
        $this->assertSame('Current', $quarters['period-q3-2026']['status']);
        $this->assertFalse((bool) $quarters['period-q3-2026']['read_only']);
        $this->assertSame('Upcoming', $quarters['period-q4-2026']['status']);
        $this->assertTrue((bool) $quarters['period-q4-2026']['read_only']);

        $history = $workforce['performance_quarter_history'] ?? [];
        $this->assertCount(34, $history['period-q1-2026']['personnel_records']);
        $this->assertCount(34, $history['period-q2-2026']['personnel_records']);
        $this->assertSame([], $history['period-q4-2026']['personnel_records']);
    }

}
