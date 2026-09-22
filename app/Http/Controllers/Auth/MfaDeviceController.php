<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaLoginChallenge;
use App\Services\Mfa\MfaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MfaDeviceController extends Controller
{
    public function enrollShow(string $token, MfaService $mfa): Response
    {
        $this->ensureLegacyTrustedDevicesEnabled();
        $enrollment = $mfa->findValidEnrollment($token);

        return Inertia::render('Auth/MfaDeviceEnroll', [
            'valid' => $enrollment !== null,
            'token' => $enrollment ? $token : null,
            'account' => $enrollment ? [
                'name' => $enrollment->user->name,
                'email' => $enrollment->user->email,
            ] : null,
            'expiresAt' => $enrollment?->expires_at?->toIso8601String(),
        ]);
    }

    public function enrollStore(
        Request $request,
        string $token,
        MfaService $mfa,
    ): RedirectResponse {
        $this->ensureLegacyTrustedDevicesEnabled();
        $validated = $request->validate([
            'confirmation_code' => ['required', 'digits:6'],
            'device_name' => ['required', 'string', 'min:2', 'max:120'],
        ]);

        $result = $mfa->registerTrustedDevice(
            $token,
            $validated['confirmation_code'],
            $validated['device_name'],
            $request,
        );

        if ($result['recovery_codes'] !== []) {
            $request->session()->put('mfa.device_new_recovery_codes', $result['recovery_codes']);
        }

        return redirect()
            ->route('mfa.device.home')
            ->with('status', 'This device is now trusted for Alibaton sign-in approvals.')
            ->withCookie(cookie(...$mfa->cookieArguments($result['token'])));
    }

    public function home(Request $request, MfaService $mfa): Response
    {
        $this->ensureLegacyTrustedDevicesEnabled();
        $device = $mfa->trustedDeviceFromRequest($request);

        if (! $device) {
            return Inertia::render('Auth/MfaDevice', [
                'device' => null,
                'request' => null,
                'recoveryCodes' => [],
                'status' => session('status'),
            ]);
        }

        $challenge = $mfa->pendingChallengeForDevice($device);

        return Inertia::render('Auth/MfaDevice', [
            'device' => [
                'uuid' => $device->uuid,
                'name' => $device->name,
                'accountName' => $device->user->name,
                'accountEmail' => $device->user->email,
            ],
            'request' => $this->challengePayload($challenge),
            'recoveryCodes' => $request->session()->get('mfa.device_new_recovery_codes', []),
            'status' => session('status'),
        ]);
    }

    public function status(Request $request, MfaService $mfa): JsonResponse
    {
        $this->ensureLegacyTrustedDevicesEnabled();
        $device = $mfa->trustedDeviceFromRequest($request);

        if (! $device) {
            return response()->json(['trusted' => false], 401);
        }

        return response()->json([
            'trusted' => true,
            'request' => $this->challengePayload($mfa->pendingChallengeForDevice($device)),
        ]);
    }

    public function approve(Request $request, MfaService $mfa): RedirectResponse
    {
        $this->ensureLegacyTrustedDevicesEnabled();
        $device = $mfa->trustedDeviceFromRequest($request);

        if (! $device) {
            throw ValidationException::withMessages([
                'number' => 'This browser is not a registered trusted device.',
            ]);
        }

        $validated = $request->validate([
            'challenge_uuid' => ['required', 'uuid'],
            'number' => ['required', 'digits:2'],
        ]);

        $challenge = MfaLoginChallenge::query()
            ->where('uuid', $validated['challenge_uuid'])
            ->firstOrFail();

        $mfa->approveByTrustedDevice(
            $device,
            $challenge,
            $validated['number'],
            $request,
        );

        return back()->with('status', 'Sign-in approved.');
    }

    public function deny(Request $request, MfaService $mfa): RedirectResponse
    {
        $this->ensureLegacyTrustedDevicesEnabled();
        $device = $mfa->trustedDeviceFromRequest($request);

        if (! $device) {
            return back();
        }

        $validated = $request->validate([
            'challenge_uuid' => ['required', 'uuid'],
        ]);

        $challenge = MfaLoginChallenge::query()
            ->where('uuid', $validated['challenge_uuid'])
            ->firstOrFail();

        $mfa->denyByTrustedDevice($device, $challenge, $request);

        return back()->with('status', 'Sign-in denied.');
    }

    public function acknowledgeRecoveryCodes(Request $request): RedirectResponse
    {
        $this->ensureLegacyTrustedDevicesEnabled();
        $request->session()->forget('mfa.device_new_recovery_codes');

        return back();
    }

    private function ensureLegacyTrustedDevicesEnabled(): void
    {
        abort_unless((bool) config('mfa.legacy_trusted_devices_enabled', false), 404);
    }

    private function challengePayload(?MfaLoginChallenge $challenge): ?array
    {
        if (! $challenge) {
            return null;
        }

        return [
            'uuid' => $challenge->uuid,
            'requestedAt' => $challenge->created_at->toIso8601String(),
            'expiresAt' => $challenge->expires_at->toIso8601String(),
            'ipAddress' => $challenge->request_ip,
            'userAgent' => $challenge->request_user_agent,
        ];
    }
}
