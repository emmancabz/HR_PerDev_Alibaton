<?php

namespace App\Models\Succession;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SuccessProfileRequirement extends Model
{
    protected $table = 'succession_success_profile_requirements';
    protected $guarded = [];
    protected function casts(): array { return ['required' => 'boolean', 'source_snapshot' => 'array']; }
    public function position(): BelongsTo { return $this->belongsTo(CriticalPosition::class, 'critical_position_id'); }
}
