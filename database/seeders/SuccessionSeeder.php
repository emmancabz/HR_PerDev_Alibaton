<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Succession\CriticalPosition;
use App\Models\User;
use App\Services\Succession\SuccessionService;
use Illuminate\Database\Seeder;
use RuntimeException;

class SuccessionSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing']) || ! config('succession.operational_seed_enabled')) {
            throw new RuntimeException('Succession seed data is restricted to local/testing and requires SUCCESSION_OPERATIONAL_SEED_ENABLED=true.');
        }

        $operator = User::query()
            ->whereIn('role', [UserRole::Admin->value, UserRole::HR->value])
            ->orderBy('id')
            ->firstOrFail();
        $service = app(SuccessionService::class);
        $incumbents = User::query()
            ->activePersonnel()
            ->where('role', UserRole::User->value)
            ->where('evaluator_capable', true)
            ->orderBy('department')
            ->limit(6)
            ->get();
        if ($incumbents->count() < 5) {
            throw new RuntimeException('Succession operational seeding requires five canonical supervisory incumbents.');
        }

        $readinessBands = ['Ready Now', 'Ready Soon', 'Developing', 'Needs Significant Development', 'Ready Soon', 'Developing'];

        foreach ($incumbents as $index => $incumbent) {
            $position = CriticalPosition::query()
                ->where('position_title', $incumbent->position)
                ->where('department', $incumbent->department)
                ->first();

            if (! $position) {
                $position = $service->savePosition($operator, [
                    'positionTitle' => $incumbent->position,
                    'department' => $incumbent->department,
                    'criticality' => $index < 2 ? 'Critical' : ($index < 5 ? 'High' : 'Moderate'),
                    'incumbentId' => $incumbent->id,
                    'businessImpact' => 'Maintains qualified decision ownership, service continuity, and controlled operational handover for this function.',
                    'vacancyRisk' => 'An extended vacancy would reduce accountable supervision and delay operational decisions.',
                    'reviewCycleMonths' => 6,
                    'nextReviewAt' => now()->addMonths(($index % 5) + 1)->toDateString(),
                    'requirements' => [
                        ['type' => 'Competency', 'label' => 'Role-profile competency readiness', 'targetLevel' => 3, 'required' => true, 'sourceKey' => null, 'sourceVersion' => null],
                        ['type' => 'Performance', 'label' => 'Finalized performance evidence', 'targetLevel' => null, 'required' => true, 'sourceKey' => null, 'sourceVersion' => null],
                    ],
                ]);
            }

            if ($position->status === 'Draft') {
                $service->transitionPosition($operator, $position, 'Active');
                $position->refresh();
            }

            $candidate = User::query()
                ->activePersonnel()
                ->where('role', UserRole::User->value)
                ->where('department', $incumbent->department)
                ->whereKeyNot($incumbent->id)
                ->where('evaluator_capable', false)
                ->orderBy('name')
                ->first();

            if (! $candidate) {
                continue;
            }

            $nomination = $position->candidates()->where('candidate_id', $candidate->id)->first();
            if (! $nomination) {
                $nomination = $service->nominate(
                    $operator,
                    $position->fresh(),
                    $candidate->id,
                    'Talent Review',
                    'Canonical personnel record with relevant functional experience and documented development potential for this critical position.',
                );
            }

            if ($nomination->status === 'Proposed') {
                $service->transitionCandidate($operator, $nomination, 'Under Review');
                $nomination->refresh();
            }

            $finalized = $nomination->assessments()->where('status', 'Finalized')->latest('version')->first();
            if (! $finalized && $nomination->status === 'Under Review') {
                $band = $readinessBands[$index] ?? 'Developing';
                $assessment = $service->createAssessment($operator, $nomination, [
                    'readinessBand' => $band,
                    'reviewerSummary' => match ($band) {
                        'Ready Now' => 'Finalized evidence supports immediate pipeline readiness while appointment decisions remain outside the system.',
                        'Ready Soon' => 'Finalized evidence shows strong functional readiness with a limited, documented development requirement.',
                        'Developing' => 'The candidate has relevant experience but requires a governed development plan before stronger readiness can be supported.',
                        default => 'The candidate remains in the pipeline for development but has material evidence gaps that prevent near-term readiness.',
                    },
                    'developmentNeeds' => $band === 'Ready Now'
                        ? []
                        : ['Complete the approved role-specific development intervention and collect finalized follow-up evidence.'],
                    'riskFlags' => $band === 'Needs Significant Development'
                        ? ['Material readiness gap remains in the current evidence set.']
                        : [],
                ]);
                $service->finalizeAssessment($operator, $assessment);
                $finalized = $assessment->fresh();
            }

            if ($finalized && $nomination->fresh()->status === 'Under Review') {
                $service->transitionCandidate(
                    $operator,
                    $nomination->fresh(),
                    'Accepted',
                    'Finalized readiness evidence supports governed pipeline inclusion only; no automatic promotion or appointment is performed.',
                );
                $nomination->refresh();
            }

            if ($finalized && $finalized->readiness_band !== 'Ready Now') {
                $plan = $nomination->plans()
                    ->whereNotIn('status', ['Completed', 'Cancelled'])
                    ->orderByDesc('created_at')
                    ->first();

                if (! $plan) {
                    $plan = $service->createPlan($operator, $nomination->fresh(), [
                        'assessmentId' => $finalized->id,
                        'title' => $incumbent->position.' readiness development plan',
                        'objective' => 'Address the documented readiness requirement using governed development activity and finalized evidence.',
                        'startsOn' => now()->toDateString(),
                        'targetDate' => now()->addMonths(4)->toDateString(),
                        'ownerId' => $incumbent->id,
                    ]);
                }

                if ($plan->actions()->doesntExist()) {
                    $service->saveAction($operator, $plan, [
                        'actionType' => 'Development Activity',
                        'title' => 'Complete role-specific readiness intervention',
                        'description' => 'Complete the approved development intervention and attach finalized follow-up evidence before the next readiness review.',
                        'status' => 'Planned',
                        'dueOn' => now()->addMonths(3)->toDateString(),
                    ]);
                }

                if ($plan->fresh()->status === 'Draft') {
                    $service->transitionPlan($operator, $plan->fresh(), 'Active', 'Approved as the active succession development plan.');
                }
            }
        }
    }
}
