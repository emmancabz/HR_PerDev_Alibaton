<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('training_programs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->string('title');
            $table->text('description');
            $table->string('category')->index();
            $table->string('delivery_type')->index();
            $table->string('status')->default('Draft')->index();
            $table->json('objectives')->default('[]');
            $table->json('audience_rules')->default('{}');
            $table->json('completion_rules')->default('{}');
            $table->uuid('related_learning_course_id')->nullable()->index();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestampsTz();
            $table->foreign('related_learning_course_id')->references('id')->on('learning_courses')->nullOnDelete();
        });

        Schema::create('training_program_competencies', function (Blueprint $table) {
            $table->id();
            $table->uuid('program_id');
            $table->string('competency_id');
            $table->unsignedInteger('competency_version');
            $table->string('competency_code');
            $table->string('competency_name');
            $table->unsignedSmallInteger('target_level');
            $table->string('purpose')->nullable();
            $table->timestampsTz();
            $table->foreign('program_id')->references('id')->on('training_programs')->cascadeOnDelete();
            $table->unique(['program_id', 'competency_id']);
        });

        Schema::create('training_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('program_id');
            $table->string('label');
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('venue');
            $table->unsignedInteger('capacity');
            $table->foreignId('facilitator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('external_facilitator_name')->nullable();
            $table->timestampTz('enrollment_closes_at')->nullable();
            $table->string('status')->default('Draft')->index();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('attendance_finalized_at')->nullable();
            $table->foreignId('attendance_finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestampsTz();
            $table->foreign('program_id')->references('id')->on('training_programs')->cascadeOnDelete();
            $table->unique(['program_id', 'label']);
            $table->index(['facilitator_id', 'starts_at', 'ends_at']);
        });

        Schema::create('training_enrollments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('program_id');
            $table->foreignId('participant_id')->constrained('users')->restrictOnDelete();
            $table->string('source')->default('HR Assignment')->index();
            $table->string('status')->default('Assigned')->index();
            $table->json('personnel_snapshot');
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('assigned_at');
            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampTz('withdrawn_at')->nullable();
            $table->text('withdrawal_reason')->nullable();
            $table->timestampsTz();
            $table->foreign('program_id')->references('id')->on('training_programs')->cascadeOnDelete();
            $table->unique(['program_id', 'participant_id']);
        });

        Schema::create('training_session_participants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->uuid('enrollment_id');
            $table->string('status')->default('Assigned')->index();
            $table->timestampsTz();
            $table->foreign('session_id')->references('id')->on('training_sessions')->cascadeOnDelete();
            $table->foreign('enrollment_id')->references('id')->on('training_enrollments')->cascadeOnDelete();
            $table->unique(['session_id', 'enrollment_id']);
        });

        Schema::create('training_attendance_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_participant_id')->unique();
            $table->string('workforce_sync_status')->default('Not Connected')->index();
            $table->string('workforce_external_id')->nullable()->index();
            $table->json('workforce_snapshot')->default('{}');
            $table->text('workforce_sync_error')->nullable();
            $table->timestampTz('workforce_synced_at')->nullable();
            $table->string('training_status')->default('Pending')->index();
            $table->string('recording_source')->default('Manual');
            $table->text('note')->nullable();
            $table->foreignId('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('marked_at')->nullable();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('finalized_at')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestampsTz();
            $table->foreign('session_participant_id')->references('id')->on('training_session_participants')->cascadeOnDelete();
        });

        Schema::create('training_assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('enrollment_id')->unique();
            $table->string('result')->default('Pending')->index();
            $table->decimal('score', 7, 2)->nullable();
            $table->decimal('maximum_score', 7, 2)->nullable();
            $table->json('checklist')->default('[]');
            $table->text('notes')->nullable();
            $table->foreignId('assessed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('assessed_at')->nullable();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('finalized_at')->nullable();
            $table->timestampsTz();
            $table->foreign('enrollment_id')->references('id')->on('training_enrollments')->cascadeOnDelete();
        });

        Schema::create('training_feedback', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->foreignId('participant_id')->constrained('users')->restrictOnDelete();
            $table->unsignedSmallInteger('content_rating');
            $table->unsignedSmallInteger('facilitator_rating');
            $table->unsignedSmallInteger('relevance_rating');
            $table->unsignedSmallInteger('organization_rating');
            $table->unsignedSmallInteger('overall_satisfaction');
            $table->text('comments')->nullable();
            $table->timestampTz('submitted_at');
            $table->timestampsTz();
            $table->foreign('session_id')->references('id')->on('training_sessions')->cascadeOnDelete();
            $table->unique(['session_id', 'participant_id']);
        });

        Schema::create('training_completions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('enrollment_id')->unique();
            $table->string('status')->index();
            $table->decimal('attendance_rate', 5, 2);
            $table->json('attendance_snapshot');
            $table->json('assessment_snapshot');
            $table->json('program_snapshot');
            $table->json('personnel_snapshot');
            $table->text('finalization_note')->nullable();
            $table->foreignId('finalized_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('finalized_at');
            $table->timestampsTz();
            $table->foreign('enrollment_id')->references('id')->on('training_enrollments')->restrictOnDelete();
        });

        Schema::create('training_certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('completion_id')->unique();
            $table->string('certificate_number')->unique();
            $table->string('status')->default('Active')->index();
            $table->timestampTz('issued_at');
            $table->timestampTz('expires_at')->nullable()->index();
            $table->timestampTz('revoked_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('revocation_reason')->nullable();
            $table->timestampsTz();
            $table->foreign('completion_id')->references('id')->on('training_completions')->restrictOnDelete();
        });
        Schema::create('training_recommendations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source_recommendation_id')->unique();
            $table->string('source_module')->index();
            $table->string('personnel_key')->index();
            $table->string('development_need');
            $table->text('reason');
            $table->json('source_snapshot')->default('{}');
            $table->string('status')->default('Pending')->index();
            $table->uuid('linked_program_id')->nullable()->index();
            $table->uuid('linked_session_id')->nullable()->index();
            $table->uuid('linked_enrollment_id')->nullable()->index();
            $table->text('action_reason')->nullable();
            $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('acted_at')->nullable();
            $table->timestampsTz();
            $table->foreign('linked_program_id')->references('id')->on('training_programs')->nullOnDelete();
            $table->foreign('linked_session_id')->references('id')->on('training_sessions')->nullOnDelete();
            $table->foreign('linked_enrollment_id')->references('id')->on('training_enrollments')->nullOnDelete();
        });

        Schema::create('training_audit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('event_type')->index();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('subject_type');
            $table->string('subject_id')->index();
            $table->json('metadata')->default('{}');
            $table->timestampTz('occurred_at')->index();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('training_audit_events');
        Schema::dropIfExists('training_recommendations');
        Schema::dropIfExists('training_certificates');
        Schema::dropIfExists('training_completions');
        Schema::dropIfExists('training_feedback');
        Schema::dropIfExists('training_assessments');
        Schema::dropIfExists('training_attendance_records');
        Schema::dropIfExists('training_session_participants');
        Schema::dropIfExists('training_enrollments');
        Schema::dropIfExists('training_sessions');
        Schema::dropIfExists('training_program_competencies');
        Schema::dropIfExists('training_programs');
    }
};
