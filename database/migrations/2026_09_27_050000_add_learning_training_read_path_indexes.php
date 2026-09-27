<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ([
            'CREATE INDEX IF NOT EXISTS learning_collaborators_user_course_idx ON learning_course_collaborators (user_id, course_id)',
            'CREATE INDEX IF NOT EXISTS learning_assignments_learner_assigned_idx ON learning_assignments (learner_id, assigned_at)',
            'CREATE INDEX IF NOT EXISTS learning_completions_learner_completed_idx ON learning_completions (learner_id, completed_at)',
            'CREATE INDEX IF NOT EXISTS learning_requests_personnel_status_requested_idx ON learning_requests (personnel_key, status, requested_at)',
            'CREATE INDEX IF NOT EXISTS training_enrollments_participant_assigned_idx ON training_enrollments (participant_id, assigned_at)',
            'CREATE INDEX IF NOT EXISTS training_session_participants_enrollment_session_idx ON training_session_participants (enrollment_id, session_id)',
            'CREATE INDEX IF NOT EXISTS training_feedback_participant_session_idx ON training_feedback (participant_id, session_id)',
            'CREATE INDEX IF NOT EXISTS training_sessions_status_starts_idx ON training_sessions (status, starts_at)',
            'CREATE INDEX IF NOT EXISTS training_sessions_status_ends_idx ON training_sessions (status, ends_at)',
            'CREATE INDEX IF NOT EXISTS training_recommendations_status_created_idx ON training_recommendations (status, created_at)',
        ] as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ([
            'learning_collaborators_user_course_idx',
            'learning_assignments_learner_assigned_idx',
            'learning_completions_learner_completed_idx',
            'learning_requests_personnel_status_requested_idx',
            'training_enrollments_participant_assigned_idx',
            'training_session_participants_enrollment_session_idx',
            'training_feedback_participant_session_idx',
            'training_sessions_status_starts_idx',
            'training_sessions_status_ends_idx',
            'training_recommendations_status_created_idx',
        ] as $index) {
            DB::statement('DROP INDEX IF EXISTS '.$index);
        }
    }
};
