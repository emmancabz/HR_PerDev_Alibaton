<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Security\SecurityAuditService;
use App\Support\CanonicalWorkforceReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserManagementStateController extends Controller
{
    public function __construct(
        private readonly SecurityAuditService $audit,
        private readonly CanonicalWorkforceReference $workforceReference,
    ) {}

    public function updateAccess(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        abort_unless(in_array($actor?->role, [UserRole::Admin, UserRole::HR], true), 403);
        abort_if($actor->role === UserRole::HR && $user->role === UserRole::Admin, 403);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['Active', 'Suspended', 'Inactive'])],
            'reason' => ['required', 'string', 'min:8', 'max:1000'],
            'reference' => ['nullable', 'string', 'max:120'],
            'authorizedBy' => ['nullable', 'string', 'max:160'],
            'securityEmergency' => ['sometimes', 'boolean'],
        ]);

        if ($user->archived_at || $user->anonymized_at) {
            throw ValidationException::withMessages(['account' => 'Archived or anonymized accounts cannot be changed through active-access controls.']);
        }
        if ($actor->is($user) && $validated['status'] !== 'Active') {
            throw ValidationException::withMessages(['account' => 'You cannot suspend or deactivate your own signed-in P&D operator account.']);
        }

        $previous = (string) ($user->pnd_access_status ?: 'Active');
        $next = (string) $validated['status'];

        DB::transaction(function () use ($request, $actor, $user, $validated, $previous, $next): void {
            $user->forceFill([
                'pnd_access_status' => $next,
                'pnd_access_reason' => $validated['reason'],
                'pnd_access_reference' => $validated['reference'] ?? null,
                'pnd_access_authorized_by' => $validated['authorizedBy'] ?? $actor->name,
                'pnd_access_changed_at' => now(),
                'pnd_access_changed_by' => $actor->id,
            ])->save();

            if ($next !== 'Active') {
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }

            $event = match ($next) {
                'Suspended' => 'ACCOUNT_ACCESS_SUSPENDED',
                'Inactive' => 'ACCOUNT_ACCESS_DEACTIVATED',
                default => 'ACCOUNT_ACCESS_RESTORED',
            };
            $this->audit->record($request, $event, 'Success', $actor, [
                'subject_user_id' => $user->id,
                'previous_status' => $previous,
                'new_status' => $next,
                'reference' => $validated['reference'] ?? null,
                'security_emergency' => (bool) ($validated['securityEmergency'] ?? false),
                'reason_hash' => hash('sha256', $validated['reason']),
            ]);
        });

        return response()->json(['data' => [
            'databaseId' => $user->id,
            'status' => $next,
            'changedAt' => $user->fresh()->pnd_access_changed_at?->toIso8601String(),
        ]]);
    }


    public function sendAccessLink(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        abort_unless(in_array($actor?->role, [UserRole::Admin, UserRole::HR], true), 403);
        abort_if($actor->role === UserRole::HR && $user->role === UserRole::Admin, 403);

        $validated = $request->validate([
            'purpose' => ['required', Rule::in(['account_setup', 'password_reset'])],
        ]);
        if ($user->archived_at || $user->anonymized_at) {
            throw ValidationException::withMessages(['account' => 'Archived or anonymized accounts cannot receive account-access emails.']);
        }

        $status = Password::sendResetLink(['email' => $user->email]);
        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        $this->audit->record($request, 'ACCOUNT_ACCESS_LINK_SENT', 'Success', $actor, [
            'subject_user_id' => $user->id,
            'purpose' => $validated['purpose'],
        ]);

        return response()->json(['data' => ['delivered' => true, 'purpose' => $validated['purpose']]]);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        abort_unless(in_array($actor?->role, [UserRole::Admin, UserRole::HR], true), 403);
        abort_if($actor->role === UserRole::HR && $user->role === UserRole::Admin, 403);

        $validated = $request->validate([
            'role' => ['required', Rule::in(array_map(fn (UserRole $role) => $role->value, UserRole::cases()))],
            'reason' => ['required', 'string', 'min:8', 'max:1000'],
        ]);
        $next = UserRole::from($validated['role']);
        $previous = $user->role;
        $reference = $this->workforceReference->person($user->personnel_key);
        $authorizedRole = is_array($reference) && isset($reference['role'])
            ? UserRole::tryFrom(strtolower((string) $reference['role']))
            : null;

        if (! $authorizedRole || $next !== $authorizedRole) {
            throw ValidationException::withMessages([
                'role' => 'P&D roles are governed by authorized personnel records. User Management cannot elevate or assign a role that does not match the canonical workforce record.',
            ]);
        }

        if ($user->archived_at || $user->anonymized_at) {
            throw ValidationException::withMessages(['account' => 'Archived or anonymized accounts cannot receive active role changes.']);
        }
        if ($actor->is($user) && $next !== UserRole::Admin) {
            throw ValidationException::withMessages(['role' => 'You cannot remove your own Administrator role while signed in.']);
        }
        if ($previous === $next) {
            return response()->json(['data' => ['databaseId' => $user->id, 'role' => $next->label()]]);
        }

        if ($previous === UserRole::Admin && $next !== UserRole::Admin) {
            $otherActiveAdmins = User::query()
                ->where('id', '!=', $user->id)
                ->where('role', UserRole::Admin->value)
                ->whereNull('archived_at')
                ->where('pnd_access_status', 'Active')
                ->count();
            if ($otherActiveAdmins < 1) {
                throw ValidationException::withMessages(['role' => 'At least one other active Administrator must remain.']);
            }
        }

        $user->forceFill(['role' => $next])->save();
        $this->audit->record($request, 'ACCOUNT_ROLE_CHANGED', 'Success', $actor, [
            'subject_user_id' => $user->id,
            'previous_role' => $previous->value,
            'new_role' => $next->value,
            'reason_hash' => hash('sha256', $validated['reason']),
        ]);

        return response()->json(['data' => ['databaseId' => $user->id, 'role' => $next->label()]]);
    }
}
