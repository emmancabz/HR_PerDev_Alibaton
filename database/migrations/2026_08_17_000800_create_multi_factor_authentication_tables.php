<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('mfa_enabled_at')->nullable()->after('remember_token');
            $table->string('mfa_default_method', 32)->nullable()->after('mfa_enabled_at');
            $table->text('totp_secret')->nullable()->after('mfa_default_method');
            $table->unsignedBigInteger('totp_last_counter')->nullable()->after('totp_secret');
        });

        Schema::create('mfa_trusted_devices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->char('token_hash', 64)->unique();
            $table->text('user_agent')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable()->index();
            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
        });

        Schema::create('mfa_login_challenges', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('number_code', 2);
            $table->string('status', 20)->default('pending')->index();
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->foreignId('approved_by_device_id')
                ->nullable()
                ->constrained('mfa_trusted_devices')
                ->nullOnDelete();
            $table->string('request_ip', 45)->nullable();
            $table->text('request_user_agent')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('denied_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('mfa_device_enrollments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->char('confirmation_code_hash', 64);
            $table->timestamp('expires_at')->index();
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });

        Schema::create('mfa_recovery_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('code_hash', 64)->unique();
            $table->timestamp('used_at')->nullable()->index();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'used_at']);
        });

        Schema::create('mfa_security_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type', 80)->index();
            $table->string('outcome', 24)->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mfa_security_events');
        Schema::dropIfExists('mfa_recovery_codes');
        Schema::dropIfExists('mfa_device_enrollments');
        Schema::dropIfExists('mfa_login_challenges');
        Schema::dropIfExists('mfa_trusted_devices');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'mfa_enabled_at',
                'mfa_default_method',
                'totp_secret',
                'totp_last_counter',
            ]);
        });
    }
};
