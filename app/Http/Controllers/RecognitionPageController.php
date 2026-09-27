<?php

namespace App\Http\Controllers;

use App\Services\Recognition\RecognitionService;
use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RecognitionPageController extends Controller
{
    public function __construct(private readonly RecognitionService $recognition) {}

    public function administration(Request $request): Response
    {
        return Inertia::render('AdminRecognition', ['initialRecognitionState' => ReadModelCache::remember('recognition', $request->user(), fn (): array => $this->recognition->state($request->user()))]);
    }

    public function user(Request $request): Response
    {
        return Inertia::render('UserRecognition', ['initialRecognitionState' => ReadModelCache::remember('recognition', $request->user(), fn (): array => $this->recognition->state($request->user()))]);
    }
}
