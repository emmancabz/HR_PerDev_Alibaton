<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('mfa_notification_email')->nullable()->after('mfa_enabled_at');
        });

        Schema::table('mfa_login_challenges', function (Blueprint $table) {
            $table->json('choice_codes')->nullable()->after('number_code');
            $table->timestamp('notification_sent_at')->nullable()->after('expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('mfa_login_challenges', function (Blueprint $table) {
            $table->dropColumn(['choice_codes', 'notification_sent_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('mfa_notification_email');
        });
    }
};
