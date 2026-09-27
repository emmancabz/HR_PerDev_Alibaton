<?php

namespace App\Http\Controllers;

use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportsPageController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'report' => ['nullable', 'string'],
            'department' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $vary = [
            'report' => $filters['report'] ?? 'workforce-development',
            'department' => $filters['department'] ?? '',
            'date_from' => $filters['date_from'] ?? '',
            'date_to' => $filters['date_to'] ?? '',
        ];

        return Inertia::render('Reports', [
            'initialReportFilters' => $filters,
            'initialReportsState' => ReadModelCache::peek('reports', $request->user(), $vary),
        ]);
    }
}
