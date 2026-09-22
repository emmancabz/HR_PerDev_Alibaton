<?php

namespace App\Models\Succession;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DevelopmentPlan extends Model
{
    use HasUuids;
    protected $table = 'succession_development_plans';
    protected $guarded = [];
    protected function casts(): array { return ['starts_on' => 'immutable_date', 'target_date' => 'immutable_date', 'activated_at' => 'immutable_datetime', 'completed_at' => 'immutable_datetime']; }
    public function candidateRecord(): BelongsTo { return $this->belongsTo(SuccessionCandidate::class, 'succession_candidate_id'); }
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function actions(): HasMany { return $this->hasMany(DevelopmentAction::class, 'development_plan_id'); }
}
