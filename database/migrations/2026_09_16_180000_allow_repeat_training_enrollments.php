<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table): void {
            $table->dropUnique('training_enrollments_program_id_participant_id_unique');
            $table->index(['program_id', 'participant_id'], 'training_enrollments_program_participant_index');
        });
    }

    public function down(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table): void {
            $table->dropIndex('training_enrollments_program_participant_index');
            $table->unique(['program_id', 'participant_id']);
        });
    }
};
