<?php

namespace App\Http\Controllers;

use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningPageController extends Controller
{
    public function administration(Request $request): Response
    {
        return Inertia::render('AdminLearning', [
            'initialLearningState' => ReadModelCache::peek('learning', $request->user()),
        ]);
    }

    public function learner(Request $request): Response
    {
        return Inertia::render('LearnerLearning', [
            'initialLearningState' => ReadModelCache::peek('learning', $request->user()),
        ]);
    }
}
