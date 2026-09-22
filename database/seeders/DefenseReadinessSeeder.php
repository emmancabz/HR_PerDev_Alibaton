<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use RuntimeException;

class DefenseReadinessSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Defense-readiness data is restricted to local and testing environments.');
        }

        config([
            'learning.operational_seed_enabled' => true,
            'training.operational_seed_enabled' => true,
            'succession.operational_seed_enabled' => true,
            'recognition.operational_seed_enabled' => true,
        ]);

        $this->call([
            CompetencyFrameworkSeeder::class,
            CompetencyShowcaseSeeder::class,
            PerformanceSeeder::class,
            LearningSeeder::class,
            TrainingSeeder::class,
            SuccessionSeeder::class,
            RecognitionSeeder::class,
            SecurityGovernanceSeeder::class,
        ]);
    }
}
