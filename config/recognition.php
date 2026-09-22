<?php

return [
    'operational_seed_enabled' => env('RECOGNITION_OPERATIONAL_SEED_ENABLED', false),
    'governance' => [
        'nominator_roles' => ['admin', 'hr', 'user'],
        'finalizer_roles' => ['admin', 'hr'],
        'self_recognition_allowed' => false,
        'duplicate_window_days' => 30,
    ],
    'ai' => ['enabled' => false, 'reason' => 'Deferred until an approved Aevyn/Groq API is configured.'],
];
