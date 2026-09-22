<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_course_source_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_version_id');
            $table->string('document_id', 160);
            $table->string('document_version', 80);
            $table->string('document_type', 120)->nullable();
            $table->string('title');
            $table->string('owner')->nullable();
            $table->string('filename')->nullable();
            $table->foreignId('selected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('selected_at');
            $table->timestampsTz();

            $table->foreign('course_version_id')
                ->references('id')->on('learning_course_versions')->cascadeOnDelete();
            $table->unique(['course_version_id', 'document_id', 'document_version'], 'learning_course_source_unique');
            $table->index(['document_id', 'document_version']);
        });

        Schema::create('learning_course_source_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_version_id')->index();
            $table->string('content_fingerprint', 64)->index();
            $table->string('status', 40)->index();
            $table->unsignedSmallInteger('coverage_percent')->default(0);
            $table->text('summary');
            $table->json('findings')->default('[]');
            $table->json('source_snapshot')->default('[]');
            $table->boolean('ai_used')->default(false);
            $table->string('model')->nullable();
            $table->foreignId('scanned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('scanned_at');
            $table->timestampsTz();

            $table->foreign('course_version_id')
                ->references('id')->on('learning_course_versions')->cascadeOnDelete();
        });

        Schema::create('learning_publication_deliveries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_version_id')->unique();
            $table->string('event_name', 120)->default('course.published');
            $table->string('status', 40)->default('Queued')->index();
            $table->unsignedInteger('target_count')->default(0);
            $table->json('payload');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestampTz('last_attempt_at')->nullable();
            $table->timestampTz('delivered_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->foreign('course_version_id')
                ->references('id')->on('learning_course_versions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_publication_deliveries');
        Schema::dropIfExists('learning_course_source_reviews');
        Schema::dropIfExists('learning_course_source_links');
    }
};
