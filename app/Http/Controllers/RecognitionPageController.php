<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class RecognitionPageController extends Controller
{
    public function administration(): Response
    {
        return Inertia::render('AdminRecognition');
    }

    public function user(): Response
    {
        return Inertia::render('UserRecognition');
    }
}
