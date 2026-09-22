<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\MfaLoginChallenge;
use App\Services\Mfa\MfaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\View\View;

class MfaEmailController extends Controller
{
    /**
     * Display an explicit confirmation screen. This GET endpoint never changes
     * authentication state, which prevents mail scanners / link previews from
     * accidentally approving a sign-in request.
     */
    public function review(
        Request $request,
        string $challenge,
        string $choice,
    ): View {
        $record = $this->pendingChallenge($challenge);

        if (! $record || ! $this->validChoice($record, $choice)) {
            return $this->result(
                false,
                'This sign-in request is no longer available. Start a new sign-in request on the original device.',
            );
        }

        $expiresAt = $record->expires_at;
        $confirmRelativeUrl = URL::temporarySignedRoute(
            'mfa.email.confirm',
            $expiresAt,
            ['challenge' => $record->uuid, 'choice' => $choice],
            absolute: false,
        );
        $denyRelativeUrl = URL::temporarySignedRoute(
            'mfa.email.deny',
            $expiresAt,
            ['challenge' => $record->uuid],
            absolute: false,
        );
        $baseUrl = rtrim((string) config('mfa.approval_base_url'), '/');

        return view('auth.mfa-email-review', [
            'accountName' => $record->user->name,
            'selectedChoice' => $choice,
            'requestedAt' => $record->created_at->copy()->timezone('Asia/Manila'),
            'requestIp' => $record->request_ip,
            'expiresAt' => $record->expires_at->copy()->timezone('Asia/Manila'),
            'confirmUrl' => $baseUrl.$confirmRelativeUrl,
            'denyUrl' => $baseUrl.$denyRelativeUrl,
        ]);
    }

    /**
     * Open a dedicated, non-mutating denial review directly from the email.
     * The actual denial remains POST-only so automated mail scanners cannot
     * cancel a legitimate sign-in just by following the link.
     */
    public function denyReview(
        Request $request,
        string $challenge,
    ): View {
        $record = $this->pendingChallenge($challenge);

        if (! $record) {
            return $this->result(
                false,
                'This sign-in request is already closed or expired.',
            );
        }

        $denyRelativeUrl = URL::temporarySignedRoute(
            'mfa.email.deny',
            $record->expires_at,
            ['challenge' => $record->uuid],
            absolute: false,
        );
        $baseUrl = rtrim((string) config('mfa.approval_base_url'), '/');

        return view('auth.mfa-email-deny-review', [
            'accountName' => $record->user->name,
            'requestedAt' => $record->created_at->copy()->timezone('Asia/Manila'),
            'requestIp' => $record->request_ip,
            'expiresAt' => $record->expires_at->copy()->timezone('Asia/Manila'),
            'denyUrl' => $baseUrl.$denyRelativeUrl,
        ]);
    }

    /**
     * Mutating approval is POST-only and is protected by both CSRF and a
     * short-lived signed URL.
     */
    public function confirm(
        Request $request,
        string $challenge,
        string $choice,
        MfaService $mfa,
    ): View {
        $record = $this->pendingChallenge($challenge);

        if (! $record || ! $this->validChoice($record, $choice)) {
            return $this->result(
                false,
                'This sign-in request is no longer available. Start a new sign-in request on the original device.',
            );
        }

        $approved = $mfa->approveByEmailChoice($record, $choice, $request);

        return $this->result(
            $approved,
            $approved
                ? 'Return to the device where you started signing in. It will open the system automatically.'
                : 'That number did not match the sign-in request. The request has been denied for your protection.',
        );
    }

    public function deny(
        Request $request,
        string $challenge,
        MfaService $mfa,
    ): View {
        $record = $this->pendingChallenge($challenge);

        if (! $record) {
            return $this->result(
                false,
                'This sign-in request is already closed or expired.',
            );
        }

        $mfa->denyByEmail($record, $request);

        return $this->result(
            false,
            'The sign-in request was denied. If this was not you, consider changing your password and reviewing recent sign-in activity.',
        );
    }

    private function pendingChallenge(string $uuid): ?MfaLoginChallenge
    {
        $record = MfaLoginChallenge::query()
            ->where('uuid', $uuid)
            ->with('user')
            ->first();

        if (! $record || $record->isExpired() || $record->status !== 'pending') {
            return null;
        }

        return $record;
    }

    private function validChoice(MfaLoginChallenge $record, string $choice): bool
    {
        if (! preg_match('/^\d{2}$/', $choice)) {
            return false;
        }

        return in_array($choice, array_map('strval', $record->choice_codes ?? []), true);
    }

    private function result(bool $approved, string $message): View
    {
        return view('auth.mfa-email-result', compact('approved', 'message'));
    }
}
