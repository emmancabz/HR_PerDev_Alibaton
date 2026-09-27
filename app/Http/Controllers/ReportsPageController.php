<?php

namespace App\Http\Controllers;

use App\Services\Reporting\CrossModuleReportService;
use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportsPageController extends Controller
{
    public function __construct(private readonly CrossModuleReportService $reports) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'report' => ['nullable', 'string'], 'department' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date'], 'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        return Inertia::render('Reports', ['initialReportsState' => ReadModelCache::remember('reports', $request->user(), fn (): array => $this->reports->state($request->user(), $filters), $filters)]);
    }
}
