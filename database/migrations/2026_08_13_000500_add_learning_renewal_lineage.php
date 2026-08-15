<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_assignments', function (Blueprint $table) {
            $table->uuid('renewal_from_completion_id')->nullable()->after('migrated_from_assignment_id');
            $table->uuid('renewal_from_certificate_id')->nullable()->after('renewal_from_completion_id');
            $table->foreign('renewal_from_completion_id')->references('id')->on('learning_completions')->restrictOnDelete();
            $table->foreign('renewal_from_certificate_id')->references('id')->on('learning_certificates')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('learning_assignments', function (Blueprint $table) {
            $table->dropForeign(['renewal_from_completion_id']);
            $table->dropForeign(['renewal_from_certificate_id']);
            $table->dropColumn(['renewal_from_completion_id', 'renewal_from_certificate_id']);
        });
    }
};
