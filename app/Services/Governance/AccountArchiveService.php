<?php

namespace App\Services\Governance;

use App\Enums\UserRole;
use App\Models\SecurityAuditEvent;
use App\Models\User;
use App\Services\Security\SecurityAuditService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountArchiveService
{
    public function archive(User $actor, User $subject, string $reason, Request $request): void
    {
        $this->admin($actor);
        if ($actor->is($subject)) {
            throw ValidationException::withMessages(['account' => 'You cannot archive your own signed-in account.']);
        }
        if ($subject->archived_at) {
            throw ValidationException::withMessages(['account' => 'This account is already archived.']);
        }

        DB::transaction(function () use ($actor, $subject, $reason, $request): void {
            $retentionYears = (int) config('governance.archive.retention_years', 5);
            $subject->forceFill([
                'archived_at' => now(),
                'archived_by' => $actor->id,
                'archive_reason' => $reason,
                'archive_previous_employment_status' => $subject->employment_status,
                'retention_expires_at' => now()->addYears($retentionYears),
                'employment_status' => 'Inactive',
            ])->save();
            DB::table('sessions')->where('user_id', $subject->id)->delete();
            app(SecurityAuditService::class)->record($request, 'ACCOUNT_ARCHIVED', 'Success', $actor, [
                'subject_user_id' => $subject->id,
                'retention_years' => $retentionYears,
                'reason_hash' => hash('sha256', $reason),
            ]);
        });
    }

    public function restore(User $actor, User $subject, string $reason, Request $request): void
    {
        $this->admin($actor);
        if (! $subject->archived_at || $subject->anonymized_at) {
            throw ValidationException::withMessages(['account' => 'Only retained, non-anonymized accounts may be restored.']);
        }
        if ($subject->retention_expires_at && $subject->retention_expires_at->isPast()) {
            throw ValidationException::withMessages(['account' => 'Retention has already completed. Restore is no longer available; the retained identity must be deleted.']);
        }

        $subject->forceFill([
            'archived_at' => null,
            'archived_by' => null,
            'archive_reason' => null,
            'retention_expires_at' => null,
            'employment_status' => $subject->archive_previous_employment_status ?: ($subject->person_type === 'Trainee' ? 'Trainee' : 'Employee'),
            'archive_previous_employment_status' => null,
        ])->save();
        app(SecurityAuditService::class)->record($request, 'ACCOUNT_RESTORED', 'Success', $actor, [
            'subject_user_id' => $subject->id,
            'reason_hash' => hash('sha256', $reason),
        ]);
    }

    /**
     * Permanently removes the retained personal identity after the retention
     * deadline while keeping the de-identified row required by historical
     * performance, safety, learning, and reporting references.
     */
    public function deleteRetainedIdentity(User $actor, User $subject, string $reason, Request $request): void
    {
        $this->admin($actor);
        if (! $subject->archived_at || $subject->anonymized_at) {
            throw ValidationException::withMessages(['account' => 'Only archived identities that have not yet been deleted are eligible.']);
        }
        if (! $subject->retention_expires_at || $subject->retention_expires_at->isFuture()) {
            throw ValidationException::withMessages(['account' => 'The five-year retention period has not yet completed.']);
        }

        $subjectId = $subject->id;
        $this->anonymizeUser($subject, 'Retention completed; personal identity permanently deleted.');

        app(SecurityAuditService::class)->record($request, 'ACCOUNT_IDENTITY_DELETED', 'Success', $actor, [
            'subject_user_id' => $subjectId,
            'retention_years' => (int) config('governance.archive.retention_years', 5),
            'historical_metrics_preserved' => true,
            'reason_hash' => hash('sha256', $reason),
        ]);
    }

    public function anonymizeExpired(): int
    {
        $count = 0;
        User::query()
            ->whereNotNull('archived_at')
            ->whereNull('anonymized_at')
            ->where('retention_expires_at', '<=', now())
            ->each(function (User $user) use (&$count): void {
                DB::transaction(function () use ($user, &$count): void {
                    $original = ['name' => $user->name, 'personnel_key' => $user->personnel_key];
                    $this->anonymizeUser($user, 'Retention completed; identity automatically deleted.');
                    SecurityAuditEvent::query()->create([
                        'user_id' => $user->id,
                        'actor_snapshot' => ['name' => 'System Retention Job'],
                        'event_type' => 'ACCOUNT_IDENTITY_DELETED',
                        'outcome' => 'Success',
                        'severity' => 'Info',
                        'flagged' => false,
                        'metadata' => [
                            'retention_years' => (int) config('governance.archive.retention_years', 5),
                            'historical_metrics_preserved' => true,
                            'former_identity_reference' => hash('sha256', json_encode($original)),
                        ],
                        'occurred_at' => now(),
                    ]);
                    $count++;
                });
            });

        return $count;
    }

    private function anonymizeUser(User $user, string $reason): void
    {
        DB::transaction(function () use ($user, $reason): void {
            $token = Str::lower(Str::random(20));
            $user->forceFill([
                'name' => 'Anonymized Personnel',
                'email' => "anonymized-{$user->id}-{$token}@invalid.local",
                'password' => Hash::make(Str::random(64)),
                'profile_photo_path' => null,
                'profile_photo_updated_at' => null,
                'personnel_key' => null,
                'core_person_id' => null,
                'employee_or_trainee_id' => null,
                'mfa_notification_email' => null,
                'mfa_enabled_at' => null,
                'mfa_default_method' => null,
                'totp_secret' => null,
                'totp_last_counter' => null,
                'manager_id' => null,
                'evaluator_capable' => false,
                'archived_by' => null,
                'archive_reason' => $reason,
                'archive_previous_employment_status' => null,
                'anonymized_at' => now(),
            ])->save();

            DB::table('sessions')->where('user_id', $user->id)->delete();
        });
    }

    private function admin(User $actor): void
    {
        if ($actor->role !== UserRole::Admin) {
            throw new AuthorizationException('Only Admin may govern archived accounts.');
        }
    }
}
