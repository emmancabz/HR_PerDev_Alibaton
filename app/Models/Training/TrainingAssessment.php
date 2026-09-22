<?php

namespace App\Models\Training;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingAssessment extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'checklist' => 'array',
            'score' => 'decimal:2',
            'maximum_score' => 'decimal:2',
            'assessed_at' => 'immutable_datetime',
            'finalized_at' => 'immutable_datetime',
        ];
    }

    public function enrollment(): BelongsTo { return $this->belongsTo(TrainingEnrollment::class, 'enrollment_id'); }
}
