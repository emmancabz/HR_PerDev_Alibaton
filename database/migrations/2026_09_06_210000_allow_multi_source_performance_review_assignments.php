<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // A governed 360° Leadership Review has no single primary evaluator.
        // The assignment still owns the person+cycle uniqueness boundary; the
        // evaluator is intentionally NULL and contributors are stored separately.
        DB::statement('ALTER TABLE performance_review_assignments ALTER COLUMN evaluator_user_id DROP NOT NULL');
        DB::statement('ALTER TABLE performance_review_assignments ALTER COLUMN assigned_by_id DROP NOT NULL');
    }

    public function down(): void
    {
        $assignmentIds = DB::table('performance_review_assignments')
            ->where('basis', '360 Leadership Review')
            ->pluck('id');

        if ($assignmentIds->isNotEmpty()) {
            $reviewIds = DB::table('performance_reviews')
                ->whereIn('performance_review_assignment_id', $assignmentIds)
                ->pluck('id');

            if ($reviewIds->isNotEmpty()) {
                DB::table('performance_review_events')->whereIn('performance_review_id', $reviewIds)->delete();
                DB::table('performance_reviews')->whereIn('id', $reviewIds)->delete();
            }

            DB::table('performance_review_assignments')->whereIn('id', $assignmentIds)->delete();
        }

        // Only system-derived 360° assignments use a NULL assigned_by_id in this migration.
        DB::statement('ALTER TABLE performance_review_assignments ALTER COLUMN assigned_by_id SET NOT NULL');
        DB::statement('ALTER TABLE performance_review_assignments ALTER COLUMN evaluator_user_id SET NOT NULL');
    }
};
