<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_feedback', function (Blueprint $table): void {
            $table->unsignedSmallInteger('knowledge_rating')->nullable();
            $table->unsignedSmallInteger('clarity_rating')->nullable();
            $table->unsignedSmallInteger('communication_rating')->nullable();
            $table->unsignedSmallInteger('engagement_rating')->nullable();
            $table->unsignedSmallInteger('professionalism_rating')->nullable();
            $table->unsignedSmallInteger('practical_relevance_rating')->nullable();
            $table->unsignedSmallInteger('time_management_rating')->nullable();
            $table->unsignedSmallInteger('safety_emphasis_rating')->nullable();
            $table->text('trainer_strengths')->nullable();
            $table->text('trainer_improvements')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('training_feedback', function (Blueprint $table): void {
            $table->dropColumn([
                'knowledge_rating',
                'clarity_rating',
                'communication_rating',
                'engagement_rating',
                'professionalism_rating',
                'practical_relevance_rating',
                'time_management_rating',
                'safety_emphasis_rating',
                'trainer_strengths',
                'trainer_improvements',
            ]);
        });
    }
};
