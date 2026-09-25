<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Services\UserWorkspace\UserPersonaResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserPersona
{
    public function __construct(private readonly UserPersonaResolver $resolver) {}

    public function handle(Request $request, Closure $next, string ...$allowed): Response
    {
        $user = $request->user();

        if (! $user || $user->role !== UserRole::User) {
            abort(403);
        }

        $persona = $this->resolver->resolve($user)->value;
        $normalized = array_map(static fn (string $value): string => strtolower(trim($value)), $allowed);

        if ($normalized !== [] && ! in_array($persona, $normalized, true)) {
            abort(403, 'This workspace is not available for your current user persona.');
        }

        return $next($request);
    }
}
