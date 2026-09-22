<?php

namespace App\Models\Succession;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SuccessionCandidate extends Model
{
    use HasUuids;
    protected $table = 'succession_candidates';
    protected $guarded = [];
    protected function casts(): array { return ['personnel_snapshot' => 'array', 'nominated_at' => 'immutable_datetime', 'decided_at' => 'immutable_datetime']; }
    public function position(): BelongsTo { return $this->belongsTo(CriticalPosition::class, 'critical_position_id'); }
    public function candidate(): BelongsTo { return $this->belongsTo(User::class, 'candidate_id'); }
    public function assessments(): HasMany { return $this->hasMany(ReadinessAssessment::class, 'succession_candidate_id'); }
    public function plans(): HasMany { return $this->hasMany(DevelopmentPlan::class, 'succession_candidate_id'); }
}
