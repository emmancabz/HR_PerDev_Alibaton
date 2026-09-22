<?php

namespace App\Models\Training;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TrainingSessionParticipant extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function session(): BelongsTo { return $this->belongsTo(TrainingSession::class, 'session_id'); }
    public function enrollment(): BelongsTo { return $this->belongsTo(TrainingEnrollment::class, 'enrollment_id'); }
    public function attendance(): HasOne { return $this->hasOne(TrainingAttendanceRecord::class, 'session_participant_id'); }
}
