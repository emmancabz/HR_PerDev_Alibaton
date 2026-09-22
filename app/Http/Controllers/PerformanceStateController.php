<?php

namespace App\Http\Controllers;

use App\Services\Performance\PerformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PerformanceStateController extends Controller
{
    public function __construct(private readonly PerformanceService $performance) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->performance->state($request->user())]);
    }

    public function reviews(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reviews' => ['required', 'array', 'max:2000'],
            'reviews.*.id' => ['required', 'string', 'max:160'],
            'reviews.*.personId' => ['required', 'string', 'max:160'],
            'reviews.*.evaluatorId' => ['required', 'string', 'max:160'],
            'reviews.*.periodId' => ['required', 'string', 'max:160'],
            'reviews.*.status' => ['required', 'in:Pending,In Progress,Completed'],
            'reviews.*.rating' => ['nullable', 'numeric', 'between:1,5'],
            'reviews.*.lockVersion' => ['nullable', 'integer', 'min:1'],
            'reviews.*.competencyScores' => ['nullable', 'array', 'max:100'],
            'reviews.*.competencyScores.*.name' => ['required_with:reviews.*.competencyScores', 'string', 'max:160'],
            'reviews.*.competencyScores.*.score' => ['required_with:reviews.*.competencyScores', 'numeric', 'between:1,5'],
            'reviews.*.comments' => ['nullable', 'string', 'max:10000'],
            'reviews.*.developmentRecommendations' => ['nullable', 'array', 'max:20'],
            'reviews.*.developmentRecommendations.*' => ['string', 'max:500'],
            'reviews.*.selfEvaluation' => ['nullable', 'array'],
            'reviews.*.assignmentHistory' => ['nullable', 'array'],
            'reviews.*.revisionHistory' => ['nullable', 'array'],
            'reviews.*.calibrationHistory' => ['nullable', 'array'],
            'reviews.*.acknowledgment' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->performance->syncReviews($request->user(), $validated['reviews'])]);
    }

    public function transitionReview(Request $request, string $review): JsonResponse
    {
        $validated = $request->validate([
            'target' => ['required', 'in:Manager Review,Submitted,Calibration Review,Finalized'],
        ]);

        return response()->json([
            'data' => $this->performance->transitionReview(
                $request->user(),
                $review,
                $validated['target'],
            ),
        ]);
    }


    public function calibration(Request $request, string $review): JsonResponse
    {
        $validated = $request->validate([
            'target' => ['required', 'in:In Review,Approved,Returned for Revision'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        return response()->json([
            'data' => $this->performance->transitionCalibration(
                $request->user(),
                $review,
                $validated['target'],
                $validated['notes'] ?? null,
            ),
        ]);
    }

    public function goalProgress(Request $request, string $goal): JsonResponse
    {
        $validated = $request->validate([
            'progress' => ['nullable', 'numeric', 'between:0,100', 'required_without:status'],
            'status' => ['nullable', 'in:Not Started,On Track,At Risk,Completed', 'required_without:progress'],
            'administrativeCorrection' => ['nullable', 'boolean'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'reference' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json([
            'data' => $this->performance->updateGoalProgress(
                $request->user(),
                $goal,
                array_key_exists('progress', $validated) ? (float) $validated['progress'] : null,
                $validated['status'] ?? null,
                (bool) ($validated['administrativeCorrection'] ?? false),
                $validated['reason'] ?? null,
                $validated['reference'] ?? null,
            ),
        ]);
    }

    public function development(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'development' => ['required', 'array'],
            'development.feedbackRecords' => ['present', 'array', 'max:3000'],
            'development.feedbackRecords.*.id' => ['required', 'string', 'max:160'],
            'development.feedbackRecords.*.personId' => ['required', 'string', 'max:160'],
            'development.feedbackRecords.*.authorId' => ['required', 'string', 'max:160'],
            'development.feedbackRecords.*.note' => ['required', 'string', 'max:10000'],
            'development.pips' => ['present', 'array', 'max:1000'],
            'development.pips.*.id' => ['required', 'string', 'max:160'],
            'development.pips.*.personId' => ['required', 'string', 'max:160'],
            'development.pips.*.relatedReviewId' => ['required', 'string', 'max:160'],
            'development.traineeJourneys' => ['present', 'array', 'max:1000'],
            'development.traineeJourneys.*.id' => ['required', 'string', 'max:160'],
            'development.traineeJourneys.*.traineeId' => ['required', 'string', 'max:160'],
        ]);

        return response()->json(['data' => $this->performance->syncDevelopment($request->user(), $validated['development'])]);
    }

    public function pip(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pip' => ['required', 'array'],
            'pip.id' => ['required', 'string', 'max:160'],
            'pip.personId' => ['required', 'string', 'max:160'],
            'pip.relatedReviewId' => ['required', 'string', 'max:160'],
            'pip.performanceConcern' => ['required', 'string', 'max:10000'],
            'pip.expectedImprovement' => ['required', 'string', 'max:10000'],
            'pip.actionItems' => ['required', 'array', 'min:1', 'max:100'],
            'pip.actionItems.*' => ['required', 'string', 'max:2000'],
            'pip.startDate' => ['required', 'date'],
            'pip.targetEndDate' => ['required', 'date', 'after_or_equal:pip.startDate'],
            'pip.assignedManagerId' => ['required', 'string', 'max:160'],
            'pip.status' => ['required', 'in:Active,On Track,Extended,Completed,Escalated for HR Review'],
            'pip.milestones' => ['present', 'array', 'max:100'],
            'pip.milestones.*.id' => ['required', 'string', 'max:160'],
            'pip.milestones.*.title' => ['required', 'string', 'max:1000'],
            'pip.milestones.*.dueDate' => ['required', 'date'],
            'pip.milestones.*.status' => ['required', 'in:Pending,Completed'],
            'pip.progressNotes' => ['present', 'array', 'max:1000'],
            'pip.developmentActions' => ['present', 'array', 'max:100'],
            'pip.outcomeNotes' => ['nullable', 'string', 'max:10000'],
            'pip.hrReviewNotes' => ['nullable', 'string', 'max:10000'],
            'pip.lockVersion' => ['nullable', 'integer', 'min:1'],
        ]);

        return response()->json([
            'data' => $this->performance->savePip($request->user(), $validated['pip']),
        ]);
    }

    public function pipGovernance(Request $request, string $pip): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:close,extend'],
            'outcomeResult' => ['nullable', 'required_if:action,close', 'in:Expectations Met,Partially Met,Expectations Not Met'],
            'hrOutcomeNote' => ['nullable', 'required_if:action,close', 'string', 'max:10000'],
            'extensionReason' => ['nullable', 'required_if:action,extend', 'string', 'max:5000'],
            'newTargetEndDate' => ['nullable', 'required_if:action,extend', 'date'],
            'nextCheckInDate' => ['nullable', 'required_if:action,extend', 'date'],
            'nextCheckInTitle' => ['nullable', 'required_if:action,extend', 'string', 'max:1000'],
        ]);

        return response()->json([
            'data' => $this->performance->transitionPipGovernance(
                $request->user(),
                $pip,
                $validated['action'],
                $validated,
            ),
        ]);
    }

    public function configuration(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cycles' => ['sometimes', 'array', 'max:200'],
            'reviewTemplates' => ['present', 'array', 'max:100'],
            'goalTemplates' => ['present', 'array', 'max:500'],
            'goals' => ['present', 'array', 'max:10000'],
            'assignments' => ['present', 'array', 'max:10000'],
        ]);

        $manualPolicyCycle = collect($validated['cycles'] ?? [])->first(
            fn (array $cycle): bool => in_array(
                (string) ($cycle['cycleType'] ?? ''),
                ['Quarterly', 'Semi-Annual', 'Annual'],
                true,
            ),
        );

        if ($manualPolicyCycle !== null) {
            throw ValidationException::withMessages([
                'cycles' => 'Regular Performance cycles are policy-generated and read-only in the Admin workspace.',
            ]);
        }

        return response()->json(['data' => $this->performance->syncConfiguration($request->user(), $validated)]);
    }
}