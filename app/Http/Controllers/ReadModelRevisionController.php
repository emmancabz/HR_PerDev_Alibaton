<?php

namespace App\Http\Controllers;

use App\Support\ReadModelCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReadModelRevisionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->user(), 401);

        return response()->json([
            'data' => ReadModelCache::revisions(),
            'generatedAt' => now()->toIso8601String(),
        ])->header('Cache-Control', 'no-store, private');
    }
}
