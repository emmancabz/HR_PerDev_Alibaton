<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class SuccessionPageController extends Controller
{
    public function administration(): Response
    {
        return Inertia::render('AdminSuccession');
    }
}
