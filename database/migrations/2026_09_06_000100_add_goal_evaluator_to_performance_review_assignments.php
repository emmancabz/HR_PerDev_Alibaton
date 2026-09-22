<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('performance_review_assignments')) {
            return;
        }

        if (! Schema::hasColumn('performance_review_assignments', 'goal_evaluator_user_id')) {
            Schema::table('performance_review_assignments', function (Blueprint $table): void {
                $table->foreignId('goal_evaluator_user_id')
                    ->nullable()
                    ->after('evaluator_user_id')
                    ->constrained('users')
                    ->restrictOnDelete();
                $table->index(['goal_evaluator_user_id', 'active'], 'performance_goal_evaluator_active_idx');
            });
        }

        // Existing cycle assignments begin with the same authority for Goals/KPIs and the formal review.
        // Future review-only exceptions can then move only evaluator_user_id while preserving this value.
        DB::table('performance_review_assignments')
            ->whereNull('goal_evaluator_user_id')
            ->update(['goal_evaluator_user_id' => DB::raw('evaluator_user_id')]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('performance_review_assignments') || ! Schema::hasColumn('performance_review_assignments', 'goal_evaluator_user_id')) {
            return;
        }

        Schema::table('performance_review_assignments', function (Blueprint $table): void {
            $table->dropIndex('performance_goal_evaluator_active_idx');
            $table->dropConstrainedForeignId('goal_evaluator_user_id');
        });
    }
};
