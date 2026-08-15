<?php

namespace App\Http\Controllers;

use App\Services\Learning\LearningCourseService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningPageController extends Controller
{
    public function __construct(private readonly LearningCourseService $learning) {}
    public function administration(Request $request): Response { return Inertia::render('AdminLearning', ['initialLearningState' => $this->learning->state($request->user())]); }
    public function learner(Request $request): Response { return Inertia::render('LearnerLearning', ['initialLearningState' => $this->learning->state($request->user())]); }
}
