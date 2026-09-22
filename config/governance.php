<?php

return [
    'settings' => [
        'organization.name' => env('ORGANIZATION_NAME', 'Alibaton Construction Incorporated'),
        'organization.timezone' => env('ORGANIZATION_TIMEZONE', 'Asia/Manila'),
        'organization.date_format' => env('ORGANIZATION_DATE_FORMAT', 'M d, Y'),
        'reporting.default_period_days' => 90,
        'reporting.filename_prefix' => 'alibaton-pd',
    ],
    'integrations' => [
        'hr1' => [
            'label' => 'HR 1 · Core Human Capital Management',
            'status' => 'Configured',
            'ownership' => 'Canonical personnel identity and employment profile',
        ],
        'hr2' => [
            'label' => 'HR 2 · Workforce Management',
            'status' => 'Not Connected',
            'ownership' => 'Read-only attendance evidence; Training HR finalization remains authoritative',
            'contract_version' => '1.0',
        ],
    ],
    'security' => [
        'session_timeout_minutes' => (int) env('SECURITY_SESSION_TIMEOUT_MINUTES', 5),
        'failed_login_flag_threshold' => 3,
        'failed_login_window_minutes' => 15,
        'step_up_verification_minutes' => 10,
    ],
    'archive' => [
        'retention_years' => 5,
        'expiry_action' => 'delete_identity',
        'historical_analytics_preserved' => true,
    ],
];
