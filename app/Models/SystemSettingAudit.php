<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class SystemSettingAudit extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['setting_key', 'old_value', 'new_value', 'reason', 'actor_id', 'occurred_at'];

    protected function casts(): array
    {
        return ['old_value' => 'array', 'new_value' => 'array', 'occurred_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('System setting audits are immutable.'));
        static::deleting(fn () => throw new LogicException('System setting audits are immutable.'));
    }
}
