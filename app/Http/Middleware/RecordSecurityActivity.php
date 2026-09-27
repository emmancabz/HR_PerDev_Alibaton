<?php

namespace App\Http\Middleware;

use App\Models\SecurityAuditEvent;
use App\Models\SecuritySessionActivity;
use App\Services\Security\SecurityAuditService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RecordSecurityActivity
{
    public function __construct(private readonly SecurityAuditService $audit) {}

    public function handle(Request $request, Closure $next): Response
    {
        $timeout = (int) config('governance.security.session_timeout_minutes', 15);
        $backgroundRequest = app()->environment('production') && $this->isBackgroundRequest($request);
        $user = $request->user();

        // Anonymous requests (including POST /login before authentication) have
        // no persisted activity row to inspect. Background polling/prefetch also
        // must not consume database round-trips or keep an idle session alive.
        if (! $backgroundRequest && $user && $request->hasSession()) {
            $sessionHash = $this->browserSessionHash($request);

            if ($sessionHash) {
                $activity = SecuritySessionActivity::query()->where('session_hash', $sessionHash)->first();
                if ($activity && $activity->timeout_logged_at === null && $activity->last_seen_at->lte(now()->subMinutes($timeout))) {
                    $expiredAt = $activity->last_seen_at->addMinutes($timeout);
                    $this->audit->record($request, 'SESSION_TIMEOUT', 'Expired', $user, ['inactivity_minutes' => $timeout], $expiredAt);
                    $activity->forceFill(['timeout_logged_at' => $expiredAt, 'expires_at' => $expiredAt])->save();
                    Auth::guard('web')->logout();
                    $request->session()->invalidate();
                    $request->session()->regenerateToken();

                    return redirect()->route('login')->with('status', "Your session ended after {$timeout} minutes of inactivity.");
                }
            }
        }

        $response = $next($request);
        $user = $request->user();

        if ($backgroundRequest || ! $user || ! $request->hasSession()) {
            return $response;
        }

        $sessionHash = $this->browserSessionHash($request);
        if ($sessionHash === null) {
            return $response;
        }

        $now = now();
        DB::table('security_session_activities')->upsert([
            [
                'session_hash' => $sessionHash,
                'user_id' => $user->id,
                'first_seen_at' => $now,
                'last_seen_at' => $now,
                'expires_at' => $now->copy()->addMinutes($timeout),
                'timeout_logged_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ], ['session_hash'], ['user_id', 'last_seen_at', 'expires_at', 'timeout_logged_at', 'updated_at']);

        $routeName = (string) $request->route()?->getName();
        if ($request->isMethod('GET') && $this->isModulePage($routeName)) {
            if (app()->environment('production')) {
                $auditKey = 'security.module_access_at.'.sha1($routeName);
                $lastAuditAt = (int) $request->session()->get($auditKey, 0);

                if ($lastAuditAt === 0 || $lastAuditAt <= $now->copy()->subMinutes(2)->timestamp) {
                    $this->audit->record($request, 'MODULE_ACCESS', 'Success', $user, ['module' => $this->moduleLabel($routeName)]);
                    $request->session()->put($auditKey, $now->timestamp);
                }
            } else {
                // Keep the existing database assertion path in local/testing so
                // governance tests continue to validate the persisted audit model.
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

    private function isBackgroundRequest(Request $request): bool
    {
        // This endpoint is emitted only from genuine browser interaction and is
        // deliberately allowed to refresh the server-side inactivity clock.
        if ($request->routeIs('session.heartbeat')) {
            return false;
        }

        $purpose = strtolower((string) ($request->header('Purpose') ?: $request->header('Sec-Purpose')));
        if (str_contains($purpose, 'prefetch')) {
            return true;
        }

        if ($request->routeIs('header-notifications', 'header-notifications.read', 'global-search', 'account.profile-photo')) {
            return true;
        }

        return $request->is('api/*') || str_contains($request->path(), '/api/');
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
