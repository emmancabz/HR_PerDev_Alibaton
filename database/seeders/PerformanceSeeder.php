<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Performance\PerformanceService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PerformanceSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedPersonnel();

        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        app(PerformanceService::class)->syncConfiguration($admin, [
            'cycles' => $this->cycles(),
            'reviewTemplates' => $this->reviewTemplates(),
            'goalTemplates' => $this->goalTemplates(),
            'goals' => $this->goals(),
            'assignments' => $this->reportingAssignments(),
        ]);

        $this->seedHistoricalAndNamedReviews($admin);
        $this->seedDevelopment($admin);
    }

    private function seedPersonnel(): void
    {
        $base = [
            ['user-1', 'CORE-001', 'EMP-001', 'Mara Villanueva', 'mara.villanueva@alibaton.com', 'System Administrator', 'Administration', UserRole::Admin, 'Employee', 'Employee'],
            ['user-2', 'CORE-002', 'EMP-002', 'Alvin Custodio', 'alvin.custodio@alibaton.com', 'System Administrator', 'Information Technology', UserRole::Admin, 'Employee', 'Employee'],
            ['user-4', 'CORE-014', 'EMP-004', 'Celso Ramirez', 'celso.ramirez@alibaton.com', 'HR Business Partner', 'Human Resources', UserRole::HR, 'Employee', 'Employee'],
            ['user-5', 'CORE-112', 'EMP-005', 'Nina Soriano', 'nina.soriano@alibaton.com', 'Finance Staff', 'Finance', UserRole::User, 'Employee', 'Employee'],
            ['user-6', 'CORE-204', 'TRN-001', 'Elaine Bautista', 'elaine.bautista@alibaton.com', 'Graduate Trainee', 'Operations', UserRole::User, 'Trainee', 'Trainee'],
            ['user-8', 'CORE-154', 'EMP-006', 'Miguel Santos', 'miguel.santos@alibaton.com', 'Safety Officer', 'Safety & Compliance', UserRole::User, 'Employee', 'Employee'],
            ['user-10', 'CORE-027', 'EMP-008', 'Grace Fernandez', 'grace.fernandez@alibaton.com', 'Training Officer', 'Human Resources', UserRole::HR, 'Employee', 'Employee'],
            ['user-12', 'CORE-238', 'EMP-010', 'Katrina Buenaventura', 'katrina.buenaventura@alibaton.com', 'HR Business Partner', 'Human Resources', UserRole::HR, 'Employee', 'Employee'],
        ];

        $names = ['Luis Gomez', 'Sofia Reyes', 'Mateo Cruz', 'Isabella Torres', 'Lucas Flores', 'Mia Ramos', 'Gabriel Morales', 'Camila Ortiz', 'Jose Castillo', 'Elena Chavez', 'Antonio Ruiz', 'Valeria Herrera', 'Carlos Medina', 'Mariana Aguilar', 'Jorge Vargas', 'Lucia Castro', 'Pedro Salazar', 'Valentina Guzman', 'Juan Pena', 'Ximena Rojas', 'Diego Mendez', 'Mariana Silva', 'Alejandro Rios', 'Daniela Navarro', 'Fernando Delgado', 'Victoria Nunez', 'Ricardo Padilla'];
        $departments = ['Crane Operations', 'Logistics', 'Operations', 'Finance', 'Contracts', 'Safety & Compliance', 'Administration', 'Information Technology', 'Crane Operations', 'Logistics', 'Operations', 'Finance', 'Contracts', 'Safety & Compliance', 'Administration', 'Information Technology', 'Crane Operations', 'Logistics', 'Operations', 'Finance', 'Contracts', 'Safety & Compliance', 'Administration', 'Information Technology', 'Crane Operations', 'Operations', 'Logistics'];
        $supervisorPositions = [
            8 => 'Crane Operations Supervisor',
            9 => 'Logistics Supervisor',
            10 => 'Operations Supervisor',
            11 => 'Finance Manager',
            13 => 'Safety Supervisor',
        ];

        $people = $base;
        foreach ($names as $index => $name) {
            $people[] = [
                "user-gen-{$index}",
                "CORE-GEN-{$index}",
                'EMP-1'.str_pad((string) $index, 2, '0', STR_PAD_LEFT),
                $name,
                strtolower(str_replace(' ', '.', $name)).'@alibaton.com',
                $supervisorPositions[$index] ?? 'Staff Professional',
                $departments[$index],
                UserRole::User,
                'Employee',
                'Employee',
            ];
        }

        foreach ($people as [$key, $coreId, $personnelId, $name, $email, $position, $department, $role, $personType, $status]) {
            User::query()->updateOrCreate(
                ['personnel_key' => $key],
                [
                    'core_person_id' => $coreId,
                    'employee_or_trainee_id' => $personnelId,
                    'name' => $name,
                    'email' => $email,
                    'password' => Hash::make('password'),
                    'role' => $role,
                    'position' => $position,
                    'department' => $department,
                    'person_type' => $personType,
                    'employment_status' => $status,
                    'evaluator_capable' => in_array($key, ['user-gen-8', 'user-gen-9', 'user-gen-10', 'user-gen-11', 'user-gen-13'], true),
                    'email_verified_at' => now(),
                ],
            );
        }
    }

    private function cycles(): array
    {
        return [
            [
                'id' => 'period-q2-2026', 'cycleName' => 'Q2 2026 Performance Cycle', 'cycleType' => 'Quarterly',
                'performanceStartDate' => '2026-04-01', 'performanceEndDate' => '2026-06-30', 'reviewOpenDate' => '2026-07-01', 'reviewDueDate' => '2026-07-15',
                'applicablePersonTypes' => ['Employee', 'Trainee'], 'departmentScopes' => [],
                'reviewTemplateIds' => ['Employee' => 'review-template-employee-standard', 'Trainee' => 'review-template-trainee-standard'],
                'selfEvaluationEnabled' => false, 'selfRatingEnabled' => false, 'calibrationRequired' => false,
                'employeeAcknowledgment' => 'Optional', 'status' => 'Closed', 'description' => 'Historical quarterly performance cycle.',
            ],
            [
                'id' => 'period-q3-2026', 'cycleName' => 'Q3 2026 Performance Cycle', 'cycleType' => 'Quarterly',
                'performanceStartDate' => '2026-07-01', 'performanceEndDate' => '2026-09-30', 'reviewOpenDate' => '2026-10-01', 'reviewDueDate' => '2026-10-15',
                'applicablePersonTypes' => ['Employee', 'Trainee'], 'departmentScopes' => [],
                'reviewTemplateIds' => ['Employee' => 'review-template-employee-standard', 'Trainee' => 'review-template-trainee-standard'],
                'selfEvaluationEnabled' => true, 'selfRatingEnabled' => true, 'calibrationRequired' => true,
                'employeeAcknowledgment' => 'Required', 'status' => 'Active',
                'description' => 'Active organization-wide quarterly performance cycle.',
                'instructions' => 'Use agreed goals and documented workplace evidence. Missing supporting evidence does not become a zero score.',
            ],
            [
                'id' => 'cycle-probationary-2026', 'cycleName' => '2026 Probationary Review', 'cycleType' => 'Probationary',
                'performanceStartDate' => '2026-08-01',
'performanceEndDate' => '2026-11-30',
'reviewOpenDate' => '2026-12-01',
'reviewDueDate' => '2026-12-05',
                'applicablePersonTypes' => ['Trainee'], 'departmentScopes' => [],
                'reviewTemplateIds' => ['Trainee' => 'review-template-trainee-standard'],
                'selfEvaluationEnabled' => false, 'selfRatingEnabled' => false, 'calibrationRequired' => false,
                'employeeAcknowledgment' => 'Optional', 'probationaryMilestoneMonths' => 4, 'status' => 'Draft',
                'description' => 'Configurable milestone review for eligible trainees; it does not change HR1 employment status.',
            ],
        ];
    }

    private function reviewTemplates(): array
    {
        return [
            [
                'id' => 'review-template-employee-standard', 'name' => 'Standard Employee Review', 'personType' => 'Employee',
                'ratingScaleId' => 'rating-scale-five-point', 'active' => true,
                'criteria' => [
                    ['id' => 'employee-goal-achievement', 'name' => 'Goal / KPI Achievement', 'description' => 'Results against agreed goals, KPIs, and KRAs.', 'weight' => 25],
                    ['id' => 'employee-quality', 'name' => 'Quality of Work', 'description' => 'Accuracy, completeness, and standard of work delivered.', 'weight' => 20],
                    ['id' => 'employee-productivity', 'name' => 'Productivity', 'description' => 'Consistent and timely delivery of role responsibilities.', 'weight' => 15],
                    ['id' => 'employee-competency', 'name' => 'Role Competency', 'description' => 'Application of the knowledge and skills required for the role.', 'weight' => 15],
                    ['id' => 'employee-collaboration', 'name' => 'Communication / Collaboration', 'description' => 'Clear communication and constructive teamwork.', 'weight' => 10],
                    ['id' => 'employee-reliability', 'name' => 'Reliability / Compliance', 'description' => 'Dependability and adherence to organizational requirements.', 'weight' => 10],
                    ['id' => 'employee-problem-solving', 'name' => 'Problem Solving', 'description' => 'Sound judgment when analyzing and resolving work issues.', 'weight' => 5],
                ],
            ],
            [
                'id' => 'review-template-trainee-standard', 'name' => 'Standard Trainee Review', 'personType' => 'Trainee',
                'ratingScaleId' => 'rating-scale-five-point', 'active' => true,
                'criteria' => [
                    ['id' => 'trainee-learning', 'name' => 'Learning / Development Progress', 'description' => 'Growth against the agreed trainee development plan.', 'weight' => 25],
                    ['id' => 'trainee-assessment', 'name' => 'Assessment Performance', 'description' => 'Demonstrated understanding in assigned assessments.', 'weight' => 20],
                    ['id' => 'trainee-participation', 'name' => 'Training Participation', 'description' => 'Engagement with required development activities.', 'weight' => 15],
                    ['id' => 'trainee-readiness', 'name' => 'Competency Readiness', 'description' => 'Readiness to apply role competencies with appropriate support.', 'weight' => 20],
                    ['id' => 'trainee-compliance', 'name' => 'Participation / Compliance', 'description' => 'Participation and adherence to trainee requirements.', 'weight' => 10],
                    ['id' => 'trainee-practical', 'name' => 'Practical Application', 'description' => 'Ability to apply learning in practical work situations.', 'weight' => 10],
                ],
            ],
        ];
    }

    private function goalTemplates(): array
    {
        return [
            [
                'id' => 'goal-template-operations', 'name' => 'Operations Delivery & Safety', 'applicablePersonTypes' => ['Employee'],
                'departmentScopes' => ['Operations', 'Crane Operations', 'Logistics'], 'positionScopes' => [], 'cycleIds' => ['period-q3-2026'],
                'description' => 'Shared operational expectations that can be refined for an individual assignment.', 'allowIndividualOverrides' => true, 'active' => true,
                'items' => [
                    ['id' => 'ops-kra-delivery', 'metricType' => 'KRA', 'title' => 'Operational Delivery', 'target' => 'Meet the agreed work plan', 'unit' => '% work plan', 'weight' => 35],
                    ['id' => 'ops-kpi-quality', 'metricType' => 'KPI', 'title' => 'Work Quality', 'target' => 'At least 95', 'unit' => '% accepted output', 'weight' => 30],
                    ['id' => 'ops-kpi-compliance', 'metricType' => 'KPI', 'title' => 'Safety and Process Compliance', 'target' => 'Meet documented requirements', 'unit' => '% compliance', 'weight' => 25],
                    ['id' => 'ops-goal-development', 'metricType' => 'Goal', 'title' => 'Role Development Goal', 'target' => 'Complete agreed development action', 'unit' => 'milestone', 'weight' => 10],
                ],
            ],
            [
                'id' => 'goal-template-finance', 'name' => 'Finance Accuracy & Timeliness', 'applicablePersonTypes' => ['Employee'],
                'departmentScopes' => ['Finance'], 'positionScopes' => [], 'cycleIds' => ['period-q3-2026'], 'allowIndividualOverrides' => true, 'active' => true,
                'items' => [
                    ['id' => 'finance-kra-accuracy', 'metricType' => 'KRA', 'title' => 'Financial Record Accuracy', 'target' => 'At least 98', 'unit' => '% accurate', 'weight' => 40],
                    ['id' => 'finance-kpi-timeliness', 'metricType' => 'KPI', 'title' => 'Reporting Timeliness', 'target' => 'Meet all agreed reporting dates', 'unit' => '% on time', 'weight' => 35],
                    ['id' => 'finance-goal-improvement', 'metricType' => 'Goal', 'title' => 'Process Improvement', 'target' => 'Deliver one approved improvement', 'unit' => 'milestone', 'weight' => 25],
                ],
            ],
            [
                'id' => 'goal-template-trainee', 'name' => 'Trainee Development Plan', 'applicablePersonTypes' => ['Trainee'],
                'departmentScopes' => [], 'positionScopes' => [], 'cycleIds' => ['period-q3-2026', 'cycle-probationary-2026'],
                'description' => 'Development expectations only; completion does not automatically change employment status.', 'allowIndividualOverrides' => true, 'active' => true,
                'items' => [
                    ['id' => 'trainee-kra-progress', 'metricType' => 'KRA', 'title' => 'Development Progress', 'target' => 'Complete agreed milestones', 'unit' => '% milestones', 'weight' => 35],
                    ['id' => 'trainee-kpi-application', 'metricType' => 'KPI', 'title' => 'Practical Application', 'target' => 'Demonstrate supervised task readiness', 'unit' => 'milestone', 'weight' => 35],
                    ['id' => 'trainee-goal-feedback', 'metricType' => 'Goal', 'title' => 'Apply Coaching Feedback', 'target' => 'Close agreed coaching actions', 'unit' => '% actions', 'weight' => 30],
                ],
            ],
        ];
    }

    private function goals(): array
    {
        return [
            ['id' => 'goal-mateo-delivery', 'personId' => 'user-gen-2', 'cycleId' => 'period-q3-2026', 'templateId' => 'goal-template-operations', 'templateItemId' => 'ops-kra-delivery', 'title' => 'Operational Delivery', 'metricType' => 'KRA', 'target' => 'Meet the agreed work plan', 'unit' => '% work plan', 'weight' => 35, 'progress' => 62, 'status' => 'On Track', 'startDate' => '2026-07-01', 'endDate' => '2026-09-30', 'individualOverride' => false],
            ['id' => 'goal-mateo-quality', 'personId' => 'user-gen-2', 'cycleId' => 'period-q3-2026', 'templateId' => 'goal-template-operations', 'templateItemId' => 'ops-kpi-quality', 'title' => 'Work Quality', 'metricType' => 'KPI', 'target' => 'At least 95', 'unit' => '% accepted output', 'weight' => 30, 'progress' => 54, 'status' => 'At Risk', 'startDate' => '2026-07-01', 'endDate' => '2026-09-30', 'individualOverride' => false],
            ['id' => 'goal-elaine-progress', 'personId' => 'user-6', 'cycleId' => 'period-q3-2026', 'templateId' => 'goal-template-trainee', 'templateItemId' => 'trainee-kra-progress', 'title' => 'Development Progress', 'metricType' => 'KRA', 'target' => 'Complete agreed milestones', 'unit' => '% milestones', 'weight' => 35, 'progress' => 70, 'status' => 'On Track', 'startDate' => '2026-07-01', 'endDate' => '2026-09-30', 'individualOverride' => false],
            ['id' => 'goal-nina-accuracy', 'personId' => 'user-5', 'cycleId' => 'period-q3-2026', 'templateId' => 'goal-template-finance', 'templateItemId' => 'finance-kra-accuracy', 'title' => 'Financial Record Accuracy', 'metricType' => 'KRA', 'target' => 'At least 98', 'unit' => '% accurate', 'weight' => 40, 'progress' => 100, 'status' => 'Completed', 'startDate' => '2026-07-01', 'endDate' => '2026-09-30', 'individualOverride' => false],
        ];
    }

    private function reportingAssignments(): array
    {
        return [
            ['id' => 'report-crane-1', 'scopeType' => 'Reporting Relationship', 'basis' => 'Reporting Relationship', 'reportingRelationshipId' => 'report-crane-1', 'evaluatorId' => 'user-gen-8', 'personId' => 'user-gen-0'],
            ['id' => 'report-logistics-1', 'scopeType' => 'Reporting Relationship', 'basis' => 'Reporting Relationship', 'reportingRelationshipId' => 'report-logistics-1', 'evaluatorId' => 'user-gen-9', 'personId' => 'user-gen-1'],
            ['id' => 'report-operations-1', 'scopeType' => 'Reporting Relationship', 'basis' => 'Reporting Relationship', 'reportingRelationshipId' => 'report-operations-1', 'evaluatorId' => 'user-gen-10', 'personId' => 'user-gen-2'],
            ['id' => 'report-operations-trainee', 'scopeType' => 'Reporting Relationship', 'basis' => 'Reporting Relationship', 'reportingRelationshipId' => 'report-operations-trainee', 'evaluatorId' => 'user-gen-10', 'personId' => 'user-6'],
            ['id' => 'report-finance-1', 'scopeType' => 'Reporting Relationship', 'basis' => 'Reporting Relationship', 'reportingRelationshipId' => 'report-finance-1', 'evaluatorId' => 'user-gen-11', 'personId' => 'user-5'],
            ['id' => 'report-finance-2', 'scopeType' => 'Reporting Relationship', 'basis' => 'Reporting Relationship', 'reportingRelationshipId' => 'report-finance-2', 'evaluatorId' => 'user-gen-11', 'personId' => 'user-gen-3'],
            ['id' => 'report-safety-1', 'scopeType' => 'Reporting Relationship', 'basis' => 'Reporting Relationship', 'reportingRelationshipId' => 'report-safety-1', 'evaluatorId' => 'user-gen-13', 'personId' => 'user-8'],
        ];
    }

    private function seedHistoricalAndNamedReviews(User $admin): void
    {
        $records = [
            ['eval-1', 'user-6', 'user-gen-10', 'period-q3-2026', 'review-template-trainee-standard', 4.4, '2026-08-03T15:10:00+08:00', [4.3, 4.2, 4.6, 4.4, 4.7, 4.2], 'Adjusting well to the Operations training track and consistently meets attendance expectations.', ['Training recommended']],
            ['eval-2', 'user-5', 'user-gen-11', 'period-q2-2026', 'review-template-employee-standard', 4.2, '2026-07-02T14:30:00+08:00', [4.1, 4.3, 4.2, 4.4, 4.0, 4.1], 'Reliable performance in Finance with steady turnaround on monthly reconciliations.', []],
            ['eval-4', 'user-gen-0', 'user-gen-8', 'period-q2-2026', 'review-template-employee-standard', 4.5, '2026-07-05T10:15:00+08:00', [4.3, 4.7, 4.5, 4.6, 4.4, 4.5], 'Strong technical execution on crane operations with a clean safety record this quarter.', ['Learning recommended']],
            ['eval-5', 'user-gen-1', 'user-gen-9', 'period-q2-2026', 'review-template-employee-standard', 4.0, '2026-07-06T16:20:00+08:00', [4.0, 3.9, 4.1, 4.0, 4.2, 3.8], 'Consistent contributor to the Logistics team with good coordination across shifts.', []],
            ['eval-7', 'user-gen-3', 'user-gen-11', 'period-q2-2026', 'review-template-employee-standard', 3.8, '2026-07-08T11:40:00+08:00', [3.7, 3.9, 3.8, 3.6, 4.0, 3.7], 'Meets expectations overall; would benefit from additional support on reporting turnaround time.', ['Learning recommended']],
        ];

        foreach ($records as [$reviewKey, $subjectKey, $evaluatorKey, $cycleKey, $templateKey, $rating, $finalizedAt, $scoreValues, $comments, $recommendations]) {
            $subject = User::query()->where('personnel_key', $subjectKey)->firstOrFail();
            $evaluator = User::query()->where('personnel_key', $evaluatorKey)->firstOrFail();
            $cycle = DB::table('performance_cycles')->where('external_key', $cycleKey)->first();
            $template = DB::table('performance_review_templates')->where('external_key', $templateKey)->first();
            $assignment = DB::table('performance_review_assignments')
                ->where('performance_cycle_id', $cycle->id)
                ->where('subject_user_id', $subject->id)
                ->first();
            if (! $assignment) {
                $assignmentId = DB::table('performance_review_assignments')->insertGetId([
                    'external_key' => "assignment-{$cycleKey}-{$subjectKey}",
                    'performance_cycle_id' => $cycle->id,
                    'subject_user_id' => $subject->id,
                    'evaluator_user_id' => $evaluator->id,
                    'basis' => 'Reporting Relationship',
                    'active' => true,
                    'assigned_by_id' => $admin->id,
                    'assigned_at' => now(),
                    'lock_version' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $assignmentId = $assignment->id;
                DB::table('performance_review_assignments')->where('id', $assignmentId)->update(['evaluator_user_id' => $evaluator->id]);
            }

            $criteria = json_decode($template->criteria, true, 512, JSON_THROW_ON_ERROR);
            $scores = collect($criteria)->values()->map(fn (array $criterion, int $index) => [
                'name' => $criterion['name'],
                'score' => $scoreValues[$index] ?? $rating,
            ])->all();
            DB::table('performance_reviews')->updateOrInsert(
                ['performance_review_assignment_id' => $assignmentId],
                [
                    'external_key' => $reviewKey,
                    'performance_review_template_id' => $template->id,
                    'status' => 'Completed',
                    'workflow_state' => 'Finalized',
                    'calibration_status' => 'Not Required',
                    'final_rating' => $rating,
                    'criteria_scores' => json_encode($scores, JSON_THROW_ON_ERROR),
                    'comments' => $comments,
                    'development_recommendations' => json_encode($recommendations, JSON_THROW_ON_ERROR),
                    'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
                    'manager_submitted_at' => $finalizedAt,
                    'finalized_at' => $finalizedAt,
                    'due_date' => $cycle->review_due_date,
                    'lock_version' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }

        $pendingKeys = [
            'user-8' => 'eval-3',
            'user-gen-2' => 'eval-6',
            'user-gen-0' => 'eval-q3-luis',
            'user-gen-1' => 'eval-q3-sofia',
            'user-5' => 'eval-q3-nina',
            'user-gen-3' => 'eval-q3-isabella',
        ];
        $q3 = DB::table('performance_cycles')->where('external_key', 'period-q3-2026')->first();
        foreach ($pendingKeys as $subjectKey => $reviewKey) {
            $subjectId = User::query()->where('personnel_key', $subjectKey)->value('id');
            $assignmentId = DB::table('performance_review_assignments')
                ->where('performance_cycle_id', $q3->id)
                ->where('subject_user_id', $subjectId)
                ->value('id');
            if ($assignmentId) {
                DB::table('performance_reviews')->where('performance_review_assignment_id', $assignmentId)->update([
                    'external_key' => $reviewKey,
                    'status' => 'Pending',
                    'workflow_state' => 'Manager Review',
                    'calibration_status' => 'Pending',
                    'final_rating' => null,
                    'criteria_scores' => null,
                    'manager_submitted_at' => null,
                    'finalized_at' => null,
                    'due_date' => $q3->review_due_date,
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function seedDevelopment(User $admin): void
    {
        $subject = User::query()->where('personnel_key', 'user-6')->firstOrFail();
        $author = User::query()->where('personnel_key', 'user-gen-10')->firstOrFail();
        $cycle = DB::table('performance_cycles')->where('external_key', 'period-q3-2026')->first();
        $review = DB::table('performance_reviews')->where('external_key', 'eval-1')->first();
        DB::table('performance_feedback_records')->updateOrInsert(['external_key' => 'feedback-elaine-checkin-1'], [
            'subject_user_id' => $subject->id,
            'author_user_id' => $author->id,
            'performance_cycle_id' => $cycle->id,
            'performance_review_id' => $review->id,
            'record_type' => '1:1 Check-in',
            'note' => 'Reviewed trainee progress and practical-work confidence during the regular check-in.',
            'coaching_action' => 'Continue supervised practical exercises and review progress at the next check-in.',
            'linked_goal_keys' => json_encode([], JSON_THROW_ON_ERROR),
            'follow_up_date' => '2026-08-24',
            'visibility' => 'Employee & Manager',
            'lock_version' => 1,
            'created_at' => '2026-08-03T14:00:00+08:00',
            'updated_at' => '2026-08-03T14:00:00+08:00',
        ]);

        $probationary = DB::table('performance_cycles')->where('external_key', 'cycle-probationary-2026')->first();
        DB::table('performance_trainee_journeys')->updateOrInsert(['external_key' => 'trainee-journey-elaine-2026'], [
            'trainee_user_id' => $subject->id,
            'performance_cycle_id' => $probationary->id,
            'current_stage' => 'Learning / Training / Practical Development',
            'milestones' => json_encode([
                ['id' => 'trainee-elaine-initial', 'title' => 'Initial performance discussion', 'completedAt' => '2026-08-03T15:10:00+08:00', 'note' => 'Initial trainee review recorded.'],
                ['id' => 'trainee-elaine-development', 'title' => 'Complete agreed practical-development activities', 'targetDate' => '2026-11-15'],
                ['id' => 'trainee-elaine-reevaluation', 'title' => 'Probationary re-evaluation', 'targetDate' => '2026-12-05'],
            ], JSON_THROW_ON_ERROR),
            'development_action_keys' => json_encode([], JSON_THROW_ON_ERROR),
            'lock_version' => 1,
            'created_at' => now(),
            'updated_at' => '2026-08-03T15:10:00+08:00',
        ]);
    }
}