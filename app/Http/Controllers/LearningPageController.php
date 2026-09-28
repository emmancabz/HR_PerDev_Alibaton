<?php

namespace App\Http\Controllers;

use App\Services\Learning\LearningCourseService;
use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningPageController extends Controller
{
    public function __construct(private readonly LearningCourseService $learning) {}

    public function administration(Request $request): Response
    {
        return Inertia::render('AdminLearning', [
            'initialLearningState' => ReadModelCache::remember(
                'learning',
                $request->user(),
                fn (): array => $this->learning->state($request->user()),
            ),
        ]);
    }

    public function learner(Request $request): Response
    {
        return Inertia::render('LearnerLearning', [
            'initialLearningState' => ReadModelCache::remember(
                'learning',
                $request->user(),
                fn (): array => $this->learning->state($request->user()),
            ),
        ]);
    }
}
