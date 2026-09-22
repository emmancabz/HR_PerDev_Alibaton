<?php

$isLocal = env('APP_ENV', 'production') === 'local';
$appUrl = rtrim((string) env('APP_URL', 'http://localhost'), '/');

return [
    'relying_party_id' => env(
        'PASSKEYS_RELYING_PARTY_ID',
        parse_url($appUrl, PHP_URL_HOST) ?: 'localhost',
    ),

    'allowed_origins' => array_values(array_filter(array_map(
        static fn (string $origin): string => trim($origin),
        explode(',', (string) env('PASSKEYS_ALLOWED_ORIGINS', $appUrl)),
    ))),

    'user_handle_secret' => env('PASSKEYS_USER_HANDLE_SECRET', env('APP_KEY')),
    'timeout' => (int) env('PASSKEYS_TIMEOUT', 60000),
    'guard' => 'web',
    'middleware' => ['web'],

    // Passkey creation/deletion is a sensitive security change. The custom
    // middleware accepts a recent password, MFA, or passkey authentication.
    'management_middleware' => ['recent-auth'],

    // Repeated local testing is intentionally relaxed. Production stays rate
    // limited even when a user repeatedly opens the passkey prompt.
    'throttle' => $isLocal ? null : 'throttle:10,1',

    // /dashboard already resolves the correct Admin / HR / User destination.
    'redirect' => '/dashboard',
];
