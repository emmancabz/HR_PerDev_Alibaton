<?php

namespace App\Http\Controllers;

use App\Http\Requests\LearningCourseRequest;
use App\Models\Learning\LearningAssessment;
use App\Models\Learning\LearningAssessmentAttempt;
use App\Models\Learning\LearningAssignment;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseLesson;
use App\Models\Learning\LearningCourseVersion;
use App\Models\Learning\LearningCertificate;
use App\Models\Learning\LearningMaterial;
use App\Services\Learning\LearningAssignmentService;
use App\Services\Learning\LearningCourseService;
use App\Services\Learning\LearningDeliveryService;
use App\Services\Learning\LearningGroqService;
use App\Services\Learning\LearningMaterialService;
use App\Services\Learning\LearningRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Illuminate\Http\Response;

class LearningStateController extends Controller
{
    public function __construct(
        private readonly LearningCourseService $courses, private readonly LearningAssignmentService $assignments,
        private readonly LearningDeliveryService $delivery, private readonly LearningMaterialService $materials,
        private readonly LearningGroqService $groq, private readonly LearningRequestService $requests,
    ) {}

    public function show(Request $request): JsonResponse { return response()->json(['data' => $this->courses->state($request->user())]); }
    public function create(LearningCourseRequest $request): JsonResponse { $version = $this->courses->createDraft($request->user(), $request->validated()); return response()->json(['data' => ['versionId' => $version->id, 'courseId' => $version->course_id]], 201); }
    public function save(LearningCourseRequest $request, LearningCourseVersion $version): JsonResponse { Gate::authorize('edit', $version); $this->courses->saveDraft($request->user(), $version, $request->validated()); return response()->json(['data' => $this->courses->state($request->user())]); }
    public function submitReview(Request $request, LearningCourseVersion $version): JsonResponse { Gate::authorize('submitReview', $version); $data = $request->validate(['reviewerId' => ['required', 'integer', 'exists:users,id']]); $this->courses->submitForReview($request->user(), $version, $data['reviewerId']); return $this->show($request); }
    public function decideReview(Request $request, LearningCourseVersion $version): JsonResponse { Gate::authorize('review', $version); $data = $request->validate(['decision' => ['required', 'in:Approved,Changes Requested'], 'comment' => ['nullable', 'string', 'max:10000']]); $this->courses->decideReview($request->user(), $version, $data['decision'], $data['comment'] ?? ''); return $this->show($request); }
    public function publish(Request $request, LearningCourseVersion $version): JsonResponse { Gate::authorize('publish', $version); $this->courses->publish($request->user(), $version); return $this->show($request); }
    public function workingDraft(Request $request, LearningCourseVersion $version): JsonResponse { Gate::authorize('createWorkingDraft', $version); $draft = $this->courses->workingDraft($request->user(), $version); return response()->json(['data' => ['versionId' => $draft->id, 'courseId' => $draft->course_id]]); }
    public function archive(Request $request, LearningCourse $course): JsonResponse { Gate::authorize('archive', $course); $this->courses->archive($request->user(), $course); return $this->show($request); }

    public function assignmentPreview(Request $request, LearningCourseVersion $version): JsonResponse { $data = $request->validate(['learnerIds' => ['required', 'array', 'min:1', 'max:2000'], 'learnerIds.*' => ['integer', 'distinct']]); return response()->json(['data' => $this->assignments->preview($request->user(), $version, $data['learnerIds'])]); }
    public function assign(Request $request, LearningCourseVersion $version): JsonResponse { $data = $request->validate(['learnerIds' => ['required', 'array', 'min:1', 'max:2000'], 'learnerIds.*' => ['integer', 'distinct'], 'source' => ['required', 'string'], 'availableFrom' => ['nullable', 'date'], 'dueAt' => ['nullable', 'date', 'after_or_equal:availableFrom'], 'mandatory' => ['sometimes', 'boolean'], 'priority' => ['required', 'in:Low,Normal,High,Critical'], 'reason' => ['nullable', 'string', 'max:5000'], 'sourceCompletionId' => ['nullable', 'uuid', 'exists:learning_completions,id'], 'sourceCertificateId' => ['nullable', 'uuid', 'exists:learning_certificates,id']]); $ids = $this->assignments->assign($request->user(), $version, $data); return response()->json(['data' => ['assignmentIds' => $ids]], 201); }
    public function selfEnroll(Request $request, LearningCourseVersion $version): JsonResponse { $assignment = $this->assignments->selfEnroll($request->user(), $version); return response()->json(['data' => ['assignmentId' => $assignment->id]], 201); }
    public function cancelAssignment(Request $request, LearningAssignment $assignment): JsonResponse { Gate::authorize('manage', $assignment); $data = $request->validate(['reason' => ['required', 'string', 'max:5000']]); $this->assignments->cancel($request->user(), $assignment, $data['reason']); return $this->show($request); }
    public function migrateAssignment(Request $request, LearningAssignment $assignment): JsonResponse { Gate::authorize('manage', $assignment); $data = $request->validate(['targetVersionId' => ['required', 'uuid', 'exists:learning_course_versions,id'], 'reason' => ['required', 'string', 'max:5000']]); $new = $this->assignments->migrate($request->user(), $assignment, LearningCourseVersion::findOrFail($data['targetVersionId']), $data['reason']); return response()->json(['data' => ['assignmentId' => $new->id]]); }

