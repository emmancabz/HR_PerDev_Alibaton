<?php

namespace App\Services\Reporting;

use App\Enums\UserRole;
use App\Models\ReportExport;
use App\Models\SystemSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CrossModuleReportService
{
    public const REPORTS = [
        'workforce-development' => 'Workforce Development Summary',
        'performance-cycle' => 'Performance Cycle Status',
        'learning-compliance' => 'Learning Completion & Certificate Status',
        'training-effectiveness' => 'Training Attendance & Completion',
        'succession-risk' => 'Succession Coverage & Risk',
        'recognition-activity' => 'Recognition Activity',
    ];

    private const DATE_BASIS = [
        'workforce-development' => 'Finalized/completed activity dates; personnel scope remains current',
        'performance-cycle' => 'Review assignment date',
        'learning-compliance' => 'Learning assignment date',
        'training-effectiveness' => 'Training assignment date',
        'succession-risk' => 'Critical-position record creation date',
        'recognition-activity' => 'Achievement date',
    ];

    public function state(User $actor, array $filters = []): array
    {
        if (! array_key_exists('date_from', $filters)) {
            $defaults = config('governance.settings');
            $storedDays = SystemSetting::query()->where('setting_key', 'reporting.default_period_days')->first()?->value;
            $days = (int) (is_array($storedDays) ? ($storedDays['value'] ?? 90) : ($defaults['reporting.default_period_days'] ?? 90));
            $filters['date_from'] = now()->subDays(max(1, $days) - 1)->toDateString();
        }

        $reportKey = array_key_exists((string) ($filters['report'] ?? ''), self::REPORTS)
            ? (string) $filters['report']
            : 'workforce-development';

        if ($actor->role === UserRole::User) {
            $reportKey = 'workforce-development';
        }

        $rows = $this->rows($actor, $reportKey, $filters);

        return [
            'role' => $actor->role->value,
            'selected_report' => $reportKey,
            'catalog' => collect(self::REPORTS)
                ->reject(fn (string $label, string $key) => $actor->role === UserRole::User && $key !== 'workforce-development')
                ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])
                ->values()->all(),
            'filters' => [
                'department' => (string) ($filters['department'] ?? ''),
                'date_from' => (string) ($filters['date_from'] ?? ''),
                'date_to' => (string) ($filters['date_to'] ?? ''),
            ],
            'departments' => User::query()
                ->activePersonnel()
                ->whereNotNull('department')
                ->distinct()
                ->orderBy('department')
                ->pluck('department')
                ->all(),
            'metrics' => $this->metrics($actor, $reportKey, $rows),
            'report' => [
                'key' => $reportKey,
                'title' => self::REPORTS[$reportKey],
                'rows' => $rows->values()->all(),
                'row_count' => $rows->count(),
                'date_basis' => self::DATE_BASIS[$reportKey],
            ],
            'exports' => ReportExport::query()
                ->when($actor->role === UserRole::User, fn ($query) => $query->where('actor_id', $actor->id))
                ->latest('exported_at')
                ->limit(10)
                ->get()
                ->map(fn (ReportExport $export) => [
                    'id' => $export->id,
                    'report' => self::REPORTS[$export->report_key] ?? $export->report_key,
                    'format' => strtoupper($export->format),
                    'row_count' => $export->row_count,
                    'actor' => User::query()->whereKey($export->actor_id)->value('name') ?? 'Former account',
                    'exported_at' => $export->exported_at?->toIso8601String(),
                ])->all(),
        ];
    }

    public function rows(User $actor, string $reportKey, array $filters = []): Collection
    {
        if (! array_key_exists($reportKey, self::REPORTS)) {
            throw new AuthorizationException('Unknown report.');
        }

        if ($actor->role === UserRole::User && $reportKey !== 'workforce-development') {
            throw new AuthorizationException('Users may export only their own development record.');
        }

        return match ($reportKey) {
            'workforce-development' => $this->workforceRows($actor, $filters),
            'performance-cycle' => $this->performanceRows($filters),
            'learning-compliance' => $this->learningRows($filters),
            'training-effectiveness' => $this->trainingRows($filters),
            'succession-risk' => $this->successionRows($filters),
            'recognition-activity' => $this->recognitionRows($filters),
        };
    }

    public function recordExport(User $actor, string $reportKey, string $format, array $filters, int $rowCount): void
    {
        ReportExport::query()->create([
            'report_key' => $reportKey,
            'format' => $format,
            'filters' => $filters,
            'row_count' => $rowCount,
            'actor_id' => $actor->id,
            'exported_at' => now(),
        ]);
    }

    private function metrics(User $actor, string $reportKey, Collection $rows): array
    {
        if ($actor->role === UserRole::User) {
            return [
                ['label' => 'My Record', 'value' => $rows->count()],
                ['label' => 'Finalized Reviews', 'value' => $rows->sum(fn (array $row) => (int) ($row['finalized_reviews'] ?? 0))],
                ['label' => 'Competency Assessments', 'value' => $rows->sum(fn (array $row) => (int) ($row['competency_assessments'] ?? 0))],
                ['label' => 'Development Completions', 'value' => $rows->sum(fn (array $row) => (int) ($row['learning_completions'] ?? 0) + (int) ($row['training_completions'] ?? 0))],
            ];
        }

        return match ($reportKey) {
            'performance-cycle' => [
                ['label' => 'Reviews in Scope', 'value' => $rows->count()],
                ['label' => 'Finalized', 'value' => $rows->filter(fn (array $row) => ! empty($row['finalized_at']))->count()],
                ['label' => 'Open Reviews', 'value' => $rows->filter(fn (array $row) => empty($row['finalized_at']))->count()],
                ['label' => 'Rated Reviews', 'value' => $rows->filter(fn (array $row) => $row['final_rating'] !== null && $row['final_rating'] !== '')->count()],
            ],
            'learning-compliance' => [
                ['label' => 'Assignments', 'value' => $rows->count()],
                ['label' => 'Completed', 'value' => $rows->filter(fn (array $row) => ! empty($row['completed_at']))->count()],
                ['label' => 'Valid Certificates', 'value' => $rows->where('certificate_status', 'Valid')->count()],
                ['label' => 'Certificate Attention', 'value' => $rows->filter(fn (array $row) => in_array($row['certificate_status'] ?? '', ['Expiring Soon', 'Expired', 'Revoked'], true))->count()],
            ],
            'training-effectiveness' => [
                ['label' => 'Participants', 'value' => $rows->count()],
                ['label' => 'Finalized', 'value' => $rows->filter(fn (array $row) => ! empty($row['finalized_at']))->count()],
                ['label' => 'Passed', 'value' => $rows->where('completion_status', 'Passed')->count()],
                ['label' => 'Active Certificates', 'value' => $rows->where('certificate_status', 'Active')->count()],
            ],
            'succession-risk' => [
                ['label' => 'Critical Positions', 'value' => $rows->count()],
                ['label' => 'Covered', 'value' => $rows->filter(fn (array $row) => (int) ($row['successor_count'] ?? 0) > 0)->count()],
                ['label' => 'Ready Now Coverage', 'value' => $rows->filter(fn (array $row) => (int) ($row['ready_now_count'] ?? 0) > 0)->count()],
                ['label' => 'Positions At Risk', 'value' => $rows->where('coverage_risk', 'At Risk')->count()],
            ],
            'recognition-activity' => [
                ['label' => 'Records', 'value' => $rows->count()],
                ['label' => 'Recognized', 'value' => $rows->where('status', 'Recognized')->count()],
                ['label' => 'Pending Review', 'value' => $rows->where('status', 'Pending Review')->count()],
                ['label' => 'People Recognized', 'value' => $rows->where('status', 'Recognized')->pluck('person')->filter()->unique()->count()],
            ],
            default => [
                ['label' => 'People in Scope', 'value' => $rows->count()],
                ['label' => 'Finalized Reviews', 'value' => $rows->sum(fn (array $row) => (int) ($row['finalized_reviews'] ?? 0))],
                ['label' => 'Competency Assessments', 'value' => $rows->sum(fn (array $row) => (int) ($row['competency_assessments'] ?? 0))],
                ['label' => 'Development Completions', 'value' => $rows->sum(fn (array $row) => (int) ($row['learning_completions'] ?? 0) + (int) ($row['training_completions'] ?? 0))],
            ],
        };
    }

    private function workforceRows(User $actor, array $filters): Collection
    {
        $query = User::query()->activePersonnel()->orderBy('name');
        if ($actor->role === UserRole::User) {
            $query->whereKey($actor->id);
        }
        if ($filters['department'] ?? null) {
            $query->where('department', $filters['department']);
        }

        return $query->get()->map(function (User $person) use ($filters): array {
            $reviewCount = 0;
            if (Schema::hasTable('performance_review_assignments') && Schema::hasTable('performance_reviews')) {
                $reviewQuery = DB::table('performance_review_assignments as a')
                    ->join('performance_reviews as r', 'r.performance_review_assignment_id', '=', 'a.id')
                    ->where('a.subject_user_id', $person->id)
                    ->whereNotNull('r.finalized_at');
                $this->applyDateRange($reviewQuery, 'r.finalized_at', $filters);
                $reviewCount = $reviewQuery->count();
            }

            $competencyAssessments = 0;
            if (Schema::hasTable('competency_assessments') && Schema::hasTable('competency_finalizations')) {
                $competencyQuery = DB::table('competency_assessments as a')
                    ->join('competency_finalizations as f', 'f.assessment_id', '=', 'a.id')
                    ->where('a.person_id', $person->id);
                $this->applyDateRange($competencyQuery, 'f.finalized_at', $filters);
                $competencyAssessments = $competencyQuery->distinct()->count('a.id');
            }

            $competencyOpenGaps = 0;
            if (Schema::hasTable('competency_recommendations')) {
                $gapQuery = DB::table('competency_recommendations')
                    ->where('person_id', $person->id)
                    ->where('status', '!=', 'Reassessed');
                $competencyOpenGaps = $gapQuery->count();
            }

            $learning = 0;
            if (Schema::hasTable('learning_completions')) {
                $learningQuery = DB::table('learning_completions')->where('learner_id', $person->id);
                $this->applyDateRange($learningQuery, 'completed_at', $filters);
                $learning = $learningQuery->count();
            }

            $training = 0;
            if (Schema::hasTable('training_completions') && Schema::hasTable('training_enrollments')) {
                $trainingQuery = DB::table('training_completions as c')
                    ->join('training_enrollments as e', 'e.id', '=', 'c.enrollment_id')
                    ->where('e.participant_id', $person->id);
                $this->applyDateRange($trainingQuery, 'c.finalized_at', $filters);
                $training = $trainingQuery->count();
            }

            $recognition = 0;
            if (Schema::hasTable('recognition_records')) {
                $recognitionQuery = DB::table('recognition_records')
                    ->where('recipient_id', $person->id)
                    ->where('status', 'Recognized');
                $this->applyDateRange($recognitionQuery, 'recognized_at', $filters);
                $recognition = $recognitionQuery->count();
            }

            return [
                'id' => (string) $person->id,
                'person' => $person->name,
                'employee_id' => $person->employee_or_trainee_id,
                'department' => $person->department,
                'position' => $person->position,
                'finalized_reviews' => $reviewCount,
                'competency_assessments' => $competencyAssessments,
                'open_competency_gaps' => $competencyOpenGaps,
                'learning_completions' => $learning,
                'training_completions' => $training,
                'recognitions' => $recognition,
            ];
        });
    }

    private function performanceRows(array $filters): Collection
    {
        if (! Schema::hasTable('performance_reviews')) {
            return collect();
        }

        $query = DB::table('performance_review_assignments as a')
            ->join('users as u', 'u.id', '=', 'a.subject_user_id')
            ->join('performance_cycles as c', 'c.id', '=', 'a.performance_cycle_id')
            ->leftJoin('performance_reviews as r', 'r.performance_review_assignment_id', '=', 'a.id')
            ->selectRaw("a.id, u.name as person, u.department, c.name as cycle, COALESCE(r.status, 'Pending') as status, r.final_rating, r.finalized_at")
            ->orderBy('u.name');

        if ($filters['department'] ?? null) {
            $query->where('u.department', $filters['department']);
        }
        $this->applyDateRange($query, 'a.assigned_at', $filters);

        return $query->get()->map(fn ($row) => (array) $row);
    }

    private function learningRows(array $filters): Collection
    {
        if (! Schema::hasTable('learning_assignments')) {
            return collect();
        }

        $query = DB::table('learning_assignments as a')
            ->join('users as u', 'u.id', '=', 'a.learner_id')
            ->join('learning_course_versions as v', 'v.id', '=', 'a.course_version_id')
            ->leftJoin('learning_completions as c', 'c.assignment_id', '=', 'a.id')
            ->leftJoin('learning_certificates as cert', 'cert.completion_id', '=', 'c.id')
            ->select(
                'a.id',
                'u.name as person',
                'u.department',
                'v.title as course',
                'a.status',
                'a.progress_percent',
                'a.due_at',
                'c.completed_at',
                'c.assessment_score',
                'cert.certificate_number',
                'cert.status as certificate_record_status',
                'cert.expires_on'
            )
            ->orderByDesc('a.assigned_at');

        if ($filters['department'] ?? null) {
            $query->where('u.department', $filters['department']);
        }
        $this->applyDateRange($query, 'a.assigned_at', $filters);

        return $query->get()->map(function ($row): array {
            $item = (array) $row;
            $item['certificate_status'] = $this->certificateStatus(
                $item['certificate_record_status'] ?? null,
                $item['expires_on'] ?? null,
                'Valid'
            );
            unset($item['certificate_record_status']);

            return $item;
        });
    }

    private function trainingRows(array $filters): Collection
    {
        if (! Schema::hasTable('training_enrollments')) {
            return collect();
        }

        $query = DB::table('training_enrollments as e')
            ->join('users as u', 'u.id', '=', 'e.participant_id')
            ->join('training_programs as p', 'p.id', '=', 'e.program_id')
            ->leftJoin('training_completions as c', 'c.enrollment_id', '=', 'e.id')
            ->leftJoin('training_assessments as a', 'a.enrollment_id', '=', 'e.id')
            ->leftJoin('training_certificates as cert', 'cert.completion_id', '=', 'c.id')
            ->select(
                'e.id',
                'u.name as person',
                'u.department',
                'p.title as program',
                'e.status as enrollment_status',
                'c.status as completion_status',
                'c.attendance_rate',
                'a.result as practical_result',
                'c.finalized_at',
                'cert.certificate_number',
                'cert.status as certificate_record_status',
                'cert.expires_at'
            )
            ->orderByDesc('e.assigned_at');

        if ($filters['department'] ?? null) {
            $query->where('u.department', $filters['department']);
        }
        $this->applyDateRange($query, 'e.assigned_at', $filters);

        return $query->get()->map(function ($row): array {
            $item = (array) $row;
            $item['status'] = $item['completion_status'] ?: $item['enrollment_status'];
            $item['certificate_status'] = $this->certificateStatus(
                $item['certificate_record_status'] ?? null,
                $item['expires_at'] ?? null,
                'Active'
            );
            unset($item['certificate_record_status']);

            return $item;
        });
    }

    private function successionRows(array $filters): Collection
    {
        if (! Schema::hasTable('succession_critical_positions')) {
            return collect();
        }

        $query = DB::table('succession_critical_positions as p')
            ->select(
                'p.id',
                'p.position_title as position',
                'p.department',
                'p.criticality',
                'p.status',
                'p.next_review_at'
            )
            ->orderByRaw("CASE p.criticality WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Moderate' THEN 3 ELSE 4 END")
            ->orderBy('p.position_title');

        if ($filters['department'] ?? null) {
            $query->where('p.department', $filters['department']);
        }
        $this->applyDateRange($query, 'p.created_at', $filters);

        return $query->get()->map(function ($position): array {
            $item = (array) $position;
            $successorCount = 0;
            $readyNowCount = 0;

            if (Schema::hasTable('succession_candidates')) {
                $candidateIds = DB::table('succession_candidates')
                    ->where('critical_position_id', $position->id)
                    ->where('status', 'Accepted')
                    ->pluck('id');
                $successorCount = $candidateIds->count();

                if ($candidateIds->isNotEmpty() && Schema::hasTable('succession_readiness_assessments')) {
                    $latestByCandidate = DB::table('succession_readiness_assessments')
                        ->whereIn('succession_candidate_id', $candidateIds)
                        ->whereNotNull('finalized_at')
                        ->orderByDesc('version')
                        ->get(['succession_candidate_id', 'readiness_band', 'version'])
                        ->groupBy('succession_candidate_id')
                        ->map(fn (Collection $versions) => $versions->first());

                    $readyNowCount = $latestByCandidate
                        ->filter(fn ($assessment) => ($assessment->readiness_band ?? null) === 'Ready Now')
                        ->count();
                }
            }

            $item['successor_count'] = $successorCount;
            $item['ready_now_count'] = $readyNowCount;
            $item['coverage_risk'] = $successorCount === 0
                ? 'At Risk'
                : ($readyNowCount > 0 ? 'Covered' : 'Developing Coverage');

            return $item;
        });
    }

    private function recognitionRows(array $filters): Collection
    {
        if (! Schema::hasTable('recognition_records')) {
            return collect();
        }

        $query = DB::table('recognition_records as r')
            ->leftJoin('users as u', 'u.id', '=', 'r.recipient_id')
            ->join('recognition_categories as c', 'c.id', '=', 'r.category_id')
            ->select(
                'r.id',
                'u.name as person',
                'u.department',
                'r.title',
                'c.name as category',
                'r.status',
                'r.achievement_date',
                'r.recognized_at'
            )
            ->orderByDesc('r.achievement_date');

        if ($filters['department'] ?? null) {
            $query->where('u.department', $filters['department']);
        }
        $this->applyDateRange($query, 'r.achievement_date', $filters);

        return $query->get()->map(fn ($row) => (array) $row);
    }

    private function applyDateRange($query, string $column, array $filters): void
    {
        if ($filters['date_from'] ?? null) {
            $query->whereDate($column, '>=', $filters['date_from']);
        }
        if ($filters['date_to'] ?? null) {
            $query->whereDate($column, '<=', $filters['date_to']);
        }
    }

    private function certificateStatus(?string $storedStatus, mixed $expiresAt, string $defaultActiveStatus): string
    {
        if (! $storedStatus) {
            return '—';
        }

        if (in_array($storedStatus, ['Revoked', 'Expired'], true)) {
            return $storedStatus;
        }

        if ($expiresAt) {
            $expiry = CarbonImmutable::parse($expiresAt)->startOfDay();
            if ($expiry->isPast()) {
                return 'Expired';
            }
            if ($expiry->lte(now()->addDays(30)->startOfDay())) {
                return 'Expiring Soon';
            }
        }

        return $storedStatus ?: $defaultActiveStatus;
    }
}
