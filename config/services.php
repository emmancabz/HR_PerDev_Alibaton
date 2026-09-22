<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'groq' => [
        'key' => env('GROQ_API_KEY'),
        'url' => env('GROQ_API_URL', 'https://api.groq.com/openai/v1'),
        'base_url' => env('GROQ_API_URL', 'https://api.groq.com/openai/v1'),
        'model' => env('GROQ_MODEL', env('GROQ_PERFORMANCE_MODEL', 'openai/gpt-oss-20b')),
        'learning_model' => env('GROQ_LEARNING_MODEL', env('GROQ_MODEL', 'openai/gpt-oss-20b')),
        'timeout' => (int) env('GROQ_TIMEOUT_SECONDS', 20),
        'performance_anonymous_feedback' => (bool) env('PERFORMANCE_ANONYMOUS_FEEDBACK_ENABLED', false),
        'anonymous_feedback_minimum' => (int) env('PERFORMANCE_ANONYMOUS_FEEDBACK_MINIMUM', 3),
    ],

    'learning_lms' => [
        'url' => env('LEARNING_LMS_URL'),
        'token' => env('LEARNING_LMS_TOKEN'),
        'timeout' => (int) env('LEARNING_LMS_TIMEOUT_SECONDS', 15),
    ],

];
