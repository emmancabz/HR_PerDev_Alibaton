<?php

namespace App\Services\Performance;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class PerformanceIntelligenceService
{
    private const USE_CASES = [
        'Evidence Summary',
        'Feedback Theme Summary',
        'Development Recommendation Draft',
        'Learning / Training Intervention Draft',
    ];

    public function draft(User $actor, string $reviewKey, string $useCase): array
    {
        if (! in_array($useCase, self::USE_CASES, true)) {
            throw ValidationException::withMessages(['useCase' => 'The selected Groq assistance use case is not supported.']);
        }

        $review = DB::table('performance_reviews as reviews')
            ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'assignments.performance_cycle_id')
            ->join('users as subjects', 'subjects.id', '=', 'assignments.subject_user_id')
            ->leftJoin('performance_review_templates as templates', 'templates.id', '=', 'reviews.performance_review_template_id')
            ->where('reviews.external_key', $reviewKey)
            ->select([
                'reviews.*',
                'assignments.evaluator_user_id',
                'assignments.subject_user_id',
                'cycles.external_key as cycle_key',
                'subjects.personnel_key as subject_key',
                'subjects.position',
                'subjects.department',
                'subjects.person_type',
                'templates.criteria',
            ])
            ->first();

        if (! $review) {
            abort(404);
        }
        if (! $actor->isPerformanceOperator() && $review->evaluator_user_id !== $actor->id) {
            abort(403, 'Only an authorized Performance operator or assigned evaluator may request this draft.');
        }

        $goals = DB::table('performance_goals as goals')
            ->join('performance_cycles as cycles', 'cycles.id', '=', 'goals.performance_cycle_id')
            ->where('goals.user_id', $review->subject_user_id)
            ->where('cycles.external_key', $review->cycle_key)
            ->get(['goals.title', 'goals.metric_type', 'goals.target', 'goals.progress', 'goals.status'])
            ->map(fn (object $goal) => (array) $goal)
            ->all();

        $feedback = DB::table('performance_feedback_records')
            ->where('subject_user_id', $review->subject_user_id)
            ->where(function ($query) use ($review): void {
                $query->where('performance_review_id', $review->id)
                    ->orWhereNull('performance_review_id');
            })
            ->where('visibility', '!=', 'HR Only')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['record_type', 'note', 'coaching_action', 'follow_up_date'])
            ->map(fn (object $record) => (array) $record)
            ->all();

        $context = [
            'useCase' => $useCase,
            'subjectReference' => [
                'personnelKey' => $review->subject_key,
                'position' => $review->position,
                'department' => $review->department,
                'personType' => $review->person_type,
            ],
            'cycleId' => $review->cycle_key,
            'criteria' => $this->decode($review->criteria, []),
            'scores' => $this->decode($review->criteria_scores, []),
            'managerComments' => $review->comments,
            'developmentRecommendations' => $this->decode($review->development_recommendations, []),
            'goals' => $goals,
            'feedback' => $feedback,
        ];

        $key = (string) config('services.groq.key');
        if ($key === '') {
            abort(503, 'Groq AI is not configured. Add GROQ_API_KEY on the server.');
        }

        $model = (string) config('services.groq.model', 'llama-3.3-70b-versatile');
        $response = Http::withToken($key)
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('services.groq.timeout', 20))
            ->retry(2, 250, throw: false)
            ->post(rtrim((string) config('services.groq.url', 'https://api.groq.com/openai/v1'), '/').'/chat/completions', [
                'model' => $model,
                'temperature' => 0.2,
                'max_tokens' => 700,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You assist authorized human reviewers with evidence synthesis and development planning. Never determine or alter a final rating, promotion, discipline, termination, employment status, access role, or succession decision. Do not invent missing evidence. Clearly label uncertainty and keep the output reviewable, concise, and development-oriented.',
                    ],
                    [
                        'role' => 'user',
                        'content' => "Prepare the requested {$useCase} from this authorized Performance context:\n".json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                    ],
                ],
            ]);

        if (! $response->successful()) {
            report(new \RuntimeException('Groq Performance request failed with HTTP '.$response->status()));
            abort(502, 'Groq AI could not generate a draft. The Performance workflow remains available without AI.');
        }

        $draft = trim((string) $response->json('choices.0.message.content'));
        if ($draft === '') {
            abort(502, 'Groq AI returned an empty draft.');
        }

        DB::table('performance_ai_drafts')->insert([
            'performance_review_id' => $review->id,
            'requested_by_id' => $actor->id,
            'use_case' => $useCase,
            'model' => $model,
            'context_hash' => hash('sha256', json_encode($context, JSON_THROW_ON_ERROR)),
            'response_text' => $draft,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [
            'reviewId' => $reviewKey,
            'useCase' => $useCase,
            'draft' => $draft,
            'model' => $model,
            'generatedAt' => now()->toIso8601String(),
            'humanReviewRequired' => true,
        ];
    }

    private function decode(mixed $value, mixed $default): mixed
    {
        if ($value === null) {
            return $default;
        }
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $default;
    }
}