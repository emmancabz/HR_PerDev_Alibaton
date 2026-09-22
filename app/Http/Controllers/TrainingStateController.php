<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\TrainingProgramRequest;
use App\Models\Training\TrainingAttendanceRecord;
use App\Models\Training\TrainingCertificate;
use App\Models\Training\TrainingEnrollment;
use App\Models\Training\TrainingProgram;
use App\Models\Training\TrainingRecommendation;
use App\Models\Training\TrainingSession;
use App\Services\Training\TrainingService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TrainingStateController extends Controller
{
    public function __construct(private readonly TrainingService $training) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->training->state($request->user())]);
    }

    public function createProgram(TrainingProgramRequest $request): JsonResponse
    {
        $program = $this->training->createProgram($request->user(), $request->validated());

        return response()->json(['data' => ['programId' => $program->id, 'code' => $program->code]], 201);
    }

    public function updateProgram(TrainingProgramRequest $request, TrainingProgram $program): JsonResponse
    {
        $this->training->updateProgram($request->user(), $program, $request->validated());

        return $this->show($request);
    }

    public function transitionProgram(Request $request, TrainingProgram $program): JsonResponse
    {
        $data = $request->validate(['action' => ['required', 'in:activate,archive,cancel'], 'reason' => ['nullable', 'string', 'max:5000']]);
        $this->training->transitionProgram($request->user(), $program, $data['action'], $data['reason'] ?? null);

        return $this->show($request);
    }

    public function scheduleRequirements(Request $request): JsonResponse
    {
        $data = $request->validate([
            'recommendationIds' => ['required', 'array', 'min:1', 'max:500'],
            'recommendationIds.*' => ['uuid', 'distinct', 'exists:training_recommendations,id'],
            'programId' => ['required', 'uuid', 'exists:training_programs,id'],
            'label' => ['nullable', 'string', 'max:160'],
            'startsAt' => ['required', 'date'],
            'endsAt' => ['required', 'date', 'after:startsAt'],
            'venue' => ['required', 'string', 'max:255'],
            'capacity' => ['required', 'integer', 'between:1,5000'],
            'facilitatorId' => ['nullable', 'integer', 'exists:users,id', 'required_without:externalFacilitatorName'],
            'externalFacilitatorName' => ['nullable', 'string', 'max:255', 'required_without:facilitatorId'],
            'enrollmentClosesAt' => ['nullable', 'date', 'before_or_equal:startsAt'],
        ]);
        $this->training->scheduleRequirements($request->user(), $data);

        return $this->show($request);
    }

    public function createSession(Request $request, TrainingProgram $program): JsonResponse
    {
        $session = $this->training->saveSession($request->user(), $program, $this->sessionData($request));

        return response()->json(['data' => ['sessionId' => $session->id]], 201);
    }

    public function updateSession(Request $request, TrainingProgram $program, TrainingSession $session): JsonResponse
    {
        $this->training->saveSession($request->user(), $program, $this->sessionData($request), $session);

        return $this->show($request);
    }

    public function transitionSession(Request $request, TrainingSession $session): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:Scheduled,Ongoing,Completed,Cancelled'], 'reason' => ['nullable', 'string', 'max:5000']]);
        $this->training->transitionSession($request->user(), $session, $data['status'], $data['reason'] ?? null);

        return $this->show($request);
    }

    public function enroll(Request $request, TrainingProgram $program): JsonResponse
    {
        $data = $request->validate([
            'participantIds' => ['required', 'array', 'min:1', 'max:500'],
            'participantIds.*' => ['integer', 'distinct'],
            'sessionIds' => ['required', 'array', 'min:1', 'max:100'],
            'sessionIds.*' => ['uuid', 'distinct'],
            'source' => ['required', 'in:HR Assignment,Competency Recommendation,Performance Development,Manager Nomination,Self Request,Role/Position Requirement,Development Requirement'],
            'reason' => ['nullable', 'string', 'max:5000'],
        ]);
        $ids = $this->training->enroll($request->user(), $program, $data['participantIds'], $data['sessionIds'], $data['source'], $data['reason'] ?? null);

        return response()->json(['data' => ['enrollmentIds' => $ids]], 201);
    }

    public function transitionEnrollment(Request $request, TrainingEnrollment $enrollment): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:Confirmed,Withdrawn,Cancelled'],
            'reason' => ['nullable', 'string', 'max:5000'],
        ]);
        $this->training->transitionEnrollment($request->user(), $enrollment, $data['status'], $data['reason'] ?? null);

        return $this->show($request);
    }

    public function syncWorkforce(Request $request, TrainingSession $session): JsonResponse
    {
        $this->training->syncWorkforceEvidence($request->user(), $session);

        return $this->show($request);
    }

    public function markAttendance(Request $request, TrainingAttendanceRecord $attendance): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:Pending,Present,Late,Partial,Absent,Excused'], 'note' => ['nullable', 'string', 'max:5000']]);
        $this->training->recordAttendance($request->user(), $attendance, $data['status'], $data['note'] ?? null);

        return $this->show($request);
    }

    public function finalizeAttendance(Request $request, TrainingSession $session): JsonResponse
    {
        $this->training->finalizeAttendance($request->user(), $session);

        return $this->show($request);
    }

    public function assess(Request $request, TrainingEnrollment $enrollment): JsonResponse
    {
        $data = $request->validate([
            'result' => ['required', 'in:Pending,Passed,Failed,Needs Improvement'],
            'score' => ['nullable', 'numeric', 'min:0'],
            'maximumScore' => ['nullable', 'numeric', 'min:0.01'],
            'checklist' => ['present', 'array', 'max:100'],
            'checklist.*.criterion' => ['required', 'string', 'max:500'],
            'checklist.*.met' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ]);
        if (isset($data['score'], $data['maximumScore']) && $data['score'] > $data['maximumScore']) {
            return response()->json(['message' => 'The score may not exceed the maximum score.', 'errors' => ['score' => ['The score may not exceed the maximum score.']]], 422);
        }
        $this->training->assess($request->user(), $enrollment, $data);

        return $this->show($request);
    }

    public function finalizeCompletion(Request $request, TrainingEnrollment $enrollment): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:Passed,Failed,Incomplete,Waived'], 'note' => ['nullable', 'string', 'max:10000']]);
        $this->training->finalizeCompletion($request->user(), $enrollment, $data['status'], $data['note'] ?? null);

        return $this->show($request);
    }

    public function finalizeReadyParticipants(Request $request, TrainingSession $session): JsonResponse
    {
        $this->training->finalizeReadyParticipants($request->user(), $session);

        return $this->show($request);
    }

    public function revokeCertificate(Request $request, TrainingCertificate $certificate): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:5000']]);
        $this->training->revokeCertificate($request->user(), $certificate, $data['reason']);

        return $this->show($request);
    }

    public function feedback(Request $request, TrainingSession $session): JsonResponse
    {
        $data = $request->validate([
            'content_rating' => ['required', 'integer', 'between:1,5'],
            'facilitator_rating' => ['required', 'integer', 'between:1,5'],
            'relevance_rating' => ['required', 'integer', 'between:1,5'],
            'organization_rating' => ['required', 'integer', 'between:1,5'],
            'overall_satisfaction' => ['required', 'integer', 'between:1,5'],
            'comments' => ['nullable', 'string', 'max:5000'],
        ]);
        $this->training->submitFeedback($request->user(), $session, $data);

        return $this->show($request);
    }

    public function receiveRecommendation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sourceRecommendationId' => ['required', 'string', 'max:160'],
            'sourceModule' => ['required', 'in:Performance,Competency,Learning,Compliance'],
            'personnelKey' => ['required', 'string', 'max:160'],
            'developmentNeed' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string', 'max:10000'],
            'sourceSnapshot' => ['present', 'array', 'max:100'],
        ]);
        $recommendation = $this->training->receiveRecommendation($request->user(), $data);

        return response()->json(['data' => ['recommendationId' => $recommendation->id]], 201);
    }

    public function actRecommendation(Request $request, TrainingRecommendation $recommendation): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'in:Under Review,Accepted,Rejected'],
            'programId' => ['nullable', 'uuid', 'exists:training_programs,id'],
            'sessionId' => ['nullable', 'uuid', 'exists:training_sessions,id'],
            'enrollmentId' => ['nullable', 'uuid', 'exists:training_enrollments,id'],
            'reason' => ['nullable', 'string', 'max:5000'],
        ]);
        $this->training->actRecommendation($request->user(), $recommendation, $data);

        return $this->show($request);
    }

    public function export(Request $request): StreamedResponse
    {
        if (! in_array($request->user()->role, [UserRole::Admin, UserRole::HR], true)) {
            throw new AuthorizationException('Only Training operators may export reports.');
        }
        $state = $this->training->state($request->user());

        return response()->streamDownload(function () use ($state): void {
            $output = fopen('php://output', 'wb');
            fputcsv($output, ['Program Code', 'Program', 'Participant', 'Employee/Trainee ID', 'Department', 'Enrollment Status', 'Completion Status', 'Attendance Rate']);
            foreach ($state['enrollments'] as $enrollment) {
                $program = collect($state['programs'])->firstWhere('id', $enrollment['programId']);
                fputcsv($output, [
                    $program['code'] ?? '', $program['title'] ?? '', $enrollment['participant'], $enrollment['employeeId'],
                    $enrollment['department'], $enrollment['status'], $enrollment['completion']['status'] ?? 'Pending',
                    $enrollment['completion']['attendanceRate'] ?? '',
                ]);
            }
            fclose($output);
        }, 'training-report-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function certificate(Request $request, TrainingCertificate $certificate): Response
    {
        $certificate->load('completion.enrollment.program', 'completion.enrollment.participant');
        $enrollment = $certificate->completion->enrollment;
        $actor = $request->user();
        if (! in_array($actor->role, [UserRole::Admin, UserRole::HR], true) && $enrollment->participant_id !== $actor->id) {
            throw new AuthorizationException('You may only download your own Training certificate.');
        }
        if ($certificate->status !== 'Active' || ($certificate->expires_at && $certificate->expires_at->isPast())) {
            throw new AuthorizationException('This Training certificate is not active.');
        }
        $name = e($enrollment->participant->name);
        $program = e($enrollment->program->title);
        $number = e($certificate->certificate_number);
        $date = e($certificate->issued_at->format('F j, Y'));
        $html = "<!doctype html><html><head><meta charset=\"utf-8\"><title>{$number}</title><style>body{font-family:Arial,sans-serif;background:#f4f1e8;padding:48px}.certificate{max-width:900px;margin:auto;background:white;border:12px solid #111;padding:64px;text-align:center}.accent{color:#b77900}.name{font-size:38px;font-weight:800;margin:28px 0}.program{font-size:24px;font-weight:700}.meta{margin-top:40px;color:#475569}</style></head><body><section class=\"certificate\"><p class=\"accent\">ALIBATON PERFORMANCE &amp; DEVELOPMENT</p><h1>Certificate of Training Completion</h1><p>This certifies that</p><div class=\"name\">{$name}</div><p>successfully completed</p><div class=\"program\">{$program}</div><p class=\"meta\">Issued {$date}<br>Certificate {$number}</p></section></body></html>";

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    private function sessionData(Request $request): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:160'],
            'startsAt' => ['required', 'date'],
            'endsAt' => ['required', 'date', 'after:startsAt'],
            'venue' => ['required', 'string', 'max:255'],
            'capacity' => ['required', 'integer', 'between:1,5000'],
            'facilitatorId' => ['nullable', 'integer', 'exists:users,id'],
            'externalFacilitatorName' => ['nullable', 'string', 'max:255'],
            'enrollmentClosesAt' => ['nullable', 'date', 'before_or_equal:startsAt'],
            'status' => ['required', 'in:Draft,Scheduled'],
        ]);
    }
}
