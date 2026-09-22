<?php

namespace App\Services\Mfa;

use App\Enums\UserRole;
use App\Mail\MfaNumberMatchMail;
use App\Models\MfaDeviceEnrollment;
use App\Models\MfaLoginChallenge;
use App\Models\MfaRecoveryCode;
use App\Models\MfaSecurityEvent;
use App\Models\MfaTrustedDevice;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class MfaService
{
    public function __construct(private readonly TotpService $totp)
    {
    }

    public function requiresMfa(User $user): bool
    {
        return $user->role === UserRole::Admin
            || $user->role === UserRole::HR
            || $user->mfa_enabled_at !== null;
    }

    /**
     * Verification email is owned by the individual account. There is no
     * global Admin mailbox override. Admin password sign-in is intentionally
     * governed by an authenticator app instead of email number matching.
     */
    public function notificationEmailFor(User $user): ?string
    {
        $email = trim((string) $user->mfa_notification_email);

        return $email !== '' ? $email : null;
    }

    public function emailNumberMatchAllowed(User $user): bool
    {
        return $user->role !== UserRole::Admin
            && filled($this->notificationEmailFor($user));
    }

    public function hasPrimaryFactor(User $user): bool
    {
        // Admin password sign-in must have a TOTP authenticator configured.
        // Passkey sign-in remains a separate phishing-resistant login path.
        if ($user->role === UserRole::Admin) {
            return $user->hasTotp();
        }

        return $this->emailNumberMatchAllowed($user)
            || $user->hasTotp()
            || (
                (bool) config('mfa.legacy_trusted_devices_enabled', false)
                && $user->activeTrustedDevices()->exists()
            );
    }

    public function preferredMethod(User $user): string
    {
        if ($user->role === UserRole::Admin) {
            return 'totp';
        }

        if (
            $user->mfa_default_method === 'email_number_match'
            && $this->emailNumberMatchAllowed($user)
        ) {
            return 'email_number_match';
        }

        if (
            (bool) config('mfa.legacy_trusted_devices_enabled', false)
            && $user->mfa_default_method === 'trusted_device'
            && $user->activeTrustedDevices()->exists()
        ) {
            return 'trusted_device';
        }

        if ($user->mfa_default_method === 'totp' && $user->hasTotp()) {
            return 'totp';
        }

        if ($this->emailNumberMatchAllowed($user)) {
            return 'email_number_match';
        }

        if (
            (bool) config('mfa.legacy_trusted_devices_enabled', false)
            && $user->activeTrustedDevices()->exists()
        ) {
            return 'trusted_device';
        }

        return 'totp';
    }

    public function createChallenge(User $user, Request $request): MfaLoginChallenge
    {
        MfaLoginChallenge::query()
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->update(['status' => 'expired']);

        $target = $this->twoDigitNumber();
        $choices = [$target];

        while (count($choices) < 3) {
            $candidate = $this->twoDigitNumber();

            if (! in_array($candidate, $choices, true)) {
                $choices[] = $candidate;
            }
        }

        shuffle($choices);

        $bindingToken = $request->session()->get('mfa.pending_browser_token');

        if (! is_string($bindingToken) || strlen($bindingToken) < 64) {
            $bindingToken = bin2hex(random_bytes(32));
            $request->session()->put('mfa.pending_browser_token', $bindingToken);
        }

        $challenge = MfaLoginChallenge::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'number_code' => $target,
            'choice_codes' => $choices,
            'status' => 'pending',
            'request_ip' => $request->ip(),
            'request_user_agent' => $request->userAgent(),
            // Bind to a random browser-session secret instead of the Laravel
            // session ID itself. Laravel may rotate session IDs during a secure
            // authentication flow; the secret remains in the same browser
            // session and therefore survives rotation without weakening replay
            // protection. Only its hash is persisted with the challenge.
            'request_session_hash' => hash('sha256', $bindingToken),
            'expires_at' => now()->addSeconds(config('mfa.challenge_ttl_seconds', 180)),
        ]);

        $this->event($request, $user, 'mfa.challenge.created', 'success', [
            'challenge_uuid' => $challenge->uuid,
            'method' => $this->preferredMethod($user),
        ]);

        return $challenge;
    }

    /**
     * @return array{challenge:MfaLoginChallenge, delivered:bool}
     */
    public function createAndDeliverChallenge(User $user, Request $request): array
    {
        $challenge = $this->createChallenge($user, $request);
        $delivered = true;

        if ($this->preferredMethod($user) === 'email_number_match') {
            $delivered = $this->sendNumberMatchEmail($user, $challenge, $request);
        }

        return [
            'challenge' => $challenge,
            'delivered' => $delivered,
        ];
    }

    public function sendNumberMatchEmail(
        User $user,
        MfaLoginChallenge $challenge,
        Request $request,
    ): bool {
        $recipient = $this->notificationEmailFor($user);

        if (! $this->emailNumberMatchAllowed($user) || ! filled($recipient) || ! $challenge->isPending()) {
            return false;
        }

        try {
            Mail::to($recipient)->send(new MfaNumberMatchMail($user, $challenge));

            $challenge->forceFill(['notification_sent_at' => now()])->save();

            $this->event($request, $user, 'mfa.email.sent', 'success', [
                'challenge_uuid' => $challenge->uuid,
                'recipient' => $this->maskEmail($recipient),
            ]);

            return true;
        } catch (Throwable $exception) {
            Log::warning('Unable to send MFA number-match email.', [
                'user_id' => $user->id,
                'challenge_uuid' => $challenge->uuid,
                'exception' => $exception->getMessage(),
            ]);

            $this->event($request, $user, 'mfa.email.sent', 'failed', [
                'challenge_uuid' => $challenge->uuid,
            ]);

            return false;
        }
    }

    public function approveByEmailChoice(
        MfaLoginChallenge $challenge,
        string $choice,
        Request $request,
    ): bool {
        return DB::transaction(function () use ($challenge, $choice, $request): bool {
            $locked = MfaLoginChallenge::query()
                ->whereKey($challenge->getKey())
                ->with('user')
                ->lockForUpdate()
                ->first();

            if (! $locked || ! $locked->isPending()) {
                return false;
            }

            if (! preg_match('/^\d{2}$/', trim($choice))) {
                return false;
            }

            $normalized = trim($choice);
            $choices = array_map('strval', $locked->choice_codes ?? []);

            if (! in_array($normalized, $choices, true)) {
                return false;
            }

            if (! hash_equals($locked->number_code, $normalized)) {
                $locked->forceFill([
                    'status' => 'denied',
                    'denied_at' => now(),
                    'attempt_count' => $locked->attempt_count + 1,
                ])->save();

                $this->event($request, $locked->user, 'mfa.email.number_match', 'failed', [
                    'challenge_uuid' => $locked->uuid,
                ]);

                return false;
            }

            $locked->forceFill([
                'status' => 'approved',
                'approved_at' => now(),
            ])->save();

            $this->event($request, $locked->user, 'mfa.email.number_match', 'success', [
                'challenge_uuid' => $locked->uuid,
            ]);

            return true;
        });
    }

    public function denyByEmail(
        MfaLoginChallenge $challenge,
        Request $request,
    ): bool {
        return DB::transaction(function () use ($challenge, $request): bool {
            $locked = MfaLoginChallenge::query()
                ->whereKey($challenge->getKey())
                ->with('user')
                ->lockForUpdate()
                ->first();

            if (! $locked || ! $locked->isPending()) {
                return false;
            }

            $locked->forceFill([
                'status' => 'denied',
                'denied_at' => now(),
            ])->save();

            $this->event($request, $locked->user, 'mfa.email.denied', 'success', [
                'challenge_uuid' => $locked->uuid,
            ]);

            return true;
        });
    }

    public function resendWaitSeconds(MfaLoginChallenge $challenge): int
    {
        if ($challenge->notification_sent_at === null) {
            return 0;
        }

        $cooldown = max(0, (int) config('mfa.resend_cooldown_seconds', 30));
        $availableAt = $challenge->notification_sent_at->copy()->addSeconds($cooldown);

        return max(0, (int) ceil(now()->diffInSeconds($availableAt, false)));
    }

    public function maskEmail(?string $email): ?string
    {
        if (! $email || ! str_contains($email, '@')) {
            return $email;
        }

        [$local, $domain] = explode('@', $email, 2);
        $first = mb_substr($local, 0, 1);
        $masked = $first.str_repeat('•', max(4, mb_strlen($local) - 1));

        return $masked.'@'.$domain;
    }

    // Legacy trusted-device support remains available for backwards compatibility,
    // but it is no longer the default Admin experience shown in the interface.
    public function createDeviceEnrollment(User $user, Request $request): array
    {
        MfaDeviceEnrollment::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->delete();

        $token = bin2hex(random_bytes(32));
        $confirmationCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $enrollment = MfaDeviceEnrollment::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'token_hash' => $this->tokenHash($token),
            'confirmation_code_hash' => $this->secretHash($confirmationCode),
            'expires_at' => now()->addMinutes(config('mfa.enrollment_ttl_minutes', 10)),
        ]);

        $this->event($request, $user, 'mfa.device.enrollment.created', 'success', [
            'enrollment_uuid' => $enrollment->uuid,
        ]);

        return [
            'enrollment' => $enrollment,
            'token' => $token,
            'confirmation_code' => $confirmationCode,
        ];
    }

    public function findValidEnrollment(string $token): ?MfaDeviceEnrollment
    {
        $enrollment = MfaDeviceEnrollment::query()
            ->where('token_hash', $this->tokenHash($token))
            ->with('user')
            ->first();

        if (
            ! $enrollment
            || $enrollment->used_at !== null
            || now()->greaterThanOrEqualTo($enrollment->expires_at)
        ) {
            return null;
        }

        return $enrollment;
    }

    public function registerTrustedDevice(
        string $enrollmentToken,
        string $confirmationCode,
        string $deviceName,
        Request $request,
    ): array {
        $enrollment = MfaDeviceEnrollment::query()
            ->where('token_hash', $this->tokenHash($enrollmentToken))
            ->with('user')
            ->first();

        if (
            ! $enrollment
            || $enrollment->used_at !== null
            || now()->greaterThanOrEqualTo($enrollment->expires_at)
            || ! hash_equals($enrollment->confirmation_code_hash, $this->secretHash($confirmationCode))
        ) {
            throw ValidationException::withMessages([
                'confirmation_code' => 'This enrollment link or confirmation code is invalid or expired.',
            ]);
        }

        return DB::transaction(function () use ($enrollment, $deviceName, $request): array {
            $deviceToken = $this->randomToken();

            $device = MfaTrustedDevice::create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $enrollment->user_id,
                'name' => trim($deviceName) !== '' ? trim($deviceName) : 'Trusted device',
                'token_hash' => $this->tokenHash($deviceToken),
                'user_agent' => $request->userAgent(),
                'ip_address' => $request->ip(),
                'last_used_at' => now(),
            ]);

            $enrollment->forceFill(['used_at' => now()])->save();

            $recoveryCodes = [];

            if ($enrollment->user->mfa_enabled_at === null) {
                $enrollment->user->forceFill([
                    'mfa_enabled_at' => now(),
                    'mfa_default_method' => 'trusted_device',
                ])->save();

                $recoveryCodes = $this->generateRecoveryCodes($enrollment->user, $request);
            } elseif ($enrollment->user->mfa_default_method === null) {
                $enrollment->user->forceFill([
                    'mfa_default_method' => 'trusted_device',
                ])->save();
            }

            $this->event($request, $enrollment->user, 'mfa.device.enrolled', 'success', [
                'device_uuid' => $device->uuid,
            ]);

            return [
                'device' => $device,
                'token' => $deviceToken,
                'recovery_codes' => $recoveryCodes,
            ];
        });
    }

    public function trustedDeviceFromRequest(Request $request): ?MfaTrustedDevice
    {
        $token = (string) $request->cookie(config('mfa.trusted_device_cookie'));

        if ($token === '') {
            return null;
        }

        $device = MfaTrustedDevice::query()
            ->where('token_hash', $this->tokenHash($token))
            ->whereNull('revoked_at')
            ->first();

        if ($device && (
            $device->last_used_at === null
            || $device->last_used_at->lt(now()->subMinutes(5))
            || $device->ip_address !== $request->ip()
        )) {
            $device->forceFill([
                'last_used_at' => now(),
                'ip_address' => $request->ip(),
            ])->save();
        }

        return $device;
    }

    public function pendingChallengeForDevice(MfaTrustedDevice $device): ?MfaLoginChallenge
    {
        MfaLoginChallenge::query()
            ->where('user_id', $device->user_id)
            ->where('status', 'pending')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired']);

        return MfaLoginChallenge::query()
            ->where('user_id', $device->user_id)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();
    }

    public function approveByTrustedDevice(
        MfaTrustedDevice $device,
        MfaLoginChallenge $challenge,
        string $number,
        Request $request,
    ): void {
        if ($challenge->user_id !== $device->user_id || ! $challenge->isPending()) {
            throw ValidationException::withMessages([
                'number' => 'This sign-in request is no longer available.',
            ]);
        }

        if ($challenge->attempt_count >= 5) {
            $challenge->forceFill(['status' => 'denied', 'denied_at' => now()])->save();

            throw ValidationException::withMessages([
                'number' => 'Too many incorrect attempts. The sign-in request was denied.',
            ]);
        }

        if (! hash_equals($challenge->number_code, trim($number))) {
            $challenge->increment('attempt_count');
            $challenge->refresh();

            $this->event($request, $challenge->user, 'mfa.number_match', 'failed', [
                'challenge_uuid' => $challenge->uuid,
                'device_uuid' => $device->uuid,
            ]);

            throw ValidationException::withMessages([
                'number' => 'The number does not match the sign-in screen.',
            ]);
        }

        $challenge->forceFill([
            'status' => 'approved',
            'approved_by_device_id' => $device->id,
            'approved_at' => now(),
        ])->save();

        $this->event($request, $challenge->user, 'mfa.number_match', 'success', [
            'challenge_uuid' => $challenge->uuid,
            'device_uuid' => $device->uuid,
        ]);
    }

    public function denyByTrustedDevice(
        MfaTrustedDevice $device,
        MfaLoginChallenge $challenge,
        Request $request,
    ): void {
        if ($challenge->user_id !== $device->user_id || ! $challenge->isPending()) {
            return;
        }

        $challenge->forceFill([
            'status' => 'denied',
            'denied_at' => now(),
        ])->save();

        $this->event($request, $challenge->user, 'mfa.challenge.denied', 'success', [
            'challenge_uuid' => $challenge->uuid,
            'device_uuid' => $device->uuid,
        ]);
    }

    public function verifyTotp(User $user, string $code, Request $request): bool
    {
        if (! filled($user->totp_secret)) {
            return false;
        }

        $counter = $this->totp->verify($user->totp_secret, $code);

        if ($counter === null) {
            $this->event($request, $user, 'mfa.totp', 'failed');

            return false;
        }

        if ($user->totp_last_counter !== null && $counter <= $user->totp_last_counter) {
            $this->event($request, $user, 'mfa.totp.replay', 'failed');

            return false;
        }

        $user->forceFill(['totp_last_counter' => $counter])->save();

        $this->event($request, $user, 'mfa.totp', 'success');

        return true;
    }

    public function generateRecoveryCodes(User $user, Request $request): array
    {
        return DB::transaction(function () use ($user, $request): array {
            MfaRecoveryCode::query()->where('user_id', $user->id)->delete();

            $plain = [];

            for ($index = 0; $index < config('mfa.recovery_code_count', 8); $index++) {
                $raw = strtoupper($this->totp->base32Encode(random_bytes(10)));
                $code = implode('-', str_split(substr($raw, 0, 16), 4));
                $plain[] = $code;

                MfaRecoveryCode::create([
                    'user_id' => $user->id,
                    'code_hash' => $this->secretHash($code),
                    'created_at' => now(),
                ]);
            }

            $this->event($request, $user, 'mfa.recovery_codes.generated', 'success');

            return $plain;
        });
    }

    public function consumeRecoveryCode(User $user, string $code, Request $request): bool
    {
        $normalized = strtoupper(trim($code));

        $record = MfaRecoveryCode::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->where('code_hash', $this->secretHash($normalized))
            ->first();

        if (! $record) {
            $this->event($request, $user, 'mfa.recovery_code', 'failed');

            return false;
        }

        $record->forceFill(['used_at' => now()])->save();

        $this->event($request, $user, 'mfa.recovery_code', 'success');

        return true;
    }

    public function beginTotpEnrollment(User $user): array
    {
        $secret = $this->totp->generateSecret();
        $issuer = config('mfa.issuer', 'Alibaton Construction');

        return [
            'secret' => $secret,
            'uri' => $this->totp->provisioningUri($secret, $user->email, $issuer),
        ];
    }

    public function confirmTotpEnrollment(
        User $user,
        string $secret,
        string $code,
        Request $request,
    ): bool {
        if ($this->totp->verify($secret, $code) === null) {
            return false;
        }

        $user->forceFill([
            'totp_secret' => $secret,
            'totp_last_counter' => null,
            'mfa_enabled_at' => $user->mfa_enabled_at ?? now(),
            'mfa_default_method' => $user->role === UserRole::Admin
                ? 'totp'
                : ($user->mfa_default_method ?? 'totp'),
        ])->save();

        $this->event($request, $user, 'mfa.totp.enrolled', 'success');

        return true;
    }

    public function markConfiguredWithTrustedDevice(User $user, Request $request): array
    {
        if ($user->mfa_enabled_at !== null) {
            return [];
        }

        $user->forceFill([
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'trusted_device',
        ])->save();

        return $this->generateRecoveryCodes($user, $request);
    }

    public function revokeDevice(MfaTrustedDevice $device, Request $request): void
    {
        $device->forceFill(['revoked_at' => now()])->save();

        $this->event($request, $device->user, 'mfa.device.revoked', 'success', [
            'device_uuid' => $device->uuid,
        ]);
    }

    public function event(
        Request $request,
        ?User $user,
        string $type,
        string $outcome,
        array $metadata = [],
    ): void {
        MfaSecurityEvent::create([
            'user_id' => $user?->id,
            'event_type' => $type,
            'outcome' => $outcome,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'metadata' => $metadata === [] ? null : $metadata,
            'created_at' => now(),
        ]);
    }

    public function cookieArguments(string $token): array
    {
        return [
            config('mfa.trusted_device_cookie'),
            $token,
            config('mfa.trusted_device_cookie_minutes', 525600),
            '/',
            null,
            (bool) config('session.secure', false) || request()->isSecure(),
            true,
            false,
            'strict',
        ];
    }

    private function twoDigitNumber(): string
    {
        return str_pad((string) random_int(0, 99), 2, '0', STR_PAD_LEFT);
    }

    private function randomToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private function tokenHash(string $token): string
    {
        return hash('sha256', $token);
    }

    private function secretHash(string $value): string
    {
        return hash_hmac('sha256', strtoupper(trim($value)), (string) config('app.key'));
    }
}
