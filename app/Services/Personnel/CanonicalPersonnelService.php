<?php

namespace App\Services\Personnel;

use App\Models\User;
use Illuminate\Support\Collection;

class CanonicalPersonnelService
{
    public function active(): Collection
    {
        return User::query()
            ->activePersonnel()
            ->with('manager:id,personnel_key,name')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->personnel_key,
                'databaseId' => $user->id,
                'corePersonId' => $user->core_person_id,
                'employeeOrTraineeId' => $user->employee_or_trainee_id,
                'fullName' => $user->name,
                'email' => $user->email,
                'position' => $user->position,
                'department' => $user->department,
                'accessRole' => $user->role->value === 'admin' ? 'Admin' : ($user->role->value === 'hr' ? 'HR' : 'User'),
                'personType' => $user->person_type,
                'employmentStatus' => $user->employment_status,
                'evaluatorCapable' => (bool) $user->evaluator_capable,
                'managerPersonnelKey' => $user->manager?->personnel_key,
                'managerName' => $user->manager?->name,
                'accountStatus' => $user->employment_status === 'Inactive' ? 'Inactive' : 'Active',
                'createdAt' => $user->created_at?->toIso8601String(),
                'lastLogin' => null,
            ]);
    }
}
