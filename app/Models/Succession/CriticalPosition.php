<?php

namespace App\Models\Succession;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CriticalPosition extends Model
{
    use HasUuids;

    protected $table = 'succession_critical_positions';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['next_review_at' => 'immutable_datetime', 'activated_at' => 'immutable_datetime', 'archived_at' => 'immutable_datetime'];
    }

    public function incumbent(): BelongsTo { return $this->belongsTo(User::class, 'incumbent_id'); }
    public function requirements(): HasMany { return $this->hasMany(SuccessProfileRequirement::class, 'critical_position_id'); }
    public function candidates(): HasMany { return $this->hasMany(SuccessionCandidate::class, 'critical_position_id'); }
}
