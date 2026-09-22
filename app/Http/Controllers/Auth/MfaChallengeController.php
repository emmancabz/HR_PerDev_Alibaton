<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Controller;
use App\Models\MfaLoginChallenge;
use App\Models\User;
use App\Services\Mfa\MfaService;
use App\Services\Security\SecurityAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MfaChallengeController extends Controller
{
    public function setup(Request $request, MfaService $mfa): Response|RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        if ($mfa->hasPrimaryFactor($user)) {
            $delivery = $mfa->createAndDeliverChallenge($user, $request);
            $request->session()->put([
                'mfa.challenge_uuid' => $delivery['challenge']->uuid,
                'mfa.delivery_failed' => ! $delivery['delivered'],
            ]);

            return redirect()->route('mfa.challenge');
        }

        return Inertia::render('Auth/MfaSetup', [
            'account' => [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->label(),
            ],
            'totpEnrollment' => $request->session()->has('mfa.setup_totp_secret')
                ? [
                    'secret' => $request->session()->get('mfa.setup_totp_secret'),
                    'uri' => $request->session()->get('mfa.setup_totp_uri'),
                ]
                : null,
            'recoveryCodes' => $request->session()->get('mfa.setup_recovery_codes', []),
            'status' => session('status'),
        ]);
    }

    public function setupStatus(Request $request, MfaService $mfa): JsonResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return response()->json(['expired' => true], 401);
        }

        $user->refresh();

        return response()->json([
            'configured' => $mfa->hasPrimaryFactor($user),
            'totp_ready' => $user->hasTotp(),
        ]);
    }

    public function beginTotpSetup(Request $request, MfaService $mfa): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $enrollment = $mfa->beginTotpEnrollment($user);

        $request->session()->put([
            'mfa.setup_totp_secret' => $enrollment['secret'],
            'mfa.setup_totp_uri' => $enrollment['uri'],
        ]);

        return back();
    }

    public function confirmTotpSetup(Request $request, MfaService $mfa): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $validated = $request->validate([
            'code' => ['required', 'digits:6'],
        ]);

        $secret = (string) $request->session()->get('mfa.setup_totp_secret');

        if ($secret === '' || ! $mfa->confirmTotpEnrollment($user, $secret, $validated['code'], $request)) {
            throw ValidationException::withMessages([
                'code' => 'The authenticator code is invalid. Check your phone time and try again.',
            ]);
        }

        if ($user->recoveryCodes()->whereNull('used_at')->count() === 0) {
            $request->session()->put(
                'mfa.setup_recovery_codes',
                $mfa->generateRecoveryCodes($user, $request),
            );
        }

        $request->session()->forget([
            'mfa.setup_totp_secret',
            'mfa.setup_totp_uri',
        ]);

        return back()->with('status', 'Authenticator app added.');
    }

    public function continueSetup(Request $request, MfaService $mfa): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $user->refresh();

        if (! $mfa->hasPrimaryFactor($user)) {
            return redirect()->route('mfa.setup')->withErrors([
                'mfa' => 'Complete a verification method before continuing.',
            ]);
        }

        $delivery = $mfa->createAndDeliverChallenge($user, $request);
        $request->session()->put([
            'mfa.challenge_uuid' => $delivery['challenge']->uuid,
            'mfa.delivery_failed' => ! $delivery['delivered'],
        ]);
        $request->session()->forget('mfa.setup_recovery_codes');

        return redirect()->route('mfa.challenge');
    }

    public function show(Request $request, MfaService $mfa): Response|RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $challenge = $this->challenge($request, $user);

        if (! $challenge || $challenge->status === 'expired' || $challenge->isExpired()) {
            $delivery = $mfa->createAndDeliverChallenge($user, $request);
            $challenge = $delivery['challenge'];
            $request->session()->put([
                'mfa.challenge_uuid' => $challenge->uuid,
                'mfa.delivery_failed' => ! $delivery['delivered'],
            ]);
        }

        if ($challenge->status === 'denied') {
            return redirect()->route('login');
        }

        return Inertia::render('Auth/MfaChallenge', [
            'account' => [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->label(),
            ],
            'challenge' => [
                'uuid' => $challenge->uuid,
                'number' => $challenge->number_code,
                'expiresAt' => $challenge->expires_at->toIso8601String(),
                'status' => $challenge->status,
                'resendAvailableAt' => $challenge->notification_sent_at
                    ? $challenge->notification_sent_at->copy()
                        ->addSeconds((int) config('mfa.resend_cooldown_seconds', 30))
                        ->toIso8601String()
                    : now()->toIso8601String(),
            ],
            'methods' => [
                'emailNumberMatch' => $mfa->emailNumberMatchAllowed($user),
                'totp' => $user->hasTotp(),
                'recoveryCode' => $user->recoveryCodes()->whereNull('used_at')->exists(),
            ],
            'notificationEmail' => $mfa->emailNumberMatchAllowed($user)
                ? $mfa->maskEmail($mfa->notificationEmailFor($user))
                : null,
            'defaultMethod' => $mfa->preferredMethod($user),
            'deliveryFailed' => (bool) $request->session()->get('mfa.delivery_failed', false),
            'statusMessage' => session('status'),
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return response()->json(['expired' => true], 401);
        }

        $challenge = $this->challenge($request, $user);

        if (! $challenge) {
            return response()->json(['expired' => true], 404);
        }

        if ($challenge->isExpired() && $challenge->status === 'pending') {
            $challenge->forceFill(['status' => 'expired'])->save();
        }

        return response()->json([
            'status' => $challenge->fresh()->status,
        ]);
    }

    public function resend(Request $request, MfaService $mfa): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $challenge = $this->challenge($request, $user);

        if (! $challenge || ! $challenge->isPending()) {
            $delivery = $mfa->createAndDeliverChallenge($user, $request);
            $request->session()->put([
                'mfa.challenge_uuid' => $delivery['challenge']->uuid,
                'mfa.delivery_failed' => ! $delivery['delivered'],
            ]);

            return redirect()->route('mfa.challenge');
        }

        $waitSeconds = $mfa->resendWaitSeconds($challenge);

        if ($waitSeconds > 0) {
            return back()->with(
                'status',
                "For security, wait {$waitSeconds}s before sending another sign-in message.",
            );
        }

        $delivered = $mfa->sendNumberMatchEmail($user, $challenge, $request);
        $request->session()->put('mfa.delivery_failed', ! $delivered);

        return back()->with(
            'status',
            $delivered ? 'A new sign-in message was sent.' : 'The message could not be sent. Check the mail configuration or use another method.',
        );
    }

    public function retry(Request $request, MfaService $mfa): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $delivery = $mfa->createAndDeliverChallenge($user, $request);
        $request->session()->put([
            'mfa.challenge_uuid' => $delivery['challenge']->uuid,
            'mfa.delivery_failed' => ! $delivery['delivered'],
        ]);

        return redirect()->route('mfa.challenge');
    }

    public function verifyAlternative(Request $request, MfaService $mfa): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $validated = $request->validate([
            'method' => ['required', Rule::in(['totp', 'recovery_code'])],
            'code' => ['required', 'string', 'max:64'],
        ]);

        $challenge = $this->challenge($request, $user);

        if (! $challenge || ! $challenge->isPending()) {
            return redirect()->route('mfa.challenge');
        }

        $verified = match ($validated['method']) {
            'totp' => $mfa->verifyTotp($user, $validated['code'], $request),
            'recovery_code' => $mfa->consumeRecoveryCode($user, $validated['code'], $request),
        };

        if (! $verified) {
            throw ValidationException::withMessages([
                'code' => $validated['method'] === 'totp'
                    ? 'The authenticator code is invalid or was already used.'
                    : 'The recovery code is invalid or was already used.',
            ]);
        }

        $challenge->forceFill([
            'status' => 'approved',
            'approved_at' => now(),
        ])->save();

        return $this->completeAuthentication($request, $user, $challenge, $mfa);
    }

    public function complete(Request $request, MfaService $mfa): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return $this->expiredLoginRedirect();
        }

        $challenge = $this->challenge($request, $user);

        if (! $challenge || $challenge->status !== 'approved') {
            return redirect()->route('mfa.challenge');
        }

        return $this->completeAuthentication($request, $user, $challenge, $mfa);
    }

    private function completeAuthentication(
        Request $request,
        User $user,
        MfaLoginChallenge $challenge,
        MfaService $mfa,
    ): RedirectResponse {
        $user->refresh();

        if ($user->archived_at !== null) {
            app(SecurityAuditService::class)->record(
                $request,
                'LOGIN_BLOCKED_ARCHIVED',
                'Blocked',
                $user,
                ['stage' => 'mfa_completion'],
            );
            $request->session()->forget('mfa');

            return redirect()->route('login')
                ->withErrors(['email' => 'This account can no longer sign in. Contact the system administrator.']);
        }

        if (
            $user->employment_status === 'Inactive'
            || in_array(
                (string) ($user->pnd_access_status ?: 'Active'),
                ['Suspended', 'Inactive'],
                true,
            )
        ) {
            app(SecurityAuditService::class)->record(
                $request,
                'LOGIN_BLOCKED_ACCESS_STATUS',
                'Blocked',
                $user,
                ['stage' => 'mfa_completion'],
            );
            $request->session()->forget('mfa');

            return redirect()->route('login')
                ->withErrors(['email' => 'This account can no longer sign in. Contact the system administrator or HR.']);
        }

        $consumed = DB::transaction(function () use ($challenge): bool {
            $locked = MfaLoginChallenge::query()
                ->whereKey($challenge->getKey())
                ->lockForUpdate()
                ->first();

            if (
                ! $locked
                || $locked->status !== 'approved'
                || $locked->consumed_at !== null
                || $locked->isExpired()
            ) {
                return false;
            }

            $locked->forceFill([
                'status' => 'consumed',
                'consumed_at' => now(),
            ])->save();

            return true;
        });

        if (! $consumed) {
            $request->session()->forget('mfa');

            return redirect()->route('login')
                ->with('status', 'That verification request is already used or expired. Please sign in again.');
        }

        // MFA-governed accounts intentionally use a session login rather than a
        // persistent remember token. This prevents MFA from being bypassed by a
        // long-lived remember cookie after the browser session is gone.
        Auth::guard('web')->login($user, false);

        $mfa->event($request, $user, 'auth.mfa', 'success', [
            'challenge_uuid' => $challenge->uuid,
        ]);

        $request->session()->forget('mfa');
        $request->session()->regenerate();
        $verifiedAt = now()->timestamp;
        $request->session()->put([
            'auth.password_confirmed_at' => $verifiedAt,
            'security.last_password_verified_at' => $verifiedAt,
            'security.last_mfa_verified_at' => $verifiedAt,
        ]);

        app(SecurityAuditService::class)->record(
            $request,
            'LOGIN_SUCCESS',
            'Success',
            $user,
            ['mfa' => true, 'remember_cookie' => false],
        );

        return app(DashboardController::class)->redirectToOwnedDashboard($user);
    }

    private function pendingUser(Request $request): ?User
    {
        $userId = $request->session()->get('mfa.pending_user_id');
        $startedAt = (int) $request->session()->get('mfa.pending_started_at', 0);
        $ttl = max(60, (int) config('mfa.pending_login_ttl_seconds', 900));

        if (! $userId || $startedAt === 0 || now()->timestamp - $startedAt > $ttl) {
            $request->session()->forget('mfa');

            return null;
        }

        return User::find($userId);
    }

    private function challenge(Request $request, User $user): ?MfaLoginChallenge
    {
        $uuid = $request->session()->get('mfa.challenge_uuid');

        if (! $uuid) {
            return null;
        }

        $challenge = MfaLoginChallenge::query()
            ->where('uuid', $uuid)
            ->where('user_id', $user->id)
            ->first();

        if (! $challenge) {
            return null;
        }

        $bindingToken = $request->session()->get('mfa.pending_browser_token');

        if (! is_string($bindingToken) || strlen($bindingToken) < 64) {
            return null;
        }

        $expectedSessionHash = hash('sha256', $bindingToken);

        // The pending browser owns a random secret stored only in its session.
        // Session ID rotation is allowed, but another browser cannot complete
        // the approved challenge because it does not possess this secret.
        if (
            ! is_string($challenge->request_session_hash)
            || ! hash_equals($challenge->request_session_hash, $expectedSessionHash)
        ) {
            return null;
        }

        return $challenge;
    }

    private function expiredLoginRedirect(): RedirectResponse
    {
        return redirect()->route('login')
            ->with('status', 'Your sign-in session expired. Please enter your password again.');
    }
}
