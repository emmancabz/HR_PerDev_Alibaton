<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('succession_critical_positions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('position_title');
            $table->string('department')->index();
            $table->string('criticality')->index();
            $table->foreignId('incumbent_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('Draft')->index();
            $table->text('business_impact');
            $table->text('vacancy_risk')->nullable();
            $table->unsignedSmallInteger('review_cycle_months')->default(6);
            $table->timestampTz('next_review_at')->nullable()->index();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();
            $table->unique(['position_title', 'department']);
        });

        Schema::create('succession_success_profile_requirements', function (Blueprint $table) {
            $table->id();
            $table->uuid('critical_position_id');
            $table->string('requirement_type')->index();
            $table->string('source_key')->nullable();
            $table->string('source_version')->nullable();
            $table->string('label');
            $table->unsignedSmallInteger('target_level')->nullable();
            $table->boolean('required')->default(true);
            $table->json('source_snapshot')->default('{}');
            $table->timestampsTz();
            $table->foreign('critical_position_id')->references('id')->on('succession_critical_positions')->cascadeOnDelete();
            $table->unique(['critical_position_id', 'requirement_type', 'label']);
        });

        Schema::create('succession_candidates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('critical_position_id');
            $table->foreignId('candidate_id')->constrained('users')->restrictOnDelete();
            $table->string('status')->default('Proposed')->index();
            $table->string('nomination_source')->index();
            $table->text('nomination_rationale');
            $table->json('personnel_snapshot');
            $table->foreignId('nominated_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('nominated_at');
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('decided_at')->nullable();
            $table->text('decision_reason')->nullable();
            $table->timestampsTz();
            $table->foreign('critical_position_id')->references('id')->on('succession_critical_positions')->cascadeOnDelete();
            $table->unique(['critical_position_id', 'candidate_id']);
        });

        Schema::create('succession_readiness_assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('succession_candidate_id');
            $table->uuid('supersedes_id')->nullable()->index();
            $table->unsignedInteger('version');
            $table->string('status')->default('Draft')->index();
            $table->string('readiness_band')->nullable()->index();
            $table->json('performance_snapshot')->default('{}');
            $table->json('competency_snapshot')->default('{}');
            $table->json('learning_snapshot')->default('{}');
            $table->json('training_snapshot')->default('{}');
            $table->json('requirement_snapshot')->default('[]');
            $table->json('development_needs')->default('[]');
            $table->json('risk_flags')->default('[]');
            $table->text('reviewer_summary')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('finalized_at')->nullable();
            $table->timestampsTz();
            $table->foreign('succession_candidate_id')->references('id')->on('succession_candidates')->cascadeOnDelete();
            $table->unique(['succession_candidate_id', 'version']);
        });

        Schema::create('succession_development_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('succession_candidate_id');
            $table->uuid('readiness_assessment_id')->nullable();
            $table->string('status')->default('Draft')->index();
            $table->string('title');
            $table->text('objective');
            $table->date('starts_on')->nullable();
            $table->date('target_date')->nullable()->index();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->text('transition_reason')->nullable();
            $table->timestampsTz();
            $table->foreign('succession_candidate_id')->references('id')->on('succession_candidates')->cascadeOnDelete();
            $table->foreign('readiness_assessment_id')->references('id')->on('succession_readiness_assessments')->nullOnDelete();
        });

        Schema::create('succession_development_actions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('development_plan_id');
            $table->string('action_type')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('source_module')->nullable()->index();
            $table->string('source_record_id')->nullable()->index();
            $table->string('status')->default('Planned')->index();
            $table->date('due_on')->nullable()->index();
            $table->timestampTz('completed_at')->nullable();
            $table->json('evidence_snapshot')->default('{}');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestampsTz();
            $table->foreign('development_plan_id')->references('id')->on('succession_development_plans')->cascadeOnDelete();
        });

        Schema::create('succession_evidence_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source_module')->index();
            $table->string('source_record_id');
            $table->string('personnel_key')->index();
            $table->timestampTz('source_finalized_at');
            $table->json('source_snapshot');
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('received_at');
            $table->timestampsTz();
            $table->unique(['source_module', 'source_record_id']);
        });

        Schema::create('succession_audit_events', function (Blueprint $table) {
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
        Schema::dropIfExists('succession_audit_events');
        Schema::dropIfExists('succession_evidence_records');
        Schema::dropIfExists('succession_development_actions');
        Schema::dropIfExists('succession_development_plans');
        Schema::dropIfExists('succession_readiness_assessments');
        Schema::dropIfExists('succession_candidates');
        Schema::dropIfExists('succession_success_profile_requirements');
        Schema::dropIfExists('succession_critical_positions');
    }
};
