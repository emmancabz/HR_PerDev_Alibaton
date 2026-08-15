<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('personnel_key')->nullable()->unique()->after('id');
            $table->string('core_person_id')->nullable()->unique()->after('personnel_key');
            $table->string('employee_or_trainee_id')->nullable()->unique()->after('core_person_id');
            $table->string('position')->nullable()->after('role');
            $table->string('department')->nullable()->index()->after('position');
            $table->string('person_type')->nullable()->index()->after('department');
            $table->string('employment_status')->default('Employee')->index()->after('person_type');
            $table->boolean('evaluator_capable')->default(false)->index()->after('employment_status');
            $table->foreignId('manager_id')->nullable()->after('evaluator_capable')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('manager_id');
            $table->dropColumn([
                'personnel_key',
                'core_person_id',
                'employee_or_trainee_id',
                'position',
                'department',
                'person_type',
                'employment_status',
                'evaluator_capable',
            ]);
        });
    }
};