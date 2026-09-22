<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call(AdminAccessSeeder::class);

        $accounts = [
            [
                'name' => 'HR User',
                'email' => 'hr@alibaton-ph.com',
                'role' => UserRole::HR,
            ],
            [
                'name' => 'Driver User',
                'email' => 'user@alibaton-ph.com',
                'role' => UserRole::User,
            ],
        ];

        foreach ($accounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => Hash::make('password'),
                    'role' => $account['role'],
                    'email_verified_at' => now(),
                ],
            );
        }

        if (config('defense.readiness_seed_enabled')) {
            $this->call(DefenseReadinessSeeder::class);
        } else {
            $this->call(PerformanceSeeder::class);
            if (config('learning.operational_seed_enabled')) $this->call(LearningSeeder::class);
            if (config('training.operational_seed_enabled')) $this->call(TrainingSeeder::class);
            if (config('succession.operational_seed_enabled')) $this->call(SuccessionSeeder::class);
            if (config('recognition.operational_seed_enabled')) $this->call(RecognitionSeeder::class);
        }
    }
}
