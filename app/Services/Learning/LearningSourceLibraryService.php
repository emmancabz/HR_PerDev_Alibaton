<?php

namespace App\Services\Learning;

use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningSourceLibraryService
{
    private const MANIFEST = 'ALIBATON_INTERNAL_LEARNING_REFERENCES_MANIFEST_V1.json';

    public function catalog(): array
    {
        $manifest = $this->manifest();

        return collect($manifest['documents'] ?? [])->map(function (array $document): array {
            $owner = trim((string) ($document['owner'] ?? ''));
            $departments = collect(preg_split('/\s*\/\s*/', $owner) ?: [])
                ->map(fn ($value) => trim((string) $value))
                ->filter()
                ->values()
                ->all();

            return [
                'documentId' => (string) ($document['document_id'] ?? ''),
                'type' => (string) ($document['document_type'] ?? ''),
                'title' => (string) ($document['title'] ?? ''),
                'version' => (string) ($document['version'] ?? '1.0'),
                'status' => (string) ($document['status'] ?? ''),
                'owner' => $owner,
                'departments' => $departments,
                'filename' => (string) ($document['filename'] ?? ''),
                'relatedCourseCodes' => array_values(array_filter($document['related_lms_courses'] ?? [], 'is_string')),
            ];
        })->filter(fn (array $document) => $document['documentId'] !== '')->values()->all();
    }

    public function links(string $versionId): array
    {
        return DB::table('learning_course_source_links')
            ->where('course_version_id', $versionId)
            ->orderBy('document_id')
            ->get()
            ->map(fn ($row) => [
                'documentId' => $row->document_id,
                'type' => $row->document_type,
                'title' => $row->title,
                'version' => $row->document_version,
                'owner' => $row->owner,
                'filename' => $row->filename,
            ])->values()->all();
    }

    public function sync(User $actor, LearningCourseVersion $version, array $documentIds): void
    {
        $catalog = collect($this->catalog())->keyBy('documentId');
        $ids = collect($documentIds)
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->values();

        $unknown = $ids->reject(fn (string $id) => $catalog->has($id))->values();
        if ($unknown->isNotEmpty()) {
            throw ValidationException::withMessages([
                'sourceDocumentIds' => 'One or more selected source documents are not available in the controlled source library.',
            ]);
        }

        DB::table('learning_course_source_links')->where('course_version_id', $version->id)->delete();
        foreach ($ids as $id) {
            $document = $catalog->get($id);
            DB::table('learning_course_source_links')->insert([
                'id' => (string) Str::uuid(),
                'course_version_id' => $version->id,
                'document_id' => $document['documentId'],
                'document_version' => $document['version'],
                'document_type' => $document['type'],
                'title' => $document['title'],
                'owner' => $document['owner'],
                'filename' => $document['filename'],
                'selected_by' => $actor->id,
                'selected_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function cloneLinks(LearningCourseVersion $from, LearningCourseVersion $to, User $actor): void
    {
        foreach (DB::table('learning_course_source_links')->where('course_version_id', $from->id)->get() as $row) {
            DB::table('learning_course_source_links')->insert([
                'id' => (string) Str::uuid(),
                'course_version_id' => $to->id,
                'document_id' => $row->document_id,
                'document_version' => $row->document_version,
                'document_type' => $row->document_type,
                'title' => $row->title,
                'owner' => $row->owner,
                'filename' => $row->filename,
                'selected_by' => $actor->id,
                'selected_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function recommendedIds(LearningCourseVersion $version): array
    {
        $catalog = collect($this->catalog());
        $rules = $version->audience_rules ?? [];
        $departments = collect($rules['departments'] ?? [])->map(fn ($value) => trim((string) $value))->filter()->values();
        $allDepartments = (bool) ($rules['allDepartments'] ?? false);
        $courseCode = (string) ($version->course?->code ?? '');
        $category = Str::lower((string) $version->category);

        $ranked = $catalog->map(function (array $document) use ($departments, $allDepartments, $courseCode, $category): array {
            $score = 0;
            $docDepartments = collect($document['departments']);
            if ($departments->isNotEmpty()) {
                $score += $departments->intersect($docDepartments)->count() * 100;
            } elseif ($allDepartments && $docDepartments->contains('Human Resources')) {
                $score += 30;
            }
            if ($courseCode !== '' && in_array($courseCode, $document['relatedCourseCodes'], true)) $score += 250;

            $haystack = Str::lower($document['title'].' '.$document['owner'].' '.$document['type']);
            foreach (preg_split('/[^a-z0-9&]+/', $category) ?: [] as $token) {
                if (mb_strlen($token) >= 4 && str_contains($haystack, $token)) $score += 10;
            }

            return ['id' => $document['documentId'], 'score' => $score];
        })->filter(fn (array $row) => $row['score'] > 0)
            ->sortByDesc('score')
            ->values();

        return $ranked->pluck('id')->take(6)->all();
    }

    public function sourceText(string $documentId, int $limit = 12000): string
    {
        $document = collect($this->catalog())->firstWhere('documentId', $documentId);
        if (! $document || ! $document['filename']) return '';
        $path = database_path('seeders/data/learning-references/'.$document['filename']);
        if (! is_file($path)) return '';

        return mb_substr(trim((string) file_get_contents($path)), 0, $limit);
    }

    private function manifest(): array
    {
        $path = database_path('seeders/data/learning-references/'.self::MANIFEST);
        if (! is_file($path)) return ['documents' => []];
        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $decoded : ['documents' => []];
    }
}
