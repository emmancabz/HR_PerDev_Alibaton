<?php

namespace App\Services\Learning;

use App\Enums\UserRole;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningCourseService
{
    public function __construct(
        private readonly LearningAuditService $audit,
        private readonly LearningCatalogService $catalog,
        private readonly LearningEligibilityService $eligibility,
        private readonly LearningMaterialService $materials,
        private readonly LearningSourceLibraryService $sources,
        private readonly LearningSourceReviewService $sourceReview,
        private readonly LearningPublicationService $publication,
    ) {}

    public function state(User $actor): array
    {
        $operator = in_array($actor->role, [UserRole::Admin, UserRole::HR], true);
        $courseIds = $operator
            ? DB::table('learning_courses')->pluck('id')
            : DB::table('learning_course_collaborators')->where('user_id', $actor->id)->pluck('course_id');

        $courses = LearningCourse::query()
            ->whereIn('id', $courseIds)
            ->with(['owner:id,name,email', 'versions' => fn ($query) => $query->orderByDesc('published_at')->orderByDesc('updated_at')])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (LearningCourse $course) => $this->courseSummary($course))
            ->values();

        $catalog = collect();
        if (! $operator) {
            $catalog = LearningCourse::query()->whereNull('archived_at')->whereNotNull('current_published_version_id')
                ->with(['owner:id,name,email', 'versions'])->get()->filter(function (LearningCourse $course) use ($actor) {
                    $version = $course->versions->firstWhere('id', $course->current_published_version_id);
                    if (! $version || ($version->audience_rules['catalogVisibility'] ?? '') !== 'Eligible users may self-enroll' || ! $this->available($version)) return false;
                    return $this->eligibility->matchesAudience($actor, $version);
                })->map(function (LearningCourse $course) { $summary = $this->courseSummary($course); unset($summary['publishedDetail'], $summary['draftDetail']); return $summary; })->values();
        }

        $assignments = DB::table('learning_assignments as a')
            ->join('users as u', 'u.id', '=', 'a.learner_id')
            ->join('learning_courses as c', 'c.id', '=', 'a.course_id')
            ->join('learning_course_versions as v', 'v.id', '=', 'a.course_version_id')
            ->select('a.*', 'u.name as learner_name', 'u.personnel_key', 'u.person_type', 'u.department', 'u.position', 'c.code', 'v.title', 'v.version_number')
            ->when(! $operator, fn ($q) => $q->where('a.learner_id', $actor->id))
            ->orderByDesc('a.assigned_at')->get()->map(fn ($row) => $this->assignmentArray($row))->values();

        $completions = DB::table('learning_completions as x')
            ->join('users as u', 'u.id', '=', 'x.learner_id')
            ->join('learning_course_versions as v', 'v.id', '=', 'x.course_version_id')
            ->leftJoin('learning_certificates as cert', 'cert.completion_id', '=', 'x.id')
            ->leftJoin('learning_transcript_entries as t', 't.completion_id', '=', 'x.id')
            ->select('x.*', 'u.name as learner_name', 'v.title', 'v.version_number', 'v.status as course_version_status', 'cert.id as certificate_id', 'cert.certificate_number', 'cert.issued_on', 'cert.expires_on', 'cert.status as certificate_status', 't.id as transcript_id')
            ->when(! $operator, fn ($q) => $q->where('x.learner_id', $actor->id))
            ->orderByDesc('x.completed_at')->get()->map(function ($completion) {
                $completion->competency_evidence_count = DB::table('learning_competency_evidence')->where('completion_id', $completion->id)->count();
                if ($completion->certificate_status === 'Valid' && $completion->expires_on && Carbon::parse($completion->expires_on)->isBefore(today())) {
                    $completion->certificate_status = 'Expired';
                }
                $completion->certificate_download_url = $completion->certificate_id
                    ? URL::temporarySignedRoute('learning.api.certificates.download', now()->addMinutes(15), ['certificate' => $completion->certificate_id])
                    : null;
                $rules = $completion->rules_satisfied;
                if (is_string($rules)) $rules = json_decode($rules, true) ?? [];
                $completion->certificate_eligible = (bool) ($rules['issueCertificate'] ?? false);
                return $completion;
            });

        $personnel = $operator ? User::query()->activePersonnel()->where('role', UserRole::User->value)
            ->orderBy('name')->get(['id', 'personnel_key', 'name', 'email', 'role', 'person_type', 'department', 'position', 'evaluator_capable'])
            ->map(function (User $person): array {
                return [
                    'id' => $person->id,
                    'personnel_key' => $person->personnel_key,
                    'name' => $person->name,
                    'email' => $person->email,
                    'role' => $person->role->label(),
                    'person_type' => trim((string) $person->person_type),
                    'department' => trim((string) $person->department),
                    'position' => trim((string) $person->position),
                    'evaluator_capable' => (bool) $person->evaluator_capable,
                ];
            })->values() : collect();
        $governanceActors = $operator ? User::query()
            ->where(function ($query) {
                $query->whereIn('role', [UserRole::Admin->value, UserRole::HR->value])
                    ->orWhere(function ($personnelQuery) {
                        $personnelQuery->activePersonnel();
                    });
            })
            ->orderBy('name')
            ->get()
            ->map(function (User $user) {
                $isActivePersonnel = $user->isActivePersonnel();
                $isHr = $user->role === UserRole::HR;
                $isAdmin = $user->role === UserRole::Admin;

                return [
                    'id' => $user->id,
                    'personnel_key' => $user->personnel_key,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role->label(),
                    'person_type' => $user->person_type,
                    'department' => $user->department,
                    'position' => $user->position,
                    'evaluator_capable' => (bool) $user->evaluator_capable,
                    'hasPersonnelIdentity' => $isActivePersonnel,
                    'canOwn' => $isHr,
                    'canAuthor' => $isHr,
                    'canReview' => $isAdmin,
                    'canPublish' => $isAdmin,
                ];
            })
            ->values() : collect();

        $requests = $operator ? DB::table('learning_requests')->orderByDesc('requested_at')->get() : collect();
        if ($operator && $requests->isNotEmpty()) {
            $requestActions = DB::table('learning_request_actions as action')->join('users as actor', 'actor.id', '=', 'action.actor_id')
                ->whereIn('action.learning_request_id', $requests->pluck('id'))->orderBy('action.acted_at')
                ->get(['action.*', 'actor.name as actor_name'])->groupBy('learning_request_id');
            $requests->each(function ($request) use ($requestActions) { $request->actions = $requestActions->get($request->id, collect())->values(); });
        }
        $reviews = $operator ? DB::table('learning_review_requests as r')
            ->join('learning_course_versions as v', 'v.id', '=', 'r.course_version_id')
            ->join('learning_courses as c', 'c.id', '=', 'v.course_id')
            ->join('users as u', 'u.id', '=', 'r.reviewer_id')
            ->select('r.*', 'v.title', 'v.status as course_status', 'c.code', 'u.name as reviewer_name')
            ->orderByDesc('r.requested_at')->get() : collect();
        $attempts = $operator ? DB::table('learning_assessment_attempts as attempt')
            ->join('learning_assignments as assignment', 'assignment.id', '=', 'attempt.assignment_id')
            ->join('learning_assessments as assessment', 'assessment.id', '=', 'attempt.assessment_id')
            ->join('learning_course_versions as version', 'version.id', '=', 'assignment.course_version_id')
            ->join('users as learner', 'learner.id', '=', 'assignment.learner_id')
            ->select('attempt.id', 'attempt.assignment_id', 'attempt.attempt_number', 'attempt.status', 'attempt.score_percent', 'attempt.passed', 'attempt.started_at', 'attempt.submitted_at', 'assessment.title as assessment_title', 'version.title as course_title', 'version.version_number', 'learner.name as learner_name')
            ->orderByDesc('attempt.started_at')->get() : collect();

        return [
            'actor' => ['id' => $actor->id, 'name' => $actor->name, 'role' => $actor->role->value],
            'courses' => $courses,
            'catalog' => $catalog,
            'assignments' => $assignments,
            'completions' => $completions,
            'requests' => $requests,
            'reviews' => $reviews,
            'attempts' => $attempts,
            'personnel' => $personnel,
            'governanceActors' => $governanceActors,
            'sourceLibrary' => $operator ? $this->sources->catalog() : [],
            'competencyCatalog' => $this->catalog->competencies(),
            'roleProfiles' => $this->catalog->roleProfiles(),
            'analytics' => $this->analytics($assignments, $completions, $operator),
        ];
    }

    public function createDraft(User $actor, array $payload): LearningCourseVersion
    {
        $this->requireHrAuthor($actor);
        $payload = $this->preparePayload($payload);

        return DB::transaction(function () use ($actor, $payload) {
            $emptyInitialDraft = $this->isEmptyInitialDraft($actor, $payload);
            if ($emptyInitialDraft && DB::connection()->getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['learning-new-course:'.$actor->id]);
            }
            if ($emptyInitialDraft && ($existing = $this->untouchedDraft($actor))) return $existing;

            $code = $this->nextCode();
            if ($emptyInitialDraft && ($existing = $this->untouchedDraft($actor))) return $existing;

            $course = LearningCourse::create([
                'code' => $code,
                'owner_id' => $actor->id,
            ]);
            $version = $this->createVersion($course, $actor, $payload, null);
            if ($emptyInitialDraft) $version->forceFill(['is_untouched_initial_draft' => true])->save();

            $this->syncAutomaticGovernance($course, $actor);
            $this->syncVersionContent($actor, $version, $payload);
            $this->audit->record($actor, 'HR course Draft created', 'LearningCourseVersion', $version->id, ['courseCode' => $course->code]);

            return $version->fresh();
        }, 3);
    }

    private function isEmptyInitialDraft(User $actor, array $payload): bool
    {
        $audience = $payload['audience'] ?? [];
        $completion = $payload['completion'] ?? [];
        return trim((string) ($payload['title'] ?? '')) === ''
            && trim((string) ($payload['description'] ?? '')) === ''
            && ($payload['category'] ?? 'General') === 'General'
            && ($payload['difficulty'] ?? 'Beginner') === 'Beginner'
            && ($payload['language'] ?? 'English') === 'English'
            && empty($payload['subjectMatterExpertId']) && empty($payload['durationOverrideMinutes'])
            && collect($payload['learningObjectives'] ?? [])->every(fn ($objective) => trim((string) $objective) === '')
            && (int) ($payload['ownerId'] ?? $actor->id) === $actor->id
            && collect($payload['authorIds'] ?? [$actor->id])->map(fn ($id) => (int) $id)->values()->all() === [$actor->id]
            && empty($payload['reviewerIds']) && empty($payload['publisherId'])
            && empty($audience['personTypes']) && ($audience['allDepartments'] ?? false) === false
            && empty($audience['departments']) && empty($audience['positions']) && empty($audience['roleProfileIds'])
            && ($audience['catalogVisibility'] ?? 'Assigned only') === 'Assigned only'
            && (int) ($audience['defaultDueDays'] ?? 30) === 30 && ($audience['mandatoryDefault'] ?? true) === true
            && empty($audience['availableFrom']) && empty($audience['availableUntil'])
            && empty($payload['competencies']) && empty($payload['modules']) && empty($payload['assessments'])
            && ($completion['completeRequiredLessons'] ?? true) === true
            && ($completion['passRequiredKnowledgeChecks'] ?? true) === true
            && ($completion['passFinalAssessment'] ?? false) === false
            && ($completion['issueCertificate'] ?? false) === false
            && empty($completion['certificateValidityMonths']) && empty($completion['renewalIntervalMonths'])
            && (int) ($payload['workingStage'] ?? 0) === 0;
    }

    private function untouchedDraft(User $actor): ?LearningCourseVersion
    {
        $candidate = LearningCourseVersion::query()
            ->where('is_untouched_initial_draft', true)->whereNull('version_number')
            ->where('status', 'Draft')->where('created_by', $actor->id)
            ->orderBy('created_at')->first(['id', 'course_id']);
        if (! $candidate) return null;

        $course = LearningCourse::query()->lockForUpdate()->find($candidate->course_id);
        if (! $course || $course->archived_at) return null;
        return LearningCourseVersion::query()->lockForUpdate()
            ->whereKey($candidate->id)->where('course_id', $course->id)
            ->where('is_untouched_initial_draft', true)->whereNull('version_number')
            ->where('status', 'Draft')->where('created_by', $actor->id)->first();
    }

    public function saveDraft(User $actor, LearningCourseVersion $version, array $payload): LearningCourseVersion
    {
        $this->requireHrAuthor($actor);
        $this->authorizePermission($actor, $version->course_id, ['Owner', 'Author']);
        if (! in_array($version->status, ['Draft', 'Changes Requested'], true) || $version->version_number !== null) {
            throw ValidationException::withMessages(['course' => 'Only an HR working Draft may be edited. Published and historical versions are immutable.']);
        }
        $payload = $this->preparePayload($payload);

        return DB::transaction(function () use ($actor, $version, $payload) {
            $course = LearningCourse::query()->lockForUpdate()->findOrFail($version->course_id);
            $locked = LearningCourseVersion::query()->lockForUpdate()->findOrFail($version->id);
            $this->authorizePermission($actor, $locked->course_id, ['Owner', 'Author']);
            if ($course->archived_at) throw ValidationException::withMessages(['course' => 'Archived course lineages are immutable.']);
            if ($locked->version_number !== null || ! in_array($locked->status, ['Draft', 'Changes Requested'], true)) {
                throw ValidationException::withMessages(['course' => 'Only an HR working Draft may be edited.']);
            }

            $locked->update(array_merge($this->versionAttributes($actor, $payload), ['is_untouched_initial_draft' => false]));
            $this->syncAutomaticGovernance($course, $actor);
            $this->syncVersionContent($actor, $locked, $payload);
            $this->audit->record($actor, 'HR course Draft edited', 'LearningCourseVersion', $locked->id);

            return $locked->fresh();
        }, 3);
    }

    public function submitForReview(User $actor, LearningCourseVersion $version): void
    {
        $this->requireHrAuthor($actor);
        $submitted = DB::transaction(function () use ($actor, $version) {
            $course = LearningCourse::query()->lockForUpdate()->findOrFail($version->course_id);
            $locked = LearningCourseVersion::query()->lockForUpdate()->findOrFail($version->id);
            $this->authorizePermission($actor, $locked->course_id, ['Owner', 'Author']);
            if ($course->archived_at) throw ValidationException::withMessages(['course' => 'Archived course lineages cannot enter publication review.']);
            if ($locked->version_number !== null || ! in_array($locked->status, ['Draft', 'Changes Requested'], true)) {
                throw ValidationException::withMessages(['course' => 'Only an HR working Draft may be submitted.']);
            }

            $errors = $this->publicationErrors($locked);
            if ($errors !== []) throw ValidationException::withMessages(['course' => $errors]);

            $publisherId = (int) DB::table('learning_course_collaborators')
                ->where('course_id', $locked->course_id)
                ->where('permission', 'Publisher')
                ->value('user_id');
            if ($publisherId <= 0) throw ValidationException::withMessages(['course' => 'No Admin publisher is available for this course.']);

            DB::table('learning_review_requests')
                ->where('course_version_id', $locked->id)
                ->where('status', 'Pending')
                ->update(['status' => 'Cancelled', 'decision_comment' => 'Replaced by a newer HR submission.', 'decided_at' => now(), 'updated_at' => now()]);

            $locked->update(['status' => 'In Review', 'submitted_at' => now(), 'approved_at' => null]);
            DB::table('learning_review_requests')->insert([
                'id' => (string) Str::uuid(),
                'course_version_id' => $locked->id,
                'requested_by' => $actor->id,
                'reviewer_id' => $publisherId,
                'status' => 'Pending',
                'requested_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->audit->record($actor, 'Course submitted to Admin for publication', 'LearningCourseVersion', $locked->id, ['publisherId' => $publisherId]);

            return $locked->fresh();
        }, 3);

        // Source review is generated from the exact submitted content. Aevyn may
        // add advisory findings, but the Admin remains the publication authority.
        $this->sourceReview->scan($actor, $submitted);
    }

    public function decideReview(User $actor, LearningCourseVersion $version, string $decision, string $comment = ''): void
    {
        $this->requireAdminPublisher($actor, $version->course_id);
        if ($decision === 'Changes Requested' && trim($comment) === '') {
            throw ValidationException::withMessages(['comment' => 'A reason is required when returning a course to HR.']);
        }
        if (! in_array($decision, ['Approved', 'Changes Requested'], true)) {
            throw ValidationException::withMessages(['decision' => 'Invalid publication review decision.']);
        }

        DB::transaction(function () use ($actor, $version, $decision, $comment) {
            $course = LearningCourse::query()->lockForUpdate()->findOrFail($version->course_id);
            $locked = LearningCourseVersion::query()->lockForUpdate()->findOrFail($version->id);
            $request = DB::table('learning_review_requests')->where('course_version_id', $locked->id)
                ->where('status', 'Pending')->latest('requested_at')->lockForUpdate()->first();
            if ($course->archived_at) throw ValidationException::withMessages(['course' => 'Archived course lineages cannot receive publication decisions.']);
            if (! $request || (int) $request->reviewer_id !== $actor->id) throw new AuthorizationException('Only the assigned Admin publisher may decide this submission.');
            if ($locked->status !== 'In Review') throw ValidationException::withMessages(['course' => 'This course is no longer awaiting publication review.']);

            DB::table('learning_review_requests')->where('id', $request->id)->update([
                'status' => $decision,
                'decision_comment' => trim($comment) ?: null,
                'decided_at' => now(),
                'updated_at' => now(),
            ]);
            $locked->update([
                'status' => $decision,
                'approved_at' => $decision === 'Approved' ? now() : null,
            ]);
            $this->audit->record($actor, $decision === 'Approved' ? 'Course publication review approved' : 'Course returned to HR', 'LearningCourseVersion', $locked->id, ['comment' => trim($comment)]);
        }, 3);
    }

    public function publish(User $actor, LearningCourseVersion $version): array
    {
        $this->requireAdminPublisher($actor, $version->course_id);
        $this->sourceReview->assertPublishable($version);

        $published = DB::transaction(function () use ($actor, $version) {
            $course = LearningCourse::query()->lockForUpdate()->findOrFail($version->course_id);
            $locked = LearningCourseVersion::query()->lockForUpdate()->findOrFail($version->id);
            $this->requireAdminPublisher($actor, $locked->course_id);
            if ($course->archived_at) throw ValidationException::withMessages(['course' => 'Archived courses cannot be published.']);
            if ($locked->version_number !== null || ! in_array($locked->status, ['In Review', 'Approved'], true)) {
                throw ValidationException::withMessages(['course' => 'Only an HR-submitted course awaiting Admin publication can be published.']);
            }
            $errors = $this->publicationErrors($locked);
            if ($errors !== []) throw ValidationException::withMessages(['course' => $errors]);

            $pending = DB::table('learning_review_requests')->where('course_version_id', $locked->id)
                ->where('status', 'Pending')->lockForUpdate()->first();
            if ($pending) {
                if ((int) $pending->reviewer_id !== $actor->id) throw new AuthorizationException('This submission belongs to another Admin publisher.');
                DB::table('learning_review_requests')->where('id', $pending->id)->update([
                    'status' => 'Approved',
                    'decision_comment' => 'Published by assigned Admin after source review.',
                    'decided_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $next = (int) LearningCourseVersion::where('course_id', $course->id)->whereNotNull('version_number')->max('version_number') + 1;
            LearningCourseVersion::where('course_id', $course->id)->where('status', 'Published')->update(['status' => 'Archived']);
            $locked->update(['status' => 'Published', 'version_number' => $next, 'approved_at' => $locked->approved_at ?? now(), 'published_at' => now()]);
            $course->update(['current_published_version_id' => $locked->id]);
            $this->audit->record($actor, 'Course published by Admin', 'LearningCourseVersion', $locked->id, ['officialVersion' => $next]);

            return $locked->fresh();
        }, 3);

        return $this->publication->publishToLms($actor, $published);
    }

    public function workingDraft(User $actor, LearningCourseVersion $published): LearningCourseVersion
    {
        $this->requireHrAuthor($actor);
        $this->authorizePermission($actor, $published->course_id, ['Owner', 'Author']);
        if (! in_array($published->status, ['Published', 'Archived'], true) || $published->version_number === null) {
            throw ValidationException::withMessages(['course' => 'Choose an official Published version.']);
        }

        return DB::transaction(function () use ($actor, $published) {
            $course = LearningCourse::query()->lockForUpdate()->findOrFail($published->course_id);
            $source = LearningCourseVersion::query()->lockForUpdate()->findOrFail($published->id);
            $this->authorizePermission($actor, $source->course_id, ['Owner', 'Author']);
            if ($course->archived_at) throw ValidationException::withMessages(['course' => 'Archived course lineages cannot create a new HR Draft.']);

            $existing = LearningCourseVersion::where('course_id', $source->course_id)
                ->whereNull('version_number')->whereIn('status', ['Draft', 'Changes Requested', 'In Review', 'Approved'])->first();
            if ($existing) return $existing;

            $draft = $source->replicate(['id', 'version_number', 'status', 'submitted_at', 'approved_at', 'published_at', 'created_at', 'updated_at']);
            $draft->id = (string) Str::uuid();
            $draft->version_number = null;
            $draft->status = 'Draft';
            $draft->based_on_version_id = $source->id;
            $draft->builder_stage = 0;
            $draft->is_untouched_initial_draft = false;
            $draft->created_by = $actor->id;
            $draft->updated_by = $actor->id;
            $draft->save();

            $course->update(['owner_id' => $actor->id]);
            $this->syncAutomaticGovernance($course, $actor);
            $this->cloneContent($source, $draft, $actor);
            $this->audit->record($actor, 'HR working Draft created from Published version', 'LearningCourseVersion', $draft->id, ['basedOn' => $source->id]);

            return $draft;
        }, 3);
    }

    public function archive(User $actor, LearningCourse $course): void
    {
        $this->requireAdminPublisher($actor, $course->id);
        DB::transaction(function () use ($actor, $course) {
            $locked = LearningCourse::query()->lockForUpdate()->findOrFail($course->id);
            $this->requireAdminPublisher($actor, $locked->id);
            if ($locked->archived_at) throw ValidationException::withMessages(['course' => 'This course is already archived.']);
            $workingIds = LearningCourseVersion::query()->where('course_id', $locked->id)->whereNull('version_number')
                ->whereIn('status', ['Draft', 'Changes Requested', 'In Review', 'Approved'])->lockForUpdate()->pluck('id');
            if ($workingIds->isNotEmpty()) {
                DB::table('learning_review_requests')->whereIn('course_version_id', $workingIds)->where('status', 'Pending')
                    ->update(['status' => 'Cancelled', 'decision_comment' => 'Course lineage archived.', 'decided_at' => now(), 'updated_at' => now()]);
                LearningCourseVersion::query()->whereIn('id', $workingIds)->update(['status' => 'Archived', 'updated_at' => now()]);
            }
            $locked->update(['archived_at' => now(), 'archived_by' => $actor->id, 'current_published_version_id' => null]);
            LearningCourseVersion::where('course_id', $locked->id)->where('status', 'Published')->update(['status' => 'Archived']);
            $this->audit->record($actor, 'Course archived by Admin', 'LearningCourse', $locked->id);
        }, 3);
    }

    public function publicationErrors(LearningCourseVersion $version): array
    {
        $version->loadMissing(['course', 'modules.lessons.materials', 'assessments.questions.options']);
        $errors = [];
        if (mb_strlen(trim($version->title)) < 3) $errors[] = 'Course title is required.';
        if (mb_strlen(trim($version->description)) < 20) $errors[] = 'Provide a meaningful course description.';
        if (count(array_filter($version->learning_objectives ?? [], fn ($v) => mb_strlen(trim((string) $v)) >= 8)) === 0) $errors[] = 'Add at least one meaningful learning objective.';
        if (empty(($version->audience_rules ?? [])['personTypes'])) $errors[] = 'Select at least one canonical person type.';
        try { $this->catalog->validateRoleProfiles(($version->audience_rules ?? [])['roleProfileIds'] ?? []); } catch (ValidationException $e) { $errors[]='Audience contains an invalid Role Profile.'; }
        foreach (DB::table('learning_course_competencies')->where('course_version_id',$version->id)->get() as $mapping) {
            $canonical=$this->catalog->competency($mapping->competency_id);
            if (! $canonical || $canonical['code']!==$mapping->competency_code || $canonical['name']!==$mapping->competency_name) $errors[]='Competency mappings must reference canonical definitions.';
        }
        if ($version->modules->isEmpty()) $errors[] = 'Add at least one curriculum module.';
        foreach ($version->modules as $module) {
            if (trim($module->title)==='') $errors[]='Every module needs a title.';
            if ($module->lessons->isEmpty()) $errors[]="Module '{$module->title}' needs at least one lesson.";
            foreach ($module->lessons as $lesson) {
            if (trim($lesson->title)==='' || mb_strlen(trim($lesson->objective))<8) $errors[]='Every lesson needs a title and meaningful objective.';
            if ($lesson->is_required && ! filled($lesson->text_content) && ! filled($lesson->external_url) && $lesson->materials->whereNull('revoked_at')->isEmpty()) $errors[] = "Required lesson '{$lesson->title}' has no valid content.";
            if ($lesson->external_url && ! preg_match('/^https:\/\//i', $lesson->external_url)) $errors[] = "External link for '{$lesson->title}' must use HTTPS.";
        }}
        // Pre-Test and Post-Test are handled outside the LMS. Module-level Knowledge Checks are the LMS assessments.
        foreach ($version->assessments as $assessment) {
            if ($assessment->assessment_type === 'Knowledge Check' && ! $assessment->module_id) $errors[] = "Knowledge Check '{$assessment->title}' must be linked to a module.";
            if (in_array($assessment->assessment_type, ['Pre-Test', 'Post-Test', 'Final Assessment'], true) && $assessment->module_id) $errors[] = "{$assessment->assessment_type} must apply to the whole course.";
            if ($assessment->passing_score < 1 || $assessment->passing_score > 100) $errors[] = "{$assessment->title} has an invalid passing score.";
            if ($assessment->attempts_allowed < 1 || $assessment->questions->isEmpty()) $errors[] = "{$assessment->title} is incomplete.";
            foreach ($assessment->questions as $question) {
                $texts = $question->options->map(fn ($o) => mb_strtolower(trim($o->option_text)));
                $correct = $question->options->where('is_correct', true)->count();
                if (trim($question->question_text) === '' || $question->options->count() < 2 || $texts->contains('') || $texts->unique()->count() !== $texts->count() || $correct < 1) $errors[] = "Assessment question {$question->display_order} is invalid.";
                if (in_array($question->question_type, ['Multiple Choice', 'True/False'], true) && $correct !== 1) $errors[] = "{$question->question_type} questions require exactly one correct answer.";
                if ($question->question_type === 'True/False' && $question->options->count() !== 2) $errors[] = 'True/False questions require exactly two options.';
            }
        }
        if (! DB::table('learning_course_collaborators')->where('course_id', $version->course_id)->where('permission', 'Publisher')->exists()) $errors[] = 'An Admin publisher must be assigned.';
        if (! DB::table('learning_course_source_links')->where('course_version_id', $version->id)->exists()) $errors[] = 'Link at least one relevant source document.';
        return array_values(array_unique($errors));
    }

    private function createVersion(LearningCourse $course, User $actor, array $payload, ?string $basedOn): LearningCourseVersion
    {
        return LearningCourseVersion::create(array_merge($this->versionAttributes($actor, $payload), [
            'course_id' => $course->id, 'version_number' => null, 'status' => 'Draft', 'based_on_version_id' => $basedOn, 'created_by' => $actor->id,
        ]));
    }

    private function versionAttributes(User $actor, array $payload): array
    {
        return [
            'title' => trim((string) ($payload['title'] ?? '')), 'description' => trim((string) ($payload['description'] ?? '')),
            'builder_stage' => (int) ($payload['workingStage'] ?? 0),
            'category' => (string) ($payload['category'] ?? 'General'), 'difficulty' => (string) ($payload['difficulty'] ?? 'Beginner'),
            'language' => (string) ($payload['language'] ?? 'English'), 'learning_objectives' => array_values($payload['learningObjectives'] ?? []),
            'subject_matter_expert_id' => Arr::get($payload, 'subjectMatterExpertId'),
            'estimated_duration_minutes' => collect($payload['modules'] ?? [])->flatMap(fn ($m) => $m['lessons'] ?? [])->sum(fn ($l) => (int) ($l['estimatedMinutes'] ?? 0)),
            'duration_override_minutes' => Arr::get($payload, 'durationOverrideMinutes'), 'audience_rules' => $payload['audience'] ?? [],
            'completion_rules' => $payload['completion'] ?? [], 'availability_starts_at' => Arr::get($payload, 'audience.availableFrom'),
            'availability_ends_at' => Arr::get($payload, 'audience.availableUntil'), 'updated_by' => $actor->id,
        ];
    }

    private function syncAutomaticGovernance(LearningCourse $course, User $actor): void
    {
        $this->requireHrAuthor($actor);
        $publisherId = $this->defaultPublisherId();
        if (! $publisherId) {
            throw ValidationException::withMessages(['course' => 'At least one Admin account is required before HR can create a governed course.']);
        }

        DB::table('learning_course_collaborators')->where('course_id', $course->id)->delete();
        foreach ([
            ['user_id' => $actor->id, 'permission' => 'Owner'],
            ['user_id' => $actor->id, 'permission' => 'Author'],
            ['user_id' => $publisherId, 'permission' => 'Publisher'],
        ] as $row) {
            DB::table('learning_course_collaborators')->insert([
                'course_id' => $course->id,
                'user_id' => $row['user_id'],
                'permission' => $row['permission'],
                'authorized_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function syncVersionContent(User $actor, LearningCourseVersion $version, array $payload): void
    {
        DB::table('learning_course_competencies')->where('course_version_id', $version->id)->delete();
        foreach ($payload['competencies'] ?? [] as $index => $map) DB::table('learning_course_competencies')->insert([
            'course_version_id' => $version->id, 'competency_id' => $map['id'], 'competency_version' => $map['version'],
            'competency_code' => $map['code'], 'competency_name' => $map['name'], 'target_level' => $map['targetLevel'],
            'purpose' => $map['purpose'] ?? null, 'objective_indexes' => json_encode($map['objectiveIndexes'] ?? []), 'is_primary' => $index === 0,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $modules = $payload['modules'] ?? [];
        $existingModules = DB::table('learning_course_modules')->where('course_version_id', $version->id)
            ->orderBy('display_order')->lockForUpdate()->get();
        $existingModuleIds = $existingModules->pluck('id')->all();
        $moduleTemporaryBase = max($existingModules->max('display_order') ?? 0, count($modules)) + count($existingModules) + 1000;
        foreach ($existingModules as $index => $existingModule) {
            DB::table('learning_course_modules')->where('id', $existingModule->id)
                ->update(['display_order' => $moduleTemporaryBase + $index + 1, 'updated_at' => now()]);
        }

        $hasPersistedModuleIds = collect($modules)->contains(fn (array $module) => in_array((string) ($module['clientId'] ?? ''), $existingModuleIds, true));
        $keptModuleIds = [];
        $moduleIdMap = [];
        foreach ($modules as $mi => $module) {
            $clientId = (string) ($module['clientId'] ?? '');
            $moduleId = in_array($clientId, $existingModuleIds, true)
                ? $clientId
                : (! $hasPersistedModuleIds && isset($existingModules[$mi]) ? $existingModules[$mi]->id : (string) Str::uuid());
            $moduleIdMap[$clientId ?: (string) $mi] = $moduleId; $keptModuleIds[] = $moduleId;
            $moduleExists = in_array($moduleId, $existingModuleIds, true);
            $moduleValues = ['course_version_id' => $version->id, 'title' => (string)($module['title']??''), 'description' => $module['description'] ?? null, 'display_order' => $moduleTemporaryBase + count($existingModules) + $mi + 1, 'updated_at' => now()];
            if ($moduleExists) DB::table('learning_course_modules')->where('id', $moduleId)->update(Arr::except($moduleValues, ['course_version_id', 'display_order']));
            else DB::table('learning_course_modules')->insert(array_merge(['id' => $moduleId, 'created_at' => now()], $moduleValues));

            $lessons = $module['lessons'] ?? [];
            $existingLessons = DB::table('learning_course_lessons')->where('module_id', $moduleId)
                ->orderBy('display_order')->lockForUpdate()->get();
            $existingLessonIds = $existingLessons->pluck('id')->all();
            $lessonTemporaryBase = max($existingLessons->max('display_order') ?? 0, count($lessons)) + count($existingLessons) + 1000;
            foreach ($existingLessons as $index => $existingLesson) {
                DB::table('learning_course_lessons')->where('id', $existingLesson->id)
                    ->update(['display_order' => $lessonTemporaryBase + $index + 1, 'updated_at' => now()]);
            }
            $hasPersistedLessonIds = collect($lessons)->contains(fn (array $lesson) => in_array((string) ($lesson['id'] ?? ''), $existingLessonIds, true));
            $keptLessonIds = [];
            foreach ($module['lessons'] ?? [] as $li => $lesson) {
                $candidate = (string) ($lesson['id'] ?? '');
                $lessonId = in_array($candidate, $existingLessonIds, true)
                    ? $candidate
                    : (! $hasPersistedLessonIds && isset($existingLessons[$li]) ? $existingLessons[$li]->id : (string) Str::uuid());
                $keptLessonIds[] = $lessonId;
                $lessonValues = [
                    'module_id' => $moduleId, 'title' => (string)($lesson['title']??''), 'objective' => (string)($lesson['objective']??''),
                    'description' => $lesson['description'] ?? null, 'content_type' => $lesson['contentType'], 'text_content' => $lesson['textContent'] ?? null,
                    'external_url' => $lesson['externalUrl'] ?? null, 'estimated_minutes' => $lesson['estimatedMinutes'] ?? 5,
                    'is_required' => $lesson['required'] ?? true, 'display_order' => $lessonTemporaryBase + count($existingLessons) + $li + 1, 'updated_at' => now(),
                ];
                if (in_array($lessonId, $existingLessonIds, true)) DB::table('learning_course_lessons')->where('id', $lessonId)->update(Arr::except($lessonValues, ['module_id', 'display_order']));
                else DB::table('learning_course_lessons')->insert(array_merge(['id' => $lessonId, 'created_at' => now()], $lessonValues));
            }
            $removedLessonIds = array_values(array_diff($existingLessonIds, $keptLessonIds));
            $this->materials->prepareLessonRemoval($actor, $removedLessonIds, 'Draft curriculum synchronization');
            if ($keptLessonIds) DB::table('learning_course_lessons')->where('module_id', $moduleId)->whereNotIn('id', $keptLessonIds)->delete();
            else DB::table('learning_course_lessons')->where('module_id', $moduleId)->delete();
            foreach ($keptLessonIds as $li => $lessonId) DB::table('learning_course_lessons')->where('id', $lessonId)->update(['display_order' => $li + 1, 'updated_at' => now()]);
        }
        $removedModuleIds = array_values(array_diff($existingModuleIds, $keptModuleIds));
        $removedModuleLessonIds = $removedModuleIds === [] ? [] : DB::table('learning_course_lessons')->whereIn('module_id', $removedModuleIds)->pluck('id')->all();
        $this->materials->prepareLessonRemoval($actor, $removedModuleLessonIds, 'Draft module removal');
        if ($keptModuleIds) DB::table('learning_course_modules')->where('course_version_id', $version->id)->whereNotIn('id', $keptModuleIds)->delete();
        else DB::table('learning_course_modules')->where('course_version_id', $version->id)->delete();
        foreach ($keptModuleIds as $mi => $moduleId) DB::table('learning_course_modules')->where('id', $moduleId)->update(['display_order' => $mi + 1, 'updated_at' => now()]);

        $existingAssessmentIds = DB::table('learning_assessments')->where('course_version_id', $version->id)->orderBy('id')->lockForUpdate()->pluck('id')->all(); $keptAssessmentIds = [];
        foreach ($payload['assessments'] ?? [] as $assessment) {
            $candidate = (string) ($assessment['id'] ?? ''); $assessmentId = in_array($candidate, $existingAssessmentIds, true) ? $candidate : (string) Str::uuid(); $keptAssessmentIds[] = $assessmentId;
            DB::table('learning_assessments')->updateOrInsert(['id' => $assessmentId], [
                'course_version_id' => $version->id, 'module_id' => $moduleIdMap[$assessment['moduleClientId'] ?? ''] ?? null,
                'assessment_type' => $assessment['type'], 'title' => (string)($assessment['title']??''), 'is_required' => $assessment['required'] ?? true,
                'passing_score' => $assessment['passingScore'], 'attempts_allowed' => $assessment['attemptsAllowed'],
                'shuffle_questions' => $assessment['shuffleQuestions'] ?? false, 'shuffle_options' => $assessment['shuffleOptions'] ?? false,
                'feedback_policy' => $assessment['feedbackPolicy'] ?? 'After submission', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $questions = $assessment['questions'] ?? [];
            $existingQuestions = DB::table('learning_assessment_questions')->where('assessment_id', $assessmentId)->orderBy('display_order')->lockForUpdate()->get();
            $existingQuestionIds = $existingQuestions->pluck('id')->all();
            $questionTemporaryBase = max($existingQuestions->max('display_order') ?? 0, count($questions)) + count($existingQuestions) + 1000;
            foreach ($existingQuestions as $index => $row) DB::table('learning_assessment_questions')->where('id', $row->id)->update(['display_order' => $questionTemporaryBase + $index + 1, 'updated_at' => now()]);
            $hasQuestionIds = collect($questions)->contains(fn (array $question) => in_array((string) ($question['id'] ?? ''), $existingQuestionIds, true));
            $keptQuestionIds = [];
            foreach ($questions as $qi => $question) {
                $candidateQ = (string) ($question['id'] ?? '');
                $questionId = in_array($candidateQ, $existingQuestionIds, true) ? $candidateQ : (! $hasQuestionIds && isset($existingQuestions[$qi]) ? $existingQuestions[$qi]->id : (string) Str::uuid());
                $keptQuestionIds[] = $questionId;
                $questionValues = ['assessment_id' => $assessmentId, 'question_type' => $question['type'], 'question_text' => (string)($question['text']??''), 'explanation' => $question['explanation'] ?? null, 'points' => $question['points'] ?? 1, 'display_order' => $questionTemporaryBase + count($existingQuestions) + $qi + 1, 'updated_at' => now()];
                if (in_array($questionId, $existingQuestionIds, true)) DB::table('learning_assessment_questions')->where('id', $questionId)->update(Arr::except($questionValues, ['assessment_id', 'display_order']));
                else DB::table('learning_assessment_questions')->insert(array_merge(['id' => $questionId, 'created_at' => now()], $questionValues));

                $options = $question['options'] ?? [];
                $existingOptions = DB::table('learning_answer_options')->where('question_id', $questionId)->orderBy('display_order')->lockForUpdate()->get();
                $existingOptionIds = $existingOptions->pluck('id')->all();
                $optionTemporaryBase = max($existingOptions->max('display_order') ?? 0, count($options)) + count($existingOptions) + 1000;
                foreach ($existingOptions as $index => $row) DB::table('learning_answer_options')->where('id', $row->id)->update(['display_order' => $optionTemporaryBase + $index + 1, 'updated_at' => now()]);
                $hasOptionIds = collect($options)->contains(fn (array $option) => in_array((string) ($option['id'] ?? ''), $existingOptionIds, true));
                $keptOptionIds = [];
                foreach ($options as $oi => $option) {
                    $candidateO = (string) ($option['id'] ?? '');
                    $optionId = in_array($candidateO, $existingOptionIds, true) ? $candidateO : (! $hasOptionIds && isset($existingOptions[$oi]) ? $existingOptions[$oi]->id : (string) Str::uuid());
                    $keptOptionIds[] = $optionId;
                    $values = ['question_id' => $questionId, 'option_text' => (string)($option['text']??''), 'is_correct' => $option['correct'] ?? false, 'display_order' => $optionTemporaryBase + count($existingOptions) + $oi + 1, 'updated_at' => now()];
                    if (in_array($optionId, $existingOptionIds, true)) DB::table('learning_answer_options')->where('id', $optionId)->update(Arr::except($values, ['question_id', 'display_order']));
                    else DB::table('learning_answer_options')->insert(array_merge(['id' => $optionId, 'created_at' => now()], $values));
                }
                if ($keptOptionIds) DB::table('learning_answer_options')->where('question_id', $questionId)->whereNotIn('id', $keptOptionIds)->delete();
                else DB::table('learning_answer_options')->where('question_id', $questionId)->delete();
                foreach ($keptOptionIds as $oi => $optionId) DB::table('learning_answer_options')->where('id', $optionId)->update(['display_order' => $oi + 1, 'updated_at' => now()]);
            }
            if ($keptQuestionIds) DB::table('learning_assessment_questions')->where('assessment_id', $assessmentId)->whereNotIn('id', $keptQuestionIds)->delete();
            else DB::table('learning_assessment_questions')->where('assessment_id', $assessmentId)->delete();
            foreach ($keptQuestionIds as $qi => $questionId) DB::table('learning_assessment_questions')->where('id', $questionId)->update(['display_order' => $qi + 1, 'updated_at' => now()]);
        }
        if ($keptAssessmentIds) DB::table('learning_assessments')->where('course_version_id', $version->id)->whereNotIn('id', $keptAssessmentIds)->delete();
        else DB::table('learning_assessments')->where('course_version_id', $version->id)->delete();

        $sourceIds = collect($payload['sourceDocumentIds'] ?? [])->map(fn ($value) => trim((string) $value))->filter()->unique()->values()->all();
        if ($sourceIds === [] && trim((string) ($payload['title'] ?? '')) !== '') {
            $sourceIds = $this->sources->recommendedIds($version->fresh());
        }
        if ($sourceIds !== [] || array_key_exists('sourceDocumentIds', $payload)) {
            $this->sources->sync($actor, $version, $sourceIds);
        }
    }

    private function cloneContent(LearningCourseVersion $from, LearningCourseVersion $to, User $actor): void
    {
        foreach (DB::table('learning_course_competencies')->where('course_version_id', $from->id)->get() as $row) {
            $copy = (array) $row; unset($copy['id']); $copy['course_version_id'] = $to->id; $copy['created_at'] = now(); $copy['updated_at'] = now(); DB::table('learning_course_competencies')->insert($copy);
        }
        $moduleMap = [];
        foreach (DB::table('learning_course_modules')->where('course_version_id', $from->id)->orderBy('display_order')->get() as $row) {
            $oldId = $row->id; $newId = (string) Str::uuid(); $moduleMap[$oldId] = $newId; $copy = (array) $row; $copy['id'] = $newId; $copy['course_version_id'] = $to->id; $copy['created_at'] = now(); $copy['updated_at'] = now(); DB::table('learning_course_modules')->insert($copy);
            foreach (DB::table('learning_course_lessons')->where('module_id', $oldId)->get() as $lesson) {
                $oldLesson = $lesson->id; $newLesson = (string) Str::uuid(); $copyLesson = (array) $lesson; $copyLesson['id'] = $newLesson; $copyLesson['module_id'] = $newId; $copyLesson['created_at'] = now(); $copyLesson['updated_at'] = now(); DB::table('learning_course_lessons')->insert($copyLesson);
                foreach (DB::table('learning_materials')->where('lesson_id', $oldLesson)->whereNull('revoked_at')->get() as $material) { $copyMaterial = (array) $material; $copyMaterial['id'] = (string) Str::uuid(); $copyMaterial['lesson_id'] = $newLesson; $copyMaterial['replaces_material_id'] = $material->id; $copyMaterial['created_at'] = now(); $copyMaterial['updated_at'] = now(); DB::table('learning_materials')->insert($copyMaterial); }
            }
        }
        foreach (DB::table('learning_assessments')->where('course_version_id', $from->id)->get() as $assessment) {
            $oldAssessment = $assessment->id; $newAssessment = (string) Str::uuid(); $copy = (array) $assessment; $copy['id'] = $newAssessment; $copy['course_version_id'] = $to->id; $copy['module_id'] = $assessment->module_id ? ($moduleMap[$assessment->module_id] ?? null) : null; $copy['created_at'] = now(); $copy['updated_at'] = now(); DB::table('learning_assessments')->insert($copy);
            foreach (DB::table('learning_assessment_questions')->where('assessment_id', $oldAssessment)->get() as $question) { $oldQuestion = $question->id; $newQuestion = (string) Str::uuid(); $copyQ = (array) $question; $copyQ['id'] = $newQuestion; $copyQ['assessment_id'] = $newAssessment; $copyQ['created_at'] = now(); $copyQ['updated_at'] = now(); DB::table('learning_assessment_questions')->insert($copyQ); foreach (DB::table('learning_answer_options')->where('question_id', $oldQuestion)->get() as $option) { $copyO = (array) $option; $copyO['id'] = (string) Str::uuid(); $copyO['question_id'] = $newQuestion; $copyO['created_at'] = now(); $copyO['updated_at'] = now(); DB::table('learning_answer_options')->insert($copyO); } }
        }
        $this->sources->cloneLinks($from, $to, $actor);
    }

    private function courseSummary(LearningCourse $course): array
    {
        $published = $course->versions->firstWhere('id', $course->current_published_version_id);
        $official = $published ?? $course->versions->whereNotNull('version_number')->sortByDesc('version_number')->first();
        $draft = $course->versions->first(fn ($v) => $v->version_number === null && in_array($v->status, ['Draft', 'In Review', 'Changes Requested', 'Approved'], true));
        $active = DB::table('learning_assignments')->where('course_id', $course->id)->whereNotIn('status', ['Cancelled', 'Completed', 'Expired', 'Failed/Attempts Exhausted'])->count();
        $denom = DB::table('learning_assignments')->where('course_id', $course->id)->where('status', '!=', 'Cancelled')->count();
        $completed = DB::table('learning_assignments')->where('course_id', $course->id)->where('status', 'Completed')->count();
        $visibleVersionId = $draft?->id ?? $official?->id;
        $competencies = $visibleVersionId ? DB::table('learning_course_competencies')->where('course_version_id', $visibleVersionId)->orderByDesc('is_primary')->pluck('competency_name')->values()->all() : [];
        $audienceRules = $published?->audience_rules ?? $draft?->audience_rules ?? $official?->audience_rules ?? [];
        $personTypes = collect($audienceRules['personTypes'] ?? [])->map(fn ($value) => $value === 'Employee' ? 'Employees' : ($value === 'Trainee' ? 'Trainees' : $value))->implode(' & ');
        $audience = trim(($personTypes ?: 'No person type').' · '.(($audienceRules['allDepartments'] ?? false) ? 'All departments' : (collect($audienceRules['departments'] ?? [])->implode(', ') ?: 'Selected audience')));
        $target = ($audienceRules['allDepartments'] ?? false)
            ? 'Company-wide'
            : (collect($audienceRules['departments'] ?? [])->implode(', ') ?: 'Not set');
        $sourceReview = $draft ? $this->sourceReview->latest($draft) : null;
        $delivery = $official ? $this->publication->statusFor($official->id) : null;
        return ['id' => $course->id, 'code' => $course->code, 'owner' => $course->owner?->name, 'ownerId' => $course->owner_id,
            'publishedVersionId' => $official?->id, 'publishedVersion' => $official?->version_number, 'title' => $published?->title ?? $draft?->title ?? $official?->title,
            'category' => $published?->category ?? $draft?->category ?? $official?->category, 'status' => $course->archived_at ? 'Archived' : ($draft?->status ?? $published?->status ?? 'Draft'),
            'draftVersionId' => $draft?->id, 'audience' => $audience, 'targetDepartment' => $target, 'competencies' => $competencies,
            'sourceReview' => $sourceReview, 'delivery' => $delivery,
            'activeAssignments' => $active, 'completionRate' => $denom ? round($completed / $denom * 100) : 0, 'lastUpdated' => $course->updated_at?->toIso8601String(), 'archived' => (bool) $course->archived_at,
            'versionHistory' => $course->versions->sortByDesc(fn ($version) => $version->version_number ?? PHP_INT_MAX)->map(fn ($version) => [
                'id' => $version->id, 'versionNumber' => $version->version_number, 'status' => $version->status, 'title' => $version->title,
                'basedOnVersionId' => $version->based_on_version_id, 'submittedAt' => $version->submitted_at?->toIso8601String(),
                'approvedAt' => $version->approved_at?->toIso8601String(), 'publishedAt' => $version->published_at?->toIso8601String(),
                'updatedAt' => $version->updated_at?->toIso8601String(),
            ])->values()->all(),
            'publishedDetail' => $official ? $this->versionDetail($official) : null, 'draftDetail' => $draft ? $this->versionDetail($draft) : null];
    }

    private function versionDetail(LearningCourseVersion $version): array
    {
        $version->loadMissing(['modules.lessons.materials', 'assessments.questions.options']);
        $collaborators = DB::table('learning_course_collaborators')->where('course_id', $version->course_id)->get()->groupBy('permission');
        return [
            'id' => $version->id, 'courseId' => $version->course_id, 'code' => $version->course->code, 'status' => $version->status, 'versionNumber' => $version->version_number, 'workingStage' => $version->builder_stage,
            'title' => $version->title, 'description' => $version->description, 'category' => $version->category, 'difficulty' => $version->difficulty,
            'language' => $version->language, 'learningObjectives' => $version->learning_objectives ?? [], 'subjectMatterExpertId' => $version->subject_matter_expert_id,
            'thumbnailUrl' => $version->thumbnail_path ? URL::temporarySignedRoute('learning.api.thumbnails.download', now()->addMinutes(15), ['version' => $version->id]) : null,
            'durationOverrideMinutes' => $version->duration_override_minutes, 'estimatedDurationMinutes' => $version->estimated_duration_minutes,
            'ownerId' => $version->course->owner_id, 'authorIds' => collect($collaborators->get('Author', []))->pluck('user_id')->values()->all(),
            'reviewerIds' => collect($collaborators->get('Reviewer', []))->pluck('user_id')->values()->all(), 'publisherId' => collect($collaborators->get('Publisher', []))->pluck('user_id')->first(),
            'sourceDocumentIds' => collect($this->sources->links($version->id))->pluck('documentId')->values()->all(),
            'sourceDocuments' => $this->sources->links($version->id),
            'sourceReview' => $this->sourceReview->latest($version),
            'delivery' => $this->publication->statusFor($version->id),
            'audience' => $version->audience_rules ?? [], 'completion' => $version->completion_rules ?? [],
            'competencies' => DB::table('learning_course_competencies')->where('course_version_id', $version->id)->orderByDesc('is_primary')->get()->map(fn ($c) => ['id' => $c->competency_id, 'version' => $c->competency_version, 'code' => $c->competency_code, 'name' => $c->competency_name, 'targetLevel' => $c->target_level, 'purpose' => $c->purpose, 'objectiveIndexes' => json_decode($c->objective_indexes, true) ?? []])->all(),
            'modules' => $version->modules->map(fn ($m) => ['clientId' => $m->id, 'title' => $m->title, 'description' => $m->description, 'lessons' => $m->lessons->map(fn ($l) => ['id' => $l->id, 'title' => $l->title, 'objective' => $l->objective, 'description' => $l->description, 'contentType' => $l->content_type, 'textContent' => $l->text_content, 'externalUrl' => $l->external_url, 'estimatedMinutes' => $l->estimated_minutes, 'required' => $l->is_required, 'materials' => $l->materials->whereNull('revoked_at')->map(fn ($mat) => ['id' => $mat->id, 'displayName' => $mat->display_name, 'mimeType' => $mat->mime_type, 'sizeBytes' => $mat->size_bytes, 'downloadUrl' => URL::temporarySignedRoute('learning.api.materials.download', now()->addMinutes(15), ['material' => $mat->id])])->values()->all()])->values()->all()])->values()->all(),
            'assessments' => $version->assessments->map(fn ($a) => ['id' => $a->id, 'type' => $a->assessment_type, 'title' => $a->title, 'required' => $a->is_required, 'passingScore' => $a->passing_score, 'attemptsAllowed' => $a->attempts_allowed, 'shuffleQuestions' => $a->shuffle_questions, 'shuffleOptions' => $a->shuffle_options, 'feedbackPolicy' => $a->feedback_policy, 'moduleClientId' => $a->module_id, 'questions' => $a->questions->map(fn ($q) => ['id' => $q->id, 'type' => $q->question_type, 'text' => $q->question_text, 'explanation' => $q->explanation, 'points' => $q->points, 'options' => $q->options->map(fn ($o) => ['id' => $o->id, 'text' => $o->option_text, 'correct' => $o->is_correct])->values()->all()])->values()->all()])->values()->all(),
        ];
    }

    private function assignmentArray(object $row): array
    {
        $overdue = ! in_array($row->status, ['Completed', 'Cancelled', 'Expired'], true) && $row->due_at && now('Asia/Manila')->greaterThan($row->due_at);
        return array_merge((array) $row, ['display_status' => $overdue ? 'Overdue' : $row->status]);
    }

    private function analytics($assignments, $completions, bool $operator): array
    {
        $eligible = $assignments->where('status', '!=', 'Cancelled'); $complete = $eligible->where('status', 'Completed');
        $attempts = DB::table('learning_assessment_attempts')->whereIn('assignment_id', $assignments->pluck('id'))->where('status', 'Submitted')->get();
        $questionRows = DB::table('learning_attempt_responses as response')
            ->join('learning_assessment_questions as question', 'question.id', '=', 'response.question_id')
            ->join('learning_assessment_attempts as attempt', 'attempt.id', '=', 'response.attempt_id')
            ->join('learning_assessments as assessment', 'assessment.id', '=', 'question.assessment_id')
            ->join('learning_course_versions as version', 'version.id', '=', 'assessment.course_version_id')
            ->whereIn('attempt.assignment_id', $assignments->pluck('id'))
            ->where('attempt.status', 'Submitted')
            ->get(['attempt.assignment_id', 'question.id', 'question.question_text', 'response.is_correct', 'version.title as course_title', 'version.version_number']);
        $questionPerformance = $questionRows->groupBy('id')->map(function ($rows) { return ['question' => $rows->first()->question_text, 'responses' => $rows->count(), 'correctRate' => $rows->count() ? round($rows->where('is_correct', true)->count() / $rows->count() * 100, 1) : 0]; })->values()->all();
        $questionEvents = $questionRows->map(fn ($row) => [
            'assignmentId' => $row->assignment_id,
            'questionId' => $row->id,
            'question' => $row->question_text,
            'isCorrect' => (bool) $row->is_correct,
            'courseTitle' => $row->course_title,
            'versionNumber' => $row->version_number,
        ])->values()->all();
        $moduleRows = DB::table('learning_lesson_progress as progress')
            ->join('learning_course_lessons as lesson', 'lesson.id', '=', 'progress.lesson_id')
            ->join('learning_course_modules as module', 'module.id', '=', 'lesson.module_id')
            ->join('learning_course_versions as version', 'version.id', '=', 'module.course_version_id')
            ->whereIn('progress.assignment_id', $assignments->pluck('id'))
            ->get(['progress.assignment_id', 'module.id', 'module.title', 'progress.status', 'version.title as course_title', 'version.version_number']);
        $modulePerformance = $moduleRows->groupBy('id')->map(function ($rows) { return ['module' => $rows->first()->title, 'lessonEvents' => $rows->count(), 'completedRate' => $rows->count() ? round($rows->where('status', 'Completed')->count() / $rows->count() * 100, 1) : 0]; })->values()->all();
        $moduleEvents = $moduleRows->map(fn ($row) => [
            'assignmentId' => $row->assignment_id,
            'moduleId' => $row->id,
            'module' => $row->title,
            'status' => $row->status,
            'courseTitle' => $row->course_title,
            'versionNumber' => $row->version_number,
        ])->values()->all();
        $durations = $complete->filter(fn ($row) => $row['assigned_at'] && $row['completed_at'])->map(fn ($row) => Carbon::parse($row['assigned_at'])->diffInMinutes(Carbon::parse($row['completed_at'])));
        $certificates = $completions->whereNotNull('certificate_id');
        $active = $assignments->whereIn('status', ['Not Started', 'In Progress']);
        $referenceCoverage = $operator ? $this->referenceMatchCoverage() : ['published' => 0, 'mapped' => 0, 'percent' => 0.0];
        $canonicalWorkforce = $operator
            ? User::query()->activePersonnel()->where('role', UserRole::User->value)->count()
            : 0;
        $overview = $operator ? [
            'publishedCourses' => LearningCourse::query()->whereNull('archived_at')->whereNotNull('current_published_version_id')->count(),
            'activeAssignments' => $active->count(),
            'uniqueActiveLearners' => $active->pluck('learner_id')->unique()->count(),
            'completionRate' => $eligible->count() ? round($complete->count() / $eligible->count() * 100, 1) : 0,
            'overdueAssignments' => $eligible->where('display_status', 'Overdue')->count(),
            'coursesAwaitingReview' => DB::table('learning_review_requests')->where('status', 'Pending')->count(),
            'unprocessedRecommendations' => DB::table('learning_requests')->whereNotIn('status', ['Resolved', 'Declined'])->count(),
            'canonicalWorkforce' => $canonicalWorkforce,
            'workforceWithLearning' => $eligible->pluck('learner_id')->unique()->count(),
            'referencePublishedCourses' => $referenceCoverage['published'],
            'referenceMappedPublishedCourses' => $referenceCoverage['mapped'],
            'referenceMatchCoveragePercent' => $referenceCoverage['percent'],
            'aevynConfigured' => trim((string) config('services.groq.key')) !== '',
        ] : [];
        return [
            'overview' => $overview,
            'assigned' => $eligible->count(), 'uniqueLearners' => $eligible->pluck('learner_id')->unique()->count(),
            'notStarted' => $eligible->where('status', 'Not Started')->count(), 'inProgress' => $eligible->where('status', 'In Progress')->count(),
            'completed' => $complete->count(), 'overdue' => $eligible->where('display_status', 'Overdue')->count(),
            'failed' => $eligible->where('status', 'Failed/Attempts Exhausted')->count(), 'expired' => $eligible->where('status', 'Expired')->count(),
            'cancelled' => $assignments->where('status', 'Cancelled')->count(), 'completionRate' => $eligible->count() ? round($complete->count() / $eligible->count() * 100, 1) : 0,
            'passRate' => $attempts->count() ? round($attempts->where('passed', true)->count() / $attempts->count() * 100, 1) : 0,
            'averageAssessmentScore' => $attempts->avg('score_percent') !== null ? round((float) $attempts->avg('score_percent'), 1) : 0,
            'averageMinutesToComplete' => $durations->count() ? round((float) $durations->avg()) : 0,
            'certificates' => $certificates->count(), 'certificatesExpired' => $certificates->where('certificate_status', 'Expired')->count(), 'certificatesRevoked' => $certificates->where('certificate_status', 'Revoked')->count(),
            'byDepartment' => $eligible->groupBy('department')->map->count()->sortDesc()->all(),
            'byPosition' => $eligible->groupBy('position')->map->count()->sortDesc()->all(),
            'byPersonType' => $eligible->groupBy('person_type')->map->count()->sortDesc()->all(),
            'bySource' => $eligible->groupBy('source')->map->count()->sortDesc()->all(),
            'attempts' => $attempts->map(fn ($attempt) => ['assignmentId' => $attempt->assignment_id, 'score' => $attempt->score_percent, 'passed' => $attempt->passed])->values()->all(),
            'questionPerformance' => $questionPerformance, 'modulePerformance' => $modulePerformance,
            'questionEvents' => $questionEvents, 'moduleEvents' => $moduleEvents,
        ];
    }

    private function referenceMatchCoverage(): array
    {
        $publishedCodes = LearningCourse::query()
            ->whereNull('archived_at')
            ->whereNotNull('current_published_version_id')
            ->pluck('code')
            ->filter()
            ->unique()
            ->values();

        $published = $publishedCodes->count();
        if ($published === 0) return ['published' => 0, 'mapped' => 0, 'percent' => 0.0];

        $manifestPath = database_path('seeders/data/learning-references/ALIBATON_INTERNAL_LEARNING_REFERENCES_MANIFEST_V1.json');
        if (! is_file($manifestPath)) return ['published' => $published, 'mapped' => 0, 'percent' => 0.0];

        $manifest = json_decode((string) file_get_contents($manifestPath), true);
        if (! is_array($manifest)) return ['published' => $published, 'mapped' => 0, 'percent' => 0.0];

        $mappedCodes = collect($manifest['documents'] ?? [])
            ->flatMap(fn ($document) => is_array($document) ? ($document['related_lms_courses'] ?? []) : [])
            ->filter(fn ($code) => is_string($code) && trim($code) !== '')
            ->map(fn ($code) => trim($code))
            ->unique();

        $mapped = $publishedCodes->filter(fn ($code) => $mappedCodes->contains($code))->count();

        return [
            'published' => $published,
            'mapped' => $mapped,
            'percent' => round($mapped / $published * 100, 1),
        ];
    }

    private function nextCode(): string
    {
        $year=(int) now('Asia/Manila')->format('Y');
        DB::table('learning_course_code_sequences')->insertOrIgnore(['year'=>$year,'last_value'=>0,'created_at'=>now(),'updated_at'=>now()]);
        $row=DB::table('learning_course_code_sequences')->where('year',$year)->lockForUpdate()->first();
        $existingMaximum = LearningCourse::query()->where('code', 'like', sprintf('LRN-%d-%%', $year))->pluck('code')
            ->map(function (string $code) use ($year): int {
                return preg_match('/^LRN-'.preg_quote((string) $year, '/').'-(\d+)$/', $code, $matches) ? (int) $matches[1] : 0;
            })->max() ?? 0;
        $next=max((int)$row->last_value, $existingMaximum);
        do {
            $next++;
            $code=sprintf('LRN-%d-%03d',$year,$next);
        } while (LearningCourse::query()->where('code',$code)->exists());
        DB::table('learning_course_code_sequences')->where('year',$year)->update(['last_value'=>$next,'updated_at'=>now()]);
        return $code;
    }
    private function preparePayload(array $payload): array
    {
        $this->catalog->validateRoleProfiles($payload['audience']['roleProfileIds'] ?? []);
        $payload['competencies'] = $this->catalog->canonicalMappings($payload['competencies'] ?? []);
        $canonicalPersonnel = User::query()
            ->activePersonnel()
            ->where('role', UserRole::User->value);
        $departments = (clone $canonicalPersonnel)->pluck('department')->map(fn ($value) => trim((string) $value))->filter()->unique()->sort()->values();
        $positions = (clone $canonicalPersonnel)->pluck('position')->map(fn ($value) => trim((string) $value))->filter()->unique()->sort()->values();
        $personTypes = (clone $canonicalPersonnel)->pluck('person_type')->map(fn ($value) => trim((string) $value))->filter()->unique()->sort()->values();
        $canonicalPersonTypes = $personTypes->mapWithKeys(fn (string $value) => [Str::lower($value) => $value]);
        $legacyPersonTypeAliases = ['employees' => 'Employee', 'trainees' => 'Trainee'];
        $payload['audience']['personTypes'] = collect($payload['audience']['personTypes'] ?? [])->map(function ($rawValue) use ($canonicalPersonTypes, $legacyPersonTypeAliases) {
            $value = trim((string) $rawValue);
            $normalized = Str::lower($value);
            $candidate = $legacyPersonTypeAliases[$normalized] ?? $value;
            $canonical = $canonicalPersonTypes->get(Str::lower(trim($candidate)));
            if ($value !== '' && $canonical !== null) return $canonical;
            throw ValidationException::withMessages(['audience.personTypes' => "Audience Person Type '{$value}' is not used by active canonical personnel."]);
        })->unique()->values()->all();
        foreach ($payload['audience']['departments'] ?? [] as $value) if (! $departments->contains($value)) throw ValidationException::withMessages(['audience.departments' => 'Audience departments must use canonical personnel values.']);
        foreach ($payload['audience']['positions'] ?? [] as $value) if (! $positions->contains($value)) throw ValidationException::withMessages(['audience.positions' => 'Audience positions must use canonical personnel values.']);
        if (! empty($payload['subjectMatterExpertId']) && ! User::query()->activePersonnel()->whereKey($payload['subjectMatterExpertId'])->exists()) throw ValidationException::withMessages(['subjectMatterExpertId' => 'The Subject Matter Expert must be active canonical personnel.']);
        if (($payload['audience']['allDepartments'] ?? false) === true) $payload['audience']['departments'] = [];
        if (! empty($payload['audience']['availableFrom']) && ! empty($payload['audience']['availableUntil']) && Carbon::parse($payload['audience']['availableUntil'])->lte(Carbon::parse($payload['audience']['availableFrom']))) throw ValidationException::withMessages(['audience.availableUntil' => 'Availability must end after it starts.']);

        return $payload;
    }
    private function available(LearningCourseVersion $version): bool { $now=now(); return (! $version->availability_starts_at || $now->greaterThanOrEqualTo($version->availability_starts_at)) && (! $version->availability_ends_at || $now->lessThanOrEqualTo($version->availability_ends_at)); }
    private function hasPermission(string $courseId, int $userId, string $permission): bool
    {
        return DB::table('learning_course_collaborators')->where([
            'course_id' => $courseId,
            'user_id' => $userId,
            'permission' => $permission,
        ])->exists();
    }

    private function authorizePermission(User $actor, string $courseId, array $permissions): void
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($courseId, $actor->id, $permission)) return;
        }
        throw new AuthorizationException('You do not have the required course-specific authorization.');
    }

    private function requireHrAuthor(User $actor): void
    {
        if ($actor->role !== UserRole::HR) {
            throw new AuthorizationException('Only HR may create or edit Learning course Drafts.');
        }
    }

    private function requireAdminPublisher(User $actor, string $courseId): void
    {
        if ($actor->role !== UserRole::Admin || ! $this->hasPermission($courseId, $actor->id, 'Publisher')) {
            throw new AuthorizationException('Only the assigned Admin publisher may perform this action.');
        }
    }

    private function defaultPublisherId(): ?int
    {
        $id = User::query()->where('role', UserRole::Admin->value)->orderBy('id')->value('id');
        return $id ? (int) $id : null;
    }
}
