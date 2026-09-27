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

            // Cross-module summaries can depend on any successful operational write.
            // Bump these lightweight generations instead of forcing users to press F5.
            foreach (['dashboard', 'reports', 'users', 'notifications'] as $dependent) {
                if ($dependent !== $domain) {
                    ReadModelCache::bump($dependent);
                }
            }
        }

        return $response;
    }
}
