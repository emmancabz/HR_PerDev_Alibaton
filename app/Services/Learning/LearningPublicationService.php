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

class LearningPublicationService
{
    public function __construct(
        private readonly LearningEligibilityService $eligibility,
        private readonly LearningSourceLibraryService $sources,
        private readonly LearningAuditService $audit,
    ) {}

    public function publishToLms(User $actor, LearningCourseVersion $version): array
    {
        $this->authorize($actor, $version);
        $version = LearningCourseVersion::query()
            ->with([
                'course',
                'modules.lessons',
                'assessments.questions.options',
            ])
            ->findOrFail($version->id);

        if ($version->status !== 'Published' || $version->version_number === null) {
            throw ValidationException::withMessages([
                'publication' => 'Only an official Published course version can be sent to the learner LMS.',
            ]);
        }

        $targets = User::query()
            ->activePersonnel()
            ->where('role', UserRole::User->value)
            ->orderBy('id')
            ->get()
            ->filter(fn (User $person) => $this->eligibility->matchesAudience($person, $version))
            ->values();

        $delivery = DB::table('learning_publication_deliveries')
            ->where('course_version_id', $version->id)
            ->first();
        $deliveryId = $delivery?->id ?: (string) Str::uuid();
        $payload = $this->payload($deliveryId, $version, $targets->all());

        DB::table('learning_publication_deliveries')->updateOrInsert(
            ['course_version_id' => $version->id],
            [
                'id' => $deliveryId,
                'event_name' => 'course.published',
                'status' => $delivery?->status === 'Delivered' ? 'Delivered' : 'Queued',
                'target_count' => $targets->count(),
                'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                'attempts' => (int) ($delivery?->attempts ?? 0),
                'last_error' => $delivery?->last_error,
                'last_attempt_at' => $delivery?->last_attempt_at,
                'delivered_at' => $delivery?->delivered_at,
                'published_by' => $actor->id,
                'created_at' => $delivery?->created_at ?? now(),
                'updated_at' => now(),
            ],
        );

        if ($delivery?->status === 'Delivered') {
            return $this->statusFor($version->id) ?? [];
        }

        return $this->dispatch($actor, $version, $deliveryId, $payload);
    }

    public function retry(User $actor, LearningCourseVersion $version): array
    {
        $this->authorize($actor, $version);
        $delivery = DB::table('learning_publication_deliveries')
            ->where('course_version_id', $version->id)
            ->first();
        if (! $delivery) {
            return $this->publishToLms($actor, $version);
        }
        if ($delivery->status === 'Delivered') {
            return $this->statusFor($version->id) ?? [];
        }

        $payload = json_decode((string) $delivery->payload, true);
        if (! is_array($payload)) {
            throw ValidationException::withMessages([
                'publication' => 'The stored LMS publication package is invalid. Republish the course version.',
            ]);
        }

        return $this->dispatch($actor, $version, $delivery->id, $payload);
    }

    public function statusFor(string $versionId): ?array
    {
        $row = DB::table('learning_publication_deliveries')
            ->where('course_version_id', $versionId)
            ->first();
        if (! $row) return null;

        return [
            'id' => $row->id,
            'event' => $row->event_name,
            'status' => $row->status,
            'targetCount' => (int) $row->target_count,
            'attempts' => (int) $row->attempts,
            'lastError' => $row->last_error,
            'lastAttemptAt' => $row->last_attempt_at,
            'deliveredAt' => $row->delivered_at,
        ];
    }

    private function dispatch(User $actor, LearningCourseVersion $version, string $deliveryId, array $payload): array
    {
        $url = trim((string) config('services.learning_lms.url'));
        $token = trim((string) config('services.learning_lms.token'));
        $attempts = (int) DB::table('learning_publication_deliveries')->where('id', $deliveryId)->value('attempts') + 1;

        if ($url === '') {
            DB::table('learning_publication_deliveries')->where('id', $deliveryId)->update([
                'status' => 'Queued',
                'attempts' => $attempts,
                'last_error' => 'Learner LMS endpoint is not configured.',
                'last_attempt_at' => now(),
                'updated_at' => now(),
            ]);
            $this->audit->record($actor, 'LMS publication queued', 'LearningCourseVersion', $version->id, [
                'deliveryId' => $deliveryId,
                'targetCount' => $payload['audience']['targetCount'] ?? 0,
            ]);
            return $this->statusFor($version->id) ?? [];
        }

        try {
            $request = Http::acceptJson()
                ->asJson()
                ->timeout((int) config('services.learning_lms.timeout', 15))
                ->retry(2, 350, throw: false)
                ->withHeaders([
                    'X-Publication-Id' => $deliveryId,
                    'X-Learning-Event' => 'course.published',
                ]);
            if ($token !== '') $request = $request->withToken($token);

            $response = $request->post(rtrim($url, '/'), $payload);
            if (! $response->successful()) {
                throw new \RuntimeException('Learner LMS returned HTTP '.$response->status().'.');
            }

            DB::table('learning_publication_deliveries')->where('id', $deliveryId)->update([
                'status' => 'Delivered',
                'attempts' => $attempts,
                'last_error' => null,
                'last_attempt_at' => now(),
                'delivered_at' => now(),
                'updated_at' => now(),
            ]);
            $this->audit->record($actor, 'Course delivered to learner LMS', 'LearningCourseVersion', $version->id, [
                'deliveryId' => $deliveryId,
                'targetCount' => $payload['audience']['targetCount'] ?? 0,
            ]);
        } catch (\Throwable $exception) {
            report($exception);
            DB::table('learning_publication_deliveries')->where('id', $deliveryId)->update([
                'status' => 'Failed',
                'attempts' => $attempts,
                'last_error' => mb_substr($exception->getMessage(), 0, 2000),
                'last_attempt_at' => now(),
                'updated_at' => now(),
            ]);
            $this->audit->record($actor, 'LMS publication failed', 'LearningCourseVersion', $version->id, [
                'deliveryId' => $deliveryId,
                'error' => mb_substr($exception->getMessage(), 0, 500),
            ]);
        }

        return $this->statusFor($version->id) ?? [];
    }

