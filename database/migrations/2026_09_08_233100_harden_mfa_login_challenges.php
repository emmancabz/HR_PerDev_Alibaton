<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('mfa_login_challenges', 'request_session_hash')) {
            Schema::table('mfa_login_challenges', function (Blueprint $table): void {
                $table->char('request_session_hash', 64)
                    ->nullable()
                    ->after('request_user_agent')
                    ->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('mfa_login_challenges', 'request_session_hash')) {
            Schema::table('mfa_login_challenges', function (Blueprint $table): void {
                $table->dropColumn('request_session_hash');
            });
        }
    }
};
