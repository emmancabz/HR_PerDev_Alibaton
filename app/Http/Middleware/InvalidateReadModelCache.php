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

        $learningDraftAutosave = $domain === 'learning'
            && $request->isMethod('PUT')
            && (
                $request->routeIs('learning.api.versions.save')
                || preg_match('#^learning/api/versions/[^/]+$#', $request->path()) === 1
            );

        if (! $learningDraftAutosave
            && ! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)
            && $response->getStatusCode() >= 200
            && $response->getStatusCode() < 400) {
            $responsePayload = method_exists($response, 'getData')
                ? $response->getData(true)
                : null;
            $returnedState = is_array($responsePayload)
                && isset($responsePayload['data'])
                && is_array($responsePayload['data'])
                && isset($responsePayload['data']['actor'])
                    ? $responsePayload['data']
                    : null;

            ReadModelCache::bump($domain);

            if ($returnedState !== null && $request->user()) {
                ReadModelCache::put($domain, $request->user(), $returnedState);
            }

            // Most operational writes only affect cross-module summaries. Personnel
            // changes are different: role/audience/manager changes can affect every
            // domain, so only the users domain fans out broadly.
            $dependents = $domain === 'users'
                ? array_values(array_diff(ReadModelCache::LIVE_DOMAINS, ['users']))
                : ['dashboard', 'reports'];

            foreach ($dependents as $dependent) {
                if ($dependent !== $domain) {
                    ReadModelCache::bump($dependent);
                }
            }
        }

        return $response;
    }
}
