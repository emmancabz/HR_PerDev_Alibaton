<?php

namespace App\Http\Controllers;

use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PerformancePageController extends Controller
{
    public function administration(Request $request): Response
    {
        return Inertia::render('AdminPerformance', [
            'initialPerformanceState' => ReadModelCache::peek('performance', $request->user()),
        ]);
    }

    public function evaluatorAdministration(Request $request): Response
    {
        return Inertia::render('AdminPerformance', [
            'performanceView' => 'manage-evaluators',
            'initialPerformanceState' => ReadModelCache::peek('performance', $request->user()),
        ]);
    }

    public function user(): Response
    {
        return Inertia::render('UserPerformance');
    }
}