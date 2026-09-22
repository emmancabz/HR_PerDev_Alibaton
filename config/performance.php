<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Controlled review-workflow demonstration date
    |--------------------------------------------------------------------------
    |
    | Leave null/empty for normal production behavior. Local defense/demo
    | environments may set PERFORMANCE_REVIEW_DEMO_DATE to a date inside a
    | formal review window (for example 2026-10-10) so the complete quarterly
    | workflow can be demonstrated without changing authoritative Data B dates.
    |
    */
    'review_demo_date' => env('PERFORMANCE_REVIEW_DEMO_DATE'),
];
