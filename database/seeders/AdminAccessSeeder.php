<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class AdminAccessSeeder extends Seeder
{
    public function run(): void
    {
        $loginEmail = trim((string) config('mfa.admin_login_email'));
        $initialPassword = (string) config('mfa.admin_initial_password');
        $recoveryEmail = trim((string) config('password_recovery.admin_email'));

        if ($loginEmail === '') {
            throw new RuntimeException('ALIBATON_ADMIN_EMAIL must be configured before seeding the administrator.');
        }

        $admin = User::query()->where('email', $loginEmail)->first()
            ?? User::query()->where('email', 'admin@alibaton.com')->first()
            ?? User::query()
                ->where('role', UserRole::Admin->value)
                ->whereNull('personnel_key')
                ->orderBy('id')
                ->first();

        if (! $admin && trim($initialPassword) === '') {
            throw new RuntimeException(
                'ALIBATON_ADMIN_PASSWORD must be set when creating the initial administrator. Existing administrator passwords are never reset when the variable is absent.',
            );
        }

        $admin ??= new User();

        $attributes = [
            'name' => $admin->exists ? $admin->name : 'System Administrator',
            'email' => $loginEmail,
            'role' => UserRole::Admin,
            'email_verified_at' => $admin->email_verified_at ?? now(),
            // Admin password sign-in is enrolled into a per-account authenticator
            // during first login. Do not seed a shared/personal MFA mailbox.
            'mfa_notification_email' => null,
            'password_recovery_email' => $recoveryEmail !== '' ? $recoveryEmail : $admin->password_recovery_email,
            'mfa_enabled_at' => $admin->hasTotp() ? ($admin->mfa_enabled_at ?? now()) : null,
            'mfa_default_method' => $admin->hasTotp() ? 'totp' : null,
        ];

        // An existing password is deliberately preserved unless an explicit
        // environment value is provided. Running seeders must never silently
        // reset a privileged account to a source-code password.
        if (! $admin->exists || trim($initialPassword) !== '') {
            $attributes['password'] = Hash::make($initialPassword);
        }

        $admin->forceFill($attributes)->save();
    }
}
