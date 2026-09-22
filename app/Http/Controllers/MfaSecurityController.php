<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\MfaTrustedDevice;
use App\Services\Mfa\MfaService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MfaSecurityController extends Controller
{
    public function show(Request $request, MfaService $mfa): Response
    {
        $user = $request->user();
        $notificationEmail = $mfa->emailNumberMatchAllowed($user)
            ? $mfa->notificationEmailFor($user)
            : null;

        return Inertia::render('Security/MfaSecurity', [
            'mfa' => [
                'required' => $mfa->requiresMfa($user),
                'enabled' => $mfa->hasPrimaryFactor($user),
                'enabledAt' => $user->mfa_enabled_at?->toIso8601String(),
                'defaultMethod' => $mfa->preferredMethod($user),
                'notificationEmail' => $notificationEmail,
                'emailNumberMatchEnabled' => $mfa->emailNumberMatchAllowed($user),
                'emailNumberMatchAllowed' => $user->role !== UserRole::Admin,
                'adminAuthenticatorRequired' => $user->role === UserRole::Admin,
                'totpEnabled' => $user->hasTotp(),
                'recoveryCodesRemaining' => $user->recoveryCodes()
                    ->whereNull('used_at')
                    ->count(),
            ],
            'passkeys' => $user->passkeys()
                ->latest('id')
                ->get()
                ->map(fn ($passkey) => [
                    'id' => $passkey->id,
                    'name' => $passkey->name,
                    'createdAt' => $passkey->created_at?->toIso8601String(),
                    'lastUsedAt' => $passkey->last_used_at?->toIso8601String(),
                ])
                ->values(),
            'events' => $user->mfaSecurityEvents()
                ->latest('created_at')
                ->limit(20)
                ->get()
                ->map(fn ($event) => [
                    'id' => $event->id,
                    'type' => $event->event_type,
                    'outcome' => $event->outcome,
                    'ipAddress' => $event->ip_address,
                    'createdAt' => $event->created_at->toIso8601String(),
                ])
                ->values(),
            'totpEnrollment' => $request->session()->has('security.mfa_totp_secret')
                ? [
                    'secret' => $request->session()->get('security.mfa_totp_secret'),
                    'uri' => $request->session()->get('security.mfa_totp_uri'),
                ]
                : null,
            'newRecoveryCodes' => $request->session()->get('security.mfa_recovery_codes', []),
            'status' => session('status'),
        ]);
    }

    // Kept for backwards compatibility with existing routes/bookmarks. The normal
    // Admin interface no longer presents trusted-device web enrollment.
    public function beginDeviceEnrollment(Request $request, MfaService $mfa): RedirectResponse
    {
        abort_unless((bool) config('mfa.legacy_trusted_devices_enabled', false), 404);

        $enrollment = $mfa->createDeviceEnrollment($request->user(), $request);

        $request->session()->put([
            'security.mfa_device_token' => $enrollment['token'],
            'security.mfa_device_code' => $enrollment['confirmation_code'],
            'security.mfa_device_expires_at' => $enrollment['enrollment']->expires_at->toIso8601String(),
        ]);

        return back()->with('status', 'Device enrollment link created.');
    }

    public function beginTotp(Request $request, MfaService $mfa): RedirectResponse
    {
        $enrollment = $mfa->beginTotpEnrollment($request->user());

        $request->session()->put([
            'security.mfa_totp_secret' => $enrollment['secret'],
            'security.mfa_totp_uri' => $enrollment['uri'],
        ]);

        return back();
    }

    public function confirmTotp(Request $request, MfaService $mfa): RedirectResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'digits:6'],
        ]);

        $secret = (string) $request->session()->get('security.mfa_totp_secret');

        if (
            $secret === ''
            || ! $mfa->confirmTotpEnrollment(
                $request->user(),
                $secret,
                $validated['code'],
                $request,
            )
        ) {
            throw ValidationException::withMessages([
                'code' => 'The authenticator code is invalid. Check your phone time and try again.',
            ]);
        }

        if ($request->user()->recoveryCodes()->whereNull('used_at')->count() === 0) {
            $request->session()->put(
                'security.mfa_recovery_codes',
                $mfa->generateRecoveryCodes($request->user(), $request),
            );
        }

        $request->session()->forget([
            'security.mfa_totp_secret',
            'security.mfa_totp_uri',
        ]);

        return back()->with('status', 'Authenticator app added.');
    }

    public function regenerateRecoveryCodes(Request $request, MfaService $mfa): RedirectResponse
    {
        $request->session()->put(
            'security.mfa_recovery_codes',
            $mfa->generateRecoveryCodes($request->user(), $request),
        );

        return back()->with('status', 'New recovery codes generated. Previous codes are no longer valid.');
    }

    public function acknowledgeRecoveryCodes(Request $request): RedirectResponse
    {
        $request->session()->forget('security.mfa_recovery_codes');

        return back();
    }

    public function setDefault(Request $request, MfaService $mfa): RedirectResponse
    {
        $validated = $request->validate([
            'method' => ['required', Rule::in(['email_number_match', 'totp', 'trusted_device'])],
        ]);

        $user = $request->user();

        if ($validated['method'] === 'email_number_match' && ! $mfa->emailNumberMatchAllowed($user)) {
            throw ValidationException::withMessages([
                'method' => $user->role === UserRole::Admin
                    ? 'Admin password sign-in requires an authenticator app.'
                    : 'Add a verification email first.',
            ]);
        }

        if ($validated['method'] === 'trusted_device') {
            if (! (bool) config('mfa.legacy_trusted_devices_enabled', false)) {
                throw ValidationException::withMessages([
                    'method' => 'Legacy trusted-device approval is disabled. Use a passkey, email approval, or authenticator app.',
                ]);
            }

            if (! $user->activeTrustedDevices()->exists()) {
                throw ValidationException::withMessages([
                    'method' => 'Register at least one trusted device first.',
                ]);
            }
        }

        if ($validated['method'] === 'totp' && ! $user->hasTotp()) {
            throw ValidationException::withMessages([
                'method' => 'Add an authenticator app first.',
            ]);
        }

        $user->forceFill([
            'mfa_default_method' => $validated['method'],
            'mfa_enabled_at' => $user->mfa_enabled_at ?? now(),
        ])->save();

        return back()->with('status', 'Default verification method updated.');
    }

    public function revokeDevice(
        Request $request,
        MfaTrustedDevice $device,
        MfaService $mfa,
    ): RedirectResponse {
        abort_unless($device->user_id === $request->user()->id, 404);

        $mfa->revokeDevice($device, $request);

        return back()->with('status', 'Device revoked.');
    }
}
