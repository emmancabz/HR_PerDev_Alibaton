<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use RuntimeException;

class RecognitionSuccessionDefenseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Recognition/Succession defense data is restricted to local/testing environments.');
        }

        $previousRecognition = config('recognition.operational_seed_enabled');
        $previousSuccession = config('succession.operational_seed_enabled');

        try {
            config()->set('recognition.operational_seed_enabled', true);
            config()->set('succession.operational_seed_enabled', true);

            $this->call([
                SuccessionSeeder::class,
                RecognitionSeeder::class,
            ]);
        } finally {
            config()->set('recognition.operational_seed_enabled', $previousRecognition);
            config()->set('succession.operational_seed_enabled', $previousSuccession);
        }
    }
}
