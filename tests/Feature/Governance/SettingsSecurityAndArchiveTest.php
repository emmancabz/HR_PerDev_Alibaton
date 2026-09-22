<?php

namespace Tests\Feature\Governance;

use App\Enums\UserRole;
use App\Models\SecurityAuditEvent;
use App\Models\SecuritySessionActivity;
use App\Models\User;
use App\Services\Governance\AccountArchiveService;
use App\Services\Governance\SystemSettingsService;
use App\Services\Security\SecurityAuditService;
use Database\Seeders\SecurityGovernanceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
use LogicException;
use Tests\TestCase;

class SettingsSecurityAndArchiveTest extends TestCase
{
    use RefreshDatabase;

    public function test_third_failed_login_is_flagged_in_the_immutable_ledger(): void
    {
        $request = Request::create('/login', 'POST', ['email' => 'unknown@alibaton.test']);
        $request->server->set('REMOTE_ADDR', '10.10.10.10');
        $audit = app(SecurityAuditService::class);

        $audit->record($request, 'LOGIN_FAILED', 'Failed');
        $audit->record($request, 'LOGIN_FAILED', 'Failed');
        $third = $audit->record($request, 'LOGIN_FAILED', 'Failed');

        $this->assertFalse(SecurityAuditEvent::query()->oldest('occurred_at')->firstOrFail()->flagged);
        $this->assertTrue($third->flagged);
        $this->assertSame('Critical', $third->severity);

        $this->expectException(LogicException::class);
        $third->update(['outcome' => 'Changed']);
    }

    public function test_retention_completed_account_can_delete_identity_but_preserves_deidentified_row(): void
    {
        $admin = $this->person('archive-admin', UserRole::Admin);
        $employee = $this->person('archive-subject', UserRole::User);
        $request = Request::create('/governance/api/settings/accounts/'.$employee->id.'/archive', 'POST');
        $request->setUserResolver(fn () => $admin);
        $service = app(AccountArchiveService::class);

        $service->archive($admin, $employee, 'Employment record moved to governed retention.', $request);
        $employee->refresh();
        $this->assertNotNull($employee->archived_at);
        $this->assertSame('Inactive', $employee->employment_status);

        $employee->forceFill(['retention_expires_at' => now()->subMinute()])->save();
        $service->deleteRetainedIdentity($admin, $employee, 'Approved retention-completed identity deletion.', $request);

        $employee->refresh();
        $this->assertNotNull($employee->anonymized_at);
        $this->assertNull($employee->personnel_key);
        $this->assertNull($employee->employee_or_trainee_id);
        $this->assertSame('Anonymized Personnel', $employee->name);
        $this->assertStringStartsWith('anonymized-', $employee->email);
        $this->assertDatabaseHas('users', ['id' => $employee->id]);
        $this->assertDatabaseHas('security_audit_events', [
            'event_type' => 'ACCOUNT_IDENTITY_DELETED',
            'outcome' => 'Success',
        ]);
    }

    public function test_archived_account_is_blocked_from_login(): void
    {
        $user = $this->person('blocked-user', UserRole::User);
        $user->forceFill([
            'password' => Hash::make('password'),
            'archived_at' => now(),
            'retention_expires_at' => now()->addYears(5),
        ])->save();

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertDatabaseHas('security_audit_events', [
            'user_id' => $user->id,
            'event_type' => 'LOGIN_BLOCKED_ARCHIVED',
            'outcome' => 'Blocked',
        ]);
    }

