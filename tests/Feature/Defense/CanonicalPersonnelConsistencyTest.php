<?php

namespace Tests\Feature\Defense;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Learning\LearningCourseService;
use App\Services\Performance\PerformanceService;
use App\Services\Personnel\CanonicalPersonnelService;
use App\Services\Recognition\RecognitionService;
use App\Services\Succession\SuccessionService;
use App\Services\Training\TrainingService;
use Database\Seeders\CanonicalPersonnelSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CanonicalPersonnelConsistencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_module_resolves_identity_from_the_same_canonical_directory(): void
    {
        $this->seed(CanonicalPersonnelSeeder::class);

        $catalog = collect(config('personnel'));
        $directory = app(CanonicalPersonnelService::class)->active();
        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();

        $this->assertCount($catalog->count(), $directory);
        $this->assertEmpty($directory->pluck('id')->duplicates());
        $this->assertEmpty($directory->pluck('corePersonId')->duplicates());
        $this->assertEmpty($directory->pluck('employeeOrTraineeId')->duplicates());
        $this->assertEmpty($directory->pluck('email')->duplicates());

        foreach ($catalog as $expected) {
            $actual = $directory->firstWhere('id', $expected['personnel_key']);
            $this->assertNotNull($actual, "Missing {$expected['personnel_key']} from the canonical runtime directory.");
            $this->assertSame($expected['name'], $actual['fullName']);
            $this->assertSame($expected['position'], $actual['position']);
            $this->assertSame($expected['department'], $actual['department']);
        }

        $allKeys = $directory->pluck('id')->sort()->values()->all();
        $userKeys = $catalog->filter(fn (array $person) => $person['role'] === UserRole::User)
            ->pluck('personnel_key')->sort()->values()->all();
        $nonAdminKeys = $catalog->reject(fn (array $person) => $person['role'] === UserRole::Admin)
            ->pluck('personnel_key')->sort()->values()->all();

        $performance = app(PerformanceService::class)->state($admin);
        $learning = app(LearningCourseService::class)->state($admin);
        $training = app(TrainingService::class)->state($admin);
        $succession = app(SuccessionService::class)->state($admin);
        $recognition = app(RecognitionService::class)->state($admin);

        $this->assertSame($allKeys, collect($performance['personnel'])->pluck('id')->sort()->values()->all());
        $this->assertSame($userKeys, collect($learning['personnel'])->pluck('personnel_key')->sort()->values()->all());
        $this->assertSame($nonAdminKeys, collect($training['personnel'])->pluck('personnelKey')->sort()->values()->all());
        $this->assertSame($allKeys, collect($succession['personnel'])->pluck('personnelKey')->sort()->values()->all());
        $this->assertSame($allKeys, collect($recognition['personnel'])->pluck('personnelKey')->sort()->values()->all());
    }

    public function test_saved_reporting_relationships_use_canonical_manager_keys(): void
    {
        $this->seed(CanonicalPersonnelSeeder::class);

        foreach (collect(config('personnel'))->whereNotNull('manager_key') as $person) {
            $employee = User::query()->where('personnel_key', $person['personnel_key'])->firstOrFail();
            $this->assertSame($person['manager_key'], $employee->manager?->personnel_key);
        }
    }
}
