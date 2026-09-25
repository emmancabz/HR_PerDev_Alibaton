<?php

namespace App\Services\UserWorkspace;

use App\Enums\UserPersona;
use App\Models\User;

class UserPersonaResolver
{
    public function resolve(User $user): UserPersona
    {
        $personType = mb_strtolower(trim((string) $user->person_type));
        $position = mb_strtolower(trim((string) $user->position));

        if ($personType === 'trainee' || str_contains($personType, 'trainee')) {
            return UserPersona::Trainee;
        }

        if ($this->containsAny($position, ['manager', 'head', 'director'])) {
            return UserPersona::Manager;
        }

        if ($this->containsAny($position, ['supervisor', 'team lead', 'team leader', 'foreman'])) {
            return UserPersona::Supervisor;
        }

        return UserPersona::Employee;
    }

    private function containsAny(string $value, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($value !== '' && str_contains($value, $needle)) {
                return true;
            }
        }

        return false;
    }
}
