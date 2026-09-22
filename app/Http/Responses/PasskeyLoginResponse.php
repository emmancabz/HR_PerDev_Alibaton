<?php

namespace App\Http\Responses;

use App\Models\User;
use App\Services\Mfa\MfaService;
use App\Services\Security\SecurityAuditService;
use Laravel\Passkeys\Contracts\PasskeyLoginResponse as PasskeyLoginResponseContract;

class PasskeyLoginResponse implements PasskeyLoginResponseContract
{
    public function toResponse($request)
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user) {
            $request->session()->put([
                'security.last_mfa_verified_at' => now()->timestamp,
                'security.last_passkey_verified_at' => now()->timestamp,
            ]);

            app(MfaService::class)->event(
                $request,
                $user,
                'auth.passkey',
                'success',
            );

            app(SecurityAuditService::class)->record(
                $request,
                'LOGIN_SUCCESS',
                'Success',
                $user,
                ['method' => 'passkey', 'phishing_resistant' => true],
            );
        }

        return response()->json([
            'redirect' => route('dashboard'),
        ]);
    }
}
