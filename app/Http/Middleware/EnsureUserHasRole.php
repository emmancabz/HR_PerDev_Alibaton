<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Restrict dashboard routes to users with the expected role.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        $expectedRole = UserRole::tryFrom($role);

        if (! $expectedRole || $user->role !== $expectedRole) {
            return $this->redirectToOwnedDashboard($user->role);
        }

        return $next($request);
    }

    protected function redirectToOwnedDashboard(UserRole $role): RedirectResponse
    {
        return redirect()->route($role->dashboardRouteName());
    }
}
