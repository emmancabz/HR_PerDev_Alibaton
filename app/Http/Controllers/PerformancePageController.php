<?php

namespace App\Http\Controllers;

use App\Services\Performance\PerformanceService;
use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PerformancePageController extends Controller
{
    public function __construct(private readonly PerformanceService $performance) {}

    public function administration(Request $request): Response
    {
        return Inertia::render('AdminPerformance', [
            'initialPerformanceState' => ReadModelCache::remember(
                'performance',
                $request->user(),
                fn (): array => $this->performance->state($request->user()),
            ),
        ]);
    }

    public function evaluatorAdministration(Request $request): Response
    {
        return Inertia::render('AdminPerformance', [
            'performanceView' => 'manage-evaluators',
            'initialPerformanceState' => ReadModelCache::remember(
                'performance',
                $request->user(),
                fn (): array => $this->performance->state($request->user()),
            ),
        ]);
    }

    public function user(Request $request): Response
    {
        $actor = $request->user();
        $state = ReadModelCache::remember(
            'performance',
            $actor,
            fn (): array => $this->performance->state($actor),
        );

        return Inertia::render('UserPerformance', [
            'initialReviews' => array_values($state['reviews'] ?? []),
        ]);
    }
}