    public function player(Request $request, LearningAssignment $assignment): JsonResponse { Gate::authorize('view', $assignment); return response()->json(['data' => $this->delivery->player($request->user(), $assignment)]); }
    public function lessonProgress(Request $request, LearningAssignment $assignment): JsonResponse { $data = $request->validate(['lessonId' => ['required', 'uuid'], 'completed' => ['required', 'boolean'], 'timeSpentSeconds' => ['nullable', 'integer', 'between:0,86400']]); return response()->json(['data' => $this->delivery->recordLesson($request->user(), $assignment, $data['lessonId'], $data['completed'], $data['timeSpentSeconds'] ?? 0)]); }
    public function startAttempt(Request $request, LearningAssignment $assignment, LearningAssessment $assessment): JsonResponse
    {
        $attempt = $this->delivery->startAttempt($request->user(), $assignment, $assessment);
        $data = $attempt->toArray();
        $data['question_snapshot'] = collect($attempt->question_snapshot)->map(function ($question) {
            unset($question['explanation']);
            $question['options'] = collect($question['options'])->map(function ($option) {
                unset($option['correct']);

                return $option;
            })->values()->all();

            return $question;
        })->values()->all();

        return response()->json(['data' => $data], 201);
    }
    public function saveResponses(Request $request, LearningAssessmentAttempt $attempt): JsonResponse { $data = $this->responseRules($request); $this->delivery->saveResponses($request->user(), $attempt, $data['responses']); return response()->json(['data' => ['saved' => true]]); }
    public function submitAttempt(Request $request, LearningAssessmentAttempt $attempt): JsonResponse { $data = $this->responseRules($request); return response()->json(['data' => $this->delivery->submitAttempt($request->user(), $attempt, $data['responses'])]); }
    public function regradeAttempt(Request $request, LearningAssessmentAttempt $attempt): JsonResponse { $data = $request->validate(['reason' => ['required', 'string', 'max:5000']]); return response()->json(['data' => $this->delivery->regradeAttempt($request->user(), $attempt, $data['reason'])]); }
    public function revokeCertificate(Request $request, string $certificate): JsonResponse { $data = $request->validate(['reason' => ['required', 'string', 'max:5000']]); $this->delivery->revokeCertificate($request->user(), $certificate, $data['reason']); return $this->show($request); }
    public function downloadCertificate(Request $request, LearningCertificate $certificate): Response { return $this->delivery->downloadCertificate($request->user(), $certificate); }

    public function uploadMaterial(Request $request, LearningCourseLesson $lesson): JsonResponse { $data = $request->validate(['file' => ['required', 'file', 'max:51200']]); $material = $this->materials->store($request->user(), $lesson, $data['file']); return response()->json(['data' => $material], 201); }
    public function uploadThumbnail(Request $request, LearningCourseVersion $version): JsonResponse { $data = $request->validate(['thumbnail' => ['required', 'file', 'max:5120']]); return response()->json(['data' => $this->materials->storeThumbnail($request->user(), $version, $data['thumbnail'])], 201); }
    public function downloadThumbnail(Request $request, LearningCourseVersion $version): BinaryFileResponse { return $this->materials->downloadThumbnail($request->user(), $version); }
    public function revokeMaterial(Request $request, LearningMaterial $material): JsonResponse { $this->materials->revoke($request->user(), $material); return response()->json(['data' => ['revoked' => true]]); }
    public function downloadMaterial(Request $request, LearningMaterial $material): BinaryFileResponse { return $this->materials->download($request->user(), $material); }

    public function aiGenerate(Request $request, LearningCourseVersion $version): JsonResponse { $data = $request->validate(['useCase' => ['required', 'string', 'max:100'], 'context' => ['present', 'array', 'max:100']]); return response()->json(['data' => $this->groq->generate($request->user(), $version, $data['useCase'], $data['context'])]); }
    public function aiDecide(Request $request, string $event): JsonResponse { $data = $request->validate(['decision' => ['required', 'in:Accepted,Rejected'], 'acceptedOutput' => ['nullable', 'array']]); $this->groq->decide($request->user(), $event, $data['decision'], $data['acceptedOutput'] ?? null); return response()->json(['data' => ['reviewed' => true]]); }

    public function receiveRecommendation(Request $request): JsonResponse { $data = $request->validate(['sourceRecommendationId' => ['required', 'string', 'max:160'], 'personnelKey' => ['required', 'exists:users,personnel_key'], 'sourceAssessmentId' => ['required', 'string', 'max:160'], 'sourceAssessmentVersion' => ['required', 'integer', 'min:1'], 'competencyId' => ['required', 'string', 'max:160'], 'competencyVersion' => ['required', 'integer', 'min:1'], 'competencyName' => ['required', 'string', 'max:255'], 'requiredLevel' => ['required', 'integer', 'between:1,5'], 'validatedLevel' => ['required', 'integer', 'between:0,5'], 'title' => ['required', 'string', 'max:255'], 'note' => ['required', 'string', 'max:10000'], 'targetReassessmentDate' => ['nullable', 'date'], 'recommendedByName' => ['required', 'string', 'max:255'], 'requestedAt' => ['nullable', 'date']]); return response()->json(['data' => ['requestId' => $this->requests->receive($request->user(), $data)]], 201); }
    public function actRecommendation(Request $request, string $learningRequest): JsonResponse { $data = $request->validate(['action' => ['required', 'string'], 'courseId' => ['nullable', 'uuid'], 'courseVersionId' => ['nullable', 'uuid'], 'assignmentId' => ['nullable', 'uuid'], 'reason' => ['nullable', 'string', 'max:5000'], 'resolutionPolicy' => ['nullable', 'string', 'max:160']]); $this->requests->act($request->user(), $learningRequest, $data['action'], $data); return $this->show($request); }

    private function responseRules(Request $request): array { return $request->validate(['responses' => ['present', 'array', 'max:500'], 'responses.*.questionId' => ['required', 'uuid'], 'responses.*.optionIds' => ['present', 'array', 'max:20'], 'responses.*.optionIds.*' => ['uuid', 'distinct']]); }
}
