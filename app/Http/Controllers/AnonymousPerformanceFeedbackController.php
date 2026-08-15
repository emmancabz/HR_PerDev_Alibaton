<?php

namespace App\Http\Controllers;

use App\Services\Performance\PerformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnonymousPerformanceFeedbackController extends Controller
{
    public function store(Request $request, PerformanceService $performance): JsonResponse
    {
        $validated = $request->validate([
            'subjectId' => ['required', 'string', 'max:160'],
            'cycleId' => ['required', 'string', 'max:160'],
            'feedback' => ['required', 'string', 'min:10', 'max:5000'],
        ]);
        $performance->submitAnonymousFeedback(
            $request->user(),
            $validated['subjectId'],
            $validated['cycleId'],
            $validated['feedback'],
        );

        return response()->json(['message' => 'Anonymous feedback was recorded securely.'], 201);
    }

    public function summary(Request $request, string $subject, string $cycle, PerformanceService $performance): JsonResponse
    {
        return response()->json([
            'data' => $performance->anonymousFeedbackSummary($request->user(), $subject, $cycle),
        ]);
    }
}