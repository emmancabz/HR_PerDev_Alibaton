<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRecentAuthentication
{
    public function handle(Request $request, Closure $next): Response
    {
        $windowSeconds = max(
            60,
            (int) config('governance.security.step_up_verification_minutes', 10) * 60,
        );

        $latestVerification = max(
            (int) $request->session()->get('auth.password_confirmed_at', 0),
            (int) $request->session()->get('security.last_password_verified_at', 0),
            (int) $request->session()->get('security.last_mfa_verified_at', 0),
            (int) $request->session()->get('security.last_passkey_verified_at', 0),
        );

        if ($latestVerification > 0 && now()->timestamp - $latestVerification <= $windowSeconds) {
            return $next($request);
        }

        $request->session()->put('url.intended', url()->previous());

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Re-authentication is required before changing sign-in security.',
                'redirect' => route('password.confirm'),
            ], 428);
        }

        return redirect()->route('password.confirm')
            ->with('status', 'Confirm your password before changing sign-in security.');
    }
}
