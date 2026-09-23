<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Microservices\InternalRequestSigner;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class VerifyInternalServiceRequest
{
    public function __construct(private readonly InternalRequestSigner $signer)
    {
    }

    public function handle(
        Request $request,
        Closure $next,
        ?string $expectedService = null,
    ): Response {
        $identity = $this->signer->identity($request, $expectedService);

        if ($identity === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = User::query()->find($identity['user_id']);

        if (! $user || $user->archived_at !== null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $employmentStatus = strtolower(trim((string) $user->employment_status));
        $accessStatus = strtolower(trim((string) ($user->pnd_access_status ?: 'active')));

        if ($employmentStatus === 'inactive' || $accessStatus !== 'active') {
            return response()->json([
                'message' => 'This account is not authorized for Performance & Development access.',
            ], 403);
        }

        /*
         * Internal calls do not carry a browser session. Hydrate both Laravel's
         * default guard and the current request explicitly so controllers,
         * policies, gates, and request()->user() all resolve the same actor.
         */
        Auth::shouldUse('web');
        Auth::guard('web')->setUser($user);
        Auth::setUser($user);

        $request->setUserResolver(static fn () => $user);
        $request->attributes->set('pnd_internal_service', $identity['service']);
        $request->attributes->set('pnd_internal_request_id', $identity['request_id']);

        return $next($request);
    }
}