    public function test_sensitive_settings_data_is_withheld_until_step_up_access_is_granted(): void
    {
        $admin = $this->person('security-admin', UserRole::Admin);
        $hr = $this->person('security-hr', UserRole::HR);
        app(SecurityAuditService::class)->record(Request::create('/login', 'POST'), 'LOGIN_SUCCESS', 'Success', $hr);

        $request = $this->requestFor($admin);
        $lockedState = app(SystemSettingsService::class)->state($admin, $request);

        $this->assertSame([], $lockedState['security_logs']);
        $this->assertSame([], $lockedState['settings']);
        $this->assertFalse($lockedState['sensitive_access']['security_logs']);
        $this->assertFalse($lockedState['sensitive_access']['organization_reporting']);

        $request->session()->put([
            'settings.sensitive_access.security_logs' => now()->timestamp,
            'settings.sensitive_access.organization_reporting' => now()->timestamp,
        ]);
        $unlockedState = app(SystemSettingsService::class)->state($admin, $request);

        $this->assertNotEmpty($unlockedState['security_logs']);
        $this->assertNotEmpty($unlockedState['settings']);
        $this->assertTrue($unlockedState['sensitive_access']['security_logs']);
        $this->assertTrue($unlockedState['sensitive_access']['organization_reporting']);
        $this->assertGreaterThan(0, $unlockedState['sensitive_access_remaining_seconds']['security_logs']);
        $this->assertGreaterThan(now()->timestamp, $unlockedState['sensitive_access_expires_at']['security_logs']);
    }

    public function test_password_or_recent_mfa_can_unlock_a_sensitive_workspace(): void
    {
        $admin = $this->person('step-up-admin', UserRole::Admin);
        $admin->forceFill([
            'password' => Hash::make('CorrectPassword!2026'),
            'mfa_enabled_at' => now(),
        ])->save();

        $this->actingAs($admin)
            ->postJson('/governance/api/settings/unlock', [
                'section' => 'security_logs',
                'mode' => 'password',
                'password' => 'CorrectPassword!2026',
            ])
            ->assertOk()
            ->assertJsonPath('data.sensitive_access.security_logs', true)
            ->assertJson(fn ($json) => $json
                ->whereType('data.sensitive_access_remaining_seconds.security_logs', 'integer')
                ->whereType('data.sensitive_access_expires_at.security_logs', 'integer')
                ->etc()
            );

        $this->withSession(['security.last_mfa_verified_at' => now()->timestamp])
            ->actingAs($admin)
            ->postJson('/governance/api/settings/unlock', [
                'section' => 'sign_in_protection',
                'mode' => 'mfa',
            ])
            ->assertOk()
            ->assertJsonPath('data.sensitive_access.sign_in_protection', true);
    }

    public function test_inactivity_expiration_records_the_calculated_timeout_time(): void
    {
        $user = $this->person('timeout-user', UserRole::User);
        $this->actingAs($user)->get('/user/dashboard');

        $activity = SecuritySessionActivity::query()->firstOrFail();
        $timeoutMinutes = (int) config('governance.security.session_timeout_minutes', 5);
        $lastSeen = now()->subMinutes($timeoutMinutes + 1)->startOfSecond();
        $expectedTimeout = $lastSeen->copy()->addMinutes($timeoutMinutes);
        $activity->forceFill([
            'last_seen_at' => $lastSeen,
            'expires_at' => $expectedTimeout,
        ])->save();

        $this->get('/user/dashboard')->assertRedirect(route('login'));

        $event = SecurityAuditEvent::query()
            ->where('user_id', $user->id)
            ->where('event_type', 'SESSION_TIMEOUT')
            ->firstOrFail();
        $this->assertSame($expectedTimeout->timestamp, $event->occurred_at->timestamp);
    }

    public function test_defense_seed_creates_two_retained_and_three_deletion_eligible_accounts(): void
    {
        $admin = $this->person('seed-admin', UserRole::Admin);
        $this->seed(SecurityGovernanceSeeder::class);

        $state = app(SystemSettingsService::class)->state($admin, $this->requestFor($admin));
        $archive = $state['archive'];

        $this->assertCount(2, $archive['retained_accounts']);
        $this->assertCount(3, $archive['deletion_eligible_accounts']);
        $this->assertTrue(collect($archive['retained_accounts'])->contains(
            fn (array $row) => str_contains((string) $row['archive_reason'], 'Resigned')
        ));
        $this->assertTrue(collect($archive['retained_accounts'])->contains(
            fn (array $row) => str_contains((string) $row['archive_reason'], '2023')
        ));
    }

