<?php

namespace App\Http\Controllers;

use App\Services\Training\TrainingService;
use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TrainingPageController extends Controller
{
    public function __construct(private readonly TrainingService $training) {}

    public function administration(Request $request): Response
    {
        return Inertia::render('AdminTraining', ['initialTrainingState' => ReadModelCache::remember('training', $request->user(), fn (): array => $this->training->state($request->user()))]);
    }

    public function learner(Request $request): Response
    {
        return Inertia::render('LearnerTraining', ['initialTrainingState' => ReadModelCache::remember('training', $request->user(), fn (): array => $this->training->state($request->user()))]);
    }
}
