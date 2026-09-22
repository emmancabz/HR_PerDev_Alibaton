<?php

namespace App\Models\Succession;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReadinessAssessment extends Model
{
    use HasUuids;
    protected $table = 'succession_readiness_assessments';
    protected $guarded = [];
    protected function casts(): array
    {
        return [
            'performance_snapshot' => 'array', 'competency_snapshot' => 'array', 'learning_snapshot' => 'array',
            'training_snapshot' => 'array', 'requirement_snapshot' => 'array', 'development_needs' => 'array',
            'risk_flags' => 'array', 'finalized_at' => 'immutable_datetime',
        ];
    }
    public function candidateRecord(): BelongsTo { return $this->belongsTo(SuccessionCandidate::class, 'succession_candidate_id'); }
}
