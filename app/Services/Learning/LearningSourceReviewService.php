<?php

namespace App\Services\Learning;

use App\Enums\UserRole;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningSourceReviewService
{
    public function __construct(
        private readonly LearningSourceLibraryService $sources,
        private readonly LearningAuditService $audit,
    ) {}

    public function scan(User $actor, LearningCourseVersion $version): array
    {
        $this->authorize($actor, $version);
        $version = LearningCourseVersion::query()
            ->with(['course', 'modules.lessons', 'assessments.questions.options'])
            ->findOrFail($version->id);

        $links = $this->sources->links($version->id);
        $fingerprint = $this->fingerprint($version);
        $deterministic = $this->deterministicReview($version, $links);
        $ai = $this->aiReview($version, $links, $deterministic);

        $status = $deterministic['status'];
        $coverage = $deterministic['coveragePercent'];
        $summary = $deterministic['summary'];
        $findings = $deterministic['findings'];
        $aiUsed = false;
        $model = null;

        if ($ai !== null) {
            $aiUsed = true;
            $model = $ai['model'];
            $summary = trim((string) ($ai['summary'] ?? $summary)) ?: $summary;
            $findings = array_values(array_unique(array_merge(
                $findings,
                collect($ai['findings'] ?? [])->map(fn ($finding) => trim((string) $finding))->filter()->all(),
            )));
            if ($status !== 'Blocked' && ($ai['status'] ?? '') === 'Attention') {
                $status = 'Attention';
            }
            if (isset($ai['coveragePercent']) && is_numeric($ai['coveragePercent'])) {
                $aiCoverage = max(0, min(100, (int) round((float) $ai['coveragePercent'])));
                $coverage = min($coverage, $aiCoverage);
            }
        }

        $id = (string) Str::uuid();
        DB::table('learning_course_source_reviews')->insert([
            'id' => $id,
            'course_version_id' => $version->id,
            'content_fingerprint' => $fingerprint,
            'status' => $status,
            'coverage_percent' => $coverage,
            'summary' => $summary,
            'findings' => json_encode($findings, JSON_THROW_ON_ERROR),
            'source_snapshot' => json_encode($links, JSON_THROW_ON_ERROR),
            'ai_used' => $aiUsed,
            'model' => $model,
            'scanned_by' => $actor->id,
            'scanned_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->audit->record($actor, 'Course source review completed', 'LearningCourseVersion', $version->id, [
            'reviewId' => $id,
            'status' => $status,
            'coveragePercent' => $coverage,
            'aiUsed' => $aiUsed,
        ]);

        return $this->latest($version);
    }

    public function latest(LearningCourseVersion $version): ?array
    {
        $row = DB::table('learning_course_source_reviews')
            ->where('course_version_id', $version->id)
            ->orderByDesc('scanned_at')
            ->first();
        if (! $row) return null;

        $currentFingerprint = $this->fingerprint($version);

        return [
            'id' => $row->id,
            'status' => $row->status,
            'coveragePercent' => (int) $row->coverage_percent,
            'summary' => $row->summary,
            'findings' => json_decode($row->findings, true) ?? [],
            'sources' => json_decode($row->source_snapshot, true) ?? [],
            'aiUsed' => (bool) $row->ai_used,
            'model' => $row->model,
            'scannedAt' => $row->scanned_at,
            'current' => hash_equals((string) $row->content_fingerprint, $currentFingerprint),
        ];
    }

    public function assertPublishable(LearningCourseVersion $version): void
    {
        $review = $this->latest($version);
        if (! $review || ! $review['current']) {
            throw ValidationException::withMessages([
                'sourceReview' => 'Run the course source review after the latest course changes before publishing.',
            ]);
        }
        if ($review['status'] === 'Blocked') {
            throw ValidationException::withMessages([
                'sourceReview' => 'The course source review found a blocking source issue. Resolve it before publishing.',
            ]);
        }
    }

    public function fingerprint(LearningCourseVersion $version): string
    {
        $version->loadMissing(['course', 'modules.lessons', 'assessments.questions.options']);
        $sourceIds = DB::table('learning_course_source_links')
            ->where('course_version_id', $version->id)
            ->orderBy('document_id')
            ->get(['document_id', 'document_version'])
            ->map(fn ($row) => [$row->document_id, $row->document_version])
            ->values()->all();

        $payload = [
            'title' => $version->title,
            'description' => $version->description,
            'category' => $version->category,
            'difficulty' => $version->difficulty,
            'language' => $version->language,
            'learningObjectives' => $version->learning_objectives,
            'audience' => $version->audience_rules,
            'completion' => $version->completion_rules,
            'sources' => $sourceIds,
            'competencies' => DB::table('learning_course_competencies')
                ->where('course_version_id', $version->id)
                ->orderBy('competency_id')
                ->get(['competency_id', 'competency_version', 'target_level'])
                ->map(fn ($row) => (array) $row)->all(),
            'modules' => $version->modules->map(fn ($module) => [
                'title' => $module->title,
                'description' => $module->description,
                'lessons' => $module->lessons->map(fn ($lesson) => [
                    'title' => $lesson->title,
                    'objective' => $lesson->objective,
                    'description' => $lesson->description,
                    'text' => $lesson->text_content,
                    'externalUrl' => $lesson->external_url,
                    'required' => $lesson->is_required,
                ])->values()->all(),
            ])->values()->all(),
            'assessments' => $version->assessments->map(fn ($assessment) => [
                'type' => $assessment->assessment_type,
                'title' => $assessment->title,
                'passingScore' => $assessment->passing_score,
                'questions' => $assessment->questions->map(fn ($question) => [
                    'type' => $question->question_type,
                    'text' => $question->question_text,
                    'options' => $question->options->map(fn ($option) => [
                        'text' => $option->option_text,
                        'correct' => $option->is_correct,
                    ])->values()->all(),
                ])->values()->all(),
            ])->values()->all(),
        ];

        return hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    private function deterministicReview(LearningCourseVersion $version, array $links): array
    {
        if ($links === []) {
            return [
                'status' => 'Blocked',
                'coveragePercent' => 0,
                'summary' => 'No source documents are linked to this course.',
                'findings' => ['Link at least one relevant company source before publication.'],
            ];
        }

        $rules = $version->audience_rules ?? [];
        $targets = collect($rules['departments'] ?? [])->map(fn ($value) => trim((string) $value))->filter()->unique()->values();
        $allDepartments = (bool) ($rules['allDepartments'] ?? false);
        $covered = collect($links)->flatMap(function (array $source) {
            return collect(preg_split('/\s*\/\s*/', (string) ($source['owner'] ?? '')) ?: [])
                ->map(fn ($value) => trim((string) $value))->filter()->all();
        })->unique()->values();

        if ($allDepartments || $targets->isEmpty()) {
            return [
                'status' => 'Ready',
                'coveragePercent' => 100,
                'summary' => count($links).' linked source document(s) are available for review.',
                'findings' => [],
            ];
        }

        $matched = $targets->filter(fn (string $department) => $covered->contains($department));
        $coverage = (int) round(($matched->count() / max(1, $targets->count())) * 100);
        $missing = $targets->diff($matched)->values();

        return [
            'status' => $missing->isEmpty() ? 'Ready' : 'Attention',
            'coveragePercent' => $coverage,
            'summary' => $missing->isEmpty()
                ? 'Linked sources align with the target department scope.'
                : 'Some target departments do not have a directly owned source in the selected set.',
            'findings' => $missing->isEmpty()
                ? []
                : ['Review source coverage for: '.$missing->implode(', ').'.'],
        ];
    }

    private function aiReview(LearningCourseVersion $version, array $links, array $deterministic): ?array
    {
        $key = trim((string) config('services.groq.key'));
        $url = trim((string) config('services.groq.url'));
        if ($key === '' || $url === '') return null;

        $sourceContext = collect($links)->take(8)->map(function (array $source): array {
            return [
                'documentId' => $source['documentId'],
                'title' => $source['title'],
                'version' => $source['version'],
                'owner' => $source['owner'],
                'content' => $this->clean($this->sources->sourceText($source['documentId'], 6000), 6000),
            ];
        })->values()->all();

        $courseContext = [
            'title' => $this->clean($version->title),
            'description' => $this->clean($version->description, 6000),
            'category' => $version->category,
            'learningObjectives' => collect($version->learning_objectives ?? [])->map(fn ($value) => $this->clean($value, 1000))->all(),
            'targetDepartments' => ($version->audience_rules ?? [])['departments'] ?? [],
            'allDepartments' => (bool) (($version->audience_rules ?? [])['allDepartments'] ?? false),
            'modules' => $version->modules->map(fn ($module) => [
                'title' => $this->clean($module->title),
                'lessons' => $module->lessons->map(fn ($lesson) => [
                    'title' => $this->clean($lesson->title),
                    'objective' => $this->clean($lesson->objective, 1200),
                    'text' => $this->clean($lesson->text_content, 4000),
                ])->values()->all(),
            ])->values()->all(),
            'assessments' => $version->assessments->map(fn ($assessment) => [
                'type' => $assessment->assessment_type,
                'title' => $this->clean($assessment->title),
                'questions' => $assessment->questions->map(fn ($question) => [
                    'question' => $this->clean($question->question_text, 1500),
                    'explanation' => $this->clean($question->explanation, 1500),
                    'options' => $question->options->map(fn ($option) => $this->clean($option->option_text, 700))->values()->all(),
                ])->values()->all(),
            ])->values()->all(),
        ];

        try {
            $model = (string) config('services.groq.learning_model', config('services.groq.model'));
            $response = Http::withToken($key)->acceptJson()->asJson()
                ->timeout((int) config('services.groq.timeout', 20))
                ->retry(1, 250, throw: false)
                ->post(rtrim($url, '/').'/chat/completions', [
                    'model' => $model,
                    'temperature' => 0.1,
                    'max_tokens' => 1200,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are Aevyn reviewing a company learning course before publication. Compare only the supplied course content with the supplied source documents. Do not invent policy requirements. Return strict JSON: status (Ready or Attention), coveragePercent (0-100), summary, findings (array of short actionable strings). You advise the human publisher; you do not approve or publish.',
                        ],
                        [
                            'role' => 'user',
                            'content' => json_encode([
                                'deterministicChecks' => $deterministic,
                                'course' => $courseContext,
                                'sources' => $sourceContext,
                            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR),
                        ],
                    ],
                ]);
            if (! $response->successful()) return null;
            $content = $response->json('choices.0.message.content');
            $decoded = json_decode((string) $content, true);
            if (! is_array($decoded)) return null;

            return [
                'status' => in_array(($decoded['status'] ?? ''), ['Ready', 'Attention'], true) ? $decoded['status'] : 'Attention',
                'coveragePercent' => is_numeric($decoded['coveragePercent'] ?? null) ? (int) $decoded['coveragePercent'] : $deterministic['coveragePercent'],
                'summary' => trim((string) ($decoded['summary'] ?? '')),
                'findings' => is_array($decoded['findings'] ?? null) ? $decoded['findings'] : [],
                'model' => $model,
            ];
        } catch (\Throwable $exception) {
            report($exception);
            return null;
        }
    }

    private function clean(mixed $value, int $limit = 3000): string
    {
        $text = strip_tags((string) ($value ?? ''));
        $text = preg_replace('/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i', '[removed]', $text);
        $text = preg_replace('/\b(?:EMP|USR|PERSON|PERS)[-_ ]?[A-Z0-9]{2,}\b/i', '[removed]', $text);
        return mb_substr(trim($text), 0, $limit);
    }

    private function authorize(User $actor, LearningCourseVersion $version): void
    {
        $isHrAuthor = $actor->role === UserRole::HR
            && DB::table('learning_course_collaborators')
                ->where('course_id', $version->course_id)
                ->where('user_id', $actor->id)
                ->whereIn('permission', ['Owner', 'Author'])
                ->exists();
        $isAdminPublisher = $actor->role === UserRole::Admin
            && DB::table('learning_course_collaborators')
                ->where('course_id', $version->course_id)
                ->where('user_id', $actor->id)
                ->where('permission', 'Publisher')
                ->exists();
        if (! $isHrAuthor && ! $isAdminPublisher) {
            throw new AuthorizationException('Only the HR course author or assigned Admin publisher may run the course source review.');
        }
    }
}
