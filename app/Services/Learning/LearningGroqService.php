<?php

namespace App\Services\Learning;

use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningGroqService
{
    private const USE_CASES = ['Course Outline', 'Module and Lesson Titles', 'Learning Objectives', 'Lesson Content', 'Knowledge Check Questions', 'Competency-aligned Objectives'];
    public function __construct(
        private readonly LearningAuditService $audit,
        private readonly LearningSourceLibraryService $sources,
    ) {}

    public function generate(User $actor, LearningCourseVersion $version, string $useCase, array $context): array
    {
        $version = LearningCourseVersion::query()->with(['course', 'modules.lessons', 'assessments.questions.options'])->findOrFail($version->id);
        $this->authorizeAuthor($actor, $version);
        if (! in_array($useCase, self::USE_CASES, true)) throw ValidationException::withMessages(['useCase' => 'This Learning AI use case is not supported.']);
        $key = (string) config('services.groq.key'); if ($key === '') abort(503, 'Groq AI is not configured on the Laravel server.');
        $grounding = $this->buildGroundingContext($version, $useCase);
        $eventId = (string) Str::uuid(); $model = (string) config('services.groq.learning_model', config('services.groq.model'));
        DB::table('learning_ai_generation_events')->insert(['id' => $eventId, 'actor_id' => $actor->id, 'course_version_id' => $version->id, 'use_case' => $useCase, 'model' => $model, 'grounding_context' => json_encode($grounding), 'status' => 'Requested', 'created_at' => now(), 'updated_at' => now()]);
        try {
            $response = Http::withToken($key)->acceptJson()->asJson()->timeout((int) config('services.groq.timeout', 20))->retry(2, 300, throw: false)->post(rtrim((string) config('services.groq.url'), '/').'/chat/completions', [
                'model' => $model, 'temperature' => 0.2, 'max_tokens' => 1400, 'response_format' => ['type' => 'json_object'],
                'messages' => [
                    ['role' => 'system', 'content' => 'You draft online learning content for authorized human review. Return strict JSON with keys title, rationale, and items. Never publish, assign learners, grade official attempts, change competency results, close gaps, or invent source text. Label the result as an AI Draft.'],
                    ['role' => 'user', 'content' => 'Use case: '.$useCase."\nGround only in this context:\n".json_encode($grounding, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)],
                ],
            ]);
            if (! $response->successful()) throw new \RuntimeException('Groq returned HTTP '.$response->status());
            $output = json_decode((string) $response->json('choices.0.message.content'), true, flags: JSON_THROW_ON_ERROR);
            if (! is_array($output) || ! isset($output['title'], $output['items']) || ! is_array($output['items'])) throw new \UnexpectedValueException('Groq returned malformed structured output.');
            $output['label'] = 'AI Draft';
            DB::table('learning_ai_generation_events')->where('id', $eventId)->update(['generated_output' => json_encode($output), 'status' => 'Generated', 'updated_at' => now()]);
            return ['eventId' => $eventId, 'model' => $model, 'generatedAt' => now()->toIso8601String(), 'humanReviewRequired' => true, 'draft' => $output];
        } catch (\Throwable $e) {
            report($e); DB::table('learning_ai_generation_events')->where('id', $eventId)->update(['status' => 'Failed', 'error_message' => mb_substr($e->getMessage(), 0, 1000), 'updated_at' => now()]);
            abort(502, 'Groq AI could not produce a valid draft. Your entered course content was not changed.');
        }
    }

    public function decide(User $actor, string $eventId, string $decision, ?array $acceptedOutput): void
    {
        if (! in_array($decision, ['Accepted', 'Rejected'], true)) throw ValidationException::withMessages(['decision' => 'Choose Accept or Reject.']);
        DB::transaction(function () use ($actor, $eventId, $decision, $acceptedOutput) {
            $event = DB::table('learning_ai_generation_events')->where('id', $eventId)->lockForUpdate()->first(); if (! $event) abort(404);
            $courseId = LearningCourseVersion::query()->whereKey($event->course_version_id)->value('course_id');
            $course = LearningCourse::query()->lockForUpdate()->findOrFail($courseId);
            $version = LearningCourseVersion::query()->lockForUpdate()->findOrFail($event->course_version_id);
            if ($version->course_id !== $course->id) throw ValidationException::withMessages(['event' => 'The AI event course context changed. Please retry.']);
            $version->setRelation('course', $course);
            $this->authorizeAuthor($actor, $version);
            if ($event->status !== 'Generated' || $event->human_decision) throw ValidationException::withMessages(['event' => 'This AI draft has already been decided.']);
            DB::table('learning_ai_generation_events')->where('id', $eventId)->update(['status' => 'Human Reviewed', 'human_decision' => $decision, 'accepted_output' => $decision === 'Accepted' ? json_encode($acceptedOutput ?? []) : null, 'decided_at' => now(), 'updated_at' => now()]);
            $this->audit->record($actor, 'AI output '.mb_strtolower($decision), 'LearningAiGenerationEvent', $eventId);
        }, 3);
    }

    public function sanitizeContext(array $context): array
    {
        $blockedKeys = '/(?:learner|person|employee|personnel|email|phone|mobile|address|birth|government|national|payroll|user.?id)/i';
        $clean = [];
        foreach ($context as $key => $value) {
            if (is_string($key) && preg_match($blockedKeys, $key)) continue;
            if (is_array($value)) {
                $clean[$key] = $this->sanitizeContext($value);
                continue;
            }
            if (is_string($value)) {
                $value = preg_replace('/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i', '[removed]', $value);
                $value = preg_replace('/\b(?:EMP|USR|PERSON|PERS)[-_ ]?\d{2,}\b/i', '[removed]', $value);
            }
            $clean[$key] = $value;
        }

        return json_decode(json_encode($clean, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
    }

    public function buildGroundingContext(LearningCourseVersion $version, string $useCase): array
    {
        $version->loadMissing(['modules.lessons', 'assessments.questions.options']);
        $sourceDocuments = collect($this->sources->links($version->id))->map(function (array $source): array {
            return [
                'documentId' => $source['documentId'],
                'title' => $source['title'],
                'version' => $source['version'],
                'type' => $source['type'],
                'owner' => $source['owner'],
                'content' => $this->cleanText($this->sources->sourceText($source['documentId'], 10000), 10000),
            ];
        })->values()->all();

        return [
            'useCase' => $useCase,
            'sourceDocuments' => $sourceDocuments,
            'course' => [
                'title' => $this->cleanText($version->title),
                'description' => $this->cleanText($version->description),
                'category' => $this->cleanText($version->category),
                'difficulty' => $this->cleanText($version->difficulty),
                'language' => $this->cleanText($version->language),
                'targetDepartments' => ($version->audience_rules ?? [])['departments'] ?? [],
                'companyWide' => (bool) (($version->audience_rules ?? [])['allDepartments'] ?? false),
                'learningObjectives' => collect($version->learning_objectives ?? [])->map(fn ($text) => $this->cleanText($text))->values()->all(),
                'modules' => $version->modules->map(fn ($module) => [
                    'title' => $this->cleanText($module->title),
                    'description' => $this->cleanText($module->description),
                    'lessons' => $module->lessons->map(fn ($lesson) => [
                        'title' => $this->cleanText($lesson->title),
                        'objective' => $this->cleanText($lesson->objective),
                        'description' => $this->cleanText($lesson->description),
                        'contentType' => $lesson->content_type,
                        'textContent' => $this->cleanText($lesson->text_content, 12000),
                    ])->values()->all(),
                ])->values()->all(),
            ],
        ];
    }

    private function cleanText(mixed $value, int $limit = 4000): string
    {
        $text = strip_tags((string) ($value ?? ''));
        $text = preg_replace('/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i', '[removed]', $text);
        $text = preg_replace('/\b(?:EMP|USR|PERSON|PERS)[-_ ]?[A-Z0-9]{2,}\b/i', '[removed]', $text);
        $text = preg_replace('/(?:\+?63|0)9\d{9}\b/', '[removed]', $text);
        return mb_substr(trim($text), 0, $limit);
    }

    private function authorizeAuthor(User $actor, LearningCourseVersion $version): void { if ($actor->role !== \App\Enums\UserRole::HR || $version->course?->archived_at || $version->version_number !== null || ! in_array($version->status, ['Draft', 'Changes Requested'], true) || ! DB::table('learning_course_collaborators')->where('course_id', $version->course_id)->where('user_id', $actor->id)->whereIn('permission', ['Owner', 'Author'])->exists()) throw new AuthorizationException('Only the assigned HR course author may use Aevyn course assistance.'); }
}
