<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActivePndAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) return $next($request);

        $employmentStatus = strtolower(trim((string) $user->employment_status));
        $pndAccessStatus = strtolower(trim((string) ($user->pnd_access_status ?: 'active')));

        $blocked = $user->archived_at !== null
            || $employmentStatus === 'inactive'
            || $pndAccessStatus !== 'active';

        if (! $blocked) return $next($request);

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->with('status', 'Your P&D access is currently unavailable. Contact the system administrator or HR if you need assistance.');
    }
}
