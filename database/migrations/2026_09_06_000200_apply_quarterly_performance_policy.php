<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('performance_cycles')) {
            return;
        }

        $quarterDefaults = [
            'cycle_type' => 'Quarterly',
            'applicable_person_types' => json_encode(['Employee', 'Trainee'], JSON_THROW_ON_ERROR),
            'department_scopes' => json_encode([], JSON_THROW_ON_ERROR),
            'review_template_keys' => json_encode([
                'Employee' => 'review-template-employee-standard',
                'Trainee' => 'review-template-trainee-standard',
            ], JSON_THROW_ON_ERROR),
            'self_evaluation_enabled' => true,
            'self_rating_enabled' => true,
            'calibration_required' => true,
            'employee_acknowledgment' => 'Required',
            'probationary_milestone_months' => null,
            'instructions' => 'Use agreed Goals/KPIs and documented workplace evidence. Missing evidence must remain unscored rather than being treated as zero.',
        ];

        $quarters = [
            'period-q1-2026' => [
                'name' => 'Q1 2026 Performance Cycle',
                'performance_start_date' => '2026-01-01',
                'performance_end_date' => '2026-03-31',
                'review_open_date' => '2026-04-01',
                'review_due_date' => '2026-04-15',
                'status' => 'Closed',
            ],
            'period-q2-2026' => [
                'name' => 'Q2 2026 Performance Cycle',
                'performance_start_date' => '2026-04-01',
                'performance_end_date' => '2026-06-30',
                'review_open_date' => '2026-07-01',
                'review_due_date' => '2026-07-15',
                'status' => 'Closed',
            ],
            'period-q3-2026' => [
                'name' => 'Q3 2026 Performance Cycle',
                'performance_start_date' => '2026-07-01',
                'performance_end_date' => '2026-09-30',
                'review_open_date' => '2026-10-01',
                'review_due_date' => '2026-10-15',
                'status' => 'Active',
            ],
            'period-q4-2026' => [
                'name' => 'Q4 2026 Performance Cycle',
                'performance_start_date' => '2026-10-01',
                'performance_end_date' => '2026-12-31',
                'review_open_date' => '2027-01-01',
                'review_due_date' => '2027-01-15',
                'status' => 'Draft',
            ],
        ];

        foreach ($quarters as $externalKey => $quarter) {
            $existing = DB::table('performance_cycles')->where('external_key', $externalKey)->first();

            DB::table('performance_cycles')->updateOrInsert(
                ['external_key' => $externalKey],
                $quarter + $quarterDefaults + [
                    'description' => 'System-generated quarterly Performance cycle governed by ALB-PND-POL-014.',
                    'lock_version' => $existing ? ((int) $existing->lock_version + 1) : 1,
                    'created_at' => $existing->created_at ?? now(),
                    'updated_at' => now(),
                ],
            );
        }

        if (now(config('app.timezone'))->toDateString() < '2026-10-01') {
            $prematureSeedKeys = [
                'eval-1',
                'eval-3',
                'eval-6',
                'eval-q3-luis',
                'eval-q3-sofia',
                'eval-q3-nina',
                'eval-q3-isabella',
            ];
            $reviewIds = DB::table('performance_reviews')
                ->whereIn('external_key', $prematureSeedKeys)
                ->pluck('id');

            if ($reviewIds->isNotEmpty()) {
                DB::table('performance_review_events')->whereIn('performance_review_id', $reviewIds)->delete();
                DB::table('performance_reviews')->whereIn('id', $reviewIds)->update([
                    'status' => 'Pending',
                    'workflow_state' => 'Manager Review',
                    'calibration_status' => 'Pending',
                    'final_rating' => null,
                    'criteria_scores' => null,
                    'comments' => null,
                    'development_recommendations' => json_encode([], JSON_THROW_ON_ERROR),
                    'self_evaluation' => null,
                    'manager_submitted_at' => null,
                    'finalized_at' => null,
                    'acknowledgment' => null,
                    'due_date' => '2026-10-15',
                    'lock_version' => DB::raw('lock_version + 1'),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('performance_cycles')) {
            return;
        }

        DB::table('performance_cycles')->whereIn('external_key', ['period-q1-2026', 'period-q4-2026'])->delete();

        DB::table('performance_cycles')->where('external_key', 'period-q2-2026')->update([
            'name' => 'Q2 2026 Performance Cycle',
            'cycle_type' => 'Quarterly',
            'performance_start_date' => '2026-04-01',
            'performance_end_date' => '2026-06-30',
            'review_open_date' => '2026-07-01',
            'review_due_date' => '2026-07-15',
            'self_evaluation_enabled' => false,
            'self_rating_enabled' => false,
            'calibration_required' => false,
            'employee_acknowledgment' => 'Optional',
            'status' => 'Closed',
            'description' => 'Closed historical quarterly cycle retained for trend and comparison reporting.',
            'updated_at' => now(),
        ]);

        DB::table('performance_cycles')->where('external_key', 'period-q3-2026')->update([
            'name' => 'July–August 2026 Performance Review',
            'cycle_type' => 'Custom',
            'performance_start_date' => '2026-07-01',
            'performance_end_date' => '2026-08-15',
            'review_open_date' => '2026-08-16',
            'review_due_date' => '2026-08-31',
            'self_evaluation_enabled' => true,
            'self_rating_enabled' => true,
            'calibration_required' => true,
            'employee_acknowledgment' => 'Required',
            'status' => 'Active',
            'description' => 'Current organization-wide review window for work completed from July 1 through August 15, 2026.',
            'updated_at' => now(),
        ]);
    }
};
