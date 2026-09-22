<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaLoginChallenge;
use App\Services\Security\SecurityAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    /**
     * Update the password and revoke every other database-backed session.
     * The current browser is retained so the user is not unexpectedly logged
     * out of the security screen that performed the verified change.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        $user = $request->user();
        $currentSessionId = $request->session()->getId();

        DB::transaction(function () use ($user, $validated, $currentSessionId): void {
            $user->forceFill([
                'password' => Hash::make($validated['password']),
                'remember_token' => Str::random(60),
            ])->save();

            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->getAuthIdentifier())
                ->where('id', '!=', $currentSessionId)
                ->delete();

            MfaLoginChallenge::query()
                ->where('user_id', $user->id)
                ->whereIn('status', ['pending', 'approved'])
                ->update(['status' => 'expired']);
        });

        $verifiedAt = now()->timestamp;
        $request->session()->put([
            'auth.password_confirmed_at' => $verifiedAt,
            'security.last_password_verified_at' => $verifiedAt,
        ]);

        app(SecurityAuditService::class)->record(
            $request,
            'PASSWORD_CHANGED',
            'Success',
            $user,
            ['other_sessions_revoked' => true],
        );

        return back()->with('status', 'Password updated. Other signed-in browser sessions were revoked.');
    }
}
