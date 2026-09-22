<?php

return [
    'material_max_bytes' => (int) env('LEARNING_MATERIAL_MAX_BYTES', 52_428_800),
    // Explicit opt-in; the seeder also refuses every non-local/test environment.
    'operational_seed_enabled' => (bool) env('LEARNING_OPERATIONAL_SEED', false),
];
