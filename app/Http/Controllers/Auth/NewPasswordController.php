<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaLoginChallenge;
use App\Models\MfaTrustedDevice;
use App\Models\User;
use App\Services\Security\SecurityAuditService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewPasswordController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('Auth/ResetPassword', [
            'email' => $request->email,
            'token' => $request->route('token'),
        ]);
    }

    /**
     * Resetting a password is treated as an account-recovery event: existing
     * sessions, pending MFA challenges, remember tokens, and legacy trusted
     * browser approvals are invalidated. Registered passkeys remain available
     * because they are independent phishing-resistant credentials.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user) use ($request): void {
                DB::transaction(function () use ($user, $request): void {
                    $user->forceFill([
                        'password' => Hash::make((string) $request->password),
                        'remember_token' => Str::random(60),
                    ])->save();

                    DB::table(config('session.table', 'sessions'))
                        ->where('user_id', $user->getAuthIdentifier())
                        ->delete();

                    MfaLoginChallenge::query()
                        ->where('user_id', $user->id)
                        ->whereIn('status', ['pending', 'approved'])
                        ->update(['status' => 'expired']);

                    MfaTrustedDevice::query()
                        ->where('user_id', $user->id)
                        ->whereNull('revoked_at')
                        ->update(['revoked_at' => now()]);
                });

                event(new PasswordReset($user));

                app(SecurityAuditService::class)->record(
                    $request,
                    'PASSWORD_RESET_COMPLETED',
                    'Success',
                    $user,
                    ['sessions_revoked' => true, 'legacy_trusted_devices_revoked' => true],
                );
            },
        );

        if ($status === Password::PASSWORD_RESET) {
            return redirect()->route('login')->with(
                'status',
                'Password reset complete. Sign in again and complete your normal verification.',
            );
        }

        throw ValidationException::withMessages([
            'email' => [trans($status)],
        ]);
    }
}
