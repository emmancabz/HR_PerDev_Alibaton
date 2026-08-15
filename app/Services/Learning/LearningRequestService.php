<?php

namespace App\Services\Learning;

use App\Enums\UserRole;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningRequestService
{
    public function __construct(private readonly LearningAuditService $audit) {}

    public function receive(User $actor, array $payload): string
    {
        $this->operator($actor);
        $id = (string) Str::uuid();
        DB::transaction(function () use ($actor, $payload, $id) {
            DB::table('learning_requests')->insert([
                'id' => $id, 'source_recommendation_id' => $payload['sourceRecommendationId'], 'personnel_key' => $payload['personnelKey'],
                'source_assessment_id' => $payload['sourceAssessmentId'], 'source_assessment_version' => $payload['sourceAssessmentVersion'],
                'competency_id' => $payload['competencyId'], 'competency_version' => $payload['competencyVersion'], 'competency_name' => $payload['competencyName'],
                'required_level' => $payload['requiredLevel'], 'validated_level' => $payload['validatedLevel'], 'recommendation_title' => $payload['title'],
                'recommendation_note' => $payload['note'], 'target_reassessment_date' => $payload['targetReassessmentDate'] ?? null,
                'recommended_by_name' => $payload['recommendedByName'], 'requested_at' => $payload['requestedAt'] ?? now(), 'status' => 'New', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->audit->record($actor, 'Competency recommendation received', 'LearningRequest', $id, ['sourceRecommendationId' => $payload['sourceRecommendationId'], 'automaticEnrollment' => false]);
        }, 3);
        return $id;
    }

    public function act(User $actor, string $id, string $action, array $payload): void
    {
        $this->operator($actor);
        $transitions = [
            'New' => ['Triage' => 'Triaged', 'Defer' => 'Deferred', 'Decline' => 'Declined'],
            'Triaged' => ['Link Draft' => 'Draft Linked', 'Link Course' => 'Ready for Assignment', 'Defer' => 'Deferred', 'Decline' => 'Declined'],
            'Draft Linked' => ['Ready' => 'Ready for Assignment', 'Defer' => 'Deferred', 'Decline' => 'Declined'],
            'Ready for Assignment' => ['Assigned' => 'Assigned', 'Defer' => 'Deferred', 'Decline' => 'Declined'],
            'Assigned' => ['Resolve' => 'Resolved', 'Manual Resolve' => 'Resolved'],
            'Deferred' => ['Triage' => 'Triaged'],
        ];
        if (! collect($transitions)->contains(fn (array $actions) => isset($actions[$action]))) throw ValidationException::withMessages(['action' => 'Invalid Learning Request action.']);
        if (in_array($action, ['Defer', 'Decline', 'Manual Resolve'], true) && trim((string) ($payload['reason'] ?? '')) === '') throw ValidationException::withMessages(['reason' => 'A reason is required.']);
        if ($action === 'Manual Resolve' && ($actor->role !== UserRole::Admin || ($payload['resolutionPolicy'] ?? '') !== 'Administrative closure without competency outcome')) throw new AuthorizationException('Manual resolution requires Admin authorization and the defined non-competency administrative closure policy.');
        DB::transaction(function () use ($actor, $id, $transitions, $action, $payload) {
            $this->operator($actor);
            $request = DB::table('learning_requests')->where('id', $id)->lockForUpdate()->first();
            if (! $request) abort(404);
            $next = $transitions[$request->status][$action] ?? null;
            if (! $next) throw ValidationException::withMessages(['action' => 'That action is not valid from the request\'s current status.']);

            $courseId = $payload['courseId'] ?? $request->linked_course_id;
            $versionId = $payload['courseVersionId'] ?? $request->linked_course_version_id;
            if (in_array($action, ['Link Course', 'Link Draft', 'Ready'], true)) {
                if (! $courseId || ! $versionId) throw ValidationException::withMessages(['courseVersionId' => 'Choose a course and exact version.']);
                $course = DB::table('learning_courses')->where('id', $courseId)->lockForUpdate()->first();
                if (! $course || $course->archived_at) throw ValidationException::withMessages(['courseId' => 'Choose an active Learning course lineage.']);
                $version = LearningCourseVersion::query()->whereKey($versionId)->where('course_id', $courseId)->lockForUpdate()->firstOrFail();
                if ($action === 'Link Draft' && ($version->version_number !== null || ! in_array($version->status, ['Draft', 'Changes Requested'], true))) throw ValidationException::withMessages(['courseVersionId' => 'Link Draft requires a working Draft version.']);
                if (in_array($action, ['Link Course', 'Ready'], true) && ($version->status !== 'Published' || $version->version_number === null)) throw ValidationException::withMessages(['courseVersionId' => 'A current Published version is required before assignment.']);
            }
            $assignmentId = $payload['assignmentId'] ?? $request->assignment_id;
            if ($action === 'Assigned') {
                if (! $assignmentId) throw ValidationException::withMessages(['assignmentId' => 'Choose the explicit learner assignment created for this request.']);
                $personId = DB::table('users')->where('personnel_key', $request->personnel_key)->value('id');
                $assignment = DB::table('learning_assignments')->where('id', $assignmentId)->where('learner_id', $personId)->where('course_id', $courseId)->first();
                if (! $assignment) throw ValidationException::withMessages(['assignmentId' => 'The assignment must belong to the recommended person and linked course.']);
                $versionId = $assignment->course_version_id;
            }
            if ($action === 'Resolve') {
                if (! $assignmentId) throw ValidationException::withMessages(['assignmentId' => 'A request cannot resolve without its explicit learner assignment.']);
                $completion = DB::table('learning_completions')->where('assignment_id', $assignmentId)->lockForUpdate()->first();
                if (! $completion) throw ValidationException::withMessages(['outcome' => 'Assignment creation is not a resolution outcome. Complete the assigned course or use the authorized manual-resolution policy with a reason.']);
                if ($completion->course_version_id !== $versionId) throw ValidationException::withMessages(['outcome' => 'The completion must reference the exact linked course version.']);
            }
            DB::table('learning_requests')->where('id', $request->id)->update([
                'status' => $next, 'linked_course_id' => $courseId,
                'linked_course_version_id' => $versionId, 'assignment_id' => $assignmentId,
                'action_reason' => $payload['reason'] ?? null, 'acted_by' => $actor->id, 'acted_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('learning_request_actions')->insert([
                'id' => (string) Str::uuid(), 'learning_request_id' => $request->id, 'from_status' => $request->status,
                'to_status' => $next, 'action' => $action, 'reason' => $payload['reason'] ?? null,
                'actor_id' => $actor->id, 'acted_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->audit->record($actor, 'Competency recommendation acted on', 'LearningRequest', $request->id, ['action' => $action, 'resolutionPolicy' => $payload['resolutionPolicy'] ?? null, 'competencyResultChanged' => false, 'competencyGapClosed' => false]);
        }, 3);
    }

    private function operator(User $actor): void { if (! in_array($actor->role, [UserRole::Admin, UserRole::HR], true)) throw new AuthorizationException('Learning Request actions require Admin or HR access.'); }
}
