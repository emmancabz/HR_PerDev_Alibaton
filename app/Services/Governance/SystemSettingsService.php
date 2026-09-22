<?php

namespace App\Services\Governance;

use App\Enums\UserRole;
use App\Models\SecurityAuditEvent;
use App\Models\SecuritySessionActivity;
use App\Models\SystemSetting;
use App\Models\SystemSettingAudit;
use App\Models\User;
use App\Services\Notifications\NotificationPreferenceService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SystemSettingsService
{
    public function __construct(private readonly NotificationPreferenceService $notificationPreferences) {}

    public function state(User $actor, ?Request $request = null): array
    {
        $stored = SystemSetting::query()->get()->keyBy('setting_key');
        $allSettings = collect(config('governance.settings'))->mapWithKeys(function ($default, $key) use ($stored): array {
            $storedValue = $stored->get($key)?->value;
            return [$key => is_array($storedValue) ? ($storedValue['value'] ?? $default) : $default];
        })->all();

        $displayTimezone = (string) ($allSettings['organization.timezone'] ?? 'Asia/Manila');
        $todayStart = now($displayTimezone)->startOfDay()->utc();
        $todayEnd = now($displayTimezone)->endOfDay()->utc();

        $sensitiveAccess = [
            'organization_reporting' => $this->hasSensitiveAccess($request, 'organization_reporting'),
            'sign_in_protection' => $this->hasSensitiveAccess($request, 'sign_in_protection'),
            'security_logs' => $this->hasSensitiveAccess($request, 'security_logs'),
        ];

        $canViewSecurityLogs = $actor->role === UserRole::Admin && $sensitiveAccess['security_logs'];
        $securityEvents = $canViewSecurityLogs
            ? SecurityAuditEvent::query()->latest('occurred_at')->limit(500)->get()
            : collect();
        $securityActors = User::query()->whereKey($securityEvents->pluck('user_id')->filter()->all())->get()->keyBy('id');

        $lastMfaVerifiedAt = $request?->hasSession()
            ? (int) $request->session()->get('security.last_mfa_verified_at', 0)
            : 0;
        $stepUpMinutes = (int) config('governance.security.step_up_verification_minutes', 10);
        $recentMfaAvailable = $actor->mfa_enabled_at !== null
            && $lastMfaVerifiedAt > 0
            && now()->timestamp - $lastMfaVerifiedAt <= $stepUpMinutes * 60;

        return [
            'role' => $actor->role->value,
            'display_timezone' => $displayTimezone,
            'profile' => [
                'id' => (string) $actor->id,
                'name' => $actor->name,
                'email' => $actor->email,
                'role' => $actor->role->label(),
                'employee_id' => $actor->employee_or_trainee_id ?: 'Governance account',
                'position' => $actor->position ?: $actor->role->label(),
                'department' => $actor->department ?: 'Administration',
                'person_type' => $actor->person_type ?: 'Administrative account',
                'employment_status' => $actor->employment_status ?: 'Active',
                'profile_photo_url' => $actor->profile_photo_path ? Storage::disk('public')->url($actor->profile_photo_path) : null,
                'member_since' => $actor->created_at?->toIso8601String(),
            ],
            'can_manage_organization' => $actor->role === UserRole::Admin,
            'can_manage_reporting' => in_array($actor->role, [UserRole::Admin, UserRole::HR], true),
            'sensitive_access' => $sensitiveAccess,
            'sensitive_access_ttl_minutes' => $stepUpMinutes,
            'sensitive_access_remaining_seconds' => [
                'organization_reporting' => $this->remainingSensitiveAccessSeconds($request, 'organization_reporting'),
                'sign_in_protection' => $this->remainingSensitiveAccessSeconds($request, 'sign_in_protection'),
                'security_logs' => $this->remainingSensitiveAccessSeconds($request, 'security_logs'),
            ],
            'sensitive_access_expires_at' => [
                'organization_reporting' => $this->sensitiveAccessExpiresAt($request, 'organization_reporting'),
                'sign_in_protection' => $this->sensitiveAccessExpiresAt($request, 'sign_in_protection'),
                'security_logs' => $this->sensitiveAccessExpiresAt($request, 'security_logs'),
            ],
            'recent_mfa_available' => $recentMfaAvailable,
            'notification_preferences' => $this->notificationPreferences->for($actor),
            'settings' => $actor->role !== UserRole::User && $sensitiveAccess['organization_reporting'] ? $allSettings : [],
            'integrations' => $actor->role === UserRole::User ? [] : array_values(config('governance.integrations')),
            'security' => [
                'mfa_enabled' => $actor->mfa_enabled_at !== null,
                'mfa_method' => $actor->mfa_default_method ?: 'Not configured',
                'trusted_devices' => $actor->activeTrustedDevices()->count(),
                'recent_events' => $sensitiveAccess['sign_in_protection']
                    ? $actor->mfaSecurityEvents()->latest('created_at')->limit(5)->get()->map(fn ($event) => [
                        'id' => (string) $event->id,
                        'event' => $event->event_type,
                        'outcome' => $event->outcome,
                        'occurred_at' => $event->created_at?->toIso8601String(),
                    ])->all()
                    : [],
                'session_timeout_minutes' => (int) config('governance.security.session_timeout_minutes', 15),
            ],
            'security_metrics' => $canViewSecurityLogs ? [
                'total_logins_today' => SecurityAuditEvent::query()
                    ->where('event_type', 'LOGIN_SUCCESS')
                    ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                    ->count(),
                'active_sessions_now' => SecuritySessionActivity::query()
                    ->whereNull('timeout_logged_at')
                    ->where('expires_at', '>', now())
                    ->count(),
                'failed_login_attempts_today' => SecurityAuditEvent::query()
                    ->where('event_type', 'LOGIN_FAILED')
                    ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                    ->count(),
                'session_timeouts_today' => SecurityAuditEvent::query()
                    ->where('event_type', 'SESSION_TIMEOUT')
                    ->whereBetween('occurred_at', [$todayStart, $todayEnd])
                    ->count(),
            ] : [],
            'security_logs' => $securityEvents->map(fn (SecurityAuditEvent $event) => [
                'id' => (string) $event->id,
                'actor' => $securityActors->get($event->user_id)?->name ?? $event->actor_snapshot['label'] ?? 'Former or system account',
                'email' => $securityActors->get($event->user_id)?->email ?? null,
                'employee_id' => $securityActors->get($event->user_id)?->employee_or_trainee_id ?? ($event->actor_snapshot['employee_id'] ?? null),
                'role' => $securityActors->get($event->user_id)?->role->label() ?? ucfirst((string) ($event->actor_snapshot['role'] ?? 'Unknown')),
                'event_type' => $event->event_type,
                'outcome' => $event->outcome,
                'severity' => $event->severity,
                'flagged' => $event->flagged,
                'ip_address' => $event->ip_address,
                'device' => $this->deviceLabel($event->user_agent),
                'user_agent' => $event->user_agent,
                'route_name' => $event->route_name,
                'metadata' => $event->metadata,
                'occurred_at' => $event->occurred_at?->toIso8601String(),
            ])->all(),
            'access_matrix' => $actor->role === UserRole::User ? [] : [
                ['area' => 'Organization settings', 'admin' => 'Manage after re-verification', 'hr' => 'View after re-verification', 'user' => 'No access'],
                ['area' => 'Reporting defaults', 'admin' => 'Manage after re-verification', 'hr' => 'Manage after re-verification', 'user' => 'No access'],
                ['area' => 'Notification preferences', 'admin' => 'Own account', 'hr' => 'Own account', 'user' => 'Own account'],
                ['area' => 'Personal security', 'admin' => 'Own account', 'hr' => 'Own account', 'user' => 'Own account'],
                ['area' => 'Global security logs', 'admin' => 'Read-only after re-verification', 'hr' => 'No access', 'user' => 'No access'],
                ['area' => 'Archive & retention', 'admin' => 'Govern', 'hr' => 'No access', 'user' => 'No access'],
            ],
            'audits' => ($actor->role === UserRole::User ? collect() : SystemSettingAudit::query()->latest('occurred_at')->limit(30)->get())->map(fn (SystemSettingAudit $audit) => [
                'id' => $audit->id,
                'setting_key' => $audit->setting_key,
                'reason' => $audit->reason,
                'old_value' => $audit->old_value['value'] ?? null,
                'new_value' => $audit->new_value['value'] ?? null,
                'actor' => User::query()->whereKey($audit->actor_id)->value('name') ?? 'Former account',
                'occurred_at' => $audit->occurred_at?->toIso8601String(),
            ])->all(),
            'archive' => $actor->role === UserRole::Admin ? [
                'retention_years' => (int) config('governance.archive.retention_years', 5),
                'expiry_action' => (string) config('governance.archive.expiry_action', 'delete_identity'),
                'historical_analytics_preserved' => (bool) config('governance.archive.historical_analytics_preserved', true),
                'retained_accounts' => User::query()
                    ->whereNotNull('archived_at')
                    ->whereNull('anonymized_at')
                    ->where(function ($query): void {
                        $query->whereNull('retention_expires_at')->orWhere('retention_expires_at', '>', now());
                    })
                    ->orderByDesc('archived_at')
                    ->get()->map(fn (User $user) => $this->accountRow($user))->all(),
                'deletion_eligible_accounts' => User::query()
                    ->whereNotNull('archived_at')
                    ->whereNull('anonymized_at')
                    ->whereNotNull('retention_expires_at')
                    ->where('retention_expires_at', '<=', now())
                    ->orderBy('retention_expires_at')
                    ->get()->map(fn (User $user) => $this->accountRow($user))->all(),
                'anonymized_count' => User::query()->whereNotNull('anonymized_at')->count(),
            ] : [],
        ];
    }

    public function update(User $actor, array $values, string $reason, ?Request $request = null): array
    {
        $allowed = $actor->role === UserRole::Admin
            ? array_keys(config('governance.settings'))
            : ($actor->role === UserRole::HR ? ['reporting.default_period_days', 'reporting.filename_prefix'] : []);
        if ($allowed === []) {
            throw new AuthorizationException('You may manage only your own account security.');
        }

        foreach ($values as $key => $value) {
            if (! is_scalar($value)) {
                throw ValidationException::withMessages(['values' => "Invalid value for {$key}."]);
            }
            if ($key === 'reporting.default_period_days' && ((int) $value < 7 || (int) $value > 365)) {
                throw ValidationException::withMessages(['values.reporting.default_period_days' => 'Default report period must be between 7 and 365 days.']);
            }
            if ($key === 'organization.name' && (trim((string) $value) === '' || mb_strlen((string) $value) > 160)) {
                throw ValidationException::withMessages(['values.organization.name' => 'Organization name is required and may not exceed 160 characters.']);
            }
            if ($key === 'organization.timezone' && ! in_array((string) $value, timezone_identifiers_list(), true)) {
                throw ValidationException::withMessages(['values.organization.timezone' => 'Select a valid IANA timezone.']);
            }
            if ($key === 'organization.date_format' && ! in_array((string) $value, ['M d, Y', 'd M Y', 'Y-m-d'], true)) {
                throw ValidationException::withMessages(['values.organization.date_format' => 'Select an approved date format.']);
            }
            if ($key === 'reporting.filename_prefix' && ! preg_match('/^[a-z0-9][a-z0-9-]{1,48}$/i', (string) $value)) {
                throw ValidationException::withMessages(['values.reporting.filename_prefix' => 'Use 2–49 letters, numbers, or hyphens for the filename prefix.']);
            }
        }

        DB::transaction(function () use ($actor, $values, $reason, $allowed): void {
            foreach ($values as $key => $value) {
                if (! in_array($key, $allowed, true)) {
                    throw new AuthorizationException("You cannot change {$key}.");
                }
                $setting = SystemSetting::query()->firstOrNew(['setting_key' => $key]);
                $defaults = config('governance.settings');
                $old = $setting->exists ? $setting->value : ['value' => $defaults[$key] ?? null];
                if (($old['value'] ?? null) === $value) {
                    continue;
                }
                $setting->fill(['value' => ['value' => $value], 'updated_by' => $actor->id])->save();
                SystemSettingAudit::query()->create([
                    'setting_key' => $key,
                    'old_value' => $old,
                    'new_value' => ['value' => $value],
                    'reason' => $reason,
                    'actor_id' => $actor->id,
                    'occurred_at' => now(),
                ]);
            }
        });

        return $this->state($actor, $request);
    }

    public function hasSensitiveAccess(?Request $request, string $section): bool
    {
        if (! $request || ! $request->hasSession()) {
            return false;
        }

        $verifiedAt = (int) $request->session()->get("settings.sensitive_access.{$section}", 0);
        $ttlMinutes = (int) config('governance.security.step_up_verification_minutes', 10);

        return $verifiedAt > 0 && now()->timestamp - $verifiedAt <= $ttlMinutes * 60;
    }

    private function sensitiveAccessExpiresAt(?Request $request, string $section): int
    {
        if (! $request || ! $request->hasSession()) {
            return 0;
        }

        $verifiedAt = (int) $request->session()->get("settings.sensitive_access.{$section}", 0);
        if ($verifiedAt <= 0) {
            return 0;
        }

        return $verifiedAt + ((int) config('governance.security.step_up_verification_minutes', 10) * 60);
    }

    private function remainingSensitiveAccessSeconds(?Request $request, string $section): int
    {
        if (! $request || ! $request->hasSession()) {
            return 0;
        }

        $verifiedAt = (int) $request->session()->get("settings.sensitive_access.{$section}", 0);
        $ttlSeconds = (int) config('governance.security.step_up_verification_minutes', 10) * 60;

        if ($verifiedAt <= 0) {
            return 0;
        }

        return max(0, $ttlSeconds - (now()->timestamp - $verifiedAt));
    }

    private function accountRow(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->label(),
            'employee_id' => $user->employee_or_trainee_id ?: '—',
            'position' => $user->position ?: '—',
            'department' => $user->department ?: '—',
            'archived_at' => $user->archived_at?->toIso8601String(),
            'retention_expires_at' => $user->retention_expires_at?->toIso8601String(),
            'archive_reason' => $user->archive_reason,
            'anonymized_at' => $user->anonymized_at?->toIso8601String(),
        ];
    }

    private function deviceLabel(?string $userAgent): string
    {
        if (! $userAgent) {
            return 'Unknown device';
        }

        $browser = match (true) {
            str_contains($userAgent, 'Edg/') => 'Microsoft Edge',
            str_contains($userAgent, 'Chrome/') => 'Google Chrome',
            str_contains($userAgent, 'Firefox/') => 'Mozilla Firefox',
            str_contains($userAgent, 'Safari/') => 'Safari',
            default => 'Web browser',
        };

        $device = match (true) {
            str_contains($userAgent, 'Windows NT') => 'Windows PC',
            str_contains($userAgent, 'Android') => 'Android device',
            str_contains($userAgent, 'iPhone') => 'iPhone',
            str_contains($userAgent, 'iPad') => 'iPad',
            str_contains($userAgent, 'Macintosh') => 'Mac',
            str_contains($userAgent, 'Linux') => 'Linux device',
            default => 'Unknown device',
        };

        return "{$browser} · {$device}";
    }
}
