<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SecuritySessionActivity extends Model
{
    protected $fillable = ['session_hash', 'user_id', 'first_seen_at', 'last_seen_at', 'expires_at', 'timeout_logged_at'];

    protected function casts(): array
    {
        return ['first_seen_at' => 'immutable_datetime', 'last_seen_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime', 'timeout_logged_at' => 'immutable_datetime'];
    }
}
