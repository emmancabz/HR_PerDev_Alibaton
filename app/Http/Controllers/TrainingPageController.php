<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class TrainingPageController extends Controller
{
    public function administration(): Response
    {
        return Inertia::render('AdminTraining');
    }

    public function learner(): Response
    {
        return Inertia::render('LearnerTraining');
    }
}
