<?php

namespace App\Http\Middleware;

use App\Models\SecurityAuditEvent;
use App\Models\SecuritySessionActivity;
use App\Models\User;
use App\Services\Security\SecurityAuditService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RecordSecurityActivity
{
    public function __construct(private readonly SecurityAuditService $audit) {}

    public function handle(Request $request, Closure $next): Response
    {
        $timeout = (int) config('governance.security.session_timeout_minutes', 15);
        $sessionHash = $this->browserSessionHash($request);

        if ($sessionHash) {
            $activity = SecuritySessionActivity::query()->where('session_hash', $sessionHash)->first();
            if ($activity && $activity->timeout_logged_at === null && $activity->last_seen_at->lte(now()->subMinutes($timeout))) {
                $user = User::query()->find($activity->user_id);
                $expiredAt = $activity->last_seen_at->addMinutes($timeout);
                $this->audit->record($request, 'SESSION_TIMEOUT', 'Expired', $user, ['inactivity_minutes' => $timeout], $expiredAt);
                $activity->forceFill(['timeout_logged_at' => $expiredAt, 'expires_at' => $expiredAt])->save();
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->with('status', "Your session ended after {$timeout} minutes of inactivity.");
            }
        }

        $response = $next($request);
        $user = $request->user();

        if ($user && $request->hasSession()) {
            $sessionHash = $this->browserSessionHash($request);

            if ($sessionHash === null) {
                return $response;
            }

            $sessionActivity = SecuritySessionActivity::query()->firstOrCreate(
                ['session_hash' => $sessionHash],
                ['user_id' => $user->id, 'first_seen_at' => now(), 'last_seen_at' => now(), 'expires_at' => now()->addMinutes($timeout)],
            );
            $sessionActivity->forceFill(['user_id' => $user->id, 'last_seen_at' => now(), 'expires_at' => now()->addMinutes($timeout), 'timeout_logged_at' => null])->save();

            $routeName = (string) $request->route()?->getName();
            if ($request->isMethod('GET') && $this->isModulePage($routeName)) {
                // SecurityAuditService intentionally hashes the current Laravel
                // session ID for audit correlation. Keep that separate from the
                // stable browser activity token used for inactivity enforcement.
                $auditSessionHash = hash('sha256', $request->session()->getId());
                $recent = SecurityAuditEvent::query()
                    ->where('user_id', $user->id)
                    ->where('session_hash', $auditSessionHash)
                    ->where('route_name', $routeName)
                    ->where('event_type', 'MODULE_ACCESS')
                    ->where('occurred_at', '>=', now()->subMinutes(2))
                    ->exists();
                if (! $recent) $this->audit->record($request, 'MODULE_ACCESS', 'Success', $user, ['module' => $this->moduleLabel($routeName)]);
            }
        }

        return $response;
    }

    private function browserSessionHash(Request $request): ?string
    {
        if (! $request->hasSession()) {
            return null;
        }

        $token = $request->session()->get('security.activity_token');

        if (! is_string($token) || strlen($token) < 64) {
            $token = Str::random(64);
            $request->session()->put('security.activity_token', $token);
        }

        return hash('sha256', $token);
    }

    private function isModulePage(string $routeName): bool
    {
        return $routeName === 'dashboard' || str_ends_with($routeName, '.index');
    }

    private function moduleLabel(string $routeName): string
    {
        $segments = explode('.', $routeName);
        return ucwords(str_replace('-', ' ', $segments[count($segments) - 2] ?? $segments[0]));
    }
}
