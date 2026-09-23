<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

$serviceRole = (string) env('SERVICE_ROLE', 'gateway');
$isGateway = $serviceRole === 'gateway';
$serviceRoute = $isGateway ? null : __DIR__.'/../routes/services/'.$serviceRole.'.php';

if (! $isGateway && ! is_file($serviceRoute)) {
    throw new RuntimeException("Unknown SERVICE_ROLE [{$serviceRole}].");
}

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: $isGateway ? __DIR__.'/../routes/web.php' : null,
        api: null,
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () use ($isGateway, $serviceRoute): void {
            if (! $isGateway) {
                \Illuminate\Support\Facades\Route::group([], $serviceRoute);
            }
        },
    )
    ->withMiddleware(function (Middleware $middleware) use ($isGateway): void {
        if ($isGateway) {
            $middleware->web(append: [
                \App\Http\Middleware\HandleInertiaRequests::class,
                \App\Http\Middleware\ApplySecurityHeaders::class,
                \App\Http\Middleware\RecordSecurityActivity::class,
                \App\Http\Middleware\EnsureActivePndAccess::class,
                \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            ]);
        }

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureUserHasRole::class,
            'recent-auth' => \App\Http\Middleware\EnsureRecentAuthentication::class,
            'internal.service' => \App\Http\Middleware\VerifyInternalServiceRequest::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) use ($isGateway): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => ! $isGateway || $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
