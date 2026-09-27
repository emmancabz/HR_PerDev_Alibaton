<?php

namespace App\Http\Controllers;

use App\Support\ReadModelCache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SuccessionPageController extends Controller
{
    public function administration(Request $request): Response
    {
        return Inertia::render('AdminSuccession', [
            'initialSuccessionState' => ReadModelCache::peek('succession', $request->user()),
        ]);
    }
}