    public function test_settings_profile_endpoint_persists_normalized_account_details(): void
    {
        $admin = $this->person('profile-admin', UserRole::Admin);

        $this->actingAs($admin)
            ->patchJson('/governance/api/settings/profile', [
                'name' => '  Emmanuel Cabañas  ',
                'email' => '  EMMAN.SETTINGS@ALIBATON.TEST  ',
            ])
            ->assertOk()
            ->assertJsonPath('data.profile.name', 'Emmanuel Cabañas')
            ->assertJsonPath('data.profile.email', 'emman.settings@alibaton.test');

        $admin->refresh();
        $this->assertSame('Emmanuel Cabañas', $admin->name);
        $this->assertSame('emman.settings@alibaton.test', $admin->email);
        $this->assertNull($admin->email_verified_at);
        $this->assertDatabaseHas('security_audit_events', [
            'user_id' => $admin->id,
            'event_type' => 'PROFILE_UPDATED',
            'outcome' => 'Success',
        ]);
    }

    public function test_settings_profile_photo_upload_and_removal_are_persisted(): void
    {
        Storage::fake('public');
        $admin = $this->person('photo-admin', UserRole::Admin);

        $response = $this->actingAs($admin)
            ->post('/governance/api/settings/profile-photo', [
                'photo' => UploadedFile::fake()->image('profile.jpg', 600, 600)->size(900),
            ]);

        $response->assertOk();
        $admin->refresh();
        $this->assertNotNull($admin->profile_photo_path);
        Storage::disk('public')->assertExists($admin->profile_photo_path);

        $path = $admin->profile_photo_path;
        $this->actingAs($admin)
            ->deleteJson('/governance/api/settings/profile-photo')
            ->assertOk()
            ->assertJsonPath('data.profile.profile_photo_url', null);

        $admin->refresh();
        $this->assertNull($admin->profile_photo_path);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_notification_preferences_are_persisted_and_admin_security_alerts_remain_enabled(): void
    {
        $admin = $this->person('notification-admin', UserRole::Admin);

        $this->actingAs($admin)
            ->putJson('/governance/api/settings/notifications', [
                'preferences' => [
                    'performance_actions' => false,
                    'competency_actions' => true,
                    'learning_actions' => false,
                    'training_actions' => true,
                    'succession_actions' => false,
                    'recognition_actions' => true,
                    'security_alerts' => false,
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.notification_preferences.performance_actions', false)
            ->assertJsonPath('data.notification_preferences.learning_actions', false)
            ->assertJsonPath('data.notification_preferences.security_alerts', true);

        $admin->refresh();
        $this->assertFalse($admin->notification_preferences['performance_actions']);
        $this->assertTrue($admin->notification_preferences['security_alerts']);
        $this->assertDatabaseHas('security_audit_events', [
            'user_id' => $admin->id,
            'event_type' => 'NOTIFICATION_PREFERENCES_UPDATED',
            'outcome' => 'Success',
        ]);
    }

    public function test_legacy_profile_delete_request_is_refused(): void
    {
        $user = $this->person('no-delete-user', UserRole::User);
        $this->actingAs($user)->delete('/profile', ['password' => 'password'])
            ->assertSessionHasErrors('account')
            ->assertRedirect('/profile');
        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    private function requestFor(User $user): Request
    {
        $request = Request::create('/settings', 'GET');
        $request->setLaravelSession(app('session')->driver());
        $request->session()->start();
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function person(string $key, UserRole $role): User
    {
        return User::factory()->create([
            'personnel_key' => $key,
            'core_person_id' => strtoupper($key),
            'employee_or_trainee_id' => 'EMP-'.strtoupper(substr(md5($key), 0, 6)),
            'name' => ucwords(str_replace('-', ' ', $key)),
            'email' => "{$key}@alibaton.test",
            'role' => $role,
            'position' => $role->label(),
            'department' => $role === UserRole::HR ? 'Human Resources' : 'Administration',
            'person_type' => 'Employee',
            'employment_status' => 'Employee',
        ]);
    }
}
