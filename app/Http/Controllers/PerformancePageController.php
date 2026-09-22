<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class PerformancePageController extends Controller
{
    public function administration(): Response
    {
        return Inertia::render('AdminPerformance');
    }

    public function evaluatorAdministration(): Response
    {
        return Inertia::render('AdminPerformance', ['performanceView' => 'manage-evaluators']);
    }

    public function user(): Response
    {
        return Inertia::render('UserPerformance');
    }
}