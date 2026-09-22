<?php

namespace App\Support;

use Illuminate\Support\Arr;

class CanonicalLearningReference
{
    private ?array $payload = null;

    public function payload(): array
    {
        if ($this->payload !== null) {
            return $this->payload;
        }

        $path = base_path('database/seeders/data/DEFENSE_LMS_CANONICAL_DATA_V1.json');
        if (! is_file($path)) {
            return $this->payload = [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return $this->payload = is_array($decoded) ? $decoded : [];
    }

    public function person(?string $personnelKey): ?array
    {
        $key = trim((string) $personnelKey);
        if ($key === '') return null;

        foreach (Arr::wrap($this->payload()['person_learning_records'] ?? []) as $person) {
            if (is_array($person) && (string) ($person['personnel_key'] ?? '') === $key) {
                return $person;
            }
        }

        return null;
    }

    public function course(?string $courseCode): ?array
    {
        $code = trim((string) $courseCode);
        if ($code === '') return null;

        foreach (Arr::wrap($this->payload()['course_catalog'] ?? []) as $course) {
            if (is_array($course) && (string) ($course['code'] ?? '') === $code) {
                return $course;
            }
        }

        return null;
    }

    public function courseTitle(?string $courseCode): ?string
    {
        $course = $this->course($courseCode);

        return is_array($course) ? (trim((string) ($course['title'] ?? '')) ?: null) : null;
    }

    public function currentCourse(?string $personnelKey): ?array
    {
        $person = $this->person($personnelKey);
        if (! is_array($person)) return null;

        $active = collect(Arr::wrap($person['assignments'] ?? []))
            ->filter(fn ($assignment): bool => is_array($assignment) && (string) ($assignment['status'] ?? '') === 'In Progress')
            ->sortByDesc(fn (array $assignment): string => (string) ($assignment['assigned_at'] ?? ''))
            ->values();

        $assignment = $active->first();
        if (! is_array($assignment)) return null;

        $courseCode = (string) ($assignment['course_code'] ?? '');
        $course = $this->course($courseCode) ?? [];
        $preTest = is_array($assignment['pre_test'] ?? null) ? $assignment['pre_test'] : [];
        $postTest = is_array($assignment['post_test'] ?? null) ? $assignment['post_test'] : [];
        $certificate = is_array($assignment['certificate'] ?? null) ? $assignment['certificate'] : null;
        $completionRules = is_array($course['completion_rules'] ?? null) ? $course['completion_rules'] : [];

        return [
            'courseCode' => $courseCode,
            'title' => $this->courseTitle($courseCode) ?? $courseCode,
            'progressPercent' => max(0, min(100, (int) ($assignment['progress_percent'] ?? 0))),
            'stage' => (string) ($assignment['learning_stage'] ?? 'Course Content'),
            'status' => (string) ($assignment['status'] ?? 'In Progress'),
            'assignedAt' => $assignment['assigned_at'] ?? null,
            'dueAt' => $assignment['due_at'] ?? null,
            'completedAt' => $assignment['completed_at'] ?? null,
            'preTest' => [
                'status' => (string) ($preTest['status'] ?? 'Not Started'),
                'scorePercent' => isset($preTest['score_percent']) ? (int) $preTest['score_percent'] : null,
                'attemptNumber' => (int) ($preTest['attempt_number'] ?? 0),
                'submittedAt' => $preTest['submitted_at'] ?? null,
            ],
            'postTest' => [
                'status' => (string) ($postTest['status'] ?? 'Locked'),
                'scorePercent' => isset($postTest['score_percent']) ? (int) $postTest['score_percent'] : null,
                'attemptsUsed' => (int) ($postTest['attempts_used'] ?? 0),
                'attemptsAllowed' => (int) ($postTest['attempts_allowed'] ?? 0),
                'submittedAt' => $postTest['submitted_at'] ?? null,
            ],
            'modules' => collect(Arr::wrap($course['modules_outline'] ?? []))
                ->filter(fn ($module): bool => is_array($module) && trim((string) ($module['title'] ?? '')) !== '')
                ->sortBy(fn (array $module): int => (int) ($module['order'] ?? PHP_INT_MAX))
                ->map(fn (array $module): array => [
                    'order' => (int) ($module['order'] ?? 0),
                    'title' => (string) $module['title'],
                ])
                ->values()
                ->all(),
            'certificateEnabled' => (bool) ($completionRules['issue_certificate'] ?? false),
            'certificate' => $certificate,
        ];
    }
}
