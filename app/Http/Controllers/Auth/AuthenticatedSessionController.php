<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\Mfa\MfaService;
use App\Services\Security\SecurityAuditService;
use App\Models\SecuritySessionActivity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    public function store(LoginRequest $request, MfaService $mfa): RedirectResponse
    {
        $user = $request->authenticate();

        $request->session()->regenerate();
        $mfa->event($request, $user, 'auth.password', 'success');

        if ($mfa->requiresMfa($user)) {
            $request->session()->put([
                'mfa.pending_user_id' => $user->id,
                // MFA-governed accounts intentionally do not receive a long-lived
                // remember cookie. Local testing can still sign in/out repeatedly.
                'mfa.pending_remember' => false,
                'mfa.pending_started_at' => now()->timestamp,
            ]);

            if (! $mfa->hasPrimaryFactor($user)) {
                return redirect()->route('mfa.setup');
            }

            $delivery = $mfa->createAndDeliverChallenge($user, $request);
            $request->session()->put([
                'mfa.challenge_uuid' => $delivery['challenge']->uuid,
                'mfa.delivery_failed' => ! $delivery['delivered'],
            ]);

            return redirect()->route('mfa.challenge');
        }

        Auth::guard('web')->login($user, $request->boolean('remember'));
        $request->session()->regenerate();
        $request->session()->put([
            'auth.password_confirmed_at' => now()->timestamp,
            'security.last_password_verified_at' => now()->timestamp,
        ]);
        app(SecurityAuditService::class)->record($request, 'LOGIN_SUCCESS', 'Success', $user, ['mfa' => false]);

        return app(DashboardController::class)->redirectToOwnedDashboard($user);
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();
        $timedOut = $request->input('reason') === 'timeout';
        $timeoutMinutes = (int) config('governance.security.session_timeout_minutes', 5);

        if ($user) {
            app(SecurityAuditService::class)->record(
                $request,
                $timedOut ? 'SESSION_TIMEOUT' : 'LOGOUT',
                $timedOut ? 'Expired' : 'Success',
                $user,
                $timedOut ? ['inactivity_minutes' => $timeoutMinutes] : [],
            );
        }

        if ($request->hasSession()) {
            $activityToken = $request->session()->get('security.activity_token');

            if (is_string($activityToken) && strlen($activityToken) >= 64) {
                SecuritySessionActivity::query()
                    ->where('session_hash', hash('sha256', $activityToken))
                    ->update([
                        'timeout_logged_at' => $timedOut ? now() : null,
                        'expires_at' => now(),
                    ]);
            }
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
