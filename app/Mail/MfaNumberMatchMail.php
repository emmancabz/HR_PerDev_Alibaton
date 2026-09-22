<?php

namespace App\Mail;

use App\Models\MfaLoginChallenge;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\URL;

class MfaNumberMatchMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $account,
        public readonly MfaLoginChallenge $challenge,
    ) {
    }

    public function envelope(): Envelope
    {
        $fromAddress = trim((string) config('mail.from.address'));

        return new Envelope(
            from: $fromAddress !== '' ? new Address($fromAddress, 'Alibaton Security') : null,
            subject: 'Alibaton sign-in request',
        );
    }

    public function content(): Content
    {
        $choices = collect($this->challenge->choice_codes ?? [])
            ->map(function (string $choice): array {
                // This link only opens a review page. Approval requires an
                // explicit POST confirmation so mail scanners cannot sign in.
                $relativeUrl = URL::temporarySignedRoute(
                    'mfa.email.review',
                    $this->challenge->expires_at,
                    [
                        'challenge' => $this->challenge->uuid,
                        'choice' => $choice,
                    ],
                    absolute: false,
                );

                return [
                    'value' => $choice,
                    'url' => rtrim((string) config('mfa.approval_base_url'), '/').$relativeUrl,
                ];
            })
            ->values()
            ->all();

        $denyRelativeUrl = URL::temporarySignedRoute(
            'mfa.email.deny.review',
            $this->challenge->expires_at,
            ['challenge' => $this->challenge->uuid],
            absolute: false,
        );
        $denyUrl = rtrim((string) config('mfa.approval_base_url'), '/').$denyRelativeUrl;

        return new Content(
            view: 'emails.mfa-number-match',
            with: [
                'accountName' => $this->account->name,
                'choices' => $choices,
                'denyUrl' => $denyUrl,
                'requestedAt' => $this->challenge->created_at->copy()->timezone('Asia/Manila'),
                'requestIp' => $this->challenge->request_ip,
                'expiresAt' => $this->challenge->expires_at->copy()->timezone('Asia/Manila'),
            ],
        );
    }
}
