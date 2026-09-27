<?php

namespace App\Http\Middleware;

use App\Support\ReadModelCache;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InvalidateReadModelCache
{
    public function handle(Request $request, Closure $next, string $domain): Response
    {
        $response = $next($request);

        if (! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)
            && $response->getStatusCode() >= 200
            && $response->getStatusCode() < 400) {
            ReadModelCache::bump($domain);

            // These are cross-module read models, so any successful domain write
            // can change their aggregates/personnel development summaries.
            if ($domain !== 'reports') {
                ReadModelCache::bump('reports');
            }
            if ($domain !== 'users') {
                ReadModelCache::bump('users');
            }
        }

        return $response;
    }
}
