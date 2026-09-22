<?php

namespace App\Models\Succession;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DevelopmentAction extends Model
{
    use HasUuids;
    protected $table = 'succession_development_actions';
    protected $guarded = [];
    protected function casts(): array { return ['due_on' => 'immutable_date', 'completed_at' => 'immutable_datetime', 'evidence_snapshot' => 'array']; }
    public function plan(): BelongsTo { return $this->belongsTo(DevelopmentPlan::class, 'development_plan_id'); }
}
