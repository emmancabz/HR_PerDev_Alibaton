<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Mail\MfaNumberMatchMail;
use App\Models\MfaLoginChallenge;
use App\Models\MfaRecoveryCode;
use App\Models\User;
use App\Services\Mfa\MfaService;
use App\Services\Mfa\TotpService;
use Database\Seeders\AdminAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class MfaAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private const SECURITY_EMAIL = 'security@example.test';

    public function test_standard_user_still_logs_in_normally(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::User->value,
        ]);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('user.dashboard'));
        $this->assertAuthenticatedAs($user);
    }

    public function test_privileged_hr_without_a_factor_is_not_authenticated_before_mfa_setup(): void
    {
        $hr = User::factory()->create([
            'role' => UserRole::HR->value,
            'mfa_notification_email' => null,
            'totp_secret' => null,
        ]);

        $response = $this->post('/login', [
            'email' => $hr->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('mfa.setup'));
        $response->assertSessionHas('mfa.pending_user_id', $hr->id);
        $this->assertGuest();
    }

    public function test_admin_without_authenticator_is_forced_to_setup_even_if_an_old_email_exists(): void
    {
        Mail::fake();

        $admin = User::factory()->create([
            'role' => UserRole::Admin->value,
            'mfa_notification_email' => self::SECURITY_EMAIL,
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'email_number_match',
            'totp_secret' => null,
        ]);

        $login = $this->post('/login', [
            'email' => $admin->email,
            'password' => 'password',
        ]);

        $login->assertRedirect(route('mfa.setup'));
        $login->assertSessionHas('mfa.pending_user_id', $admin->id);
        $this->assertGuest();
        Mail::assertNothingSent();
    }

    public function test_admin_with_authenticator_uses_totp_and_does_not_send_email(): void
    {
        Mail::fake();

        $totp = app(TotpService::class);
        $secret = $totp->generateSecret();
        $admin = User::factory()->create([
            'role' => UserRole::Admin->value,
            'mfa_notification_email' => self::SECURITY_EMAIL,
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'email_number_match',
            'totp_secret' => $secret,
        ]);

        $login = $this->post('/login', [
            'email' => $admin->email,
            'password' => 'password',
        ]);

        $login->assertRedirect(route('mfa.challenge'));
        $this->assertGuest();
        Mail::assertNothingSent();

        $challenge = MfaLoginChallenge::query()
            ->where('user_id', $admin->id)
            ->latest('id')
            ->firstOrFail();

        $response = $this->post(route('mfa.challenge.verify'), [
            'method' => 'totp',
            'code' => $totp->codeAt($secret, time()),
        ]);

        $response->assertRedirect(route('admin.dashboard'));
        $this->assertAuthenticatedAs($admin);
        $this->assertSame('consumed', $challenge->fresh()->status);
    }

    public function test_hr_email_number_match_creates_session_bound_challenge_and_sends_three_choices(): void
    {
        Mail::fake();

        $hr = User::factory()->create([
            'role' => UserRole::HR->value,
            'mfa_notification_email' => self::SECURITY_EMAIL,
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'email_number_match',
        ]);

        $login = $this->post('/login', [
            'email' => $hr->email,
            'password' => 'password',
        ]);

        $login->assertRedirect(route('mfa.challenge'));
        $this->assertGuest();

        $challenge = MfaLoginChallenge::query()
            ->where('user_id', $hr->id)
            ->latest('id')
            ->firstOrFail();

        $this->assertCount(3, $challenge->choice_codes);
        $this->assertCount(3, array_unique($challenge->choice_codes));
        $this->assertContains($challenge->number_code, $challenge->choice_codes);
        $this->assertMatchesRegularExpression('/^\d{2}$/', $challenge->number_code);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', (string) $challenge->request_session_hash);

        Mail::assertSent(
            MfaNumberMatchMail::class,
            fn (MfaNumberMatchMail $mail): bool => $mail->hasTo(self::SECURITY_EMAIL)
                && $mail->challenge->is($challenge),
        );
    }

    public function test_email_link_get_is_non_mutating_and_post_confirmation_approves_then_completes_login(): void
    {
        Mail::fake();
        $hr = User::factory()->create([
            'role' => UserRole::HR->value,
            'mfa_notification_email' => self::SECURITY_EMAIL,
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'email_number_match',
        ]);

        $this->post('/login', [
            'email' => $hr->email,
            'password' => 'password',
        ])->assertRedirect(route('mfa.challenge'));

        $challenge = MfaLoginChallenge::query()
            ->where('user_id', $hr->id)
            ->latest('id')
            ->firstOrFail();

        $reviewUrl = URL::temporarySignedRoute(
            'mfa.email.review',
            $challenge->expires_at,
            [
                'challenge' => $challenge->uuid,
                'choice' => $challenge->number_code,
            ],
            absolute: false,
        );

        // Link previews and email security scanners may issue GET requests.
        // Merely opening the link must never approve authentication.
        $this->get($reviewUrl)
            ->assertOk()
            ->assertSee('Confirm sign-in');
        $this->assertSame('pending', $challenge->fresh()->status);
        $this->assertGuest();

        $confirmUrl = URL::temporarySignedRoute(
            'mfa.email.confirm',
            $challenge->expires_at,
            [
                'challenge' => $challenge->uuid,
                'choice' => $challenge->number_code,
            ],
            absolute: false,
        );

        $this->post($confirmUrl)->assertOk();
        $this->assertSame('approved', $challenge->fresh()->status);
        $this->assertGuest();

        // Replaying the same confirmation cannot transition the challenge again.
        $this->post($confirmUrl)->assertOk();
        $this->assertSame('approved', $challenge->fresh()->status);

        $complete = $this->post(route('mfa.challenge.complete'));

        $complete->assertRedirect(route('hr.dashboard'));
        $this->assertAuthenticatedAs($hr);
        $this->assertSame('consumed', $challenge->fresh()->status);
        $this->assertNotEmpty(session('security.last_mfa_verified_at'));
    }

    public function test_wrong_email_number_requires_explicit_post_and_denies_the_pending_request(): void
    {
        Mail::fake();
        $hr = User::factory()->create([
            'role' => UserRole::HR->value,
            'mfa_notification_email' => self::SECURITY_EMAIL,
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'email_number_match',
        ]);

        $this->post('/login', [
            'email' => $hr->email,
            'password' => 'password',
        ])->assertRedirect(route('mfa.challenge'));

        $challenge = MfaLoginChallenge::query()
            ->where('user_id', $hr->id)
            ->latest('id')
            ->firstOrFail();

        $wrongChoice = collect($challenge->choice_codes)
            ->first(fn (string $choice): bool => $choice !== $challenge->number_code);

        $reviewUrl = URL::temporarySignedRoute(
            'mfa.email.review',
            $challenge->expires_at,
            [
                'challenge' => $challenge->uuid,
                'choice' => $wrongChoice,
            ],
            absolute: false,
        );

        $this->get($reviewUrl)->assertOk();
        $this->assertSame('pending', $challenge->fresh()->status);

        $confirmUrl = URL::temporarySignedRoute(
            'mfa.email.confirm',
            $challenge->expires_at,
            [
                'challenge' => $challenge->uuid,
                'choice' => $wrongChoice,
            ],
            absolute: false,
        );

        $this->post($confirmUrl)->assertOk();
        $this->assertSame('denied', $challenge->fresh()->status);
        $this->assertGuest();
    }

    public function test_email_contains_direct_non_mutating_deny_flow(): void
    {
        Mail::fake();
        $hr = User::factory()->create([
            'role' => UserRole::HR->value,
            'mfa_notification_email' => self::SECURITY_EMAIL,
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'email_number_match',
        ]);

        $this->post('/login', [
            'email' => $hr->email,
            'password' => 'password',
        ])->assertRedirect(route('mfa.challenge'));

        $challenge = MfaLoginChallenge::query()
            ->where('user_id', $hr->id)
            ->latest('id')
            ->firstOrFail();

        $reviewUrl = URL::temporarySignedRoute(
            'mfa.email.deny.review',
            $challenge->expires_at,
            ['challenge' => $challenge->uuid],
            absolute: false,
        );

        $this->get($reviewUrl)
            ->assertOk()
            ->assertSeeText("Wasn't you?");
        $this->assertSame('pending', $challenge->fresh()->status);

        $denyUrl = URL::temporarySignedRoute(
            'mfa.email.deny',
            $challenge->expires_at,
            ['challenge' => $challenge->uuid],
            absolute: false,
        );

        $this->post($denyUrl)->assertOk();
        $this->assertSame('denied', $challenge->fresh()->status);
        $this->assertGuest();
    }

    public function test_logout_returns_to_clean_login_without_logout_banner(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::User->value,
        ]);

        $this->actingAs($user)
            ->post(route('logout'))
            ->assertRedirect(route('login'))
            ->assertSessionMissing('status');

        $this->assertGuest();
    }

    public function test_recovery_code_is_one_time_and_can_complete_mfa(): void
    {
        Mail::fake();

        $admin = User::factory()->create([
            'role' => UserRole::Admin->value,
            'mfa_enabled_at' => now(),
            'mfa_default_method' => 'totp',
            'totp_secret' => app(TotpService::class)->generateSecret(),
        ]);

        $codes = app(MfaService::class)->generateRecoveryCodes($admin, request());
        $code = $codes[0];

        $this->post('/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->assertRedirect(route('mfa.challenge'));

        $response = $this->post(route('mfa.challenge.verify'), [
            'method' => 'recovery_code',
            'code' => $code,
        ]);

        $response->assertRedirect(route('admin.dashboard'));
        $this->assertAuthenticatedAs($admin);
        $this->assertSame(
            1,
            MfaRecoveryCode::query()
                ->where('user_id', $admin->id)
                ->whereNotNull('used_at')
                ->count(),
        );

        $this->post(route('logout'));

        $this->post('/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->assertRedirect(route('mfa.challenge'));

        $this->post(route('mfa.challenge.verify'), [
            'method' => 'recovery_code',
            'code' => $code,
        ])->assertSessionHasErrors('code');

        $this->assertGuest();
    }

    public function test_admin_access_seeder_requires_explicit_initial_secret_for_new_admin(): void
    {
        config([
            'mfa.admin_login_email' => 'admin@example.test',
            'mfa.admin_initial_password' => '',
        ]);

        $this->expectException(\RuntimeException::class);
        $this->seed(AdminAccessSeeder::class);
    }

    public function test_admin_access_seeder_creates_admin_from_explicit_environment_style_values(): void
    {
        config([
            'mfa.admin_login_email' => 'admin@example.test',
            'mfa.admin_initial_password' => 'TestAdmin!2026-OnlyForTests',
        ]);

        $this->seed(AdminAccessSeeder::class);

        $admin = User::query()->where('email', 'admin@example.test')->firstOrFail();

        $this->assertSame(UserRole::Admin, $admin->role);
        $this->assertSame('System Administrator', $admin->name);
        $this->assertNull($admin->mfa_notification_email);
        $this->assertNull($admin->mfa_default_method);
        $this->assertNull($admin->mfa_enabled_at);
        $this->assertTrue(Hash::check('TestAdmin!2026-OnlyForTests', $admin->password));
    }

    public function test_admin_access_seeder_does_not_reset_existing_admin_password_without_explicit_secret(): void
    {
        $admin = User::factory()->create([
            'email' => 'admin@example.test',
            'role' => UserRole::Admin->value,
            'password' => Hash::make('Existing-Unique-Password!42'),
        ]);

        config([
            'mfa.admin_login_email' => 'admin@example.test',
            'mfa.admin_initial_password' => '',
        ]);

        $this->seed(AdminAccessSeeder::class);

        $admin->refresh();
        $this->assertTrue(Hash::check('Existing-Unique-Password!42', $admin->password));
    }

    public function test_public_registration_routes_are_disabled(): void
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'name' => 'Unexpected User',
            'email' => 'unexpected@example.test',
            'password' => 'LongEnoughPassword123',
            'password_confirmation' => 'LongEnoughPassword123',
        ])->assertNotFound();

        $this->assertDatabaseMissing('users', ['email' => 'unexpected@example.test']);
    }

    public function test_password_reset_request_does_not_reveal_whether_account_exists(): void
    {
        Mail::fake();

        $existing = User::factory()->create(['email' => 'known@example.test']);

        $known = $this->post(route('password.email'), ['email' => $existing->email]);
        $unknown = $this->post(route('password.email'), ['email' => 'missing@example.test']);

        $known->assertSessionHas('status', 'If an active account matches that email, a reset link has been sent to its registered recovery email.');
        $unknown->assertSessionHas('status', 'If an active account matches that email, a reset link has been sent to its registered recovery email.');
    }

    public function test_password_change_revokes_other_database_sessions_and_pending_challenges(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('CurrentPassword123'),
        ]);

        DB::table('sessions')->insert([
            [
                'id' => 'other-session-id',
                'user_id' => $user->id,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Other browser',
                'payload' => base64_encode('test'),
                'last_activity' => now()->timestamp,
            ],
        ]);

        MfaLoginChallenge::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'user_id' => $user->id,
            'number_code' => '42',
            'choice_codes' => ['42', '13', '77'],
            'status' => 'pending',
            'request_session_hash' => hash('sha256', 'another-session'),
            'expires_at' => now()->addMinutes(3),
        ]);

        $response = $this->actingAs($user)->put(route('password.update'), [
            'current_password' => 'CurrentPassword123',
            'password' => 'NewSecurePassword456',
            'password_confirmation' => 'NewSecurePassword456',
        ]);

        $response->assertSessionHas('status');
        $this->assertDatabaseMissing('sessions', ['id' => 'other-session-id']);
        $this->assertSame('expired', MfaLoginChallenge::query()->latest('id')->value('status'));
        $this->assertTrue(Hash::check('NewSecurePassword456', $user->fresh()->password));
    }

    public function test_idle_timeout_logout_redirects_to_login_with_timeout_notice(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::User,
            'employment_status' => 'Employee',
            'pnd_access_status' => 'active',
        ]);

        $response = $this->actingAs($user)
            ->post(route('logout'), ['reason' => 'timeout']);

        $response
            ->assertRedirect(route('login', ['timeout' => 1]));

        $this->assertGuest();
        $this->assertDatabaseHas('security_audit_events', [
            'user_id' => $user->id,
            'event_type' => 'SESSION_TIMEOUT',
            'outcome' => 'Expired',
        ]);
    }

}
