<?php

namespace App\Models\Training;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TrainingCompletion extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'attendance_rate' => 'decimal:2',
            'attendance_snapshot' => 'array',
            'assessment_snapshot' => 'array',
            'program_snapshot' => 'array',
            'personnel_snapshot' => 'array',
            'finalized_at' => 'immutable_datetime',
        ];
    }

    public function enrollment(): BelongsTo { return $this->belongsTo(TrainingEnrollment::class, 'enrollment_id'); }
    public function certificate(): HasOne { return $this->hasOne(TrainingCertificate::class, 'completion_id'); }
}
