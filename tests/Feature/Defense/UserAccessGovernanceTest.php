<?php

namespace Tests\Feature\Defense;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\CanonicalPersonnelSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAccessGovernanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_access_restrictions_are_persisted_and_block_sign_in(): void
    {
        $this->seed(CanonicalPersonnelSeeder::class);
        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $subject = User::query()->where('personnel_key', 'user-5')->firstOrFail();

        $this->actingAs($admin)->patchJson(route('admin.users.access.update', $subject), [
            'status' => 'Suspended',
            'reason' => 'Authorized security review requires temporary P&D access suspension.',
            'reference' => 'SEC-DEFENSE-001',
            'authorizedBy' => $admin->name,
        ])->assertOk();

        $subject->refresh();
        $this->assertSame('Suspended', $subject->pnd_access_status);
        $this->assertFalse(User::query()->activePersonnel()->whereKey($subject->id)->exists());
        $this->assertNotNull($subject->pnd_access_changed_at);
        $this->assertSame($admin->id, $subject->pnd_access_changed_by);

        auth()->logout();
        $this->post('/login', [
            'email' => $subject->email,
            'password' => 'password',
        ])->assertSessionHasErrors('email');

        $this->actingAs($admin)->patchJson(route('admin.users.access.update', $subject), [
            'status' => 'Active',
            'reason' => 'Authorized security review completed and P&D access is restored.',
            'authorizedBy' => $admin->name,
        ])->assertOk();

        $this->assertSame('Active', $subject->fresh()->pnd_access_status);
        $this->assertTrue(User::query()->activePersonnel()->whereKey($subject->id)->exists());
    }

    public function test_role_changes_only_reconcile_to_the_authorized_canonical_role(): void
    {
        $this->seed(CanonicalPersonnelSeeder::class);
        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $ordinaryEmployee = User::query()->where('personnel_key', 'user-5')->firstOrFail();

        $this->actingAs($admin)->patchJson(route('admin.users.role.update', $ordinaryEmployee), [
            'role' => 'hr',
            'reason' => 'Attempted privilege elevation that is not supported by the authorized workforce record.',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertSame(UserRole::User, $ordinaryEmployee->fresh()->role);

        // Reconciliation remains possible when a stored role drifts from the approved canonical record.
        $hrPerson = User::query()->where('personnel_key', 'user-4')->firstOrFail();
        $hrPerson->forceFill(['role' => UserRole::User])->save();

        $this->actingAs($admin)->patchJson(route('admin.users.role.update', $hrPerson), [
            'role' => 'hr',
            'reason' => 'Reconcile the stored role to the approved canonical HR personnel record.',
        ])->assertOk();

        $this->assertSame(UserRole::HR, $hrPerson->fresh()->role);

        $ordinaryUser = User::query()->where('personnel_key', 'user-6')->firstOrFail();
        $this->actingAs($ordinaryUser)->patchJson(route('admin.users.role.update', $hrPerson), [
            'role' => 'hr',
            'reason' => 'Unauthorized reconciliation attempt should be rejected.',
        ])->assertForbidden();
    }
}
