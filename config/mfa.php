<?php

$isLocal = env('APP_ENV', 'production') === 'local';

return [
    'challenge_ttl_seconds' => (int) env('MFA_CHALLENGE_TTL_SECONDS', 180),
    'pending_login_ttl_seconds' => (int) env('MFA_PENDING_LOGIN_TTL_SECONDS', 900),
    'resend_cooldown_seconds' => (int) env(
        'MFA_RESEND_COOLDOWN_SECONDS',
        $isLocal ? 2 : 30,
    ),
    'enrollment_ttl_minutes' => (int) env('MFA_ENROLLMENT_TTL_MINUTES', 10),
    // Legacy browser-trust approval is disabled by default. Passkeys are the
    // supported phishing-resistant device credential.
    'legacy_trusted_devices_enabled' => (bool) env('MFA_LEGACY_TRUSTED_DEVICES_ENABLED', false),
    'trusted_device_cookie' => env('MFA_TRUSTED_DEVICE_COOKIE', 'alibaton_mfa_device'),
    'trusted_device_cookie_minutes' => (int) env('MFA_TRUSTED_DEVICE_COOKIE_MINUTES', 525600),
    'recovery_code_count' => (int) env('MFA_RECOVERY_CODE_COUNT', 8),
    'issuer' => env('MFA_ISSUER', 'Alibaton Construction'),
    'approval_base_url' => env('MFA_APPROVAL_BASE_URL', env('APP_URL', 'http://localhost')),

    // Never ship real admin credentials or personal verification addresses as
    // source-code defaults. Configure these only through the environment.
    'admin_login_email' => env('ALIBATON_ADMIN_EMAIL', 'admin@alibaton-ph.com'),
    'admin_initial_password' => env('ALIBATON_ADMIN_PASSWORD'),
];
