<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\Auth\PasswordResetRecoveryNotification;
use App\Services\Security\SecurityAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class PasswordResetLinkController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /**
     * Always return the same public response whether or not an account exists.
     * This prevents the reset endpoint from becoming an account-enumeration oracle.
     *
     * The account email remains the login identity, while delivery may use a
     * separately registered recovery mailbox. The recovery address is never
     * returned to the browser.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $loginEmail = strtolower(trim((string) $validated['email']));
        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$loginEmail])
            ->first();

        $status = Password::INVALID_USER;
        $deliveryStatus = 'not_delivered';

        if ($user && $this->isRecoveryEligible($user)) {
            $destination = $user->passwordRecoveryDestination();

            if ($destination !== null) {
                try {
                    $status = Password::broker()->sendResetLink(
                        ['email' => (string) $user->email],
                        function (User $brokerUser, string $token) use ($destination): void {
                            Notification::route('mail', $destination)
                                ->notify(new PasswordResetRecoveryNotification(
                                    $token,
                                    (string) $brokerUser->email,
                                ));
                        },
                    );

                    $deliveryStatus = $status === Password::RESET_LINK_SENT
                        ? 'accepted'
                        : 'not_delivered';
                } catch (Throwable $exception) {
                    report($exception);
                    $deliveryStatus = 'failed';
                }
            } else {
                $deliveryStatus = 'recovery_email_not_configured';
            }
        }

        app(SecurityAuditService::class)->record(
            $request,
            'PASSWORD_RESET_REQUESTED',
            'Success',
            $user,
            [
                'delivery_status' => $deliveryStatus,
                'delivery_channel' => 'registered_recovery_email',
            ],
        );

        return back()->with(
            'status',
            'If an active account matches that email, a reset link has been sent to its registered recovery email.',
        );
    }

    private function isRecoveryEligible(User $user): bool
    {
        return $user->archived_at === null
            && $user->employment_status !== 'Inactive'
            && in_array((string) ($user->pnd_access_status ?: 'Active'), ['Active'], true);
    }
}
