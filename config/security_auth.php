<?php

$isLocal = env('APP_ENV', 'production') === 'local';

return [
    /*
    |--------------------------------------------------------------------------
    | Authentication rate limits
    |--------------------------------------------------------------------------
    |
    | Local development intentionally allows repeated sign-in / sign-out cycles
    | so the authentication flow can be tested without weakening production.
    | Only failed password attempts consume the password limiter.
    |
    */
    'login_max_failed_attempts' => (int) env(
        'AUTH_LOGIN_MAX_FAILED_ATTEMPTS',
        $isLocal ? 100 : 5,
    ),
    'login_decay_seconds' => (int) env(
        'AUTH_LOGIN_DECAY_SECONDS',
        $isLocal ? 60 : 900,
    ),

    'mfa_email_review_per_minute' => (int) env(
        'MFA_EMAIL_REVIEW_PER_MINUTE',
        $isLocal ? 300 : 60,
    ),
    'mfa_email_confirm_per_minute' => (int) env(
        'MFA_EMAIL_CONFIRM_PER_MINUTE',
        $isLocal ? 300 : 30,
    ),
    'mfa_status_per_minute' => (int) env(
        'MFA_STATUS_PER_MINUTE',
        $isLocal ? 600 : 120,
    ),
    'mfa_resend_per_minute' => (int) env(
        'MFA_RESEND_PER_MINUTE',
        $isLocal ? 60 : 5,
    ),
    'mfa_verify_per_minute' => (int) env(
        'MFA_VERIFY_PER_MINUTE',
        $isLocal ? 120 : 20,
    ),
];
