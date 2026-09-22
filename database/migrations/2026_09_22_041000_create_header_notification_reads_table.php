<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('header_notification_reads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('notification_id', 120);
            $table->char('fingerprint', 64);
            $table->timestamp('read_at');
            $table->timestamps();

            $table->unique(['user_id', 'notification_id'], 'header_notification_reads_user_notification_unique');
            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('header_notification_reads');
    }
};
