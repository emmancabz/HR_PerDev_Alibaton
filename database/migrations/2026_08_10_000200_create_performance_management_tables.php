<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('performance_review_templates', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->string('name');
            $table->string('person_type')->index();
            $table->string('rating_scale_key');
            $table->json('rating_scale');
            $table->json('criteria');
            $table->boolean('active')->default(true)->index();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
        });
        Schema::create('performance_cycles', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->string('name');
            $table->string('cycle_type')->index();
            $table->date('performance_start_date');
            $table->date('performance_end_date');
            $table->date('review_open_date');
            $table->date('review_due_date');
            $table->json('applicable_person_types');
            $table->json('department_scopes');
            $table->json('review_template_keys');
            $table->boolean('self_evaluation_enabled')->default(false);
            $table->boolean('self_rating_enabled')->default(false);
            $table->boolean('calibration_required')->default(false);
            $table->string('employee_acknowledgment')->default('Optional');
            $table->unsignedSmallInteger('probationary_milestone_months')->nullable();
            $table->string('status')->default('Draft')->index();
            $table->text('description')->nullable();
            $table->text('instructions')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
        });
        Schema::create('performance_goal_templates', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->string('name');
            $table->json('applicable_person_types');
            $table->json('department_scopes');
            $table->json('position_scopes');
            $table->json('cycle_keys');
            $table->text('description')->nullable();
            $table->boolean('allow_individual_overrides')->default(true);
            $table->json('items');
            $table->boolean('active')->default(true)->index();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
        });
        Schema::create('performance_goals', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('performance_cycle_id')->constrained('performance_cycles')->cascadeOnDelete();
            $table->foreignId('performance_goal_template_id')->nullable()
                ->constrained('performance_goal_templates')->nullOnDelete();
            $table->string('template_item_key')->nullable();
            $table->string('title');
            $table->string('metric_type');
            $table->string('target');
            $table->string('unit')->nullable();
            $table->decimal('weight', 5, 2);
            $table->decimal('progress', 5, 2)->default(0);
            $table->string('status')->default('Not Started')->index();
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('individual_override')->default(false);
            $table->text('description')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
            $table->index(['performance_cycle_id', 'user_id']);
        });
        Schema::create('performance_reporting_relationships', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('direct_report_id')->constrained('users')->cascadeOnDelete();
            $table->string('source')->default('Manual');
            $table->boolean('active')->default(true)->index();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['supervisor_id', 'direct_report_id', 'effective_from'], 'performance_reporting_unique');
        });
        Schema::create('performance_review_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->foreignId('performance_cycle_id')->constrained('performance_cycles')->cascadeOnDelete();
            $table->foreignId('subject_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('evaluator_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('reporting_relationship_id')->nullable()
                ->constrained('performance_reporting_relationships')->nullOnDelete();
            $table->string('basis')->default('Cycle Assignment');
            $table->boolean('active')->default(true)->index();
            $table->foreignId('assigned_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('assigned_at')->useCurrent();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
            $table->unique(['performance_cycle_id', 'subject_user_id'], 'one_primary_evaluator_per_cycle');
            $table->index(['evaluator_user_id', 'active']);
        });
        Schema::create('performance_reviews', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->foreignId('performance_review_assignment_id')->unique()
                ->constrained('performance_review_assignments')->cascadeOnDelete();
            $table->foreignId('performance_review_template_id')->nullable()
                ->constrained('performance_review_templates')->nullOnDelete();
            $table->string('status')->default('Pending')->index();
            $table->string('workflow_state')->default('Manager Review')->index();
            $table->string('calibration_status')->default('Not Required')->index();
            $table->decimal('final_rating', 4, 2)->nullable();
            $table->json('criteria_scores')->nullable();
            $table->text('comments')->nullable();
            $table->json('development_recommendations')->nullable();
            $table->json('linked_evidence')->nullable();
            $table->json('self_evaluation')->nullable();
            $table->timestampTz('manager_submitted_at')->nullable();
            $table->timestampTz('finalized_at')->nullable();
            $table->date('due_date')->nullable();
            $table->json('acknowledgment')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
        });
        Schema::create('performance_review_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('performance_review_id')->constrained('performance_reviews')->cascadeOnDelete();
            $table->string('event_type')->index();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('from_evaluator_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_evaluator_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->json('snapshot')->nullable();
            $table->unsignedInteger('revision_version')->nullable();
            $table->timestampTz('occurred_at')->useCurrent();
            $table->timestamps();
            $table->index(['performance_review_id', 'occurred_at']);
        });
        Schema::create('performance_feedback_records', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->foreignId('subject_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('author_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('performance_cycle_id')->nullable()->constrained('performance_cycles')->nullOnDelete();
            $table->foreignId('performance_review_id')->nullable()->constrained('performance_reviews')->nullOnDelete();
            $table->string('record_type');
            $table->text('note');
            $table->text('coaching_action')->nullable();
            $table->json('linked_goal_keys');
            $table->date('follow_up_date')->nullable();
            $table->string('visibility')->default('Employee & Manager')->index();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
        });
        Schema::create('performance_improvement_plans', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->foreignId('subject_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('performance_review_id')->unique()->constrained('performance_reviews')->restrictOnDelete();
            $table->foreignId('assigned_manager_id')->constrained('users')->restrictOnDelete();
            $table->text('performance_concern');
            $table->text('expected_improvement');
            $table->json('action_items');
            $table->date('start_date');
            $table->date('target_end_date');
            $table->string('status')->default('Active')->index();
            $table->json('milestones');
            $table->json('progress_notes');
            $table->json('development_actions');
            $table->text('outcome_notes')->nullable();
            $table->text('hr_review_notes')->nullable();
            $table->foreignId('created_by_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
        });
        Schema::create('performance_trainee_journeys', function (Blueprint $table) {
            $table->id();
            $table->string('external_key')->unique();
            $table->foreignId('trainee_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('performance_cycle_id')->nullable()->constrained('performance_cycles')->nullOnDelete();
            $table->string('current_stage')->index();
            $table->json('milestones');
            $table->json('development_action_keys');
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
            $table->unique(['trainee_user_id', 'performance_cycle_id'], 'one_trainee_journey_per_cycle');
        });
        Schema::create('performance_anonymous_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('evaluator_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('performance_cycle_id')->constrained('performance_cycles')->cascadeOnDelete();
            $table->text('feedback');
            $table->timestampTz('submitted_at')->useCurrent();
            $table->timestamps();
            $table->unique(['subject_user_id', 'evaluator_user_id', 'performance_cycle_id'], 'anonymous_feedback_once_per_cycle');
        });
        Schema::create('performance_ai_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('performance_review_id')->constrained('performance_reviews')->cascadeOnDelete();
            $table->foreignId('requested_by_id')->constrained('users')->restrictOnDelete();
            $table->string('use_case');
            $table->string('model');
            $table->string('context_hash', 64)->index();
            $table->text('response_text');
            $table->timestamps();
            $table->index(['performance_review_id', 'created_at']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('performance_ai_drafts');
        Schema::dropIfExists('performance_anonymous_feedback');
        Schema::dropIfExists('performance_trainee_journeys');
        Schema::dropIfExists('performance_improvement_plans');
        Schema::dropIfExists('performance_feedback_records');
        Schema::dropIfExists('performance_review_events');
        Schema::dropIfExists('performance_reviews');
        Schema::dropIfExists('performance_review_assignments');
        Schema::dropIfExists('performance_reporting_relationships');
        Schema::dropIfExists('performance_goals');
        Schema::dropIfExists('performance_goal_templates');
        Schema::dropIfExists('performance_cycles');
        Schema::dropIfExists('performance_review_templates');
    }
};