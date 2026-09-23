<?php

namespace App\Providers;

use App\Contracts\Training\WorkforceAttendanceGateway;
use App\Http\Responses\PasskeyLoginResponse as AppPasskeyLoginResponse;
use App\Models\Learning\LearningAssignment;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseVersion;
use App\Models\Passkey as AppPasskey;
use App\Models\User;
use App\Policies\Learning\LearningAssignmentPolicy;
use App\Policies\Learning\LearningCoursePolicy;
use App\Policies\Learning\LearningCourseVersionPolicy;
use App\Services\Mfa\MfaService;
use App\Services\Security\SecurityAuditService;
use App\Services\Training\PendingWorkforceAttendanceGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;
use Laravel\Passkeys\Contracts\PasskeyLoginResponse as PasskeyLoginResponseContract;
use Laravel\Passkeys\Contracts\PasskeyUser;
use Laravel\Passkeys\Passkey;
use Laravel\Passkeys\Passkeys;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(WorkforceAttendanceGateway::class, PendingWorkforceAttendanceGateway::class);
        $this->app->singleton(PasskeyLoginResponseContract::class, AppPasskeyLoginResponse::class);
    }

    public function boot(): void
    {
        if ((string) config('microservices.role') !== 'gateway') {
            URL::forceRootUrl((string) config('app.url'));
        }
        Password::defaults(fn () => Password::min(12)
            ->mixedCase()
            ->letters()
            ->numbers());

        Gate::policy(LearningCourse::class, LearningCoursePolicy::class);
        Gate::policy(LearningCourseVersion::class, LearningCourseVersionPolicy::class);
        Gate::policy(LearningAssignment::class, LearningAssignmentPolicy::class);

        Passkeys::useUserModel(User::class);
        Passkeys::usePasskeyModel(AppPasskey::class);

        Passkeys::authorizeLoginUsing(function (
            Request $request,
            PasskeyUser $passkeyUser,
            Passkey $passkey,
        ): bool {
            if (! $passkeyUser instanceof User) {
                return false;
            }

            if ($passkeyUser->archived_at !== null) {
                app(SecurityAuditService::class)->record(
                    $request,
                    'LOGIN_BLOCKED_ARCHIVED',
                    'Blocked',
                    $passkeyUser,
                    ['stage' => 'passkey'],
                );

                throw ValidationException::withMessages([
                    'credential' => 'Unable to sign in with this account.',
                ]);
            }

            if (
                $passkeyUser->employment_status === 'Inactive'
                || in_array(
                    (string) ($passkeyUser->pnd_access_status ?: 'Active'),
                    ['Suspended', 'Inactive'],
                    true,
                )
            ) {
                app(SecurityAuditService::class)->record(
                    $request,
                    'LOGIN_BLOCKED_ACCESS_STATUS',
                    'Blocked',
                    $passkeyUser,
                    ['stage' => 'passkey'],
                );

                throw ValidationException::withMessages([
                    'credential' => 'Unable to sign in with this account.',
                ]);
            }

            // A passkey is already a strong, phishing-resistant authenticator.
            // Privileged / MFA-governed accounts still do not receive a long-lived
            // remember cookie so a stolen browser token cannot outlive the session.
            if (app(MfaService::class)->requiresMfa($passkeyUser)) {
                $request->merge(['remember' => false]);
            }

            return true;
        });

        RateLimiter::for('password-reset-request', fn (Request $request): Limit => Limit::perMinute(
            app()->environment('local') ? 60 : 5,
        )->by('password-reset|'.$request->ip()));

        RateLimiter::for('mfa-email-review', fn (Request $request): Limit => Limit::perMinute(
            max(1, (int) config('security_auth.mfa_email_review_per_minute', 60)),
        )->by('mfa-email-review|'.$request->ip()));

        RateLimiter::for('mfa-email-confirm', fn (Request $request): Limit => Limit::perMinute(
            max(1, (int) config('security_auth.mfa_email_confirm_per_minute', 30)),
        )->by('mfa-email-confirm|'.$request->ip()));

        RateLimiter::for('mfa-status', fn (Request $request): Limit => Limit::perMinute(
            max(1, (int) config('security_auth.mfa_status_per_minute', 120)),
        )->by('mfa-status|'.$request->ip()));

        RateLimiter::for('mfa-resend', fn (Request $request): Limit => Limit::perMinute(
            max(1, (int) config('security_auth.mfa_resend_per_minute', 5)),
        )->by('mfa-resend|'.$request->ip()));

        RateLimiter::for('mfa-verify', fn (Request $request): Limit => Limit::perMinute(
            max(1, (int) config('security_auth.mfa_verify_per_minute', 20)),
        )->by('mfa-verify|'.$request->ip()));

        Vite::prefetch(concurrency: 3);
    }
}
