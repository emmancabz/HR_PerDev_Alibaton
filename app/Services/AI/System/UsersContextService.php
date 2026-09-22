<?php

namespace App\Services\AI\System;

use App\Models\User;
use App\Support\CanonicalWorkforceReference;
use Illuminate\Support\Collection;

class UsersContextService
{
    public function __construct(
        private readonly CanonicalWorkforceReference $workforceReference,
    ) {}

    /**
     * Authoritative User Management personnel snapshot.
     *
     * This intentionally follows the same population rules used by
     * UserManagementPageController:
     * - canonical personnel only
     * - exclude anonymized personnel
     * - exclude archived personnel
     * - exclude Incoming personnel from the active directory
     */
    public function users(): Collection
    {
        $personnel = User::query()
            ->canonicalPersonnel()
            ->with('manager:id,personnel_key,name,position,department')
            ->whereNull('anonymized_at')
            ->whereNull('archived_at')
            ->orderBy('name')
            ->get();

        return $personnel
            ->reject(
                fn (User $user): bool =>
                    $user->employment_status === 'Incoming'
            )
            ->map(function (User $user): array {
                $reference = $this->workforceReference->person(
                    $user->personnel_key
                );

                $reference = is_array($reference) ? $reference : [];

                return [
                    'databaseId' => $user->id,
                    'personnelKey' => (string) $user->personnel_key,
                    'corePersonId' => $user->core_person_id,
                    'employeeOrTraineeId' => $user->employee_or_trainee_id,

                    'name' => $user->name,
                    'email' => $user->email,

                    'position' =>
                        $user->position
                        ?: ($reference['position'] ?? 'Not recorded'),

                    'department' =>
                        $user->department
                        ?: ($reference['department'] ?? 'Not recorded'),

                    'role' => $user->role->label(),

                    'personType' =>
                        $user->person_type === 'Trainee'
                            ? 'Trainee'
                            : 'Employee',

                    'employmentStatus' =>
                        $reference['employment_stage']
                        ?? ($user->employment_status ?: 'Active Employee'),

                    'accountStatus' => $this->accountStatus($user),

                    'activationStatus' =>
                        $user->email_verified_at
                            ? 'Activated'
                            : 'Invitation Pending',

                    'mfaStatus' =>
                        $user->mfa_enabled_at
                            ? 'Enabled'
                            : 'Not Enrolled',

                    'evaluatorCapable' =>
                        (bool) $user->evaluator_capable,

                    'directManagerName' =>
                        $user->manager?->name
                        ?: ($reference['direct_manager'] ?? null)
                        ?: 'No direct supervisor recorded',
                ];
            })
            ->values();
    }

    /**
     * Deterministic summary used by Aevyn.
     * No LLM / Groq is involved.
     */
    public function summary(): array
    {
        $users = $this->users();

        $countBy = static function (
            Collection $users,
            string $field
        ): array {
            return $users
                ->countBy(
                    fn (array $user): string =>
                        (string) ($user[$field] ?? 'Unknown')
                )
                ->sortDesc()
                ->all();
        };

        return [
            'total' => $users->count(),

            'employees' => $users
                ->where('personType', 'Employee')
                ->count(),

            'trainees' => $users
                ->where('personType', 'Trainee')
                ->count(),

            'active' => $users
                ->where('accountStatus', 'Active')
                ->count(),

            'pendingActivation' => $users
                ->where('accountStatus', 'Pending Activation')
                ->count(),

            'suspended' => $users
                ->where('accountStatus', 'Suspended')
                ->count(),

            'inactive' => $users
                ->where('accountStatus', 'Inactive')
                ->count(),

            'admins' => $users
                ->where('role', 'Admin')
                ->count(),

            'hr' => $users
                ->where('role', 'HR')
                ->count(),

            'privileged' => $users
                ->filter(
                    fn (array $user): bool =>
                        in_array(
                            $user['role'],
                            ['Admin', 'HR'],
                            true
                        )
                )
                ->count(),

            'mfaEnabled' => $users
                ->where('mfaStatus', 'Enabled')
                ->count(),

            'mfaNotEnrolled' => $users
                ->where('mfaStatus', 'Not Enrolled')
                ->count(),

            'evaluatorCapable' => $users
                ->where('evaluatorCapable', true)
                ->count(),

            'byAccountStatus' => $countBy(
                $users,
                'accountStatus'
            ),

            'byPersonType' => $countBy(
                $users,
                'personType'
            ),

            'byRole' => $countBy(
                $users,
                'role'
            ),

            'byDepartment' => $countBy(
                $users,
                'department'
            ),
        ];
    }

    private function accountStatus(User $user): string
    {
        $accessStatus = (string) (
            $user->pnd_access_status ?: 'Active'
        );

        if ($accessStatus === 'Suspended') {
            return 'Suspended';
        }

        if (
            $accessStatus === 'Inactive'
            || $user->employment_status === 'Inactive'
        ) {
            return 'Inactive';
        }

        return $user->email_verified_at
            ? 'Active'
            : 'Pending Activation';
    }
}
