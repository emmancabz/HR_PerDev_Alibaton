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
        $accounts = [
            [
                'name' => 'Admin User',
                'email' => 'admin@alibaton.com',
                'role' => UserRole::Admin,
            ],
            [
                'name' => 'HR User',
                'email' => 'hr@alibaton.com',
                'role' => UserRole::HR,
            ],
            [
                'name' => 'Driver User',
                'email' => 'user@alibaton.com',
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
    }
}