    /** @param array<int, User> $targets */
    private function payload(string $deliveryId, LearningCourseVersion $version, array $targets): array
    {
        $competencies = DB::table('learning_course_competencies')
            ->where('course_version_id', $version->id)
            ->orderByDesc('is_primary')
            ->orderBy('competency_code')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->competency_id,
                'version' => (int) $row->competency_version,
                'code' => $row->competency_code,
                'name' => $row->competency_name,
                'targetLevel' => (int) $row->target_level,
                'primary' => (bool) $row->is_primary,
            ])->values()->all();

        return [
            'event' => 'course.published',
            'publicationId' => $deliveryId,
            'publishedAt' => optional($version->published_at)->toIso8601String(),
            'course' => [
                'courseId' => $version->course_id,
                'courseVersionId' => $version->id,
                'code' => $version->course?->code,
                'version' => (int) $version->version_number,
                'title' => $version->title,
                'description' => $version->description,
                'category' => $version->category,
                'difficulty' => $version->difficulty,
                'language' => $version->language,
                'learningObjectives' => $version->learning_objectives ?? [],
                'estimatedDurationMinutes' => (int) $version->estimated_duration_minutes,
                'availabilityStartsAt' => optional($version->availability_starts_at)->toIso8601String(),
                'availabilityEndsAt' => optional($version->availability_ends_at)->toIso8601String(),
            ],
            'audience' => [
                'rules' => $version->audience_rules ?? [],
                'targetCount' => count($targets),
                'eligiblePersonnelKeys' => collect($targets)->pluck('personnel_key')->filter()->values()->all(),
            ],
            'sourceDocuments' => $this->sources->links($version->id),
            'competencies' => $competencies,
            'curriculum' => $version->modules->map(fn ($module) => [
                'id' => $module->id,
                'title' => $module->title,
                'description' => $module->description,
                'order' => (int) $module->display_order,
                'lessons' => $module->lessons->map(fn ($lesson) => [
                    'id' => $lesson->id,
                    'title' => $lesson->title,
                    'objective' => $lesson->objective,
                    'description' => $lesson->description,
                    'contentType' => $lesson->content_type,
                    'textContent' => $lesson->text_content,
                    'externalUrl' => $lesson->external_url,
                    'estimatedMinutes' => (int) $lesson->estimated_minutes,
                    'required' => (bool) $lesson->is_required,
                    'order' => (int) $lesson->display_order,
                ])->values()->all(),
            ])->values()->all(),
            'assessments' => $version->assessments->map(fn ($assessment) => [
                'id' => $assessment->id,
                'moduleId' => $assessment->module_id,
                'type' => $assessment->assessment_type,
                'title' => $assessment->title,
                'required' => (bool) $assessment->is_required,
                'passingScore' => (int) $assessment->passing_score,
                'attemptsAllowed' => (int) $assessment->attempts_allowed,
                'shuffleQuestions' => (bool) $assessment->shuffle_questions,
                'shuffleOptions' => (bool) $assessment->shuffle_options,
                'feedbackPolicy' => $assessment->feedback_policy,
                'questions' => $assessment->questions->map(fn ($question) => [
                    'id' => $question->id,
                    'type' => $question->question_type,
                    'text' => $question->question_text,
                    'explanation' => $question->explanation,
                    'points' => (int) $question->points,
                    'order' => (int) $question->display_order,
                    'options' => $question->options->map(fn ($option) => [
                        'id' => $option->id,
                        'text' => $option->option_text,
                        'correct' => (bool) $option->is_correct,
                        'order' => (int) $option->display_order,
                    ])->values()->all(),
                ])->values()->all(),
            ])->values()->all(),
            'completionRules' => $version->completion_rules ?? [],
        ];
    }

    private function authorize(User $actor, LearningCourseVersion $version): void
    {
        $publisher = $actor->role === UserRole::Admin
            && DB::table('learning_course_collaborators')
                ->where('course_id', $version->course_id)
                ->where('user_id', $actor->id)
                ->where('permission', 'Publisher')
                ->exists();
        if (! $publisher) {
            throw new AuthorizationException('Only the assigned Admin publisher may deliver a published course to the learner LMS.');
        }
    }
}
