<?php

namespace App\Services\Learning;

use App\Models\Learning\LearningCourseVersion;
use App\Models\User;

class LearningEligibilityService
{
    public function __construct(private readonly LearningCatalogService $catalog) {}

    public function isActiveLearner(User $user): bool
    {
        return $user->isActivePersonnel();
    }

    public function matchesAudience(User $user, LearningCourseVersion $version): bool
    {
        if (! $this->isActiveLearner($user)) return false;
        $rules = $version->audience_rules ?? [];
        if (($types = $rules['personTypes'] ?? []) && ! in_array(trim((string) $user->person_type), $types, true)) return false;
        if (! ($rules['allDepartments'] ?? false) && ($departments = $rules['departments'] ?? []) && ! in_array(trim((string) $user->department), $departments, true)) return false;
        if (($positions = $rules['positions'] ?? []) && ! in_array(trim((string) $user->position), $positions, true)) return false;

        return $this->catalog->userMatchesProfiles($user, $rules['roleProfileIds'] ?? []);
    }
}
