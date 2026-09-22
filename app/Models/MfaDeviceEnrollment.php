<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MfaDeviceEnrollment extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'token_hash',
        'confirmation_code_hash',
        'expires_at',
        'used_at',
    ];

    protected $hidden = ['token_hash', 'confirmation_code_hash'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
