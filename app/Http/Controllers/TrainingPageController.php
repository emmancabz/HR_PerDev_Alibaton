<?php

namespace App\Http\Controllers;

use App\Services\Training\TrainingService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TrainingPageController extends Controller
{
    public function __construct(private readonly TrainingService $training) {}

    public function administration(Request $request): Response
    {
        return Inertia::render('AdminTraining', ['initialTrainingState' => $this->training->state($request->user())]);
    }

    public function learner(Request $request): Response
    {
        return Inertia::render('LearnerTraining', ['initialTrainingState' => $this->training->state($request->user())]);
    }
}
