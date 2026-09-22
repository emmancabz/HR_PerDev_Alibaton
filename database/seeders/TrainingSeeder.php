<?php

namespace Database\Seeders;

use App\Models\Training\TrainingProgram;
use App\Models\User;
use App\Services\Training\TrainingService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TrainingSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing']) || ! config('training.operational_seed_enabled')) {
            throw new RuntimeException('Training operational seed data is restricted to local/testing and requires TRAINING_OPERATIONAL_SEED_ENABLED=true.');
        }

        $owner = User::query()->activePersonnel()->where('role', 'hr')->orderBy('id')->firstOrFail();
        $service = app(TrainingService::class);

        // Retire the original showcase-only definitions when they never produced a finalized
        // Training record. This keeps existing real history intact while moving local/demo data
        // to the governed development-driven definitions below.
        foreach (['TRN-SAFETY-001', 'TRN-LEAD-001', 'TRN-CRANE-001', 'TRN-INCIDENT-001'] as $legacyCode) {
            $legacy = TrainingProgram::query()->where('code', $legacyCode)->first();
            if (! $legacy) continue;
            $hasFinalizedHistory = DB::table('training_completions')
                ->join('training_enrollments', 'training_completions.enrollment_id', '=', 'training_enrollments.id')
                ->where('training_enrollments.program_id', $legacy->id)
                ->exists();
            $hasLockedDelivery = $legacy->sessions()->whereIn('status', ['Ongoing', 'Completed'])->exists();
            if ($hasFinalizedHistory || $hasLockedDelivery) continue;

            $sessionIds = $legacy->sessions()->pluck('id');
            if ($sessionIds->isNotEmpty()) {
                DB::table('training_session_participants')->whereIn('session_id', $sessionIds)
                    ->whereNotIn('status', ['Withdrawn', 'Cancelled'])->update(['status' => 'Cancelled', 'updated_at' => now()]);
                DB::table('training_sessions')->whereIn('id', $sessionIds)->whereIn('status', ['Draft', 'Scheduled'])
                    ->update(['status' => 'Cancelled', 'cancelled_at' => now(), 'cancellation_reason' => 'Retired legacy showcase schedule during Training Management finalization.', 'updated_at' => now()]);
            }
            $legacy->update(['status' => 'Archived', 'archived_at' => now(), 'updated_by' => $owner->id]);
        }

        $definitions = [
            [
                'code' => 'TRN-PRACT-CRANE-OPS-001',
                'title' => 'Crane Operations Practical',
                'category' => 'Technical Skills',
                'deliveryType' => 'Practical',
                'description' => 'Supervised practical verification for crane-operation controls, pre-use inspection, operating boundaries, communication, and safe shutdown or escalation.',
                'objectives' => [
                    'Demonstrate safe crane-operation controls within the authorized role boundary.',
                    'Complete required pre-use inspection, communication, and stop-work escalation correctly.',
                ],
                'audienceRules' => [
                    'personTypes' => ['Employee'],
                    'departments' => ['Crane Operations'],
                    'positions' => ['Crane Operator', 'Crane Operations Supervisor'],
                    'roleProfileIds' => [],
                ],
                'completionRules' => ['attendanceThreshold' => 100, 'assessmentRequired' => true, 'passingScore' => 80, 'issueCertificate' => true, 'certificateValidityMonths' => 12],
                'learningCode' => 'LRN-2026-907',
                'competencies' => [
                    ['id' => 'comp-crane-operation', 'version' => 1, 'code' => 'CMP-005', 'name' => 'Crane Operation', 'targetLevel' => 5, 'purpose' => 'Practical operation verification'],
                    ['id' => 'comp-equipment-inspection', 'version' => 1, 'code' => 'CMP-008', 'name' => 'Equipment Inspection', 'targetLevel' => 4, 'purpose' => 'Pre-use inspection evidence'],
                ],
            ],
            [
                'code' => 'TRN-PRACT-CRANE-001',
                'title' => 'Crane, Rigging, and Signal Communication Practical',
                'category' => 'Technical Skills',
                'deliveryType' => 'Practical',
                'description' => 'Authorized practical evaluation for crane-operation, rigging, lift preparation, and signal-communication requirements. Knowledge completion alone does not authorize specialized work.',
                'objectives' => [
                    'Demonstrate controlled lift preparation and role boundaries.',
                    'Apply approved signal communication and stop-work escalation in a supervised environment.',
                ],
                'audienceRules' => [
                    'personTypes' => ['Employee'],
                    'departments' => ['Crane Operations'],
                    'positions' => ['Crane Operator', 'Rigger and Signalperson', 'Crane Operations Supervisor'],
                    'roleProfileIds' => [],
                ],
                'completionRules' => ['attendanceThreshold' => 100, 'assessmentRequired' => true, 'passingScore' => 80, 'issueCertificate' => true, 'certificateValidityMonths' => 12],
                'learningCode' => 'LRN-2026-924',
                'competencies' => [
                    ['id' => 'comp-rigging-signals', 'version' => 1, 'code' => 'CMP-025', 'name' => 'Rigging and Signal Communication', 'targetLevel' => 4, 'purpose' => 'Practical demonstration'],
                    ['id' => 'comp-safety-compliance', 'version' => 1, 'code' => 'CMP-011', 'name' => 'Safety Procedure Compliance', 'targetLevel' => 3, 'purpose' => 'Safe-work execution'],
                ],
            ],
            [
                'code' => 'TRN-PRACT-WORKZONE-001',
                'title' => 'Equipment and Work-Zone Coordination Practical',
                'category' => 'Safety & Compliance',
                'deliveryType' => 'Practical',
                'description' => 'Supervised practical training for work-zone setup, equipment-personnel coordination, communication controls, and safe escalation.',
                'objectives' => [
                    'Apply work-zone access and exclusion controls in an approved environment.',
                    'Demonstrate safe equipment-personnel coordination and escalation.',
                ],
                'audienceRules' => [
                    'personTypes' => ['Employee', 'Trainee'],
                    'departments' => ['Crane Operations', 'Operations', 'Safety & Compliance'],
                    'positions' => [],
                    'roleProfileIds' => [],
                ],
                'completionRules' => ['attendanceThreshold' => 100, 'assessmentRequired' => true, 'passingScore' => 80, 'issueCertificate' => true, 'certificateValidityMonths' => 12],
                'learningCode' => 'LRN-2026-904',
                'competencies' => [
                    ['id' => 'comp-safety-compliance', 'version' => 1, 'code' => 'CMP-011', 'name' => 'Safety Procedure Compliance', 'targetLevel' => 3, 'purpose' => 'Practical safe-work execution'],
                    ['id' => 'comp-equipment-inspection', 'version' => 1, 'code' => 'CMP-008', 'name' => 'Equipment Inspection', 'targetLevel' => 3, 'purpose' => 'Equipment and work-zone verification'],
                ],
            ],
            [
                'code' => 'TRN-SIM-INCIDENT-001',
                'title' => 'Emergency Response and Incident Reporting Drill',
                'category' => 'Safety & Compliance',
                'deliveryType' => 'Simulation',
                'description' => 'Scenario-based facilitated drill for immediate response, communication, escalation, and accurate incident documentation.',
                'objectives' => [
                    'Apply the approved emergency communication and escalation sequence.',
                    'Produce complete initial incident documentation from a controlled scenario.',
                ],
                'audienceRules' => [
                    'personTypes' => ['Employee', 'Trainee'],
                    'departments' => ['Operations', 'Crane Operations', 'Safety & Compliance'],
                    'positions' => [],
                    'roleProfileIds' => [],
                ],
                'completionRules' => ['attendanceThreshold' => 100, 'assessmentRequired' => true, 'passingScore' => 80, 'issueCertificate' => false, 'certificateValidityMonths' => null],
                'learningCode' => 'LRN-2026-909',
                'competencies' => [
                    ['id' => 'comp-incident-reporting', 'version' => 1, 'code' => 'CMP-012', 'name' => 'Incident Reporting', 'targetLevel' => 4, 'purpose' => 'Scenario-based application'],
                    ['id' => 'comp-safety-compliance', 'version' => 1, 'code' => 'CMP-011', 'name' => 'Safety Procedure Compliance', 'targetLevel' => 4, 'purpose' => 'Emergency control execution'],
                ],
            ],
            [
                'code' => 'TRN-PRACT-SAFETY-INSPECTION-001',
                'title' => 'Safety Inspection and Corrective Action Practical',
                'category' => 'Safety & Compliance',
                'deliveryType' => 'Practical',
                'description' => 'Facilitated field exercise for inspection planning, finding classification, immediate controls, and corrective-action verification.',
                'objectives' => [
                    'Conduct a structured safety inspection and classify findings correctly.',
                    'Document and verify appropriate corrective actions.',
                ],
                'audienceRules' => [
                    'personTypes' => ['Employee'],
                    'departments' => ['Safety & Compliance'],
                    'positions' => ['Safety Officer', 'Safety Inspector', 'Safety Compliance Specialist', 'Safety Supervisor'],
                    'roleProfileIds' => [],
                ],
                'completionRules' => ['attendanceThreshold' => 100, 'assessmentRequired' => true, 'passingScore' => 80, 'issueCertificate' => true, 'certificateValidityMonths' => 12],
                'learningCode' => 'LRN-2026-931',
                'competencies' => [
                    ['id' => 'comp-safety-compliance', 'version' => 1, 'code' => 'CMP-011', 'name' => 'Safety Procedure Compliance', 'targetLevel' => 4, 'purpose' => 'Inspection and corrective-action practice'],
                    ['id' => 'comp-equipment-inspection', 'version' => 1, 'code' => 'CMP-008', 'name' => 'Equipment Inspection', 'targetLevel' => 3, 'purpose' => 'Inspection evidence'],
                ],
            ],
        ];

        foreach ($definitions as $definition) {
            $learningCourseId = DB::table('learning_courses')->where('code', $definition['learningCode'])->value('id');
            $program = TrainingProgram::query()->where('code', $definition['code'])->first();

            if (! $program) {
                $program = $service->createProgram($owner, [
                    'code' => $definition['code'],
                    'title' => $definition['title'],
                    'description' => $definition['description'],
                    'category' => $definition['category'],
                    'deliveryType' => $definition['deliveryType'],
                    'objectives' => $definition['objectives'],
                    'audienceRules' => $definition['audienceRules'],
                    'completionRules' => $definition['completionRules'],
                    'relatedLearningCourseId' => $learningCourseId,
                    'ownerId' => $owner->id,
                    'competencies' => $definition['competencies'],
                ])->fresh();
            }

            if ($program->status === 'Draft') {
                $service->transitionProgram($owner, $program, 'activate');
            }
        }
    }
}
