<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pnd_access_status')->default('Active')->index()->after('employment_status');
            $table->text('pnd_access_reason')->nullable()->after('pnd_access_status');
            $table->string('pnd_access_reference')->nullable()->after('pnd_access_reason');
            $table->string('pnd_access_authorized_by')->nullable()->after('pnd_access_reference');
            $table->timestampTz('pnd_access_changed_at')->nullable()->index()->after('pnd_access_authorized_by');
            $table->foreignId('pnd_access_changed_by')->nullable()->after('pnd_access_changed_at')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pnd_access_changed_by');
            $table->dropColumn([
                'pnd_access_status',
                'pnd_access_reason',
                'pnd_access_reference',
                'pnd_access_authorized_by',
                'pnd_access_changed_at',
            ]);
        });
    }
};
