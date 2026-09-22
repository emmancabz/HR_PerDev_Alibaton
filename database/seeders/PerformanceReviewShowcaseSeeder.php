<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PerformanceReviewShowcaseSeeder extends Seeder
{
    /**
     * Keep the demo timeline policy-correct as of 2026-09-06:
     * - Q1 and Q2 are finalized historical quarters with complete Formal Evaluation data.
     * - Q3 is the current performance period, so every routine formal review remains Scheduled
     *   until the October 1 review window opens.
     *
     * The seeder reuses the personnel/evaluator relationships already present in the Q3
     * review register. It does not create extra personnel.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $this->ensureFunctionReviewTemplates();
            $q1 = $this->ensureHistoricalCycle(
                'period-q1-2026',
                'Q1 2026 Performance Cycle',
                '2026-01-01',
                '2026-03-31',
                '2026-04-01',
                '2026-04-15'
            );
            $q2 = $this->ensureHistoricalCycle(
                'period-q2-2026',
                'Q2 2026 Performance Cycle',
                '2026-04-01',
                '2026-06-30',
                '2026-07-01',
                '2026-07-15'
            );
            $q3 = DB::table('performance_cycles')->where('external_key', 'period-q3-2026')->first();
            if (! $q3) {
                throw new \RuntimeException('Q3 2026 Performance Cycle is missing.');
            }

            $sourceRows = DB::table('performance_review_assignments as assignments')
                ->join('performance_reviews as reviews', 'reviews.performance_review_assignment_id', '=', 'assignments.id')
                ->join('users as subjects', 'subjects.id', '=', 'assignments.subject_user_id')
                ->where('assignments.performance_cycle_id', $q3->id)
                ->orderBy('subjects.name')
                ->get([
                    'assignments.id as q3_assignment_id',
                    'assignments.subject_user_id as subject_id',
                    'assignments.evaluator_user_id as evaluator_id',
                    'assignments.reporting_relationship_id',
                    'assignments.basis',
                    'assignments.assigned_by_id',
                    'subjects.personnel_key as subject_key',
                    'subjects.name as subject_name',
                    'subjects.department',
                    'subjects.position',
                    'subjects.person_type',
                    'reviews.id as q3_review_id',
                ]);

            if ($sourceRows->count() < 1) {
                throw new \RuntimeException('No Q3 review assignments are available to build historical review coverage.');
            }

            // Q3 is still in its Jul-Sep performance period on 2026-09-06.
            // Routine formal reviews therefore remain Scheduled and unrated.
            foreach ($sourceRows as $row) {
                $template = $this->resolveTemplate($row);
                DB::table('performance_reviews')->where('id', $row->q3_review_id)->update([
                    'external_key' => "review-period-q3-2026-{$row->subject_key}",
                    'performance_review_template_id' => $template->id,
                    'status' => 'Pending',
                    'workflow_state' => 'Scheduled',
                    'calibration_status' => 'Pending',
                    'final_rating' => null,
                    'criteria_scores' => null,
                    'comments' => null,
                    'development_recommendations' => json_encode([], JSON_THROW_ON_ERROR),
                    'manager_submitted_at' => null,
                    'finalized_at' => null,
                    'acknowledgment' => null,
                    'due_date' => $q3->review_due_date,
                    'lock_version' => DB::raw('lock_version + 1'),
                    'updated_at' => now(),
                ]);
            }

            $this->seedHistoricalCycle($q1, $sourceRows, 1);
            $this->seedHistoricalCycle($q2, $sourceRows, 2);

            $q3Summary = DB::table('performance_reviews as reviews')
                ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                ->where('assignments.performance_cycle_id', $q3->id)
                ->selectRaw('COUNT(*) as total, COUNT(reviews.final_rating) as rated')
                ->first();
            $q1Count = DB::table('performance_review_assignments')->where('performance_cycle_id', $q1->id)->count();
            $q2Count = DB::table('performance_review_assignments')->where('performance_cycle_id', $q2->id)->count();

            if ((int) $q3Summary->rated !== 0) {
                throw new \RuntimeException('Q3 timeline verification failed: Q3 must remain unrated before Oct 1.');
            }

            $this->command?->info('Performance review history aligned to the quarterly policy.');
            $this->command?->line(" - Q1 finalized historical reviews: {$q1Count}");
            $this->command?->line(" - Q2 finalized historical reviews: {$q2Count}");
            $this->command?->line(" - Q3 scheduled reviews: {$q3Summary->total} (rated: {$q3Summary->rated})");
            $this->command?->line(' - Q3 formal review opens: 2026-10-01');
        }, 3);
    }

    private function ensureHistoricalCycle(
        string $key,
        string $name,
        string $performanceStart,
        string $performanceEnd,
        string $reviewOpen,
        string $reviewDue,
    ): object {
        $existing = DB::table('performance_cycles')->where('external_key', $key)->first();
        DB::table('performance_cycles')->updateOrInsert(
            ['external_key' => $key],
            [
                'name' => $name,
                'cycle_type' => 'Quarterly',
                'performance_start_date' => $performanceStart,
                'performance_end_date' => $performanceEnd,
                'review_open_date' => $reviewOpen,
                'review_due_date' => $reviewDue,
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
                'status' => 'Closed',
                'description' => 'Finalized historical quarterly Performance cycle.',
                'instructions' => 'Historical records are read-only except through governed revision.',
                'lock_version' => $existing ? DB::raw('lock_version + 1') : 1,
                'created_at' => $existing->created_at ?? now(),
                'updated_at' => now(),
            ]
        );

        return DB::table('performance_cycles')->where('external_key', $key)->first();
    }

    private function seedHistoricalCycle(object $cycle, $sourceRows, int $quarterOffset): void
    {
        $patterns = [
            [4, 4, 3, 4, 4, 4, 3, 4],
            [5, 4, 4, 5, 4, 5, 4, 4],
            [3, 3, 4, 3, 4, 3, 3, 4],
            [4, 5, 4, 4, 4, 5, 4, 5],
            [3, 4, 3, 4, 3, 4, 3, 3],
            [5, 5, 4, 4, 5, 4, 5, 4],
            [2, 3, 3, 3, 4, 3, 3, 3],
            [4, 4, 5, 4, 5, 4, 4, 5],
        ];

        foreach ($sourceRows as $index => $row) {
            $existingAssignment = DB::table('performance_review_assignments')
                ->where('performance_cycle_id', $cycle->id)
                ->where('subject_user_id', $row->subject_id)
                ->first();

            if ($existingAssignment) {
                $assignmentId = $existingAssignment->id;
            } else {
                $assignmentId = DB::table('performance_review_assignments')->insertGetId([
                    'external_key' => "assignment-{$cycle->external_key}-{$row->subject_key}",
                    'performance_cycle_id' => $cycle->id,
                    'subject_user_id' => $row->subject_id,
                    'evaluator_user_id' => $row->evaluator_id,
                    'reporting_relationship_id' => $row->reporting_relationship_id,
                    'basis' => $row->basis ?: 'Reporting Relationship',
                    'active' => true,
                    'assigned_by_id' => $row->assigned_by_id ?: $row->evaluator_id,
                    'assigned_at' => $cycle->performance_start_date,
                    'lock_version' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $template = $this->resolveTemplate($row);
            $criteria = json_decode((string) $template->criteria, true, 512, JSON_THROW_ON_ERROR);
            $pattern = $patterns[($index + $quarterOffset) % count($patterns)];
            $scores = collect($criteria)->values()->map(
                fn (array $criterion, int $criterionIndex) => [
                    'name' => (string) $criterion['name'],
                    'score' => $pattern[$criterionIndex % count($pattern)],
                ]
            )->all();
            $rating = $this->weightedRating($criteria, $scores);
            $submittedAt = $this->historicalTimestamp($cycle->external_key, $index, false);
            $finalizedAt = $this->historicalTimestamp($cycle->external_key, $index, true);
            $acknowledgedAt = $this->historicalAcknowledgmentTimestamp($cycle->external_key, $index);

            $existingReview = DB::table('performance_reviews')
                ->where('performance_review_assignment_id', $assignmentId)
                ->first();

            DB::table('performance_reviews')->updateOrInsert(
                ['performance_review_assignment_id' => $assignmentId],
                [
                    'external_key' => "review-{$cycle->external_key}-{$row->subject_key}",
                    'performance_review_template_id' => $template->id,
                    'status' => 'Completed',
                    'workflow_state' => 'Finalized',
                    'calibration_status' => 'Approved',
                    'final_rating' => $rating,
                    'criteria_scores' => json_encode($scores, JSON_THROW_ON_ERROR),
                    'comments' => $this->commentFor((string) $row->department, 'Finalized'),
                    'development_recommendations' => json_encode($this->recommendationsFor($rating), JSON_THROW_ON_ERROR),
                    'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
                    'manager_submitted_at' => $submittedAt,
                    'finalized_at' => $finalizedAt,
                    'acknowledgment' => json_encode([
                        'status' => 'Acknowledged',
                        'actorId' => $row->subject_key,
                        'timestamp' => $acknowledgedAt,
                        'statement' => 'Received / Viewed',
                    ], JSON_THROW_ON_ERROR),
                    'due_date' => $cycle->review_due_date,
                    'lock_version' => $existingReview ? DB::raw('lock_version + 1') : 1,
                    'created_at' => $existingReview->created_at ?? now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function resolveTemplate(object $row): object
    {
        $key = $row->person_type === 'Trainee'
            ? 'review-template-trainee-standard'
            : $this->employeeTemplateKey((string) $row->department);

        $template = DB::table('performance_review_templates')
            ->where('external_key', $key)
            ->where('person_type', $row->person_type)
            ->where('active', true)
            ->first();

        if (! $template) {
            $fallback = $row->person_type === 'Trainee'
                ? 'review-template-trainee-standard'
                : 'review-template-employee-standard';

            $template = DB::table('performance_review_templates')
                ->where('external_key', $fallback)
                ->where('person_type', $row->person_type)
                ->where('active', true)
                ->first();
        }

        if (! $template) {
            throw new \RuntimeException("Missing compatible review template for {$row->subject_name}.");
        }

        return $template;
    }

    private function ensureFunctionReviewTemplates(): void
    {
        foreach ($this->functionReviewTemplates() as $template) {
            DB::table('performance_review_templates')->updateOrInsert(
                ['external_key' => $template['id']],
                [
                    'name' => $template['name'],
                    'person_type' => 'Employee',
                    'rating_scale_key' => 'rating-scale-five-point',
                    'rating_scale' => json_encode([
                        'id' => 'rating-scale-five-point',
                        'levels' => [],
                    ], JSON_THROW_ON_ERROR),
                    'criteria' => json_encode($template['criteria'], JSON_THROW_ON_ERROR),
                    'active' => true,
                    'lock_version' => 1,
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }
    }

    private function employeeTemplateKey(string $department): string
    {
        return match ($department) {
            'Crane Operations' => 'review-template-employee-crane-operations',
            'Logistics' => 'review-template-employee-logistics',
            'Operations' => 'review-template-employee-operations',
            'Finance' => 'review-template-employee-finance',
            'Contracts' => 'review-template-employee-contracts',
            'Safety & Compliance' => 'review-template-employee-safety',
            'Administration' => 'review-template-employee-administration',
            'Information Technology' => 'review-template-employee-it',
            'Human Resources' => 'review-template-employee-hr',
            default => 'review-template-employee-standard',
        };
    }

    private function functionReviewTemplates(): array
    {
        $core = [
            ['id' => 'core-goal-achievement', 'name' => 'Goal / KPI Achievement', 'description' => 'Results against the person\'s agreed Goals, KPIs, and KRAs for the same performance cycle.', 'weight' => 25],
            ['id' => 'core-quality', 'name' => 'Quality of Work', 'description' => 'Accuracy, completeness, and standard of work delivered.', 'weight' => 15],
            ['id' => 'core-competency', 'name' => 'Role Competency', 'description' => 'Application of the knowledge and skills required for the role.', 'weight' => 10],
            ['id' => 'core-collaboration', 'name' => 'Communication / Collaboration', 'description' => 'Clear communication and constructive teamwork.', 'weight' => 10],
            ['id' => 'core-reliability', 'name' => 'Reliability / Compliance', 'description' => 'Dependability and adherence to organizational requirements.', 'weight' => 5],
            ['id' => 'core-problem-solving', 'name' => 'Problem Solving', 'description' => 'Sound judgment when analyzing and resolving work issues.', 'weight' => 5],
        ];

        $definitions = [
            'review-template-employee-crane-operations' => ['Crane Operations Employee Review',
                ['id' => 'crane-safe-operation', 'name' => 'Safe Equipment Operation', 'description' => 'Applies equipment and work-zone safety requirements during assigned operations.', 'weight' => 15],
                ['id' => 'crane-rigging-signals', 'name' => 'Rigging / Signal Communication Execution', 'description' => 'Applies approved crane, rigging, and signal communication practices relevant to assigned work.', 'weight' => 15]],
            'review-template-employee-logistics' => ['Logistics Employee Review',
                ['id' => 'logistics-dispatch', 'name' => 'Dispatch & Journey Reliability', 'description' => 'Executes dispatch and journey responsibilities reliably and on time.', 'weight' => 15],
                ['id' => 'logistics-road-safety', 'name' => 'Road Safety & Documentation', 'description' => 'Applies journey, road-safety, and required logistics documentation controls.', 'weight' => 15]],
            'review-template-employee-operations' => ['Operations Employee Review',
                ['id' => 'operations-coordination', 'name' => 'Operational Coordination & Delivery', 'description' => 'Coordinates assigned operational work and delivers agreed outputs.', 'weight' => 15],
                ['id' => 'operations-reporting', 'name' => 'Project / Site Reporting', 'description' => 'Maintains timely and accurate project, site, progress, and handover reporting.', 'weight' => 15]],
            'review-template-employee-finance' => ['Finance Employee Review',
                ['id' => 'finance-accuracy', 'name' => 'Financial Record Accuracy', 'description' => 'Maintains accurate and complete financial records and supporting documentation.', 'weight' => 15],
                ['id' => 'finance-controls', 'name' => 'Disbursement & Documentation Control', 'description' => 'Applies required recordkeeping and disbursement control practices.', 'weight' => 15]],
            'review-template-employee-contracts' => ['Contracts Employee Review',
                ['id' => 'contracts-documentation', 'name' => 'Contract Documentation Accuracy', 'description' => 'Maintains complete and accurate contract documentation.', 'weight' => 15],
                ['id' => 'contracts-compliance', 'name' => 'Compliance & Permit Control', 'description' => 'Tracks required compliance and permit documentation within assigned responsibilities.', 'weight' => 15]],
            'review-template-employee-safety' => ['Safety & Compliance Employee Review',
                ['id' => 'safety-hazard', 'name' => 'Hazard Reporting & Prevention', 'description' => 'Identifies, documents, and escalates hazards using approved safety practices.', 'weight' => 15],
                ['id' => 'safety-procedure', 'name' => 'Safety Procedure Compliance', 'description' => 'Consistently applies applicable safety and work-zone procedures.', 'weight' => 15]],
            'review-template-employee-administration' => ['Administration Employee Review',
                ['id' => 'admin-records', 'name' => 'Records & Document Control', 'description' => 'Maintains controlled records and documents accurately and consistently.', 'weight' => 15],
                ['id' => 'admin-handover', 'name' => 'Operational Handover & Coordination', 'description' => 'Supports reliable work turnover, handover, and internal coordination.', 'weight' => 15]],
            'review-template-employee-it' => ['Information Technology Employee Review',
                ['id' => 'it-access-incidents', 'name' => 'Access Control & Incident Handling', 'description' => 'Applies authorized access-control and service-incident management practices.', 'weight' => 15],
                ['id' => 'it-service', 'name' => 'Service Continuity & Technical Execution', 'description' => 'Delivers reliable technical support and resolves assigned service issues effectively.', 'weight' => 15]],
            'review-template-employee-hr' => ['Human Resources Employee Review',
                ['id' => 'hr-learning-governance', 'name' => 'Learning & Development Governance', 'description' => 'Applies approved employee learning, development, and training governance practices where relevant.', 'weight' => 15],
                ['id' => 'hr-stakeholder', 'name' => 'Employee Support & Stakeholder Coordination', 'description' => 'Handles employee-facing work and stakeholder coordination consistently and professionally.', 'weight' => 15]],
        ];

        $templates = [];
        foreach ($definitions as $id => [$name, $specificA, $specificB]) {
            $templates[] = [
                'id' => $id,
                'name' => $name,
                'criteria' => [...$core, $specificA, $specificB],
            ];
        }

        return $templates;
    }

    private function weightedRating(array $criteria, array $scores): float
    {
        $scoresByName = collect($scores)->keyBy('name');
        $weighted = 0.0;
        $weight = 0.0;

        foreach ($criteria as $criterion) {
            $score = $scoresByName->get($criterion['name']);
            if (! $score) {
                continue;
            }
            $criterionWeight = (float) ($criterion['weight'] ?? 0);
            if ($criterionWeight <= 0) {
                continue;
            }
            $weighted += ((float) $score['score']) * $criterionWeight;
            $weight += $criterionWeight;
        }

        return $weight > 0 ? round($weighted / $weight, 2) : round(collect($scores)->avg('score') ?? 0, 2);
    }

    private function recommendationsFor(?float $rating): array
    {
        if ($rating === null) return [];
        if ($rating < 3.0) return ['Training recommended', 'Further performance review recommended'];
        if ($rating < 3.7) return ['Learning recommended'];
        if ($rating < 4.2) return ['Competency reassessment recommended'];
        return ['No immediate intervention'];
    }

    private function commentFor(string $department, string $workflow): string
    {
        $focus = match ($department) {
            'Crane Operations' => 'equipment handling, execution quality, and safe operating practice',
            'Logistics' => 'dispatch coordination, timeliness, and handoff reliability',
            'Operations' => 'delivery consistency, work quality, and coordination',
            'Finance' => 'record accuracy, reporting timeliness, and control discipline',
            'Contracts' => 'documentation quality, compliance tracking, and turnaround time',
            'Safety & Compliance' => 'hazard awareness, compliance execution, and incident-prevention practice',
            'Administration' => 'service reliability, documentation, and internal coordination',
            'Information Technology' => 'service continuity, issue resolution, and technical execution',
            'Human Resources' => 'case handling, documentation quality, and stakeholder coordination',
            default => 'role delivery, quality, and collaboration',
        };

        return match ($workflow) {
            'Finalized' => "Formal evaluation completed for {$focus}. The evaluator recorded criterion ratings, supporting rationale, and development follow-through.",
            'Calibration Pending' => "All evaluator criterion ratings for {$focus} were submitted and are awaiting calibration.",
            'Calibration In Review' => "The submitted evaluation for {$focus} is under calibration for rating consistency and evidence alignment.",
            'Revision In Progress' => "The evaluation for {$focus} was returned to the evaluator for clarification or revision.",
            default => "The evaluator has started the formal review of {$focus}; several criterion star ratings are saved as a draft.",
        };
    }


    private function historicalTimestamp(string $cycleKey, int $index, bool $finalized): string
    {
        $month = $cycleKey === 'period-q1-2026' ? 4 : 7;
        $baseDay = $finalized ? 5 : 2;
        $day = $baseDay + ($index % ($finalized ? 8 : 7));
        $hour = $finalized ? 15 : 10;
        return sprintf('2026-%02d-%02dT%02d:%02d:00+08:00', $month, $day, $hour, ($index * 7) % 60);
    }

    private function historicalAcknowledgmentTimestamp(string $cycleKey, int $index): string
    {
        $month = $cycleKey === 'period-q1-2026' ? 4 : 7;
        $day = 7 + ($index % 7);
        return sprintf('2026-%02d-%02dT09:%02d:00+08:00', $month, $day, ($index * 5) % 60);
    }
}
