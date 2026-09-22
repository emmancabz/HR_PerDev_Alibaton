<?php

namespace App\Http\Controllers;

use App\Services\Performance\PerformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class Performance360FeedbackController extends Controller
{
    public function index(Request $request, PerformanceService $performance): JsonResponse
    {
        return response()->json([
            'data' => $performance->leadership360Tasks($request->user()),
        ]);
    }

    public function store(Request $request, PerformanceService $performance): JsonResponse
    {
        $validated = $request->validate([
            'subjectId' => ['required', 'string', 'max:160'],
            'cycleId' => ['required', 'string', 'max:160'],
            'ratings' => ['required', 'array', 'min:6', 'max:6'],
            'ratings.Communication' => ['required', 'numeric', 'between:1,5'],
            'ratings.Coaching & Support' => ['required', 'numeric', 'between:1,5'],
            'ratings.Delegation' => ['required', 'numeric', 'between:1,5'],
            'ratings.Team Coordination' => ['required', 'numeric', 'between:1,5'],
            'ratings.Accountability' => ['required', 'numeric', 'between:1,5'],
            'ratings.Leadership Effectiveness' => ['required', 'numeric', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:4000'],
        ]);

        return response()->json([
            'data' => $performance->submitLeadership360Feedback(
                $request->user(),
                $validated['subjectId'],
                $validated['cycleId'],
                $validated['ratings'],
                $validated['comment'] ?? null,
            ),
        ]);
    }
}
