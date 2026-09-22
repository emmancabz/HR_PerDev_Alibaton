<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('profile_photo_path')->nullable()->after('email');
            $table->timestampTz('profile_photo_updated_at')->nullable()->after('profile_photo_path');
            $table->timestampTz('archived_at')->nullable()->index()->after('updated_at');
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->string('archive_previous_employment_status')->nullable();
            $table->timestampTz('retention_expires_at')->nullable()->index();
            $table->timestampTz('anonymized_at')->nullable()->index();
        });

        Schema::create('security_audit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('actor_snapshot')->default('{}');
            $table->string('event_type')->index();
            $table->string('outcome')->index();
            $table->string('severity')->default('Info')->index();
            $table->boolean('flagged')->default(false)->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('route_name')->nullable()->index();
            $table->char('session_hash', 64)->nullable()->index();
            $table->json('metadata')->default('{}');
            $table->timestampTz('occurred_at')->index();
        });

        Schema::create('security_session_activities', function (Blueprint $table) {
            $table->id();
            $table->char('session_hash', 64)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('first_seen_at');
            $table->timestampTz('last_seen_at')->index();
            $table->timestampTz('expires_at')->index();
            $table->timestampTz('timeout_logged_at')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_session_activities');
        Schema::dropIfExists('security_audit_events');
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('archived_by');
            $table->dropColumn(['profile_photo_path', 'profile_photo_updated_at', 'archived_at', 'archive_reason', 'archive_previous_employment_status', 'retention_expires_at', 'anonymized_at']);
        });
    }
};
