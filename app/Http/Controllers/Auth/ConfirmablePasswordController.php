<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Security\SecurityAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ConfirmablePasswordController extends Controller
{
    /**
     * Show the confirm password view.
     */
    public function show(): Response
    {
        return Inertia::render('Auth/ConfirmPassword');
    }

    /**
     * Confirm the user's password.
     */
    public function store(Request $request): RedirectResponse
    {
        if (! Auth::guard('web')->validate([
            'email' => $request->user()->email,
            'password' => $request->password,
        ])) {
            app(SecurityAuditService::class)->record(
                $request,
                'PASSWORD_REAUTH_FAILED',
                'Failed',
                $request->user(),
            );

            throw ValidationException::withMessages([
                'password' => __('auth.password'),
            ]);
        }

        $verifiedAt = now()->timestamp;
        $request->session()->put([
            'auth.password_confirmed_at' => $verifiedAt,
            'security.last_password_verified_at' => $verifiedAt,
        ]);

        app(SecurityAuditService::class)->record(
            $request,
            'PASSWORD_REAUTH_SUCCESS',
            'Success',
            $request->user(),
        );

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
