<?php

namespace App\Http\Controllers;

use App\Http\Requests\SuccessionPositionRequest;
use App\Models\Succession\CriticalPosition;
use App\Models\Succession\DevelopmentAction;
use App\Models\Succession\DevelopmentPlan;
use App\Models\Succession\ReadinessAssessment;
use App\Models\Succession\SuccessionCandidate;
use App\Services\Succession\SuccessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SuccessionStateController extends Controller
{
    public function __construct(private readonly SuccessionService $succession) {}
    public function show(Request $request): JsonResponse { return response()->json(['data' => $this->succession->state($request->user())]); }

    public function createPosition(SuccessionPositionRequest $request): JsonResponse
    {
        $position = $this->succession->savePosition($request->user(), $request->validated());
        return response()->json(['data' => ['positionId' => $position->id]], 201);
    }

    public function updatePosition(SuccessionPositionRequest $request, CriticalPosition $position): JsonResponse
    {
        $this->succession->savePosition($request->user(), $request->validated(), $position);
        return $this->show($request);
    }

    public function transitionPosition(Request $request, CriticalPosition $position): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:Active,Archived'], 'reason' => ['nullable', 'string', 'max:5000']]);
        $this->succession->transitionPosition($request->user(), $position, $data['status'], $data['reason'] ?? null);
        return $this->show($request);
    }

    public function nominate(Request $request, CriticalPosition $position): JsonResponse
    {
        $data = $request->validate([
            'candidateId' => ['required', 'integer', 'exists:users,id'],
            'source' => ['required', 'in:HR Nomination,Admin Nomination,Manager Recommendation,Talent Review'],
            'rationale' => ['required', 'string', 'max:10000'],
        ]);
        $candidate = $this->succession->nominate($request->user(), $position, $data['candidateId'], $data['source'], $data['rationale']);
        return response()->json(['data' => ['candidateId' => $candidate->id]], 201);
    }

    public function transitionCandidate(Request $request, SuccessionCandidate $candidate): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:Proposed,Under Review,Accepted,Declined,Withdrawn'], 'reason' => ['nullable', 'string', 'max:5000']]);
        $this->succession->transitionCandidate($request->user(), $candidate, $data['status'], $data['reason'] ?? null);
        return $this->show($request);
    }

    public function createAssessment(Request $request, SuccessionCandidate $candidate): JsonResponse
    {
        $data = $this->assessmentData($request, false);
        $assessment = $this->succession->createAssessment($request->user(), $candidate, $data);
        return response()->json(['data' => ['assessmentId' => $assessment->id]], 201);
    }

    public function updateAssessment(Request $request, ReadinessAssessment $assessment): JsonResponse
    {
        $this->succession->updateAssessment($request->user(), $assessment, $this->assessmentData($request, true));
        return $this->show($request);
    }

    public function finalizeAssessment(Request $request, ReadinessAssessment $assessment): JsonResponse
    {
        $this->succession->finalizeAssessment($request->user(), $assessment);
        return $this->show($request);
    }

    public function reopenAssessment(Request $request, ReadinessAssessment $assessment): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:5000']]);
        $copy = $this->succession->reopenAssessment($request->user(), $assessment, $data['reason']);
        return response()->json(['data' => ['assessmentId' => $copy->id]], 201);
    }

    public function createPlan(Request $request, SuccessionCandidate $candidate): JsonResponse
    {
        $data = $request->validate([
            'assessmentId' => ['nullable', 'uuid', 'exists:succession_readiness_assessments,id'],
            'title' => ['required', 'string', 'max:255'], 'objective' => ['required', 'string', 'max:10000'],
            'startsOn' => ['nullable', 'date'], 'targetDate' => ['nullable', 'date', 'after_or_equal:startsOn'],
            'ownerId' => ['required', 'integer', 'exists:users,id'],
        ]);
        $plan = $this->succession->createPlan($request->user(), $candidate, $data);
        return response()->json(['data' => ['planId' => $plan->id]], 201);
    }

    public function transitionPlan(Request $request, DevelopmentPlan $plan): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:Active,Completed,Cancelled'], 'reason' => ['nullable', 'string', 'max:5000']]);
        $this->succession->transitionPlan($request->user(), $plan, $data['status'], $data['reason'] ?? null);
        return $this->show($request);
    }

    public function createAction(Request $request, DevelopmentPlan $plan): JsonResponse
    {
        $action = $this->succession->saveAction($request->user(), $plan, $this->actionData($request));
        return response()->json(['data' => ['actionId' => $action->id]], 201);
    }

    public function updateAction(Request $request, DevelopmentPlan $plan, DevelopmentAction $action): JsonResponse
    {
        $this->succession->saveAction($request->user(), $plan, $this->actionData($request), $action);
        return $this->show($request);
    }

    public function receiveEvidence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sourceModule' => ['required', 'in:Competency,Performance'], 'sourceRecordId' => ['required', 'string', 'max:255'],
            'personnelKey' => ['required', 'string', 'max:255'], 'sourceFinalizedAt' => ['required', 'date'],
            'sourceSnapshot' => ['required', 'array', 'max:200'],
        ]);
        return response()->json(['data' => ['evidenceId' => $this->succession->receiveEvidence($request->user(), $data)]], 201);
    }

    public function export(Request $request): StreamedResponse
    {
        $state = $this->succession->state($request->user());
        return response()->streamDownload(function () use ($state): void {
            $output = fopen('php://output', 'wb');
            fputcsv($output, ['Position', 'Department', 'Criticality', 'Status', 'Accepted Successors', 'Ready Now', 'Risk Flags', 'Next Review']);
            foreach ($state['positions'] as $position) fputcsv($output, [$position['positionTitle'], $position['department'], $position['criticality'], $position['status'], $position['coverage']['accepted'], $position['coverage']['readyNow'], implode('; ', $position['riskFlags']), $position['nextReviewAt']]);
            fclose($output);
        }, 'succession-risk-report-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    private function assessmentData(Request $request, bool $required): array
    {
        $sometimes = $required ? 'required' : 'nullable';
        return $request->validate([
            'readinessBand' => [$sometimes, 'in:Ready Now,Ready Soon,Developing,Needs Significant Development'],
            'reviewerSummary' => [$sometimes, 'string', 'max:10000'],
            'developmentNeeds' => [$required ? 'required' : 'sometimes', 'array', 'max:100'], 'developmentNeeds.*' => ['string', 'max:1000'],
            'riskFlags' => [$required ? 'required' : 'sometimes', 'array', 'max:100'], 'riskFlags.*' => ['string', 'max:1000'],
        ]);
    }

    private function actionData(Request $request): array
    {
        return $request->validate([
            'actionType' => ['required', 'in:Learning,Training,Mentoring,Stretch Assignment,Competency Goal,Other'],
            'title' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:10000'],
            'sourceModule' => ['nullable', 'in:Learning,Training,Performance,Competency'], 'sourceRecordId' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'in:Planned,In Progress,Completed,Cancelled'], 'dueOn' => ['nullable', 'date'],
            'evidenceSnapshot' => ['sometimes', 'array', 'max:100'],
        ]);
    }
}
