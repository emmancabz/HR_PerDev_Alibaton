<?php

namespace App\Services\Security;

use App\Models\SecurityAuditEvent;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;

class SecurityAuditService
{
    public function record(
        Request $request,
        string $eventType,
        string $outcome,
        ?User $user = null,
        array $metadata = [],
        ?CarbonInterface $occurredAt = null,
    ): SecurityAuditEvent {
        $windowMinutes = (int) config('governance.security.failed_login_window_minutes', 15);
        $threshold = (int) config('governance.security.failed_login_flag_threshold', 3);
        $failedLoginCount = $eventType === 'LOGIN_FAILED'
            ? SecurityAuditEvent::query()
                ->where('event_type', 'LOGIN_FAILED')
                ->where('ip_address', $request->ip())
                ->where('occurred_at', '>=', now()->subMinutes($windowMinutes))
                ->count() + 1
            : 0;
        $flagged = $eventType === 'LOGIN_FAILED' && $failedLoginCount >= $threshold;

        return SecurityAuditEvent::query()->create([
            'user_id' => $user?->id,
            'actor_snapshot' => $user
                ? [
                    'role' => $user->role->value,
                    'personnel_reference_hash' => $user->personnel_key ? hash('sha256', $user->personnel_key) : null,
                ]
                : [
                    'label' => 'Unrecognized account',
                    'attempted_identifier_hash' => hash('sha256', strtolower(trim((string) $request->input('email')))),
                ],
            'event_type' => $eventType,
            'outcome' => $outcome,
            'severity' => $flagged ? 'Critical' : ($outcome === 'Failed' ? 'Warning' : 'Info'),
            'flagged' => $flagged,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'route_name' => $request->route()?->getName(),
            'session_hash' => $request->hasSession() ? hash('sha256', $request->session()->getId()) : null,
            'metadata' => [
                ...$metadata,
                ...($failedLoginCount ? ['failed_attempts_window' => $failedLoginCount, 'window_minutes' => $windowMinutes] : []),
            ],
            'occurred_at' => $occurredAt ?? now(),
        ]);
    }
}
