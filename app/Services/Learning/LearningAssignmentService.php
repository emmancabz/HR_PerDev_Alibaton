<?php

namespace App\Services\Learning;

use App\Enums\UserRole;
use App\Models\Learning\LearningAssignment;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningAssignmentService
{
    private const ACTIVE = ['Not Started', 'In Progress', 'Failed/Attempts Exhausted'];
    private const SOURCES = ['Manual Assignment', 'Role/Position Requirement', 'Competency Recommendation', 'Reassignment/Renewal', 'Self-enrollment'];

    public function __construct(private readonly LearningAuditService $audit, private readonly LearningEligibilityService $eligibility) {}

    public function preview(User $actor, LearningCourseVersion $version, array $learnerIds): array
    {
        $this->requireOperator($actor);
        $this->assertAssignable($version);
        $users = User::whereIn('id', $learnerIds)->get()->keyBy('id');
        return collect($learnerIds)->unique()->map(function ($id) use ($users, $version) {
            $user = $users->get($id);
            if (! $user) return ['id' => $id, 'name' => 'Unknown person', 'result' => 'Excluded', 'reason' => 'Canonical person not found'];
            if (! $this->eligible($user, $version)) return ['id' => $user->id, 'name' => $user->name, 'result' => 'Ineligible', 'reason' => 'Outside the published audience'];
            if ($this->duplicateExists($user->id, $version->course_id)) return ['id' => $user->id, 'name' => $user->name, 'result' => 'Already assigned', 'reason' => 'An active assignment already exists for this course lineage'];
            return ['id' => $user->id, 'name' => $user->name, 'result' => 'Eligible', 'reason' => null];
        })->values()->all();
    }

    public function assign(User $actor, LearningCourseVersion $version, array $payload): array
    {
        $this->requireOperator($actor);
        $this->assertAssignable($version);
        $source = $payload['source'];
        if (! in_array($source, self::SOURCES, true)) throw ValidationException::withMessages(['source' => 'Invalid assignment source.']);
        if ($source === 'Reassignment/Renewal' && trim((string) ($payload['reason'] ?? '')) === '') throw ValidationException::withMessages(['reason' => 'Reassignment requires an explicit reason.']);
        return DB::transaction(function () use ($actor, $version, $payload) {
            $this->requireOperator($actor);
            LearningCourse::query()->lockForUpdate()->findOrFail($version->course_id);
            $lockedVersion=LearningCourseVersion::query()->lockForUpdate()->findOrFail($version->id); $this->assertAssignable($lockedVersion);
            $payload = $this->applyAssignmentDefaults($lockedVersion, $payload, true);
            $this->validateSchedule($lockedVersion, $payload);
            $requestedIds=collect($payload['learnerIds'])->map(fn($id)=>(int)$id)->unique()->values();
            $users=User::query()->whereIn('id',$requestedIds)->orderBy('id')->lockForUpdate()->get(); $eligibleIds=[];
            foreach ($users as $user) if ($this->eligible($user,$lockedVersion) && ! $this->duplicateExists($user->id,$lockedVersion->course_id)) $eligibleIds[]=$user->id;
            if (count($eligibleIds)!==$requestedIds->count()) throw ValidationException::withMessages(['learnerIds'=>'Assignment candidates changed after preview. Preview again before confirming the exact eligible people.']);
            $created = [];
            foreach ($eligibleIds as $id) {
                $assignment = LearningAssignment::create([
                    'learner_id' => $id, 'course_id' => $lockedVersion->course_id, 'course_version_id' => $lockedVersion->id,
                    'source' => $payload['source'], 'assigned_by' => $actor->id, 'assigned_at' => now(),
                    'available_from' => $payload['availableFrom'] ?? null, 'due_at' => $payload['dueAt'] ?? null,
                    'is_mandatory' => $payload['mandatory'] ?? true, 'priority' => $payload['priority'] ?? 'Normal',
                    'reason' => trim((string) ($payload['reason'] ?? '')) ?: null, 'status' => 'Not Started', 'progress_percent' => 0,
                    'renewal_from_completion_id' => $payload['sourceCompletionId'] ?? null,
                    'renewal_from_certificate_id' => $payload['sourceCertificateId'] ?? null,
                ]);
                $this->audit->record($actor, 'Assignment created', 'LearningAssignment', $assignment->id, ['versionId' => $lockedVersion->id, 'source' => $payload['source']]);
                $created[] = $assignment->id;
            }
            return $created;
        }, 3);
    }

    public function selfEnroll(User $actor, LearningCourseVersion $version): LearningAssignment
    {
        $this->assertAssignable($version);
        if (! $this->availableNow($version)) throw ValidationException::withMessages(['course' => 'This course is outside its self-enrollment window.']);
        if (($version->audience_rules['catalogVisibility'] ?? '') !== 'Eligible users may self-enroll' || ! $this->eligible($actor, $version)) {
            throw new AuthorizationException('This course is not available for self-enrollment.');
        }
        if ($this->duplicateExists($actor->id, $version->course_id)) throw ValidationException::withMessages(['course' => 'You already have active work for this course.']);
        return DB::transaction(function () use ($actor, $version) {
            LearningCourse::query()->lockForUpdate()->findOrFail($version->course_id); User::query()->lockForUpdate()->findOrFail($actor->id);
            $locked=LearningCourseVersion::query()->lockForUpdate()->findOrFail($version->id); $this->assertAssignable($locked); if (! $this->availableNow($locked)) throw ValidationException::withMessages(['course' => 'This course is outside its self-enrollment window.']);
            $freshActor = User::query()->findOrFail($actor->id);
            if (($locked->audience_rules['catalogVisibility'] ?? '') !== 'Eligible users may self-enroll' || ! $this->eligible($freshActor, $locked)) throw new AuthorizationException('This course is not available for self-enrollment.');
            if ($this->duplicateExists($actor->id,$locked->course_id)) throw ValidationException::withMessages(['course'=>'You already have active work for this course.']);
            $assignment = LearningAssignment::create(['learner_id' => $actor->id, 'course_id' => $locked->course_id, 'course_version_id' => $locked->id, 'source' => 'Self-enrollment', 'assigned_by' => $actor->id, 'assigned_at' => now(), 'is_mandatory' => false, 'priority' => 'Normal', 'status' => 'Not Started', 'progress_percent' => 0]);
            $this->audit->record($actor, 'Assignment created', 'LearningAssignment', $assignment->id, ['source' => 'Self-enrollment']);
            return $assignment;
        }, 3);
    }

    public function cancel(User $actor, LearningAssignment $assignment, string $reason): void
    {
        $this->requireOperator($actor);
        if (trim($reason) === '') throw ValidationException::withMessages(['reason' => 'A cancellation reason is required.']);
        DB::transaction(function () use ($actor, $assignment, $reason) {
            $this->requireOperator($actor);
            $locked=LearningAssignment::query()->lockForUpdate()->findOrFail($assignment->id);
            if ($locked->status==='Cancelled') throw ValidationException::withMessages(['assignment'=>'This assignment is already cancelled.']);
            if ($locked->status==='Completed') throw ValidationException::withMessages(['assignment'=>'Completed assignments cannot be cancelled.']);
            $locked->update(['status' => 'Cancelled', 'cancelled_at' => now(), 'cancellation_reason' => trim($reason)]);
            $this->audit->record($actor, 'Assignment cancelled', 'LearningAssignment', $locked->id, ['reason' => trim($reason)]);
        }, 3);
    }

    public function migrate(User $actor, LearningAssignment $assignment, LearningCourseVersion $target, string $reason): LearningAssignment
    {
        $this->requireOperator($actor); $this->assertAssignable($target);
        if ($assignment->course_id !== $target->course_id) throw ValidationException::withMessages(['targetVersion' => 'The target must belong to the same course lineage.']);
        if (trim($reason) === '') throw ValidationException::withMessages(['reason' => 'Migration requires a previewed, explicit reason.']);
        return DB::transaction(function () use ($actor, $assignment, $target, $reason) {
            $this->requireOperator($actor);
            $locked=LearningAssignment::query()->lockForUpdate()->findOrFail($assignment->id); LearningCourse::query()->lockForUpdate()->findOrFail($locked->course_id);
            $lockedTarget=LearningCourseVersion::query()->lockForUpdate()->findOrFail($target->id); $this->assertAssignable($lockedTarget);
            if (! in_array($locked->status,self::ACTIVE,true)) throw ValidationException::withMessages(['assignment'=>'Only active work can be migrated.']);
            if ($locked->course_id!==$lockedTarget->course_id || $locked->course_version_id===$lockedTarget->id) throw ValidationException::withMessages(['targetVersion'=>'Choose a newer Published version in the same lineage.']);
            $learner=User::query()->lockForUpdate()->findOrFail($locked->learner_id); if (! $this->eligible($learner,$lockedTarget)) throw ValidationException::withMessages(['targetVersion'=>'The learner is not eligible for the target version.']);
            $locked->update(['status' => 'Cancelled', 'cancelled_at' => now(), 'cancellation_reason' => 'Migrated: '.trim($reason)]);
            $new = LearningAssignment::create([
                'learner_id' => $locked->learner_id, 'course_id' => $locked->course_id, 'course_version_id' => $lockedTarget->id,
                'source' => 'Reassignment/Renewal', 'assigned_by' => $actor->id, 'assigned_at' => now(), 'available_from' => now(),
                'due_at' => $locked->due_at, 'is_mandatory' => $locked->is_mandatory, 'priority' => $locked->priority,
                'reason' => trim($reason), 'status' => 'Not Started', 'progress_percent' => 0, 'migrated_from_assignment_id' => $locked->id,
            ]);
            $this->audit->record($actor, 'Assignment migrated', 'LearningAssignment', $new->id, ['from' => $locked->id, 'toVersion' => $lockedTarget->id]);
            return $new;
        }, 3);
    }

    public function eligible(User $user, LearningCourseVersion $version): bool
    {
        return $user->role === UserRole::User
            && $user->isActivePersonnel()
            && $this->eligibility->matchesAudience($user, $version);
    }

    private function assertAssignable(LearningCourseVersion $version): void
    {
        $course = LearningCourse::findOrFail($version->course_id);
        if ($course->archived_at || $version->status !== 'Published' || $version->id !== $course->current_published_version_id) {
            throw ValidationException::withMessages(['courseVersion' => 'New assignments require the current Published version of an active course.']);
        }
        if ($version->availability_ends_at && now()->gt($version->availability_ends_at)) throw ValidationException::withMessages(['courseVersion'=>'The Published course availability window has ended.']);
    }
    private function availableNow(LearningCourseVersion $version): bool { $now=now(); return (! $version->availability_starts_at || $now->gte($version->availability_starts_at)) && (! $version->availability_ends_at || $now->lte($version->availability_ends_at)); }
    private function validateSchedule(LearningCourseVersion $version, array $payload): void
    {
        $available = ! empty($payload['availableFrom']) ? Carbon::parse($payload['availableFrom']) : null;
        $due = ! empty($payload['dueAt']) ? Carbon::parse($payload['dueAt']) : null;
        if ($version->availability_ends_at && (($available && $available->gt($version->availability_ends_at)) || ($due && $due->gt($version->availability_ends_at)))) throw ValidationException::withMessages(['dueAt' => 'Assignment availability and due dates must fit within the course availability window.']);
        if ($version->availability_starts_at && $due && $due->lt($version->availability_starts_at)) throw ValidationException::withMessages(['dueAt' => 'The assignment cannot be due before the course becomes available.']);
    }
    private function applyAssignmentDefaults(LearningCourseVersion $version, array $payload, bool $lockSources = false): array
    {
        $rules = $version->audience_rules ?? [];
        $payload['mandatory'] = array_key_exists('mandatory', $payload) ? (bool) $payload['mandatory'] : (bool) ($rules['mandatoryDefault'] ?? true);
        if (($payload['source'] ?? '') === 'Reassignment/Renewal') {
            $learnerIds = collect($payload['learnerIds'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
            if ($learnerIds->count() !== 1) throw ValidationException::withMessages(['learnerIds' => 'A renewal must identify exactly one learner.']);
            $completionId = $payload['sourceCompletionId'] ?? null;
            if (! $completionId) throw ValidationException::withMessages(['sourceCompletionId' => 'A renewal must retain its source completion.']);
            $completionQuery = DB::table('learning_completions')->where('id', $completionId);
            if ($lockSources) $completionQuery->lockForUpdate();
            $completion = $completionQuery->first();
            if (! $completion || (int) $completion->learner_id !== $learnerIds->first() || $completion->course_id !== $version->course_id) throw ValidationException::withMessages(['sourceCompletionId' => 'The renewal source must belong to the selected learner and course lineage.']);
            if (! empty($payload['sourceCertificateId'])) {
                $certificateQuery = DB::table('learning_certificates')->where('id', $payload['sourceCertificateId'])->where('completion_id', $completionId);
                if ($lockSources) $certificateQuery->lockForUpdate();
                if (! $certificateQuery->first()) throw ValidationException::withMessages(['sourceCertificateId' => 'The renewal certificate must belong to the source completion.']);
            }
            $sourceVersionQuery = LearningCourseVersion::query()->whereKey($completion->course_version_id);
            if ($lockSources) $sourceVersionQuery->lockForUpdate();
            $sourceRules = $sourceVersionQuery->value('completion_rules') ?? [];
            if (is_string($sourceRules)) $sourceRules = json_decode($sourceRules, true) ?? [];
            $interval = (int) ($sourceRules['renewalIntervalMonths'] ?? 0);
            if ($interval < 1) throw ValidationException::withMessages(['sourceCompletionId' => 'The source course version does not define a renewal interval.']);
            $payload['availableFrom'] = Carbon::parse($completion->completed_at)->addMonthsNoOverflow($interval)->toIso8601String();
        }
        if (empty($payload['dueAt']) && ! empty($rules['defaultDueDays'])) {
            $base = ! empty($payload['availableFrom']) ? Carbon::parse($payload['availableFrom']) : now('Asia/Manila');
            $payload['dueAt'] = $base->copy()->addDays((int) $rules['defaultDueDays'])->toIso8601String();
        }
        return $payload;
    }
    private function duplicateExists(int $learnerId, string $courseId): bool { return LearningAssignment::where(['learner_id'=>$learnerId,'course_id'=>$courseId])->whereIn('status',self::ACTIVE)->exists(); }
    private function requireOperator(User $actor): void { if (! in_array($actor->role, [UserRole::Admin, UserRole::HR], true)) throw new AuthorizationException('Learning administration requires Admin or HR access.'); }
}
