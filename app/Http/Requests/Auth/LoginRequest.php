<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Services\Security\SecurityAuditService;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Verify the password without creating an authenticated session.
     *
     * The final Auth::login call is intentionally deferred until MFA succeeds.
     *
     * @throws ValidationException
     */
    public function authenticate(): User
    {
        $this->ensureIsNotRateLimited();

        $email = Str::lower(trim((string) $this->input('email')));

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $user || ! Hash::check((string) $this->input('password'), $user->password)) {
            RateLimiter::hit(
                $this->throttleKey(),
                (int) config('security_auth.login_decay_seconds', 900),
            );
            app(SecurityAuditService::class)->record($this, 'LOGIN_FAILED', 'Failed', $user);

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        if ($user->archived_at !== null) {
            app(SecurityAuditService::class)->record($this, 'LOGIN_BLOCKED_ARCHIVED', 'Blocked', $user);
            throw ValidationException::withMessages([
                'email' => 'This account is archived and cannot sign in. Contact the system administrator.',
            ]);
        }

        if ($user->employment_status === 'Inactive' || in_array((string) ($user->pnd_access_status ?: 'Active'), ['Suspended', 'Inactive'], true)) {
            app(SecurityAuditService::class)->record($this, 'LOGIN_BLOCKED_ACCESS_STATUS', 'Blocked', $user, [
                'pnd_access_status' => $user->pnd_access_status ?: 'Active',
                'employment_status' => $user->employment_status,
            ]);
            throw ValidationException::withMessages([
                'email' => 'This account does not currently have active P&D access. Contact the system administrator or HR.',
            ]);
        }

        RateLimiter::clear($this->throttleKey());

        return $user;
    }

    /**
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts(
            $this->throttleKey(),
            (int) config('security_auth.login_max_failed_attempts', 5),
        )) {
            return;
        }

        event(new Lockout($this));
        app(SecurityAuditService::class)->record($this, 'LOGIN_RATE_LIMITED', 'Blocked');

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    public function throttleKey(): string
    {
        return Str::transliterate(
            Str::lower(trim((string) $this->input('email'))).'|'.$this->ip()
        );
    }
}
