<?php

namespace App\Http\Controllers;

use App\Services\Performance\PerformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function configuration(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cycles' => ['present', 'array', 'max:200'],
            'cycles.*.id' => ['required', 'string', 'max:160'],
            'cycles.*.cycleName' => ['required', 'string', 'max:255'],
            'cycles.*.performanceStartDate' => ['required', 'date'],
            'cycles.*.performanceEndDate' => ['required', 'date'],
            'cycles.*.reviewOpenDate' => ['required', 'date'],
            'cycles.*.reviewDueDate' => ['required', 'date'],
            'reviewTemplates' => ['present', 'array', 'max:100'],
            'goalTemplates' => ['present', 'array', 'max:500'],
            'goals' => ['present', 'array', 'max:10000'],
            'assignments' => ['present', 'array', 'max:10000'],
        ]);

        return response()->json(['data' => $this->performance->syncConfiguration($request->user(), $validated)]);
    }
}