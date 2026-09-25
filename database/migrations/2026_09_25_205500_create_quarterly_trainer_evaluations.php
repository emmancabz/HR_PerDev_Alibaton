<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('training_trainer_evaluations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('participant_id')->constrained('users')->restrictOnDelete();
            $table->string('quarter_key', 16);
            $table->string('trainer_key', 255);
            $table->foreignId('trainer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('trainer_name');
            $table->json('covered_session_ids');
            $table->json('covered_training_titles');

            $table->unsignedSmallInteger('knowledge_rating');
            $table->unsignedSmallInteger('clarity_rating');
            $table->unsignedSmallInteger('communication_rating');
            $table->unsignedSmallInteger('engagement_rating');
            $table->unsignedSmallInteger('professionalism_rating');
            $table->unsignedSmallInteger('practical_relevance_rating');
            $table->unsignedSmallInteger('time_management_rating');
            $table->unsignedSmallInteger('safety_emphasis_rating')->nullable();
            $table->unsignedSmallInteger('facilitator_rating');

            $table->unsignedSmallInteger('content_rating');
            $table->unsignedSmallInteger('relevance_rating');
            $table->unsignedSmallInteger('organization_rating');
            $table->unsignedSmallInteger('overall_satisfaction');

            $table->text('trainer_strengths')->nullable();
            $table->text('trainer_improvements')->nullable();
            $table->text('comments')->nullable();
            $table->timestampTz('submitted_at');
            $table->timestampsTz();

            $table->unique(
                ['participant_id', 'quarter_key', 'trainer_key'],
                'training_trainer_eval_participant_quarter_trainer_unique',
            );
            $table->index(['quarter_key', 'trainer_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('training_trainer_evaluations');
    }
};
