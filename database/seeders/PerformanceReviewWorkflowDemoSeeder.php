<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Performance\PerformanceService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PerformanceReviewWorkflowDemoSeeder extends Seeder
{
    private const LEADERSHIP_360_CRITERIA = [
        'Communication' => 20,
        'Coaching & Support' => 20,
        'Delegation' => 15,
        'Team Coordination' => 15,
        'Accountability' => 15,
        'Leadership Effectiveness' => 15,
    ];

    public function run(): void
    {
        $fixture = $this->fixture();
        $configuredDate = trim((string) config('performance.review_demo_date', ''));
        $scenarioDate = (string) ($fixture['simulated_system_date'] ?? '');

        if ($configuredDate === '' || $configuredDate !== $scenarioDate) {
            throw new RuntimeException(
                "Set PERFORMANCE_REVIEW_DEMO_DATE={$scenarioDate} before running the controlled review-workflow scenario."
            );
        }

        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();

        // Derive the canonical Q3 routing first. With the simulated date inside the
        // review window, the service also releases the normal formal review records.
        app(PerformanceService::class)->state($admin);

        DB::transaction(function () use ($admin, $fixture): void {
            $cycle = DB::table('performance_cycles')
                ->where('external_key', (string) $fixture['cycle_id'])
                ->first();
            if (! $cycle) {
                throw new RuntimeException('The Q3 2026 Performance cycle is missing.');
            }

            $rows = DB::table('performance_review_assignments as assignments')
                ->join('users as subjects', 'subjects.id', '=', 'assignments.subject_user_id')
                ->leftJoin('users as evaluators', 'evaluators.id', '=', 'assignments.evaluator_user_id')
                ->leftJoin('performance_reviews as reviews', 'reviews.performance_review_assignment_id', '=', 'assignments.id')
                ->where('assignments.performance_cycle_id', $cycle->id)
                ->where('assignments.active', true)
                ->orderBy('subjects.name')
                ->get([
                    'assignments.id as assignment_id',
                    'assignments.basis',
                    'assignments.subject_user_id as subject_id',
                    'assignments.evaluator_user_id as evaluator_id',
                    'subjects.personnel_key as subject_key',
                    'subjects.name as subject_name',
                    'subjects.department',
                    'subjects.position',
                    'subjects.person_type',
                    'evaluators.name as evaluator_name',
                    'reviews.id as review_id',
                    'reviews.performance_review_template_id as review_template_id',
                    'reviews.created_at as review_created_at',
                ]);

            if ($rows->count() !== 35) {
                throw new RuntimeException("Controlled Q3 scenario expects 35 active review assignments; found {$rows->count()}.");
            }

            if ($rows->contains(fn (object $row): bool => ! $row->review_id)) {
                throw new RuntimeException('One or more Q3 assignments do not yet have a formal review record.');
            }

            $unfinished = collect($fixture['unfinished'] ?? [])->keyBy('personnel_key');
            $unknown = $unfinished->keys()->diff($rows->pluck('subject_key'));
            if ($unknown->isNotEmpty()) {
                throw new RuntimeException('Scenario contains unknown Q3 personnel keys: '.$unknown->implode(', '));
            }

            $reviewIds = $rows->pluck('review_id')->filter()->map(fn ($id) => (int) $id)->values();
            DB::table('performance_review_events')->whereIn('performance_review_id', $reviewIds)->delete();
            DB::table('performance_anonymous_feedback')->where('performance_cycle_id', $cycle->id)->delete();

            foreach ($rows as $index => $row) {
                $workflow = (string) ($unfinished->get($row->subject_key)['workflow_state'] ?? 'Finalized');
                $is360 = ($row->basis ?? '') === '360 Leadership Review';

                if ($workflow === '360 Feedback Collection' && ! $is360) {
                    throw new RuntimeException("{$row->subject_name} is not routed to a 360° Leadership Review.");
                }

                if ($is360) {
                    $criteria = collect(self::LEADERSHIP_360_CRITERIA)
                        ->map(fn (int $weight, string $name) => ['name' => $name, 'weight' => $weight])
                        ->values()
                        ->all();
                } else {
                    $template = DB::table('performance_review_templates')->where('id', $row->review_template_id)->first();
                    $criteria = $template ? $this->decode((string) $template->criteria) : [];
                }

                if ($criteria === []) {
                    throw new RuntimeException("No governed review criteria are configured for {$row->subject_name}.");
                }

                [$weightedProgress, $goalCount, $goalWeight] = $this->goalContext((int) $row->subject_id, (int) $cycle->id);
                if ($goalCount < 1 || abs($goalWeight - 100.0) > 0.01) {
                    throw new RuntimeException(
                        "{$row->subject_name} does not have a complete 100% Q3 Goal/KPI plan (goals={$goalCount}, weight={$goalWeight})."
                    );
                }

                $scores = $this->criterionScores($criteria, $weightedProgress, (string) $row->subject_key);
                $rating = $this->weightedRating($criteria, $scores);

                if ($is360) {
                    $completeCoverage = $workflow !== '360 Feedback Collection';
                    $this->seed360Feedback($row, $cycle, $scores, $completeCoverage, $index);
                }

                $submittedAt = $this->timestamp(2 + ($index % 6), 9 + ($index % 7), ($index * 7) % 60);
                $calibrationAt = $this->timestamp(3 + ($index % 6), 13 + ($index % 4), ($index * 11) % 60);
                $finalizedAt = $this->timestamp(4 + ($index % 7), 15, ($index * 13) % 60);
                $acknowledgedAt = $this->timestamp(5 + ($index % 6), 16, ($index * 17) % 60);

                $base = [
                    'external_key' => "review-period-q3-2026-{$row->subject_key}",
                    'due_date' => $cycle->review_due_date,
                    'linked_evidence' => json_encode([], JSON_THROW_ON_ERROR),
                    'lock_version' => DB::raw('lock_version + 1'),
                    'updated_at' => now(),
                ];

                $selfEvaluation = $is360 ? null : json_encode([
                    'accomplishments' => "Documented Q3 accomplishments for {$row->position} responsibilities and agreed work outcomes.",
                    'goalProgress' => "Reviewed the same governed Q3 Goals/KPIs shown in Performance Management; verified weighted progress is {$weightedProgress}%.",
                    'challenges' => 'Operational context and constraints were documented for evaluator consideration where applicable.',
                    'comments' => 'Submitted as employee input; the self-rating is not the official Performance rating.',
                    'selfRating' => round(max(1, min(5, $rating - 0.1)), 1),
                    'status' => 'Submitted',
                    'submittedAt' => $this->timestamp(1 + ($index % 5), 10, ($index * 3) % 60),
                    'updatedAt' => $this->timestamp(1 + ($index % 5), 10, ($index * 3) % 60),
                ], JSON_THROW_ON_ERROR);

                if ($workflow === 'Finalized') {
                    DB::table('performance_reviews')->where('id', $row->review_id)->update($base + [
                        'status' => 'Completed',
                        'workflow_state' => 'Finalized',
                        'calibration_status' => 'Approved',
                        'final_rating' => $rating,
                        'criteria_scores' => json_encode($scores, JSON_THROW_ON_ERROR),
                        'comments' => $this->commentFor($row, $weightedProgress, 'Finalized'),
                        'development_recommendations' => json_encode($this->recommendationsFor($rating, $weightedProgress), JSON_THROW_ON_ERROR),
                        'self_evaluation' => $selfEvaluation,
                        'manager_submitted_at' => $submittedAt,
                        'finalized_at' => $finalizedAt,
                        'acknowledgment' => json_encode([
                            'status' => 'Acknowledged',
                            'actorId' => $row->subject_key,
                            'timestamp' => $acknowledgedAt,
                            'statement' => 'Received / Viewed',
                        ], JSON_THROW_ON_ERROR),
                    ]);
                    $this->event((int) $row->review_id, $is360 ? '360 Feedback Consolidated' : 'Manager Review Submitted', $row->evaluator_id, $submittedAt, null, $is360 ? 'Required multi-source coverage completed.' : 'Evaluator submitted the completed criterion ratings and rationale.');
                    $this->event((int) $row->review_id, 'Calibration Review Started', $admin->id, $calibrationAt, null, 'Admin/HR governance review started.');
                    $this->event((int) $row->review_id, 'Calibration Approved', $admin->id, $finalizedAt, null, 'Submitted result approved and finalized after governance checks.');
                    $this->event((int) $row->review_id, 'Employee Acknowledged', $row->subject_id, $acknowledgedAt, null, 'Employee received/viewed the finalized result.');
                } elseif ($workflow === 'Calibration Pending') {
                    DB::table('performance_reviews')->where('id', $row->review_id)->update($base + [
                        'status' => 'In Progress',
                        'workflow_state' => 'Calibration Pending',
                        'calibration_status' => 'Pending',
                        'final_rating' => $rating,
                        'criteria_scores' => json_encode($scores, JSON_THROW_ON_ERROR),
                        'comments' => $this->commentFor($row, $weightedProgress, 'Calibration Pending'),
                        'development_recommendations' => json_encode($this->recommendationsFor($rating, $weightedProgress), JSON_THROW_ON_ERROR),
                        'self_evaluation' => $selfEvaluation,
                        'manager_submitted_at' => $submittedAt,
                        'finalized_at' => null,
                        'acknowledgment' => null,
                    ]);
                    $this->event((int) $row->review_id, $is360 ? '360 Feedback Consolidated' : 'Manager Review Submitted', $row->evaluator_id, $submittedAt, null, 'Formal result submitted and awaiting required calibration.');
                } elseif ($workflow === 'Calibration In Review') {
                    DB::table('performance_reviews')->where('id', $row->review_id)->update($base + [
                        'status' => 'In Progress',
                        'workflow_state' => 'Calibration In Review',
                        'calibration_status' => 'In Review',
                        'final_rating' => $rating,
                        'criteria_scores' => json_encode($scores, JSON_THROW_ON_ERROR),
                        'comments' => $this->commentFor($row, $weightedProgress, 'Calibration In Review'),
                        'development_recommendations' => json_encode($this->recommendationsFor($rating, $weightedProgress), JSON_THROW_ON_ERROR),
                        'self_evaluation' => $selfEvaluation,
                        'manager_submitted_at' => $submittedAt,
                        'finalized_at' => null,
                        'acknowledgment' => null,
                    ]);
                    $this->event((int) $row->review_id, $is360 ? '360 Feedback Consolidated' : 'Manager Review Submitted', $row->evaluator_id, $submittedAt, null, 'Formal result submitted for calibration.');
                    $this->event((int) $row->review_id, 'Calibration Review Started', $admin->id, $calibrationAt, null, 'Admin/HR is checking completeness, consistency, authority, and evidence context.');
                } elseif ($workflow === 'Revision In Progress') {
                    DB::table('performance_reviews')->where('id', $row->review_id)->update($base + [
                        'status' => 'In Progress',
                        'workflow_state' => 'Revision In Progress',
                        'calibration_status' => 'Returned for Revision',
                        'final_rating' => $rating,
                        'criteria_scores' => json_encode($scores, JSON_THROW_ON_ERROR),
                        'comments' => $this->commentFor($row, $weightedProgress, 'Revision In Progress'),
                        'development_recommendations' => json_encode($this->recommendationsFor($rating, $weightedProgress), JSON_THROW_ON_ERROR),
                        'self_evaluation' => $selfEvaluation,
                        'manager_submitted_at' => $submittedAt,
                        'finalized_at' => null,
                        'acknowledgment' => null,
                    ]);
                    $this->event((int) $row->review_id, 'Manager Review Submitted', $row->evaluator_id, $submittedAt, null, 'Evaluator originally submitted the formal review.');
                    $this->event((int) $row->review_id, 'Calibration Review Started', $admin->id, $calibrationAt, null, 'Calibration identified a clarification requirement.');
                    $this->event((int) $row->review_id, 'Calibration Returned for Revision', $admin->id, $calibrationAt, 'Clarify the evaluator rationale and supporting evidence before resubmission.', 'Admin/HR returned the review without directly changing the evaluator score.');
                    $this->event((int) $row->review_id, 'Revision Requested', $admin->id, $calibrationAt, 'Clarify the evaluator rationale and supporting evidence before resubmission.', 'Assigned evaluator retains ownership of the revised submission.', 1);
                } elseif ($workflow === 'Manager Review') {
                    $partialScores = array_slice($scores, 0, max(2, (int) floor(count($scores) / 2)));
                    DB::table('performance_reviews')->where('id', $row->review_id)->update($base + [
                        'status' => 'In Progress',
                        'workflow_state' => 'Manager Review',
                        'calibration_status' => 'Pending',
                        'final_rating' => null,
                        'criteria_scores' => json_encode($partialScores, JSON_THROW_ON_ERROR),
                        'comments' => $this->commentFor($row, $weightedProgress, 'Manager Review'),
                        'development_recommendations' => json_encode([], JSON_THROW_ON_ERROR),
                        'self_evaluation' => $selfEvaluation,
                        'manager_submitted_at' => null,
                        'finalized_at' => null,
                        'acknowledgment' => null,
                    ]);
                    $this->event((int) $row->review_id, 'Manager Review Started', $row->evaluator_id, $submittedAt, null, 'Evaluator has saved a partial criterion-rating draft; the review is not yet submitted.');
                } elseif ($workflow === '360 Feedback Collection') {
                    DB::table('performance_reviews')->where('id', $row->review_id)->update($base + [
                        'status' => 'In Progress',
                        'workflow_state' => '360 Feedback Collection',
                        'calibration_status' => 'Pending',
                        'final_rating' => null,
                        'criteria_scores' => null,
                        'comments' => 'Governed multi-source leadership feedback is still being collected. Individual contributor identities remain confidential.',
                        'development_recommendations' => json_encode([], JSON_THROW_ON_ERROR),
                        'self_evaluation' => null,
                        'manager_submitted_at' => null,
                        'finalized_at' => null,
                        'acknowledgment' => null,
                    ]);
                    $this->event((int) $row->review_id, '360 Feedback Collection Started', null, $submittedAt, null, 'Self/direct-report/peer-leadership coverage is not yet complete.');
                } else {
                    throw new RuntimeException("Unsupported controlled workflow state: {$workflow}");
                }
            }

            $counts = DB::table('performance_reviews as reviews')
                ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                ->where('assignments.performance_cycle_id', $cycle->id)
                ->selectRaw("SUM(CASE WHEN reviews.workflow_state = 'Finalized' THEN 1 ELSE 0 END) as finalized")
                ->selectRaw("SUM(CASE WHEN reviews.workflow_state = 'Calibration Pending' THEN 1 ELSE 0 END) as calibration_pending")
                ->selectRaw("SUM(CASE WHEN reviews.workflow_state = 'Calibration In Review' THEN 1 ELSE 0 END) as calibration_in_review")
                ->selectRaw("SUM(CASE WHEN reviews.workflow_state = 'Revision In Progress' THEN 1 ELSE 0 END) as revision_in_progress")
                ->selectRaw("SUM(CASE WHEN reviews.workflow_state = 'Manager Review' THEN 1 ELSE 0 END) as manager_review")
                ->selectRaw("SUM(CASE WHEN reviews.workflow_state = '360 Feedback Collection' THEN 1 ELSE 0 END) as feedback_360")
                ->first();

            $expected = $fixture['target_counts'] ?? [];
            $actual = [
                'Finalized' => (int) $counts->finalized,
                'Calibration Pending' => (int) $counts->calibration_pending,
                'Calibration In Review' => (int) $counts->calibration_in_review,
                'Revision In Progress' => (int) $counts->revision_in_progress,
                'Manager Review' => (int) $counts->manager_review,
                '360 Feedback Collection' => (int) $counts->feedback_360,
            ];

            if ($actual !== $expected) {
                throw new RuntimeException('Controlled Q3 workflow count verification failed: '.json_encode($actual));
            }

            $this->command?->info('Controlled Q3 Review Workflow scenario loaded.');
            foreach ($actual as $state => $count) {
                $this->command?->line(" - {$state}: {$count}");
            }
            $this->command?->line(' - Data B was not modified.');
            $this->command?->line(' - Q3 Goal/KPI progress was read, not recalculated or overwritten.');
        }, 3);
    }

    private function fixture(): array
    {
        $path = database_path('seeders/data/DEFENSE_PERFORMANCE_REVIEW_WORKFLOW_SCENARIO_V1.json');
        if (! is_file($path)) {
            throw new RuntimeException('Controlled Performance review workflow fixture is missing.');
        }

        return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    private function goalContext(int $subjectId, int $cycleId): array
    {
        $goals = DB::table('performance_goals')
            ->where('user_id', $subjectId)
            ->where('performance_cycle_id', $cycleId)
            ->get(['weight', 'progress']);
        $weight = (float) $goals->sum(fn (object $goal) => (float) $goal->weight);
        $weighted = $weight > 0
            ? round((float) $goals->sum(fn (object $goal) => (float) $goal->progress * (float) $goal->weight) / $weight, 1)
            : 0.0;

        return [$weighted, $goals->count(), $weight];
    }

    private function criterionScores(array $criteria, float $weightedProgress, string $subjectKey): array
    {
        $base = match (true) {
            $weightedProgress >= 95 => 4.5,
            $weightedProgress >= 90 => 4.2,
            $weightedProgress >= 85 => 4.0,
            $weightedProgress >= 80 => 3.8,
            $weightedProgress >= 75 => 3.5,
            $weightedProgress >= 70 => 3.3,
            default => 3.0,
        };

        return collect($criteria)->values()->map(function (array $criterion, int $index) use ($base, $weightedProgress, $subjectKey): array {
            $name = (string) ($criterion['name'] ?? "Criterion {$index}");
            if (str_contains(strtolower($name), 'goal') || str_contains(strtolower($name), 'kpi')) {
                $score = $base;
            } else {
                $jitter = (((crc32($subjectKey.'|'.$name) % 7) - 3) * 0.1);
                $score = $base + $jitter;
            }

            // Demonstration evaluator input only: keep the 1–5 rating human-like and
            // context-consistent without turning Goal/KPI percentage into a formula.
            $score = round(max(2.5, min(4.9, $score)), 1);

            return ['name' => $name, 'score' => $score];
        })->all();
    }

    private function weightedRating(array $criteria, array $scores): float
    {
        $byName = collect($scores)->keyBy('name');
        $weighted = 0.0;
        $weight = 0.0;
        foreach ($criteria as $criterion) {
            $name = (string) ($criterion['name'] ?? '');
            $score = $byName->get($name);
            $criterionWeight = (float) ($criterion['weight'] ?? 0);
            if (! $score || $criterionWeight <= 0) {
                continue;
            }
            $weighted += (float) $score['score'] * $criterionWeight;
            $weight += $criterionWeight;
        }

        return round($weight > 0 ? $weighted / $weight : 0.0, 2);
    }

    private function commentFor(object $row, float $weightedProgress, string $workflow): string
    {
        $focus = match ((string) $row->department) {
            'Crane Operations' => 'safe equipment execution, rigging/signal practice, and work quality',
            'Logistics' => 'dispatch reliability, road-safety documentation, and coordination',
            'Operations' => 'operational delivery, coordination, and project/site reporting',
            'Finance' => 'record accuracy, disbursement control, and reporting reliability',
            'Contracts' => 'contract documentation, compliance tracking, and permit control',
            'Safety & Compliance' => 'hazard prevention, procedure compliance, and reporting quality',
            'Administration' => 'records control, service reliability, and handover coordination',
            'Information Technology' => 'access/incident handling, service continuity, and technical execution',
            'Human Resources' => 'learning/development governance, employee support, and stakeholder coordination',
            default => 'role delivery, quality, collaboration, and accountability',
        };

        return match ($workflow) {
            'Finalized' => "The evaluator completed the Q3 review using verified Goals/KPI context ({$weightedProgress}% weighted progress), documented workplace evidence, and {$focus}. The criterion ratings and rationale were submitted for required calibration before finalization.",
            'Calibration Pending' => "The evaluator completed all criterion ratings for {$focus} and submitted the review. Q3 Goals/KPI context ({$weightedProgress}% weighted progress) was reviewed as supporting evidence; it was not automatically converted into the official rating.",
            'Calibration In Review' => "The evaluator-submitted review for {$focus} is under Admin/HR calibration. Q3 Goals/KPI context ({$weightedProgress}% weighted progress) remains linked for consistency and evidence checks.",
            'Revision In Progress' => "The original evaluator submission for {$focus} was returned during calibration for clarification. The assigned evaluator is revising the rationale/evidence while retaining ownership of the rating decision.",
            default => "The assigned evaluator has started the formal Q3 review for {$focus}. Some criterion ratings are saved as a draft while the verified Goals/KPI context ({$weightedProgress}% weighted progress) remains available.",
        };
    }

    private function recommendationsFor(float $rating, float $weightedProgress): array
    {
        if ($rating < 3.0 || $weightedProgress < 75) {
            return ['Training recommended', 'Further performance review recommended'];
        }
        if ($rating < 3.7 || $weightedProgress < 85) {
            return ['Learning recommended'];
        }
        if ($rating < 4.2) {
            return ['Competency reassessment recommended'];
        }

        return ['No immediate intervention'];
    }

    private function seed360Feedback(object $row, object $cycle, array $scores, bool $complete, int $index): void
    {
        $ratings = collect($scores)->mapWithKeys(fn (array $score) => [$score['name'] => (float) $score['score']])->all();
        $directReports = DB::table('performance_reporting_relationships')
            ->where('active', true)
            ->where('supervisor_id', $row->subject_id)
            ->pluck('direct_report_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $relationships = DB::table('performance_reporting_relationships')
            ->where('active', true)
            ->get(['supervisor_id', 'direct_report_id']);
        $leaderIds = $relationships->pluck('supervisor_id')->map(fn ($id) => (int) $id)->unique();
        $reportIds = $relationships->pluck('direct_report_id')->map(fn ($id) => (int) $id)->unique();
        $peerLeaders = $leaderIds
            ->reject(fn (int $id) => $reportIds->contains($id) || $id === (int) $row->subject_id)
            ->values();

        $sources = collect([['id' => (int) $row->subject_id, 'role' => 'Self']]);
        if ($complete) {
            $sources = $sources
                ->concat($directReports->take(min(2, $directReports->count()))->map(fn (int $id) => ['id' => $id, 'role' => 'Direct Report']))
                ->concat($peerLeaders->take(min(2, $peerLeaders->count()))->map(fn (int $id) => ['id' => $id, 'role' => 'Peer Leader']));
        } elseif ($directReports->isNotEmpty()) {
            $sources->push(['id' => (int) $directReports->first(), 'role' => 'Direct Report']);
        }

        foreach ($sources as $sourceIndex => $source) {
            $adjusted = $ratings;
            DB::table('performance_anonymous_feedback')->updateOrInsert(
                [
                    'subject_user_id' => $row->subject_id,
                    'evaluator_user_id' => $source['id'],
                    'performance_cycle_id' => $cycle->id,
                ],
                [
                    'feedback' => json_encode([
                        'kind' => 'leadership360',
                        'sourceRole' => $source['role'],
                        'ratings' => $adjusted,
                        'comment' => 'Controlled confidential leadership-feedback input for the Q3 workflow demonstration.',
                    ], JSON_THROW_ON_ERROR),
                    'submitted_at' => $this->timestamp(2 + ($index % 5), 8 + $sourceIndex, ($index * 9 + $sourceIndex * 5) % 60),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    private function event(
        int $reviewId,
        string $type,
        ?int $actorId,
        string $occurredAt,
        ?string $reason = null,
        ?string $notes = null,
        ?int $revisionVersion = null,
    ): void {
        DB::table('performance_review_events')->insert([
            'performance_review_id' => $reviewId,
            'event_type' => $type,
            'actor_user_id' => $actorId,
            'reason' => $reason,
            'notes' => $notes,
            'revision_version' => $revisionVersion,
            'occurred_at' => $occurredAt,
            'created_at' => $occurredAt,
            'updated_at' => $occurredAt,
        ]);
    }

    private function timestamp(int $day, int $hour, int $minute): string
    {
        $day = max(1, min(10, $day));
        return sprintf('2026-10-%02dT%02d:%02d:00+08:00', $day, $hour, $minute);
    }

    private function decode(string $value): array
    {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }
}
