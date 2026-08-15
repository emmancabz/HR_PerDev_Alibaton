<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_course_code_sequences', function (Blueprint $table) {
            $table->unsignedInteger('year')->primary(); $table->unsignedBigInteger('last_value')->default(0); $table->timestampsTz();
        });
        $this->backfillCourseCodeSequences();
        Schema::create('learning_request_actions', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->uuid('learning_request_id'); $table->string('from_status'); $table->string('to_status');
            $table->string('action'); $table->text('reason')->nullable(); $table->foreignId('actor_id')->constrained('users')->restrictOnDelete(); $table->timestampTz('acted_at'); $table->timestampsTz();
            $table->foreign('learning_request_id')->references('id')->on('learning_requests')->restrictOnDelete();
        });
        Schema::create('learning_competency_evidence', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->uuid('completion_id'); $table->uuid('course_version_id');
            $table->string('competency_id'); $table->unsignedInteger('competency_version'); $table->string('competency_code');
            $table->boolean('official_result_changed')->default(false); $table->boolean('gap_closed')->default(false);
            $table->timestampTz('recorded_at'); $table->timestampsTz();
            $table->unique(['completion_id', 'competency_id']);
            $table->foreign('completion_id')->references('id')->on('learning_completions')->restrictOnDelete();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->restrictOnDelete();
        });
        $this->remediatePublishedVersions();
        $this->assertNoDuplicateWorkingDrafts();
        $this->assertNoDuplicateActiveAssignments();
        $this->assertNoDuplicateCertificates();

        Schema::table('learning_course_versions', function (Blueprint $table) { $table->foreign('based_on_version_id')->references('id')->on('learning_course_versions')->nullOnDelete(); });
        Schema::table('learning_courses', function (Blueprint $table) { $table->foreign('current_published_version_id')->references('id')->on('learning_course_versions')->restrictOnDelete(); });
        Schema::table('learning_materials', function (Blueprint $table) { $table->foreign('replaces_material_id')->references('id')->on('learning_materials')->nullOnDelete(); });
        Schema::table('learning_assignments', function (Blueprint $table) { $table->foreign('migrated_from_assignment_id')->references('id')->on('learning_assignments')->nullOnDelete(); });
        Schema::table('learning_certificates', function (Blueprint $table) { $table->unique('completion_id'); $table->foreign('replaced_by_certificate_id')->references('id')->on('learning_certificates')->nullOnDelete(); });
        Schema::table('learning_transcript_entries', function (Blueprint $table) {
            $table->foreign('course_id')->references('id')->on('learning_courses')->restrictOnDelete();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->restrictOnDelete();
            $table->foreign('certificate_id')->references('id')->on('learning_certificates')->nullOnDelete();
        });
        Schema::table('learning_requests', function (Blueprint $table) {
            $table->foreign('linked_course_id')->references('id')->on('learning_courses')->nullOnDelete();
            $table->foreign('linked_course_version_id')->references('id')->on('learning_course_versions')->nullOnDelete();
            $table->foreign('assignment_id')->references('id')->on('learning_assignments')->nullOnDelete();
        });

        DB::statement("CREATE UNIQUE INDEX learning_one_working_draft_per_course ON learning_course_versions (course_id) WHERE version_number IS NULL AND status IN ('Draft','Changes Requested','In Review','Approved')");
        DB::statement("CREATE UNIQUE INDEX learning_one_published_version_per_course ON learning_course_versions (course_id) WHERE status = 'Published'");
        DB::statement("CREATE UNIQUE INDEX learning_one_active_assignment_per_course ON learning_assignments (learner_id, course_id) WHERE status IN ('Not Started','In Progress','Failed/Attempts Exhausted')");
    }

    private function backfillCourseCodeSequences(): void
    {
        $maxima = [];
        foreach (DB::table('learning_courses')->pluck('code') as $code) {
            if (! preg_match('/^LRN-(\d{4})-(\d+)$/', (string) $code, $matches)) continue;
            $year = (int) $matches[1];
            $maxima[$year] = max($maxima[$year] ?? 0, (int) $matches[2]);
        }
        foreach ($maxima as $year => $lastValue) {
            DB::table('learning_course_code_sequences')->updateOrInsert(
                ['year' => $year],
                ['last_value' => $lastValue, 'created_at' => now(), 'updated_at' => now()],
            );
        }
    }

    private function remediatePublishedVersions(): void
    {
        $duplicates = DB::table('learning_course_versions')->select('course_id')
            ->where('status', 'Published')->groupBy('course_id')->havingRaw('COUNT(*) > 1')->pluck('course_id');
        foreach ($duplicates as $courseId) {
            $course = DB::table('learning_courses')->where('id', $courseId)->first();
            $versions = DB::table('learning_course_versions')->where('course_id', $courseId)
                ->where('status', 'Published')->orderByDesc('published_at')->orderByDesc('version_number')->get();
            $keeper = $versions->firstWhere('id', $course?->current_published_version_id) ?? $versions->first();
            if (! $keeper) continue;
            DB::table('learning_course_versions')->where('course_id', $courseId)->where('status', 'Published')
                ->where('id', '!=', $keeper->id)->update(['status' => 'Archived', 'updated_at' => now()]);
            DB::table('learning_courses')->where('id', $courseId)->update(['current_published_version_id' => $keeper->id, 'updated_at' => now()]);
        }
    }

    private function assertNoDuplicateWorkingDrafts(): void
    {
        $duplicates = DB::table('learning_course_versions')->select('course_id')
            ->whereNull('version_number')->whereIn('status', ['Draft', 'Changes Requested', 'In Review', 'Approved'])
            ->groupBy('course_id')->havingRaw('COUNT(*) > 1')->pluck('course_id');
        $this->failForDuplicates($duplicates, 'working course versions', 'Retire or archive all but one working Draft/In Review/Approved version per course lineage, then rerun the migration.');
    }

    private function assertNoDuplicateActiveAssignments(): void
    {
        $duplicates = DB::table('learning_assignments')->select('learner_id', 'course_id')
            ->whereIn('status', ['Not Started', 'In Progress', 'Failed/Attempts Exhausted'])
            ->groupBy('learner_id', 'course_id')->havingRaw('COUNT(*) > 1')->get()
            ->map(fn ($row) => $row->learner_id.':'.$row->course_id);
        $this->failForDuplicates($duplicates, 'active learner assignments', 'Cancel or complete duplicate active assignments for each learner/course lineage, preserving the intended historical rows, then rerun the migration.');
    }

    private function assertNoDuplicateCertificates(): void
    {
        $duplicates = DB::table('learning_certificates')->select('completion_id')
            ->groupBy('completion_id')->havingRaw('COUNT(*) > 1')->pluck('completion_id');
        $this->failForDuplicates($duplicates, 'certificates for one completion', 'Retain one valid certificate per completion and preserve the others as explicit revocation/replacement history before rerunning the migration.');
    }

    private function failForDuplicates($duplicates, string $label, string $action): void
    {
        if ($duplicates->isEmpty()) return;
        $sample = $duplicates->take(10)->implode(', ');
        throw new RuntimeException("Learning integrity migration stopped: duplicate {$label} were found ({$sample}). {$action}");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS learning_one_active_assignment_per_course');
        DB::statement('DROP INDEX IF EXISTS learning_one_published_version_per_course');
        DB::statement('DROP INDEX IF EXISTS learning_one_working_draft_per_course');
        Schema::table('learning_requests', function (Blueprint $table) {
            $table->dropForeign(['linked_course_id']); $table->dropForeign(['linked_course_version_id']); $table->dropForeign(['assignment_id']);
        });
        Schema::table('learning_transcript_entries', function (Blueprint $table) {
            $table->dropForeign(['course_id']); $table->dropForeign(['course_version_id']); $table->dropForeign(['certificate_id']);
        });
        Schema::table('learning_certificates', function (Blueprint $table) {
            $table->dropForeign(['replaced_by_certificate_id']); $table->dropUnique(['completion_id']);
        });
        Schema::table('learning_assignments', fn (Blueprint $table) => $table->dropForeign(['migrated_from_assignment_id']));
        Schema::table('learning_materials', fn (Blueprint $table) => $table->dropForeign(['replaces_material_id']));
        Schema::table('learning_courses', fn (Blueprint $table) => $table->dropForeign(['current_published_version_id']));
        Schema::table('learning_course_versions', fn (Blueprint $table) => $table->dropForeign(['based_on_version_id']));
        Schema::dropIfExists('learning_competency_evidence'); Schema::dropIfExists('learning_request_actions'); Schema::dropIfExists('learning_course_code_sequences');
    }
};
