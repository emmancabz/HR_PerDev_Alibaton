<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetRecoveryNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $token,
        public readonly string $accountEmail,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = route('password.reset', [
            'token' => $this->token,
            'email' => $this->accountEmail,
        ]);

        $expires = (int) config('auth.passwords.users.expire', 60);

        return (new MailMessage())
            ->subject('Reset your Alibaton password')
            ->greeting('Password reset request')
            ->line('A password reset was requested for your Alibaton account.')
            ->action('Reset Password', $url)
            ->line("This reset link expires in {$expires} minutes.")
            ->line('If you did not request this reset, you can safely ignore this email.');
    }
}
