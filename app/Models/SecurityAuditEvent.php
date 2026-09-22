<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class SecurityAuditEvent extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['id', 'user_id', 'actor_snapshot', 'event_type', 'outcome', 'severity', 'flagged', 'ip_address', 'user_agent', 'route_name', 'session_hash', 'metadata', 'occurred_at'];

    protected function casts(): array
    {
        return ['actor_snapshot' => 'array', 'metadata' => 'array', 'flagged' => 'boolean', 'occurred_at' => 'immutable_datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Security audit events are immutable.'));
        static::deleting(fn () => throw new LogicException('Security audit events are immutable.'));
    }
}
