<?php

return [
    'operational_seed_enabled' => env('TRAINING_OPERATIONAL_SEED_ENABLED', false),
    'workforce_attendance' => [
        'driver' => env('TRAINING_WORKFORCE_ATTENDANCE_DRIVER', 'pending'),
        'source_system' => 'HR2 Workforce Management',
        'contract_version' => '1.0',
        'personnel_identifier' => 'personnel_key',
        'ownership' => 'read-only supporting evidence',
    ],
];
