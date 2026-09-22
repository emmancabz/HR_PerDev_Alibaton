<?php

namespace App\Http\Controllers;

use App\Services\Succession\SuccessionService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SuccessionPageController extends Controller
{
    public function __construct(private readonly SuccessionService $succession) {}
    public function administration(Request $request): Response
    {
        return Inertia::render('AdminSuccession', ['initialSuccessionState' => $this->succession->state($request->user())]);
    }
}
