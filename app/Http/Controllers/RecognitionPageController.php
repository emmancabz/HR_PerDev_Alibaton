<?php

namespace App\Http\Controllers;

use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RecognitionPageController extends Controller
{
    public function administration(Request $request): Response
    {
        return Inertia::render('AdminRecognition', [
            'initialRecognitionState' => ReadModelCache::peek('recognition', $request->user()),
        ]);
    }

    public function user(Request $request): Response
    {
        return Inertia::render('UserRecognition', [
            'initialRecognitionState' => ReadModelCache::peek('recognition', $request->user()),
        ]);
    }
}
