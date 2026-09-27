<?php

namespace App\Http\Controllers;

use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TrainingPageController extends Controller
{
    public function administration(Request $request): Response
    {
        return Inertia::render('AdminTraining', [
            'initialTrainingState' => ReadModelCache::peek('training', $request->user()),
        ]);
    }

    public function learner(Request $request): Response
    {
        return Inertia::render('LearnerTraining', [
            'initialTrainingState' => ReadModelCache::peek('training', $request->user()),
        ]);
    }
}
