<?php

namespace App\Services\Learning;

use App\Models\User;
use App\Models\Competency\CompetencyDefinition;
use App\Models\Competency\RoleProfile;
use App\Services\Competency\CompetencyDomain;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class LearningCatalogService
{
    public function competencies(): array
    {
        if (!Schema::hasTable('competency_definitions') || !CompetencyDefinition::query()->exists()) return array_values(config('learning_catalog.competencies', []));
        return CompetencyDefinition::query()->where('status','Active')->get()->map(fn ($row)=>array_intersect_key($row->payload,array_flip(['id','version','code','name','category'])))->all();
    }
    public function roleProfiles(): array
    {
        if (!Schema::hasTable('competency_role_profiles') || !RoleProfile::query()->exists()) return array_values(config('learning_catalog.role_profiles', []));
        return RoleProfile::query()->where('status','Active')->get()->filter(fn ($row)=>$row->payload['effectiveDate'] <= now('Asia/Manila')->toDateString())->map(fn ($row)=>['id'=>$row->id,'name'=>$row->payload['name'],'position'=>$row->payload['position'],'department'=>$row->payload['department'],'personType'=>$row->payload['appliesTo'],'version'=>$row->version])->values()->all();
    }
    public function competency(string $id): ?array { foreach ($this->competencies() as $row) if ($row['id'] === $id) return $row; return null; }
    public function roleProfile(string $id): ?array { foreach ($this->roleProfiles() as $row) if ($row['id'] === $id) return $row; return null; }

    public function canonicalMappings(array $mappings): array
    {
        return collect($mappings)->map(function (array $mapping) {
            $record = $this->competency((string) ($mapping['id'] ?? ''));
            if (! $record) throw ValidationException::withMessages(['competencies' => 'Choose an active canonical Competency definition.']);
            return array_merge($mapping, ['version'=>(int) ($record['version'] ?? config('learning_catalog.competency_version', 1)), 'code'=>$record['code'], 'name'=>$record['name'], 'category'=>$record['category']]);
        })->values()->all();
    }

    public function validateRoleProfiles(array $ids): void
    {
        foreach (array_unique($ids) as $id) if (! $this->roleProfile((string) $id)) throw ValidationException::withMessages(['audience.roleProfileIds' => 'Choose only active canonical Role Profiles.']);
    }

    public function userMatchesProfiles(User $user, array $ids): bool
    {
        if ($ids === []) return true;
        foreach ($ids as $id) { $profile=$this->roleProfile((string) $id); if ($profile && CompetencyDomain::key($profile['position']) === CompetencyDomain::key((string)$user->position) && CompetencyDomain::key($profile['department']) === CompetencyDomain::key((string)$user->department) && ($profile['personType'] === 'Both' || CompetencyDomain::personType($profile['personType']) === CompetencyDomain::personType((string)$user->person_type))) return true; }
        return false;
    }
}
