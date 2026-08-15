<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_courses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->uuid('current_published_version_id')->nullable()->index();
            $table->timestampTz('archived_at')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        Schema::create('learning_course_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_id');
            $table->unsignedInteger('version_number')->nullable();
            $table->string('status')->default('Draft')->index();
            $table->string('title');
            $table->text('description');
            $table->string('category')->index();
            $table->string('difficulty')->default('Beginner');
            $table->string('language')->default('English');
            $table->json('learning_objectives')->default('[]');
            $table->string('thumbnail_path')->nullable();
            $table->foreignId('subject_matter_expert_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('estimated_duration_minutes')->default(0);
            $table->unsignedInteger('duration_override_minutes')->nullable();
            $table->json('audience_rules')->default('{}');
            $table->json('completion_rules')->default('{}');
            $table->timestampTz('availability_starts_at')->nullable();
            $table->timestampTz('availability_ends_at')->nullable();
            $table->uuid('based_on_version_id')->nullable()->index();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();
            $table->foreign('course_id')->references('id')->on('learning_courses')->cascadeOnDelete();
            $table->unique(['course_id', 'version_number']);
        });

        Schema::create('learning_course_collaborators', function (Blueprint $table) {
            $table->id();
            $table->uuid('course_id');
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('permission');
            $table->foreignId('authorized_by')->constrained('users')->restrictOnDelete();
            $table->timestampsTz();
            $table->foreign('course_id')->references('id')->on('learning_courses')->cascadeOnDelete();
            $table->unique(['course_id', 'user_id', 'permission']);
        });

        Schema::create('learning_course_competencies', function (Blueprint $table) {
            $table->id();
            $table->uuid('course_version_id');
            $table->string('competency_id');
            $table->unsignedInteger('competency_version');
            $table->string('competency_code');
            $table->string('competency_name');
            $table->unsignedSmallInteger('target_level');
            $table->string('purpose')->nullable();
            $table->json('objective_indexes')->default('[]');
            $table->boolean('is_primary')->default(false);
            $table->timestampsTz();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->cascadeOnDelete();
            $table->unique(['course_version_id', 'competency_id']);
        });

        Schema::create('learning_course_modules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_version_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('display_order');
            $table->timestampsTz();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->cascadeOnDelete();
            $table->unique(['course_version_id', 'display_order']);
        });

        Schema::create('learning_course_lessons', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('module_id');
            $table->string('title');
            $table->text('objective');
            $table->text('description')->nullable();
            $table->string('content_type');
            $table->longText('text_content')->nullable();
            $table->text('external_url')->nullable();
            $table->unsignedInteger('estimated_minutes')->default(5);
            $table->boolean('is_required')->default(true);
            $table->unsignedInteger('display_order');
            $table->timestampsTz();
            $table->foreign('module_id')->references('id')->on('learning_course_modules')->cascadeOnDelete();
            $table->unique(['module_id', 'display_order']);
        });

        Schema::create('learning_materials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('lesson_id');
            $table->string('storage_disk')->default('local');
            $table->string('storage_path');
            $table->string('display_name');
            $table->string('stored_name');
            $table->string('mime_type');
            $table->string('extension', 16);
            $table->unsignedBigInteger('size_bytes');
            $table->string('sha256', 64);
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('revoked_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->uuid('replaces_material_id')->nullable()->index();
            $table->timestampsTz();
            $table->foreign('lesson_id')->references('id')->on('learning_course_lessons')->cascadeOnDelete();
        });

        Schema::create('learning_assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_version_id');
            $table->uuid('module_id')->nullable();
            $table->string('assessment_type');
            $table->string('title');
            $table->boolean('is_required')->default(true);
            $table->unsignedSmallInteger('passing_score')->default(80);
            $table->unsignedSmallInteger('attempts_allowed')->default(3);
            $table->boolean('shuffle_questions')->default(false);
            $table->boolean('shuffle_options')->default(false);
            $table->string('feedback_policy')->default('After submission');
            $table->timestampsTz();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->cascadeOnDelete();
            $table->foreign('module_id')->references('id')->on('learning_course_modules')->cascadeOnDelete();
        });

        Schema::create('learning_assessment_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('assessment_id');
            $table->string('question_type');
            $table->text('question_text');
            $table->text('explanation')->nullable();
            $table->unsignedSmallInteger('points')->default(1);
            $table->unsignedInteger('display_order');
            $table->timestampsTz();
            $table->foreign('assessment_id')->references('id')->on('learning_assessments')->cascadeOnDelete();
            $table->unique(['assessment_id', 'display_order']);
        });

        Schema::create('learning_answer_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('question_id');
            $table->text('option_text');
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('display_order');
            $table->timestampsTz();
            $table->foreign('question_id')->references('id')->on('learning_assessment_questions')->cascadeOnDelete();
            $table->unique(['question_id', 'display_order']);
        });

        Schema::create('learning_review_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_version_id');
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->restrictOnDelete();
            $table->string('status')->default('Pending');
            $table->text('decision_comment')->nullable();
            $table->timestampTz('requested_at');
            $table->timestampTz('decided_at')->nullable();
            $table->timestampsTz();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->cascadeOnDelete();
        });

        Schema::create('learning_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source_recommendation_id')->unique();
            $table->string('personnel_key')->index();
            $table->string('source_assessment_id');
            $table->unsignedInteger('source_assessment_version');
            $table->string('competency_id');
            $table->unsignedInteger('competency_version');
            $table->string('competency_name');
            $table->unsignedSmallInteger('required_level');
            $table->unsignedSmallInteger('validated_level');
            $table->string('recommendation_title');
            $table->text('recommendation_note');
            $table->date('target_reassessment_date')->nullable();
            $table->string('recommended_by_name');
            $table->timestampTz('requested_at');
            $table->string('status')->default('Pending')->index();
            $table->uuid('linked_course_id')->nullable()->index();
            $table->uuid('linked_course_version_id')->nullable()->index();
            $table->uuid('assignment_id')->nullable()->index();
            $table->text('action_reason')->nullable();
            $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('acted_at')->nullable();
            $table->timestampsTz();
        });

        Schema::create('learning_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('learner_id')->constrained('users')->restrictOnDelete();
            $table->uuid('course_id');
            $table->uuid('course_version_id');
            $table->string('source')->index();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('assigned_at');
            $table->timestampTz('available_from')->nullable();
            $table->timestampTz('due_at')->nullable()->index();
            $table->boolean('is_mandatory')->default(true);
            $table->string('priority')->default('Normal');
            $table->text('reason')->nullable();
            $table->string('status')->default('Not Started')->index();
            $table->unsignedSmallInteger('progress_percent')->default(0);
            $table->uuid('migrated_from_assignment_id')->nullable()->index();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestampsTz();
            $table->foreign('course_id')->references('id')->on('learning_courses')->restrictOnDelete();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->restrictOnDelete();
        });

        Schema::create('learning_lesson_progress', function (Blueprint $table) {
            $table->id();
            $table->uuid('assignment_id');
            $table->uuid('lesson_id');
            $table->string('status')->default('Not Started');
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->unsignedInteger('time_spent_seconds')->default(0);
            $table->timestampTz('last_activity_at')->nullable();
            $table->timestampsTz();
            $table->foreign('assignment_id')->references('id')->on('learning_assignments')->cascadeOnDelete();
            $table->foreign('lesson_id')->references('id')->on('learning_course_lessons')->restrictOnDelete();
            $table->unique(['assignment_id', 'lesson_id']);
        });

        Schema::create('learning_assessment_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('assignment_id');
            $table->uuid('assessment_id');
            $table->unsignedSmallInteger('attempt_number');
            $table->string('status')->default('In Progress');
            $table->json('question_snapshot');
            $table->decimal('score_percent', 5, 2)->nullable();
            $table->boolean('passed')->nullable();
            $table->timestampTz('started_at');
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampsTz();
            $table->foreign('assignment_id')->references('id')->on('learning_assignments')->cascadeOnDelete();
            $table->foreign('assessment_id')->references('id')->on('learning_assessments')->restrictOnDelete();
            $table->unique(['assignment_id', 'assessment_id', 'attempt_number']);
        });

        Schema::create('learning_attempt_responses', function (Blueprint $table) {
            $table->id();
            $table->uuid('attempt_id');
            $table->uuid('question_id');
            $table->json('selected_option_ids')->default('[]');
            $table->boolean('is_correct')->nullable();
            $table->decimal('points_awarded', 8, 2)->nullable();
            $table->timestampsTz();
            $table->foreign('attempt_id')->references('id')->on('learning_assessment_attempts')->cascadeOnDelete();
            $table->unique(['attempt_id', 'question_id']);
        });

        Schema::create('learning_completions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('assignment_id')->unique();
            $table->foreignId('learner_id')->constrained('users')->restrictOnDelete();
            $table->uuid('course_id');
            $table->uuid('course_version_id');
            $table->timestampTz('completed_at');
            $table->json('rules_satisfied');
            $table->decimal('assessment_score', 5, 2)->nullable();
            $table->string('completion_basis');
            $table->string('source_context')->default('Online Learning');
            $table->timestampsTz();
            $table->foreign('assignment_id')->references('id')->on('learning_assignments')->restrictOnDelete();
            $table->foreign('course_id')->references('id')->on('learning_courses')->restrictOnDelete();
            $table->foreign('course_version_id')->references('id')->on('learning_course_versions')->restrictOnDelete();
        });

        Schema::create('learning_certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('completion_id');
            $table->string('certificate_number')->unique();
            $table->date('issued_on');
            $table->date('expires_on')->nullable()->index();
            $table->string('status')->default('Valid')->index();
            $table->timestampTz('revoked_at')->nullable();
            $table->text('revocation_reason')->nullable();
            $table->uuid('replaced_by_certificate_id')->nullable()->index();
            $table->timestampsTz();
            $table->foreign('completion_id')->references('id')->on('learning_completions')->restrictOnDelete();
        });

        Schema::create('learning_transcript_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('learner_id')->constrained('users')->restrictOnDelete();
            $table->uuid('completion_id')->unique();
            $table->uuid('course_id');
            $table->uuid('course_version_id');
            $table->uuid('certificate_id')->nullable()->index();
            $table->timestampTz('recorded_at');
            $table->timestampsTz();
            $table->foreign('completion_id')->references('id')->on('learning_completions')->restrictOnDelete();
        });

        Schema::create('learning_ai_generation_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->uuid('course_version_id')->nullable()->index();
            $table->string('use_case');
            $table->string('model');
            $table->json('grounding_context');
            $table->json('generated_output')->nullable();
            $table->string('status')->index();
            $table->string('human_decision')->nullable();
            $table->json('accepted_output')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestampsTz();
        });

        Schema::create('learning_audit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type')->index();
            $table->string('auditable_type');
            $table->string('auditable_id')->index();
            $table->json('metadata')->default('{}');
            $table->timestampTz('occurred_at')->index();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        foreach ([
            'learning_audit_events', 'learning_ai_generation_events', 'learning_transcript_entries',
            'learning_certificates', 'learning_completions', 'learning_attempt_responses',
            'learning_assessment_attempts', 'learning_lesson_progress', 'learning_assignments',
            'learning_requests', 'learning_review_requests', 'learning_answer_options',
            'learning_assessment_questions', 'learning_assessments', 'learning_materials',
            'learning_course_lessons', 'learning_course_modules', 'learning_course_competencies',
            'learning_course_collaborators', 'learning_course_versions', 'learning_courses',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
