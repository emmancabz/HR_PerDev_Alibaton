<?php

namespace Tests\Feature\Learning;

use App\Models\Learning\LearningAssessmentAttempt;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use App\Services\Learning\LearningDeliveryService;
use Database\Seeders\LearningSeeder;
use Database\Seeders\PerformanceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class LearningSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_operational_population_requires_explicit_opt_in(): void
    {
        config(['learning.operational_seed_enabled' => false]);
        $this->expectException(RuntimeException::class);
        $this->seed(LearningSeeder::class);
    }

    public function test_operational_population_is_idempotent_and_covers_workspaces(): void
    {
        $this->seed(PerformanceSeeder::class);
        config(['learning.operational_seed_enabled' => true]);
        $this->seed(LearningSeeder::class);
        $counts = $this->counts();
        $semantic = $this->semanticSnapshot();
        $this->seed(LearningSeeder::class);

        $this->assertSame($counts, $this->counts());
        $this->assertSame($semantic, $this->semanticSnapshot());
        $this->assertEqualsCanonicalizing(
            ['Approved', 'Archived', 'Draft', 'In Review', 'Published'],
            DB::table('learning_course_versions')->distinct()->pluck('status')->all(),
        );
        $this->assertEqualsCanonicalizing(
            ['Cancelled', 'Completed', 'Failed/Attempts Exhausted', 'In Progress', 'Not Started'],
            DB::table('learning_assignments')->distinct()->pluck('status')->all(),
        );
        $this->assertDatabaseHas('learning_competency_evidence', ['official_result_changed' => false, 'gap_closed' => false]);
        $this->assertDatabaseHas('learning_requests', ['status' => 'Triaged', 'assignment_id' => null]);
    }

    public function test_operational_population_ignores_real_title_collisions(): void
    {
        $this->seed(PerformanceSeeder::class);
        config(['learning.operational_seed_enabled' => true]);
        $admin = User::query()->whereIn('role', ['admin', 'hr'])->orderBy('id')->firstOrFail();
        $unrelated = LearningCourse::create(['id' => (string) Str::uuid(), 'code' => 'LRN-2026-777', 'owner_id' => $admin->id]);
        $version = LearningCourseVersion::create([
            'id' => (string) Str::uuid(), 'course_id' => $unrelated->id, 'version_number' => null, 'status' => 'Draft',
            'builder_stage' => 2, 'is_untouched_initial_draft' => false, 'title' => 'Port Operations Safety Essentials',
            'description' => 'Unrelated authored content that must remain byte-for-byte logically unchanged.', 'category' => 'General',
            'difficulty' => 'Advanced', 'language' => 'English', 'learning_objectives' => ['Preserve this unrelated record.'],
            'estimated_duration_minutes' => 5, 'audience_rules' => ['personTypes' => ['Employee']], 'completion_rules' => [],
            'created_by' => $admin->id, 'updated_by' => $admin->id,
        ]);
        $before = $version->only(['id', 'course_id', 'status', 'builder_stage', 'title', 'description', 'category', 'difficulty', 'learning_objectives']);
        $this->seed(LearningSeeder::class);
        $this->assertSame($before, $version->fresh()->only(array_keys($before)));
        $this->assertDatabaseHas('learning_course_versions', ['id' => '81000000-0000-4000-8000-000000000004', 'title' => 'Port Operations Safety Essentials']);
    }

    public function test_operational_population_refuses_incomplete_deterministic_provenance(): void
    {
        $this->seed(PerformanceSeeder::class);
        config(['learning.operational_seed_enabled' => true]);
        $admin = User::query()->whereIn('role', ['admin', 'hr'])->orderBy('id')->firstOrFail();
        LearningCourse::create(['id' => '80000000-0000-4000-8000-000000000001', 'code' => 'LRN-2026-901', 'owner_id' => $admin->id]);
        try {
            $this->seed(LearningSeeder::class);
            $this->fail('Incomplete deterministic provenance was adopted by operational population.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('complete population provenance', $exception->getMessage());
        }
        $this->assertDatabaseCount('learning_course_versions', 0);
        $this->assertDatabaseHas('learning_courses', ['id' => '80000000-0000-4000-8000-000000000001', 'code' => 'LRN-2026-901']);
    }

    public function test_populated_passing_and_failing_attempts_have_stable_evidence_and_regrade_consistently(): void
    {
        $this->seed(PerformanceSeeder::class);
        config(['learning.operational_seed_enabled' => true]);
        $this->seed(LearningSeeder::class);
        $admin = User::query()->whereIn('role', ['admin', 'hr'])->orderBy('id')->firstOrFail();
        $delivery = app(LearningDeliveryService::class);

        $passing = LearningAssessmentAttempt::findOrFail('20000000-0000-4000-8000-000000000005');
        $failing = LearningAssessmentAttempt::findOrFail('20000000-0000-4000-8000-000000000002');
        $responseColumns = ['attempt_id', 'question_id', 'selected_option_ids', 'is_correct', 'points_awarded'];
        $passingEvidence = [$passing->question_snapshot, DB::table('learning_attempt_responses')->where('attempt_id', $passing->id)->orderBy('question_id')->get($responseColumns)->toJson()];
        $failingEvidence = [$failing->question_snapshot, DB::table('learning_attempt_responses')->where('attempt_id', $failing->id)->orderBy('question_id')->get($responseColumns)->toJson()];

        $passingResult = $delivery->regradeAttempt($admin, $passing, 'Verify populated passing evidence');
        $failingResult = $delivery->regradeAttempt($admin, $failing, 'Verify populated failing evidence');
        $this->assertSame(100.0, $passingResult['score']);
        $this->assertTrue($passingResult['passed']);
        $this->assertSame(0.0, $failingResult['score']);
        $this->assertFalse($failingResult['passed']);
        $this->assertSame($passingEvidence[0], $passing->fresh()->question_snapshot);
        $this->assertSame($failingEvidence[0], $failing->fresh()->question_snapshot);
        $this->assertSame($passingEvidence[1], DB::table('learning_attempt_responses')->where('attempt_id', $passing->id)->orderBy('question_id')->get($responseColumns)->toJson());
        $this->assertSame($failingEvidence[1], DB::table('learning_attempt_responses')->where('attempt_id', $failing->id)->orderBy('question_id')->get($responseColumns)->toJson());
    }

    private function counts(): array
    {
        return collect([
            'learning_courses', 'learning_course_versions', 'learning_assignments', 'learning_assessment_attempts',
            'learning_completions', 'learning_certificates', 'learning_transcript_entries', 'learning_competency_evidence', 'learning_requests',
        ])->mapWithKeys(fn (string $table) => [$table => DB::table($table)->count()])->all();
    }

    private function semanticSnapshot(): string
    {
        $tables = [
            'learning_courses' => ['id', 'code', 'owner_id', 'current_published_version_id', 'archived_at', 'archived_by'],
            'learning_course_versions' => ['id', 'course_id', 'version_number', 'status', 'builder_stage', 'title', 'description', 'category', 'difficulty', 'language', 'learning_objectives', 'audience_rules', 'completion_rules', 'created_by', 'updated_by'],
            'learning_assignments' => ['id', 'learner_id', 'course_id', 'course_version_id', 'source', 'assigned_by', 'assigned_at', 'available_from', 'due_at', 'status', 'progress_percent', 'completed_at', 'cancelled_at'],
            'learning_assessment_attempts' => ['id', 'assignment_id', 'assessment_id', 'attempt_number', 'status', 'question_snapshot', 'score_percent', 'passed', 'started_at', 'submitted_at'],
            'learning_attempt_responses' => ['attempt_id', 'question_id', 'selected_option_ids', 'is_correct', 'points_awarded'],
            'learning_requests' => ['id', 'source_recommendation_id', 'personnel_key', 'source_assessment_id', 'competency_id', 'status', 'linked_course_id', 'linked_course_version_id', 'assignment_id', 'requested_at'],
        ];
        return collect($tables)->mapWithKeys(fn (array $columns, string $table) => [
            $table => DB::table($table)->orderBy($columns[0])->get($columns)->map(fn ($row) => (array) $row)->all(),
        ])->toJson();
    }
}
