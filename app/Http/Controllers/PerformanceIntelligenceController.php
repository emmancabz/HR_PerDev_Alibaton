<?php

namespace App\Http\Controllers;

use App\Services\Performance\PerformanceIntelligenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerformanceIntelligenceController extends Controller
{
    public function __invoke(Request $request, PerformanceIntelligenceService $intelligence): JsonResponse
    {
        $validated = $request->validate([
            'reviewId' => ['required', 'string', 'max:160'],
            'useCase' => ['required', 'string', 'max:100'],
        ]);

        return response()->json([
            'data' => $intelligence->draft($request->user(), $validated['reviewId'], $validated['useCase']),
        ]);
    }
}
