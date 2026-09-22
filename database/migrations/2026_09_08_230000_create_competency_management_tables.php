<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('competency_revisions', function (Blueprint $table) {
            $table->unsignedInteger('id')->primary();
            $table->unsignedBigInteger('revision')->default(0);
        });
        DB::table('competency_revisions')->insert(['id' => 1, 'revision' => 0]);
        foreach (['competency_definitions', 'competency_role_profiles', 'competency_cycles'] as $name) {
            Schema::create($name, function (Blueprint $table) use ($name) {
                $table->string('id', 160)->primary();
                $table->string('status', 40)->index();
                if ($name !== 'competency_cycles') {
                    $table->string('lineage_id', 160)->index();
                    $table->unsignedInteger('version');
                }
                $table->json('payload');
                $table->timestamps();
            });
        }
        Schema::create('competency_authorizations', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->foreignId('assessor_id')->constrained('users')->restrictOnDelete();
            $table->boolean('active')->default(true);
            $table->json('payload');
            $table->timestamps();
        });
        Schema::create('competency_assessments', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->foreignId('person_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('assessor_id')->constrained('users')->restrictOnDelete();
            $table->string('role_profile_id', 160);
            $table->foreign('role_profile_id')->references('id')->on('competency_role_profiles')->restrictOnDelete();
            $table->string('cycle_id', 160);
            $table->foreign('cycle_id')->references('id')->on('competency_cycles')->restrictOnDelete();
            $table->string('official_context', 64)->nullable()->unique();
            $table->string('status', 40)->index();
            $table->json('payload');
            $table->timestamps();
        });
        Schema::create('competency_finalizations', function (Blueprint $table) {
            $table->id();
            $table->string('assessment_id', 160);
            $table->foreign('assessment_id')->references('id')->on('competency_assessments')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->foreignId('finalized_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('finalized_at');
            $table->json('payload');
            $table->unique(['assessment_id', 'version']);
        });
        Schema::create('competency_recommendations', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->foreignId('person_id')->constrained('users')->restrictOnDelete();
            $table->string('source_assessment_id', 160);
            $table->foreign('source_assessment_id')->references('id')->on('competency_assessments')->restrictOnDelete();
            $table->string('competency_id', 160);
            $table->foreign('competency_id')->references('id')->on('competency_definitions')->restrictOnDelete();
            $table->string('status', 40)->index();
            $table->json('payload');
            $table->timestamps();
        });
        Schema::create('competency_acknowledgments', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->string('assessment_id', 160);
            $table->unsignedInteger('finalized_version');
            $table->foreign(['assessment_id', 'finalized_version'], 'competency_ack_finalization_fk')->references(['assessment_id', 'version'])->on('competency_finalizations')->restrictOnDelete();
            $table->foreignId('person_id')->constrained('users')->restrictOnDelete();
            $table->json('payload');
            $table->timestamps();
            $table->unique(['assessment_id', 'finalized_version']);
        });
        Schema::create('competency_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('entity_type', 60);
            $table->string('entity_id', 160);
            $table->string('action');
            $table->json('before')->nullable();
            $table->json('after');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['competency_audits', 'competency_acknowledgments', 'competency_recommendations', 'competency_finalizations', 'competency_assessments', 'competency_authorizations', 'competency_cycles', 'competency_role_profiles', 'competency_definitions', 'competency_revisions'] as $name) Schema::dropIfExists($name);
    }
};
