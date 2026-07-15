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

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $accounts = [
            [
                'name' => 'Admin User',
                'email' => 'admin@alibaton.com',
                'role' => UserRole::Admin,
            ],
            [
                'name' => 'Manager User',
                'email' => 'manager@alibaton.com',
                'role' => UserRole::Manager,
            ],
            [
                'name' => 'Employee User',
                'email' => 'employee@alibaton.com',
                'role' => UserRole::Employee,
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
    }
}
