<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Module-based microservices
    |--------------------------------------------------------------------------
    | The manuscript defines six business-capability services. Admin, HR, and
    | User remain RBAC roles in the gateway and are not separate services.
    |
    | SERVICE_ROLE=gateway keeps the React/Inertia shell, authentication, MFA,
    | user management, reports, settings, notifications, and AI orchestration.
    | A domain service runtime loads only its own service route file.
    */
    'enabled' => env('MICROSERVICES_ENABLED', false),
    'role' => env('SERVICE_ROLE', 'gateway'),
    'shared_secret' => env('MICROSERVICES_SHARED_SECRET'),
    'signature_ttl_seconds' => (int) env('MICROSERVICES_SIGNATURE_TTL', 60),
    'connect_timeout' => (int) env('MICROSERVICES_CONNECT_TIMEOUT', 3),
    'timeout' => (int) env('MICROSERVICES_TIMEOUT', 30),

    'services' => [
        'performance' => [
            'url' => env('PERFORMANCE_SERVICE_URL', 'http://performance-service:8000'),
            'route_file' => base_path('routes/services/performance.php'),
        ],
        'competency' => [
            'url' => env('COMPETENCY_SERVICE_URL', 'http://competency-service:8000'),
            'route_file' => base_path('routes/services/competency.php'),
        ],
        'learning' => [
            'url' => env('LEARNING_SERVICE_URL', 'http://learning-service:8000'),
            'route_file' => base_path('routes/services/learning.php'),
        ],
        'training' => [
            'url' => env('TRAINING_SERVICE_URL', 'http://training-service:8000'),
            'route_file' => base_path('routes/services/training.php'),
        ],
        'succession' => [
            'url' => env('SUCCESSION_SERVICE_URL', 'http://succession-service:8000'),
            'route_file' => base_path('routes/services/succession.php'),
        ],
        'recognition' => [
            'url' => env('RECOGNITION_SERVICE_URL', 'http://recognition-service:8000'),
            'route_file' => base_path('routes/services/recognition.php'),
        ],
    ],
];
