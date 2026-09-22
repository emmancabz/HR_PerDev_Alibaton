<?php

namespace Database\Seeders;

use App\Models\SecurityAuditEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class SecurityGovernanceSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Security governance demonstration data may only be seeded locally or during tests.');
        }

        $this->seedArchiveDefenseRecords();
        $this->seedSecurityLedger();
    }

    private function seedArchiveDefenseRecords(): void
    {
        $lastYear = now()->subYear()->setDate(now()->subYear()->year, 6, 18)->startOfDay();
        $terminated2023 = Carbon::create(2023, 11, 3, 9, 30, 0, config('app.timezone'));

        $records = [
            [
                'key' => 'archive-resigned-last-year',
                'employee_id' => 'EMP-0148',
                'name' => 'Marlon Reyes',
                'email' => 'marlon.reyes.archive@alibaton.test',
                'position' => 'Equipment Operator',
                'department' => 'Operations',
                'archived_at' => $lastYear,
                'reason' => 'Resigned from Alibaton Construction Inc. — voluntary separation.',
            ],
            [
                'key' => 'archive-terminated-2023',
                'employee_id' => 'EMP-0092',
                'name' => 'Teresa Navarro',
                'email' => 'teresa.navarro.archive@alibaton.test',
                'position' => 'Site Coordinator',
                'department' => 'Project Operations',
                'archived_at' => $terminated2023,
                'reason' => 'Employment terminated in 2023 — retained under the five-year records policy.',
            ],
            [
                'key' => 'retention-complete-01',
                'employee_id' => 'EMP-0031',
                'name' => 'Gilbert Aquino',
                'email' => 'gilbert.aquino.retained@alibaton.test',
                'position' => 'Driver',
                'department' => 'Fleet Operations',
                'archived_at' => now()->subYears(8)->subMonths(2)->startOfDay(),
                'reason' => 'Former employee record retained for the required period.',
            ],
            [
                'key' => 'retention-complete-02',
                'employee_id' => 'EMP-0047',
                'name' => 'Victor Manalo',
                'email' => 'victor.manalo.retained@alibaton.test',
                'position' => 'Warehouse Assistant',
                'department' => 'Logistics',
                'archived_at' => now()->subYears(7)->subMonths(5)->startOfDay(),
                'reason' => 'Former employee record retained for the required period.',
            ],
            [
                'key' => 'retention-complete-03',
                'employee_id' => 'EMP-0063',
                'name' => 'Liza Romero',
                'email' => 'liza.romero.retained@alibaton.test',
                'position' => 'Administrative Assistant',
                'department' => 'Administration',
                'archived_at' => now()->subYears(6)->subMonths(1)->startOfDay(),
                'reason' => 'Former employee record retained for the required period.',
            ],
        ];

        foreach ($records as $record) {
            $archivedAt = $record['archived_at'];
            User::query()->updateOrCreate(
                ['email' => $record['email']],
                [
                    'personnel_key' => $record['key'],
                    'core_person_id' => strtoupper(str_replace('-', '_', $record['key'])),
                    'employee_or_trainee_id' => $record['employee_id'],
                    'name' => $record['name'],
                    'password' => Hash::make('ArchiveOnly!2026'),
                    'role' => 'user',
                    'position' => $record['position'],
                    'department' => $record['department'],
                    'person_type' => 'Employee',
                    'employment_status' => 'Inactive',
                    'evaluator_capable' => false,
                    'archived_at' => $archivedAt,
                    'archived_by' => null,
                    'archive_reason' => $record['reason'],
                    'archive_previous_employment_status' => 'Employee',
                    'retention_expires_at' => $archivedAt->copy()->addYears(5),
                    'anonymized_at' => null,
                ],
            );
        }
    }

    private function seedSecurityLedger(): void
    {
        $userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
            'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
        ];

        User::query()->whereNull('archived_at')->orderBy('id')->limit(16)->get()->values()->each(function (User $user, int $index) use ($userAgents): void {
            $snapshot = [
                'role' => $user->role->value,
                'personnel_reference_hash' => $user->personnel_key ? hash('sha256', $user->personnel_key) : null,
            ];
            $module = $this->moduleFor($user, $index);
            $ip = '10.20.1.'.($index + 20);
            $agent = $userAgents[$index % count($userAgents)];
            $loginAt = now()->subMinutes(45 + ($index * 17));

            $this->event("login-{$user->id}", [
                'user_id' => $user->id,
                'actor_snapshot' => $snapshot,
                'event_type' => 'LOGIN_SUCCESS',
                'outcome' => 'Success',
                'severity' => 'Info',
                'flagged' => false,
                'ip_address' => $ip,
                'user_agent' => $agent,
                'route_name' => 'login',
                'metadata' => ['mfa' => $user->role->value !== 'user', 'dataset' => 'defense-readiness'],
                'occurred_at' => $loginAt,
            ]);

            $this->event("module-{$user->id}", [
                'user_id' => $user->id,
                'actor_snapshot' => $snapshot,
                'event_type' => 'MODULE_ACCESS',
                'outcome' => 'Success',
                'severity' => 'Info',
                'flagged' => false,
                'ip_address' => $ip,
                'user_agent' => $agent,
                'route_name' => $module[0],
                'metadata' => ['module' => $module[1], 'dataset' => 'defense-readiness'],
                'occurred_at' => $loginAt->copy()->addMinutes(3),
            ]);

            $exitType = $index % 5 === 0 ? 'SESSION_TIMEOUT' : 'LOGOUT';
            $this->event("exit-{$user->id}", [
                'user_id' => $user->id,
                'actor_snapshot' => $snapshot,
                'event_type' => $exitType,
                'outcome' => $exitType === 'SESSION_TIMEOUT' ? 'Expired' : 'Success',
                'severity' => 'Info',
                'flagged' => false,
                'ip_address' => $ip,
                'user_agent' => $agent,
                'route_name' => $exitType === 'SESSION_TIMEOUT' ? $module[0] : 'logout',
                'metadata' => $exitType === 'SESSION_TIMEOUT'
                    ? ['inactivity_minutes' => 15, 'dataset' => 'defense-readiness']
                    : ['dataset' => 'defense-readiness'],
                'occurred_at' => $loginAt->copy()->addMinutes(18 + ($index % 8)),
            ]);
        });

        foreach ([1, 2, 3] as $attempt) {
            $this->event("failed-demo-{$attempt}", [
                'user_id' => null,
                'actor_snapshot' => [
                    'label' => 'Unrecognized account',
                    'attempted_identifier_hash' => hash('sha256', 'unrecognized.account@alibaton.test'),
                ],
                'event_type' => 'LOGIN_FAILED',
                'outcome' => 'Failed',
                'severity' => $attempt === 3 ? 'Critical' : 'Warning',
                'flagged' => $attempt === 3,
                'ip_address' => '10.20.9.44',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
                'route_name' => 'login',
                'metadata' => ['failed_attempts_window' => $attempt, 'window_minutes' => 15, 'dataset' => 'defense-readiness'],
                'occurred_at' => now()->subMinutes(8 - $attempt),
            ]);
        }
    }

    private function event(string $key, array $attributes): void
    {
        SecurityAuditEvent::query()->firstOrCreate(['id' => $this->uuid($key)], $attributes);
    }

    private function moduleFor(User $user, int $index): array
    {
        if ($user->role->value === 'user') {
            return match ($index % 4) {
                0 => ['user.performance.index', 'Performance'],
                1 => ['user.learning.index', 'Learning'],
                2 => ['user.training.index', 'Training'],
                default => ['user.leaderboard.index', 'Recognition'],
            };
        }

        $prefix = $user->role->value === 'hr' ? 'hr' : 'admin';
        return match ($index % 6) {
            0 => ["{$prefix}.performance.index", 'Performance'],
            1 => ["{$prefix}.competency.index", 'Competency'],
            2 => ["{$prefix}.learning.index", 'Learning'],
            3 => ["{$prefix}.training.index", 'Training'],
            4 => ["{$prefix}.succession.index", 'Succession'],
            default => ["{$prefix}.recognition.index", 'Recognition'],
        };
    }

    private function uuid(string $value): string
    {
        $hex = md5('alibaton-security-'.$value);
        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-4'.substr($hex, 13, 3).'-a'.substr($hex, 17, 3).'-'.substr($hex, 20, 12);
    }
}
