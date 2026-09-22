<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recognition_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->string('color')->default('amber');
            $table->string('icon')->default('award');
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        $now = now();
        DB::table('recognition_categories')->insert(collect([
            ['PERFORMANCE_EXCELLENCE', 'Performance Excellence', 'Exceptional delivery supported by clear work evidence.', 'amber', 'trophy'],
            ['TEAMWORK_COLLABORATION', 'Teamwork & Collaboration', 'Meaningful collaboration and support across teams.', 'blue', 'users'],
            ['LEADERSHIP', 'Leadership', 'Responsible leadership, mentorship, and positive influence.', 'purple', 'award'],
            ['INNOVATION', 'Innovation', 'Practical ideas or improvements with documented value.', 'cyan', 'lightbulb'],
            ['LEARNING_DEVELOPMENT', 'Learning & Development', 'Applied growth, mentorship, or verified capability development.', 'green', 'sparkles'],
            ['SAFETY_COMPLIANCE', 'Safety & Compliance', 'Consistent safety leadership and responsible compliance behavior.', 'rose', 'shield'],
        ])->map(fn (array $category, int $index) => [
            'id' => (string) Str::uuid(), 'code' => $category[0], 'name' => $category[1],
            'description' => $category[2], 'color' => $category[3], 'icon' => $category[4],
            'is_active' => true, 'display_order' => $index + 1,
            'created_at' => $now, 'updated_at' => $now,
        ])->all());

        Schema::create('recognition_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('recipient_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recipient_personnel_key')->index();
            $table->jsonb('recipient_snapshot');
            $table->foreignId('nominator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->jsonb('nominator_snapshot');
            $table->foreignUuid('category_id')->constrained('recognition_categories')->restrictOnDelete();
            $table->string('title');
            $table->text('achievement_details');
            $table->date('achievement_date');
            $table->string('status')->default('Draft')->index();
            $table->timestampTz('submitted_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->timestampTz('recognized_at')->nullable()->index();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('revoked_at')->nullable();
            $table->text('decline_reason')->nullable();
            $table->text('revocation_reason')->nullable();
            $table->uuid('replaces_id')->nullable()->index();
            $table->jsonb('source_metadata')->nullable();
            $table->timestampsTz();
            $table->index(['recipient_id', 'status']);
            $table->index(['nominator_id', 'status']);
            $table->index(['category_id', 'achievement_date']);
        });

        Schema::create('recognition_evidence', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('recognition_record_id')->constrained('recognition_records')->cascadeOnDelete();
            $table->string('evidence_type')->default('Supporting Note');
            $table->string('source_module')->nullable()->index();
            $table->string('source_record_id')->nullable();
            $table->timestampTz('source_finalized_at')->nullable();
            $table->text('description')->nullable();
            $table->jsonb('source_snapshot')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->index(['source_module', 'source_record_id']);
        });

        Schema::create('recognition_decisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('recognition_record_id')->constrained('recognition_records')->cascadeOnDelete();
            $table->string('decision')->index();
            $table->text('reason')->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->jsonb('actor_snapshot');
            $table->timestampTz('decided_at');
            $table->timestampsTz();
        });

        Schema::create('recognition_audit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('event_type')->index();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('subject_type');
            $table->uuid('subject_id');
            $table->jsonb('metadata')->nullable();
            $table->timestampTz('occurred_at')->index();
            $table->timestampsTz();
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recognition_audit_events');
        Schema::dropIfExists('recognition_decisions');
        Schema::dropIfExists('recognition_evidence');
        Schema::dropIfExists('recognition_records');
        Schema::dropIfExists('recognition_categories');
    }
};
