<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_course_versions', function (Blueprint $table) {
            $table->boolean('is_untouched_initial_draft')->default(false)->after('builder_stage');
        });
        DB::statement("CREATE UNIQUE INDEX learning_one_untouched_initial_draft_per_creator ON learning_course_versions (created_by) WHERE is_untouched_initial_draft = true AND version_number IS NULL AND status = 'Draft'");

        Schema::table('learning_materials', function (Blueprint $table) {
            $table->dropForeign(['lesson_id']);
        });
        Schema::table('learning_materials', function (Blueprint $table) {
            $table->uuid('lesson_id')->nullable()->change();
            $table->string('cleanup_status')->nullable()->index()->after('revoked_by');
            $table->timestampTz('cleanup_attempted_at')->nullable()->after('cleanup_status');
            $table->text('cleanup_error')->nullable()->after('cleanup_attempted_at');
            $table->foreign('lesson_id')->references('id')->on('learning_course_lessons')->nullOnDelete();
        });
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS learning_one_untouched_initial_draft_per_creator');
        Schema::table('learning_materials', function (Blueprint $table) {
            $table->dropForeign(['lesson_id']);
            $table->dropColumn(['cleanup_status', 'cleanup_attempted_at', 'cleanup_error']);
        });
        DB::table('learning_materials')->whereNull('lesson_id')->delete();
        Schema::table('learning_materials', function (Blueprint $table) {
            $table->uuid('lesson_id')->nullable(false)->change();
            $table->foreign('lesson_id')->references('id')->on('learning_course_lessons')->cascadeOnDelete();
        });
        Schema::table('learning_course_versions', fn (Blueprint $table) => $table->dropColumn('is_untouched_initial_draft'));
    }
};
