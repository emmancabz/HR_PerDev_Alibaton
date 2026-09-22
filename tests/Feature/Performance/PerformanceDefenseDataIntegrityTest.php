<?php

namespace Tests\Feature\Performance;

use App\Models\User;
use App\Services\Performance\PerformanceService;
use Database\Seeders\PerformanceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PerformanceDefenseDataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-08-23 20:00:00');
        config(['performance.review_demo_date' => null]);
        $this->seed(PerformanceSeeder::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_q3_policy_cycle_is_current_and_formal_reviews_wait_for_the_review_window(): void
    {
        $cycle = DB::table('performance_cycles')->where('external_key', 'period-q3-2026')->first();
        $this->assertNotNull($cycle);

        $this->assertSame('Active', $cycle->status);
        $this->assertSame('Quarterly', $cycle->cycle_type);
        $this->assertSame('2026-09-30', (string) $cycle->performance_end_date);
        $this->assertSame('2026-10-01', (string) $cycle->review_open_date);
        $this->assertSame('2026-10-15', (string) $cycle->review_due_date);

        $stages = DB::table('performance_reviews as reviews')
            ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
            ->where('assignments.performance_cycle_id', $cycle->id)
            ->get(['reviews.status', 'reviews.workflow_state', 'reviews.calibration_status']);

        $this->assertNotEmpty($stages);
        $this->assertTrue($stages->every(fn ($row) => $row->status === 'Pending'));
        $this->assertTrue($stages->every(fn ($row) => $row->workflow_state === 'Scheduled'));
        $this->assertTrue($stages->every(fn ($row) => $row->calibration_status === 'Pending'));
    }

    public function test_every_review_uses_canonical_people_and_valid_timing(): void
    {
        $rows = DB::table('performance_reviews as reviews')
            ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'assignments.performance_cycle_id')
            ->join('users as subjects', 'subjects.id', '=', 'assignments.subject_user_id')
            ->join('users as evaluators', 'evaluators.id', '=', 'assignments.evaluator_user_id')
            ->get([
                'reviews.*',
                'cycles.review_open_date',
                'cycles.calibration_required',
                'subjects.personnel_key as subject_key',
                'evaluators.personnel_key as evaluator_key',
                'evaluators.evaluator_capable',
            ]);

        $this->assertNotEmpty($rows);
        foreach ($rows as $row) {
            $this->assertNotNull($row->subject_key);
            $this->assertNotNull($row->evaluator_key);
            $this->assertNotSame($row->subject_key, $row->evaluator_key);
            $this->assertTrue((bool) $row->evaluator_capable);

            if ($row->status === 'Completed') {
                $this->assertSame('Finalized', $row->workflow_state);
                $this->assertNotNull($row->finalized_at);
                $this->assertGreaterThanOrEqual(
                    strtotime((string) $row->review_open_date),
                    strtotime((string) $row->finalized_at),
                    "{$row->external_key} was finalized before the review window opened.",
                );
                if ((bool) $row->calibration_required) {
                    $this->assertSame('Approved', $row->calibration_status);
                }
            } else {
                $this->assertNull($row->finalized_at);
            }
        }
    }

    public function test_final_ratings_are_derived_from_the_saved_weighted_template_scores(): void
    {
        $rows = DB::table('performance_reviews as reviews')
            ->join('performance_review_templates as templates', 'templates.id', '=', 'reviews.performance_review_template_id')
            ->whereNotNull('reviews.final_rating')
            ->get(['reviews.external_key', 'reviews.final_rating', 'reviews.criteria_scores', 'templates.criteria']);

        foreach ($rows as $row) {
            $criteria = collect(json_decode($row->criteria, true, 512, JSON_THROW_ON_ERROR))->keyBy('name');
            $scores = collect(json_decode($row->criteria_scores, true, 512, JSON_THROW_ON_ERROR))->keyBy('name');
            $this->assertCount($criteria->count(), $scores, "{$row->external_key} must rate every configured criterion.");

            $weighted = $criteria->sum(function (array $criterion, string $name) use ($scores): float {
                return (float) $criterion['weight'] * (float) $scores[$name]['score'];
            }) / 100;

            $this->assertEqualsWithDelta(round($weighted, 2), (float) $row->final_rating, 0.001, "{$row->external_key} rating must be server-derivable.");
        }
    }

    public function test_seeded_goals_stay_inside_their_performance_cycle_and_state_is_server_authoritative(): void
    {
        $goals = DB::table('performance_goals as goals')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'goals.performance_cycle_id')
            ->join('users', 'users.id', '=', 'goals.user_id')
            ->get([
                'goals.external_key', 'goals.start_date', 'goals.end_date',
                'cycles.performance_start_date', 'cycles.performance_end_date',
                'users.personnel_key',
            ]);

        foreach ($goals as $goal) {
            $this->assertNotNull($goal->personnel_key);
            $this->assertGreaterThanOrEqual(strtotime((string) $goal->performance_start_date), strtotime((string) $goal->start_date));
            $this->assertLessThanOrEqual(strtotime((string) $goal->performance_end_date), strtotime((string) $goal->end_date));
        }

        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $state = app(PerformanceService::class)->state($admin);
        $this->assertSame('PostgreSQL', $state['meta']['sourceOfTruth']);
        $this->assertSame('Canonical users/personnel', $state['meta']['identitySource']);
        $this->assertSame('2026-08-23', $state['meta']['serverDate']);
        $this->assertNotEmpty($state['reviews']);
    }
}
