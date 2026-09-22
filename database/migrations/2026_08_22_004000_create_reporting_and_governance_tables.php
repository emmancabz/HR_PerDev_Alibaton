<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('setting_key')->unique();
            $table->json('value');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        Schema::create('system_setting_audits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('setting_key')->index();
            $table->json('old_value')->nullable();
            $table->json('new_value');
            $table->text('reason');
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('occurred_at')->index();
        });

        Schema::create('report_exports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('report_key')->index();
            $table->string('format', 16);
            $table->json('filters')->default('{}');
            $table->unsignedInteger('row_count')->default(0);
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('exported_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_exports');
        Schema::dropIfExists('system_setting_audits');
        Schema::dropIfExists('system_settings');
    }
};
