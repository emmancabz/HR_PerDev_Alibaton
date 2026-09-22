<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_course_versions', function (Blueprint $table) {
            $table->unsignedTinyInteger('builder_stage')->default(0)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('learning_course_versions', function (Blueprint $table) {
            $table->dropColumn('builder_stage');
        });
    }
};
