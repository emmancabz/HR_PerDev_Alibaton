<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class LearningPageController extends Controller
{
    public function administration(): Response
    {
        return Inertia::render('AdminLearning');
    }

    public function learner(): Response
    {
        return Inertia::render('LearnerLearning');
    }
}
