<?php

namespace App\Http\Controllers;

use App\Services\Recognition\RecognitionService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RecognitionPageController extends Controller
{
    public function __construct(private readonly RecognitionService $recognition) {}

    public function administration(Request $request): Response
    {
        return Inertia::render('AdminRecognition', ['initialRecognitionState' => $this->recognition->state($request->user())]);
    }

    public function user(Request $request): Response
    {
        return Inertia::render('UserRecognition', ['initialRecognitionState' => $this->recognition->state($request->user())]);
    }
}
