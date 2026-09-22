<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('performance_goal_events')) {
            return;
        }

        Schema::create('performance_goal_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('performance_goal_id')->constrained('performance_goals')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 120)->index();
            $table->decimal('previous_progress', 5, 2)->nullable();
            $table->decimal('new_progress', 5, 2)->nullable();
            $table->string('previous_status', 80)->nullable();
            $table->string('new_status', 80)->nullable();
            $table->text('reason')->nullable();
            $table->string('reference', 255)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['performance_goal_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('performance_goal_events');
    }
};
