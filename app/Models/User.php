<?php

namespace App\Models;

use App\Enums\UserRole;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Passkeys\Contracts\PasskeyUser;
use Laravel\Passkeys\PasskeyAuthenticatable;

#[Fillable([
    'personnel_key',
    'core_person_id',
    'employee_or_trainee_id',
    'name',
    'email',
    'profile_photo_path',
    'profile_photo_updated_at',
    'password',
    'role',
    'position',
    'department',
    'person_type',
    'employment_status',
    'pnd_access_status',
    'pnd_access_reason',
    'pnd_access_reference',
    'pnd_access_authorized_by',
    'pnd_access_changed_at',
    'pnd_access_changed_by',
    'evaluator_capable',
    'manager_id',
    'mfa_enabled_at',
    'mfa_notification_email',
    'password_recovery_email',
    'mfa_default_method',
    'notification_preferences',
    'totp_secret',
    'totp_last_counter',
    'archived_at',
    'archived_by',
    'archive_reason',
    'archive_previous_employment_status',
    'retention_expires_at',
    'anonymized_at',
])]
#[Hidden(['password', 'remember_token', 'totp_secret', 'password_recovery_email'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'evaluator_capable' => 'boolean',
            'mfa_enabled_at' => 'datetime',
            'notification_preferences' => 'array',
            'totp_secret' => 'encrypted',
            'totp_last_counter' => 'integer',
            'profile_photo_updated_at' => 'datetime',
            'archived_at' => 'datetime',
            'retention_expires_at' => 'datetime',
            'anonymized_at' => 'datetime',
            'pnd_access_changed_at' => 'datetime',
        ];
    }


    public function trustedDevices(): HasMany
    {
        return $this->hasMany(MfaTrustedDevice::class);
    }

    public function activeTrustedDevices(): HasMany
    {
        return $this->trustedDevices()->whereNull('revoked_at');
    }

    public function recoveryCodes(): HasMany
    {
        return $this->hasMany(MfaRecoveryCode::class);
    }

    public function mfaSecurityEvents(): HasMany
    {
        return $this->hasMany(MfaSecurityEvent::class);
    }

    public function hasTotp(): bool
    {
        return trim((string) $this->totp_secret) !== '';
    }

    public function passwordRecoveryDestination(): ?string
    {
        $registered = trim((string) $this->password_recovery_email);

        if ($registered !== '' && filter_var($registered, FILTER_VALIDATE_EMAIL)) {
            return $registered;
        }

        if ($this->role === UserRole::Admin) {
            $adminRecovery = trim((string) config('password_recovery.admin_email'));

            return $adminRecovery !== '' && filter_var($adminRecovery, FILTER_VALIDATE_EMAIL)
                ? $adminRecovery
                : null;
        }

        $accountEmail = trim((string) $this->email);

        return $accountEmail !== '' && filter_var($accountEmail, FILTER_VALIDATE_EMAIL)
            ? $accountEmail
            : null;
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }

    public function directReports(): HasMany
    {
        return $this->hasMany(self::class, 'manager_id');
    }

    public function isPerformanceOperator(): bool
    {
        return $this->role === UserRole::Admin || $this->role === UserRole::HR;
    }

    public function hasPersonnelIdentity(): bool
    {
        return trim((string) $this->personnel_key) !== '';
    }

    /**
     * Canonical personnel are users linked to the persistent personnel record.
     * Governance-only accounts intentionally do not satisfy this scope.
     */
    public function scopeCanonicalPersonnel(Builder $query): Builder
    {
        return $query->whereNotNull('personnel_key')
            ->whereRaw("TRIM(personnel_key) <> ''");
    }

    /**
     * HR persists lifecycle values such as Employee, Trainee, and Incoming.
     * Inactive is the sole non-active lifecycle value shared by the existing
     * Performance and Competency eligibility contracts.
     */
    public function scopeActivePersonnel(Builder $query): Builder
    {
        return $query->canonicalPersonnel()
            ->whereNull('archived_at')
            ->where(function (Builder $status): void {
                $status->whereNull('employment_status')
                    ->orWhere('employment_status', '!=', 'Inactive');
            })
            ->where(function (Builder $access): void {
                $access->whereNull('pnd_access_status')
                    ->orWhere('pnd_access_status', 'Active');
            });
    }

    public function isActivePersonnel(): bool
    {
        return $this->hasPersonnelIdentity()
            && $this->archived_at === null
            && $this->employment_status !== 'Inactive'
            && in_array((string) ($this->pnd_access_status ?: 'Active'), ['Active'], true);
    }

    public function archivedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'archived_by');
    }
}
