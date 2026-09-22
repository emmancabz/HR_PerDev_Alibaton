<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MfaLoginChallenge extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'number_code',
        'choice_codes',
        'status',
        'attempt_count',
        'approved_by_device_id',
        'request_ip',
        'request_user_agent',
        'request_session_hash',
        'expires_at',
        'notification_sent_at',
        'approved_at',
        'denied_at',
        'consumed_at',
    ];

    protected $hidden = ['number_code', 'choice_codes'];

    protected function casts(): array
    {
        return [
            'choice_codes' => 'array',
            'expires_at' => 'datetime',
            'notification_sent_at' => 'datetime',
            'approved_at' => 'datetime',
            'denied_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approvedByDevice(): BelongsTo
    {
        return $this->belongsTo(MfaTrustedDevice::class, 'approved_by_device_id');
    }

    public function isExpired(): bool
    {
        return now()->greaterThanOrEqualTo($this->expires_at);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending' && ! $this->isExpired();
    }
}
