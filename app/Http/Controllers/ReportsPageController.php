<?php

namespace App\Http\Controllers;

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

        // Render the route shell immediately. The report state is loaded through
        // governance.api.reports.state after paint so navigation never waits on
        // cross-module reporting queries.
        return Inertia::render('Reports', ['initialReportFilters' => $filters]);
    }
}
