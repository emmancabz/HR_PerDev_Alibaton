<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_profile_photos')) {
            Schema::create('user_profile_photos', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->longText('photo_data');
                $table->string('mime_type', 80);
                $table->timestampsTz();
            });
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Keep this migration retry-safe and only add indexes that match the
        // canonical schema. performance_reviews does not directly store cycle,
        // subject, or evaluator columns; those live on review assignments.
        foreach ([
            'CREATE INDEX IF NOT EXISTS pd_assignments_cycle_active_idx ON performance_review_assignments (performance_cycle_id, active)',
            'CREATE INDEX IF NOT EXISTS pd_relationships_supervisor_active_idx ON performance_reporting_relationships (supervisor_id, active)',
            'CREATE INDEX IF NOT EXISTS pd_relationships_report_active_idx ON performance_reporting_relationships (direct_report_id, active)',
            'CREATE INDEX IF NOT EXISTS pd_reviews_finalized_idx ON performance_reviews (finalized_at) WHERE finalized_at IS NOT NULL',
            'CREATE INDEX IF NOT EXISTS pd_reviews_status_updated_idx ON performance_reviews (status, updated_at DESC)',
            'CREATE INDEX IF NOT EXISTS users_department_status_idx ON users (department, employment_status)',
        ] as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach ([
                'pd_assignments_cycle_active_idx',
                'pd_relationships_supervisor_active_idx',
                'pd_relationships_report_active_idx',
                'pd_reviews_finalized_idx',
                'pd_reviews_status_updated_idx',
                'users_department_status_idx',
            ] as $index) {
                DB::statement('DROP INDEX IF EXISTS '.$index);
            }
        }

        Schema::dropIfExists('user_profile_photos');
    }
};
