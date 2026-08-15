<?php

namespace App\Services\Learning;

use App\Models\User;
use Illuminate\Validation\ValidationException;

class LearningCatalogService
{
    public function competencies(): array { return array_values(config('learning_catalog.competencies', [])); }
    public function roleProfiles(): array { return array_values(config('learning_catalog.role_profiles', [])); }
    public function competency(string $id): ?array { foreach ($this->competencies() as $row) if ($row['id'] === $id) return $row; return null; }
    public function roleProfile(string $id): ?array { foreach ($this->roleProfiles() as $row) if ($row['id'] === $id) return $row; return null; }

    public function canonicalMappings(array $mappings): array
    {
        return collect($mappings)->map(function (array $mapping) {
            $record = $this->competency((string) ($mapping['id'] ?? ''));
            if (! $record) throw ValidationException::withMessages(['competencies' => 'Choose an active canonical Competency definition.']);
            return array_merge($mapping, ['version'=>(int) config('learning_catalog.competency_version', 1), 'code'=>$record['code'], 'name'=>$record['name'], 'category'=>$record['category']]);
        })->values()->all();
    }

    public function validateRoleProfiles(array $ids): void
    {
        foreach (array_unique($ids) as $id) if (! $this->roleProfile((string) $id)) throw ValidationException::withMessages(['audience.roleProfileIds' => 'Choose only active canonical Role Profiles.']);
    }

    public function userMatchesProfiles(User $user, array $ids): bool
    {
        if ($ids === []) return true;
        foreach ($ids as $id) { $profile=$this->roleProfile((string) $id); if ($profile && $profile['position']===$user->position && $profile['department']===$user->department && $profile['personType']===$user->person_type) return true; }
        return false;
    }
}
