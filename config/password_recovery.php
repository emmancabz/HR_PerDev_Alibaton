<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Privileged account recovery
    |--------------------------------------------------------------------------
    |
    | The Admin login address may be a system identity rather than a hosted
    | mailbox. Configure a real, controlled recovery mailbox through .env.
    | This value is never exposed on the public forgot-password screen.
    |
    */
    'admin_email' => env('PASSWORD_RECOVERY_ADMIN_EMAIL'),
];
