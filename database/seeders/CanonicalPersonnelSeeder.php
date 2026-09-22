<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class CanonicalPersonnelSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = collect(config('personnel'));

        if ($catalog->isEmpty() || $catalog->pluck('personnel_key')->duplicates()->isNotEmpty()
            || $catalog->pluck('core_person_id')->duplicates()->isNotEmpty()
            || $catalog->pluck('employee_or_trainee_id')->duplicates()->isNotEmpty()
            || $catalog->pluck('email')->duplicates()->isNotEmpty()) {
            throw new RuntimeException('Canonical personnel catalog is empty or contains duplicate identity fields.');
        }

        foreach ($catalog as $person) {
            $user = User::query()->firstOrNew(['personnel_key' => $person['personnel_key']]);
            $user->fill([
                'core_person_id' => $person['core_person_id'],
                'employee_or_trainee_id' => $person['employee_or_trainee_id'],
                'name' => $person['name'],
                'email' => $person['email'],
                'role' => $person['role'],
                'position' => $person['position'],
                'department' => $person['department'],
                'person_type' => $person['person_type'],
                'employment_status' => $person['employment_status'],
                'evaluator_capable' => $person['evaluator_capable'],
            ]);
            $user->email_verified_at ??= now();
            if (! $user->exists) {
                $user->password = Hash::make('password');
            }
            $user->save();
        }

        $users = User::query()->canonicalPersonnel()->get()->keyBy('personnel_key');
        foreach ($catalog as $person) {
            $user = $users->get($person['personnel_key']);
            $manager = $person['manager_key'] ? $users->get($person['manager_key']) : null;
            $user?->forceFill(['manager_id' => $manager?->id])->save();
        }
    }
}
