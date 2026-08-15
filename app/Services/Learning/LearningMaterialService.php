<?php

namespace App\Services\Learning;

use App\Models\Learning\LearningCourseLesson;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseModule;
use App\Models\Learning\LearningCourseVersion;
use App\Models\Learning\LearningMaterial;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LearningMaterialService
{
    private const ALLOWED = [
        'pdf' => ['application/pdf'], 'mp4' => ['video/mp4'], 'webm' => ['video/webm'],
        'txt' => ['text/plain'], 'csv' => ['text/plain', 'text/csv', 'application/csv'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
    ];

    public function __construct(private readonly LearningAuditService $audit, private readonly LearningCatalogService $catalog) {}

    public function storeThumbnail(User $actor, LearningCourseVersion $version, UploadedFile $file): array
    {
        $this->authorizeDraftVersion($actor, $version);
        if (! $file->isValid() || $file->getSize() > 5 * 1024 * 1024) throw ValidationException::withMessages(['thumbnail' => 'Use a valid image no larger than 5 MB.']);
        $extension = mb_strtolower($file->getClientOriginalExtension());
        $allowed = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
        $mime = (string) $file->getMimeType();
        $image = @getimagesize($file->getRealPath());
        if (! isset($allowed[$extension]) || $allowed[$extension] !== $mime || ! $image || $image['mime'] !== $mime) throw ValidationException::withMessages(['thumbnail' => 'The thumbnail type or file signature is not allowed.']);
        $stored = Str::random(40).'.'.$extension;
        $path = 'learning-thumbnails/'.$version->id.'/'.$stored;
        if (! Storage::disk('local')->putFileAs('learning-thumbnails/'.$version->id, $file, $stored)) throw ValidationException::withMessages(['thumbnail' => 'The thumbnail could not be stored. Please retry.']);
        $previous = $version->thumbnail_path;
        try {
            DB::transaction(function () use ($actor, $version, $path, $mime, $file) {
                LearningCourse::query()->lockForUpdate()->findOrFail($version->course_id);
                $locked = LearningCourseVersion::query()->lockForUpdate()->findOrFail($version->id);
                $this->authorizeDraftVersion($actor, $locked);
                $locked->update(['thumbnail_path' => $path, 'updated_by' => $actor->id]);
                $this->audit->record($actor, 'Thumbnail replaced', 'LearningCourseVersion', $locked->id, ['mime' => $mime, 'size' => $file->getSize()]);
            }, 3);
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }
        if ($previous && $previous !== $path && ! LearningCourseVersion::where('thumbnail_path', $previous)->exists()) Storage::disk('local')->delete($previous);
        return ['thumbnailUrl' => \Illuminate\Support\Facades\URL::temporarySignedRoute('learning.api.thumbnails.download', now()->addMinutes(15), ['version' => $version->id])];
    }

    public function downloadThumbnail(User $actor, LearningCourseVersion $version): BinaryFileResponse
    {
        $rules = $version->audience_rules ?? [];
        $authorized = DB::table('learning_course_collaborators')->where(['course_id' => $version->course_id, 'user_id' => $actor->id])->exists()
            || DB::table('learning_assignments')->where(['course_version_id' => $version->id, 'learner_id' => $actor->id])->whereNotIn('status', ['Cancelled', 'Expired'])->exists()
            || ($version->status === 'Published' && ($rules['catalogVisibility'] ?? '') === 'Eligible users may self-enroll'
                && (empty($rules['personTypes']) || in_array($actor->person_type, $rules['personTypes'], true))
                && (($rules['allDepartments'] ?? false) || empty($rules['departments']) || in_array($actor->department, $rules['departments'], true))
                && (empty($rules['positions']) || in_array($actor->position, $rules['positions'], true))
                && $this->catalog->userMatchesProfiles($actor, $rules['roleProfileIds'] ?? []));
        if (! $authorized || ! $version->thumbnail_path) throw new AuthorizationException('You are not authorized to access this protected thumbnail.');
        $path = Storage::disk('local')->path($version->thumbnail_path);
        abort_unless(is_file($path), 404, 'Thumbnail content is missing from protected storage.');
        return response()->file($path, ['X-Content-Type-Options' => 'nosniff', 'Content-Disposition' => 'inline']);
    }

    public function store(User $actor, LearningCourseLesson $lesson, UploadedFile $file): LearningMaterial
    {
        $this->authorizeAuthor($actor, $lesson);
        if (! $file->isValid()) throw ValidationException::withMessages(['file' => 'The upload did not complete. Please retry.']);
        if ($file->getSize() > (int) config('learning.material_max_bytes', 52428800)) throw ValidationException::withMessages(['file' => 'The material exceeds the 50 MB limit.']);
        $extension = mb_strtolower($file->getClientOriginalExtension()); $mime = (string) $file->getMimeType();
        if (! isset(self::ALLOWED[$extension]) || ! in_array($mime, self::ALLOWED[$extension], true)) throw ValidationException::withMessages(['file' => 'The file type or detected signature is not allowed.']);
        $this->validateMagic($file, $extension);
        $hash = hash_file('sha256', $file->getRealPath());
        $stored = Str::random(40).'.'.$extension; $path = 'learning-materials/'.$lesson->id.'/'.$stored;
        if (! Storage::disk('local')->putFileAs('learning-materials/'.$lesson->id, $file, $stored)) throw ValidationException::withMessages(['file' => 'The material could not be stored. Please retry.']);
        try {
            return DB::transaction(function () use ($actor, $lesson, $file, $extension, $mime, $stored, $path, $hash) {
                $lockedLesson = $this->lockAndAuthorizeLesson($actor, $lesson->id);
                $material = LearningMaterial::create(['lesson_id' => $lockedLesson->id, 'storage_disk' => 'local', 'storage_path' => $path, 'display_name' => $this->safeName($file->getClientOriginalName()), 'stored_name' => $stored, 'mime_type' => $mime, 'extension' => $extension, 'size_bytes' => $file->getSize(), 'sha256' => $hash, 'uploaded_by' => $actor->id]);
                $this->audit->record($actor, 'Material added', 'LearningMaterial', $material->id, ['mime' => $mime, 'size' => $file->getSize(), 'sha256' => $hash]);
                return $material;
            }, 3);
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }
    }

    public function revoke(User $actor, LearningMaterial $material): void
    {
        DB::transaction(function () use ($actor, $material) {
            $locked = LearningMaterial::query()->lockForUpdate()->findOrFail($material->id);
            $lesson = $this->lockAndAuthorizeLesson($actor, $locked->lesson_id);
            if ($locked->revoked_at) return;
            $locked->update(['revoked_at' => now(), 'revoked_by' => $actor->id]);
            $this->audit->record($actor, 'Material removed', 'LearningMaterial', $locked->id);
        }, 3);
    }

    public function download(User $actor, LearningMaterial $material): BinaryFileResponse
    {
        if ($material->revoked_at) abort(410, 'This material is no longer available.');
        $courseId = DB::table('learning_course_lessons as l')->join('learning_course_modules as m', 'm.id', '=', 'l.module_id')->join('learning_course_versions as v', 'v.id', '=', 'm.course_version_id')->where('l.id', $material->lesson_id)->value('v.course_id');
        $authorized = DB::table('learning_course_collaborators')->where(['course_id' => $courseId, 'user_id' => $actor->id])->exists()
            || DB::table('learning_assignments as a')->join('learning_course_modules as m', 'm.course_version_id', '=', 'a.course_version_id')->join('learning_course_lessons as l', 'l.module_id', '=', 'm.id')->where('a.learner_id', $actor->id)->where('l.id', $material->lesson_id)->whereNotIn('a.status', ['Cancelled', 'Expired'])->exists();
        if (! $authorized) throw new AuthorizationException('You are not authorized to access this protected material.');
        $path = Storage::disk($material->storage_disk)->path($material->storage_path);
        abort_unless(is_file($path), 404, 'Material content is missing from protected storage.');
        return response()->download($path, $material->display_name, ['Content-Type' => $material->mime_type, 'X-Content-Type-Options' => 'nosniff']);
    }

    private function authorizeAuthor(User $actor, LearningCourseLesson $lesson): void
    {
        $row = DB::table('learning_course_lessons as l')->join('learning_course_modules as m', 'm.id', '=', 'l.module_id')->join('learning_course_versions as v', 'v.id', '=', 'm.course_version_id')->join('learning_courses as c', 'c.id', '=', 'v.course_id')->where('l.id', $lesson->id)->first(['v.course_id', 'v.status', 'v.version_number', 'c.archived_at']);
        if (! $row || $row->archived_at || $row->version_number !== null || ! in_array($row->status, ['Draft', 'Changes Requested'], true) || ! DB::table('learning_course_collaborators')->where('course_id', $row->course_id)->where('user_id', $actor->id)->whereIn('permission', ['Owner', 'Author'])->exists()) throw new AuthorizationException('Only an authorized author may change materials in an active working Draft.');
    }
    private function authorizeDraftVersion(User $actor, LearningCourseVersion $version): void
    {
        $archived = DB::table('learning_courses')->where('id', $version->course_id)->value('archived_at');
        if ($archived || $version->version_number !== null || ! in_array($version->status, ['Draft', 'Changes Requested'], true) || ! DB::table('learning_course_collaborators')->where('course_id', $version->course_id)->where('user_id', $actor->id)->whereIn('permission', ['Owner', 'Author'])->exists()) throw new AuthorizationException('Only an authorized author may change a thumbnail in an active working Draft.');
    }
    private function lockAndAuthorizeLesson(User $actor, string $lessonId): LearningCourseLesson
    {
        $path = DB::table('learning_course_lessons as lesson')
            ->join('learning_course_modules as module', 'module.id', '=', 'lesson.module_id')
            ->join('learning_course_versions as version', 'version.id', '=', 'module.course_version_id')
            ->where('lesson.id', $lessonId)
            ->first(['lesson.module_id', 'module.course_version_id', 'version.course_id']);
        if (! $path) abort(404);
        LearningCourse::query()->lockForUpdate()->findOrFail($path->course_id);
        LearningCourseVersion::query()->lockForUpdate()->findOrFail($path->course_version_id);
        LearningCourseModule::query()->lockForUpdate()->findOrFail($path->module_id);
        $lesson = LearningCourseLesson::query()->lockForUpdate()->findOrFail($lessonId);
        if ($lesson->module_id !== $path->module_id) throw ValidationException::withMessages(['lesson' => 'The lesson changed while the material action was being authorized. Please retry.']);
        $this->authorizeAuthor($actor, $lesson);
        return $lesson;
    }
    private function validateMagic(UploadedFile $file, string $extension): void
    {
        $head = file_get_contents($file->getRealPath(), false, null, 0, 8) ?: '';
        if ($extension === 'pdf' && ! str_starts_with($head, '%PDF-')) throw ValidationException::withMessages(['file' => 'The PDF signature is invalid.']);
        if (in_array($extension, ['docx', 'pptx', 'xlsx'], true) && ! str_starts_with($head, "PK\x03\x04")) throw ValidationException::withMessages(['file' => 'The Office document signature is invalid.']);
        if ($extension === 'mp4' && substr($head, 4, 4) !== 'ftyp') throw ValidationException::withMessages(['file' => 'The video signature is invalid.']);
        if ($extension === 'webm' && substr($head, 0, 4) !== "\x1A\x45\xDF\xA3") throw ValidationException::withMessages(['file' => 'The WebM signature is invalid.']);
        if (in_array($extension, ['txt', 'csv'], true) && str_contains((string) file_get_contents($file->getRealPath()), "\0")) throw ValidationException::withMessages(['file' => 'The text material contains binary content.']);
    }
    private function safeName(string $name): string { $safe = preg_replace('/[^\pL\pN._ -]+/u', '_', basename($name)); return mb_substr($safe ?: 'material', 0, 180); }
}
