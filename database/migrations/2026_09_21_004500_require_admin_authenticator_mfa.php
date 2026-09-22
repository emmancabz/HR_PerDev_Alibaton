<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Remove the old shared/personal email destination from Admin accounts.
        // Admin password sign-in will require per-account TOTP enrollment.
        DB::table('users')
            ->where('role', 'admin')
            ->update(['mfa_notification_email' => null]);

        DB::table('users')
            ->where('role', 'admin')
            ->whereNotNull('totp_secret')
            ->update([
                'mfa_default_method' => 'totp',
                'mfa_enabled_at' => DB::raw('COALESCE(mfa_enabled_at, CURRENT_TIMESTAMP)'),
            ]);

        DB::table('users')
            ->where('role', 'admin')
            ->whereNull('totp_secret')
            ->update([
                'mfa_default_method' => null,
                'mfa_enabled_at' => null,
            ]);
    }

    public function down(): void
    {
        // The previous global Admin MFA mailbox is intentionally not restored.
        // Rolling back must not recreate or guess a personal verification address.
    }
};
