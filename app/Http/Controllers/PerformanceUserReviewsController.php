<?php

namespace App\Http\Controllers;

use App\Services\Performance\PerformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerformanceUserReviewsController extends Controller
{
    public function index(Request $request, PerformanceService $performance): JsonResponse
    {
        $state = $performance->state($request->user());

        return response()->json([
            'data' => array_values($state['reviews'] ?? []),
        ]);
    }

    public function store(Request $request, PerformanceService $performance): JsonResponse
    {
        $validated = $request->validate([
            'review' => ['required', 'array'],
            'review.id' => ['required', 'string', 'max:160'],
            'review.personId' => ['required', 'string', 'max:160'],
            'review.evaluatorId' => ['required', 'string', 'max:160'],
            'review.periodId' => ['required', 'string', 'max:160'],
            'review.reviewTemplateId' => ['nullable', 'string', 'max:160'],
            'review.status' => ['required', 'in:Pending,In Progress,Completed'],
            'review.rating' => ['nullable', 'numeric', 'between:1,5'],
            'review.lockVersion' => ['nullable', 'integer', 'min:1'],
            'review.competencyScores' => ['nullable', 'array', 'max:100'],
            'review.competencyScores.*.name' => ['required_with:review.competencyScores', 'string', 'max:160'],
            'review.competencyScores.*.score' => ['required_with:review.competencyScores', 'numeric', 'between:1,5'],
            'review.comments' => ['nullable', 'string', 'max:10000'],
            'review.developmentRecommendations' => ['nullable', 'array', 'max:20'],
            'review.developmentRecommendations.*' => ['string', 'max:500'],
            'review.selfEvaluation' => ['nullable', 'array'],
            'review.managerSubmittedAt' => ['nullable', 'date'],
            'review.workflowState' => ['nullable', 'string', 'max:80'],
            'review.calibrationStatus' => ['nullable', 'string', 'max:80'],
            'review.assignmentHistory' => ['nullable', 'array'],
            'review.revisionHistory' => ['nullable', 'array'],
            'review.calibrationHistory' => ['nullable', 'array'],
            'review.acknowledgment' => ['nullable', 'array'],
        ]);

        $state = $performance->syncReviews($request->user(), [$validated['review']]);

        return response()->json([
            'data' => array_values($state['reviews'] ?? []),
        ]);
    }
}
