<?php

return [
    'operational_seed_enabled' => env('SUCCESSION_OPERATIONAL_SEED_ENABLED', false),
    'ai' => ['enabled' => false, 'reason' => 'Deferred until an approved Aevyn/Groq API is configured.'],
    'governance' => ['finalizer_roles' => ['admin', 'hr'], 'user_workspace' => false],
];
