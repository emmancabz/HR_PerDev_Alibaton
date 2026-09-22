<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\ConfirmablePasswordController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\EmailVerificationPromptController;
use App\Http\Controllers\Auth\MfaChallengeController;
use App\Http\Controllers\Auth\MfaDeviceController;
use App\Http\Controllers\Auth\MfaEmailController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\VerifyEmailController;
use App\Http\Controllers\MfaSecurityController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| MFA approval endpoints
|--------------------------------------------------------------------------
|
| Email choice links use temporary signed URLs. Legacy trusted-device routes
| remain available for backwards compatibility but are no longer shown as the
| default Admin verification experience.
|
*/

Route::get('mfa/email/{challenge}/deny', [MfaEmailController::class, 'denyReview'])
    ->middleware(['signed:relative', 'throttle:mfa-email-review'])
    ->name('mfa.email.deny.review');

Route::get('mfa/email/{challenge}/{choice}', [MfaEmailController::class, 'review'])
    ->middleware(['signed:relative', 'throttle:mfa-email-review'])
    ->name('mfa.email.review');

Route::post('mfa/email/{challenge}/{choice}/confirm', [MfaEmailController::class, 'confirm'])
    ->middleware(['signed:relative', 'throttle:mfa-email-confirm'])
    ->name('mfa.email.confirm');

Route::post('mfa/email/{challenge}/deny', [MfaEmailController::class, 'deny'])
    ->middleware(['signed:relative', 'throttle:mfa-email-confirm'])
    ->name('mfa.email.deny');

Route::get('mfa/device/enroll/{token}', [MfaDeviceController::class, 'enrollShow'])
    ->middleware('throttle:30,1')
    ->name('mfa.device.enroll.show');

Route::post('mfa/device/enroll/{token}', [MfaDeviceController::class, 'enrollStore'])
    ->middleware('throttle:10,1')
    ->name('mfa.device.enroll.store');

Route::get('mfa/device', [MfaDeviceController::class, 'home'])
    ->name('mfa.device.home');

Route::get('mfa/device/status', [MfaDeviceController::class, 'status'])
    ->middleware('throttle:mfa-status')
    ->name('mfa.device.status');

Route::post('mfa/device/approve', [MfaDeviceController::class, 'approve'])
    ->middleware('throttle:20,1')
    ->name('mfa.device.approve');

Route::post('mfa/device/deny', [MfaDeviceController::class, 'deny'])
    ->middleware('throttle:20,1')
    ->name('mfa.device.deny');

Route::post('mfa/device/recovery-codes/acknowledge', [MfaDeviceController::class, 'acknowledgeRecoveryCodes'])
    ->name('mfa.device.recovery-codes.acknowledge');

Route::middleware('guest')->group(function () {
    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');

    Route::post('login', [AuthenticatedSessionController::class, 'store']);

    Route::get('mfa/setup', [MfaChallengeController::class, 'setup'])
        ->name('mfa.setup');
    Route::get('mfa/setup/status', [MfaChallengeController::class, 'setupStatus'])
        ->middleware('throttle:mfa-status')
        ->name('mfa.setup.status');
    Route::post('mfa/setup/totp', [MfaChallengeController::class, 'beginTotpSetup'])
        ->middleware('throttle:10,1')
        ->name('mfa.setup.totp.begin');
    Route::post('mfa/setup/totp/confirm', [MfaChallengeController::class, 'confirmTotpSetup'])
        ->middleware('throttle:20,1')
        ->name('mfa.setup.totp.confirm');
    Route::post('mfa/setup/continue', [MfaChallengeController::class, 'continueSetup'])
        ->name('mfa.setup.continue');

    Route::get('mfa/challenge', [MfaChallengeController::class, 'show'])
        ->name('mfa.challenge');
    Route::get('mfa/challenge/status', [MfaChallengeController::class, 'status'])
        ->middleware('throttle:mfa-status')
        ->name('mfa.challenge.status');
    Route::post('mfa/challenge/resend', [MfaChallengeController::class, 'resend'])
        ->middleware('throttle:mfa-resend')
        ->name('mfa.challenge.resend');
    Route::post('mfa/challenge/retry', [MfaChallengeController::class, 'retry'])
        ->middleware('throttle:mfa-resend')
        ->name('mfa.challenge.retry');
    Route::post('mfa/challenge/verify', [MfaChallengeController::class, 'verifyAlternative'])
        ->middleware('throttle:mfa-verify')
        ->name('mfa.challenge.verify');
    Route::post('mfa/challenge/complete', [MfaChallengeController::class, 'complete'])
        ->middleware('throttle:mfa-verify')
        ->name('mfa.challenge.complete');

    Route::get('forgot-password', [PasswordResetLinkController::class, 'create'])
        ->name('password.request');

    Route::post('forgot-password', [PasswordResetLinkController::class, 'store'])
        ->middleware('throttle:password-reset-request')
        ->name('password.email');

    Route::get('reset-password/{token}', [NewPasswordController::class, 'create'])
        ->name('password.reset');

    Route::post('reset-password', [NewPasswordController::class, 'store'])
        ->name('password.store');
});

Route::middleware('auth')->group(function () {
    Route::get('verify-email', EmailVerificationPromptController::class)
        ->name('verification.notice');

    Route::get('verify-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    Route::get('confirm-password', [ConfirmablePasswordController::class, 'show'])
        ->name('password.confirm');

    Route::post('confirm-password', [ConfirmablePasswordController::class, 'store']);

    Route::put('password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('security/mfa', [MfaSecurityController::class, 'show'])
        ->name('security.mfa');

    Route::middleware('recent-auth')->group(function () {
        Route::post('security/mfa/devices', [MfaSecurityController::class, 'beginDeviceEnrollment'])
            ->middleware('throttle:10,1')
            ->name('security.mfa.devices.begin');
        Route::delete('security/mfa/devices/{device}', [MfaSecurityController::class, 'revokeDevice'])
            ->name('security.mfa.devices.revoke');
        Route::post('security/mfa/totp', [MfaSecurityController::class, 'beginTotp'])
            ->middleware('throttle:10,1')
            ->name('security.mfa.totp.begin');
        Route::post('security/mfa/totp/confirm', [MfaSecurityController::class, 'confirmTotp'])
            ->middleware('throttle:20,1')
            ->name('security.mfa.totp.confirm');
        Route::post('security/mfa/recovery-codes', [MfaSecurityController::class, 'regenerateRecoveryCodes'])
            ->middleware('throttle:10,1')
            ->name('security.mfa.recovery-codes.regenerate');
        Route::post('security/mfa/default-method', [MfaSecurityController::class, 'setDefault'])
            ->name('security.mfa.default-method');
    });

    Route::post('security/mfa/recovery-codes/acknowledge', [MfaSecurityController::class, 'acknowledgeRecoveryCodes'])
        ->name('security.mfa.recovery-codes.acknowledge');

    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
