<?php

namespace App\Models\Training;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TrainingEnrollment extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'personnel_snapshot' => 'array',
            'assigned_at' => 'immutable_datetime',
            'confirmed_at' => 'immutable_datetime',
            'withdrawn_at' => 'immutable_datetime',
        ];
    }

    public function program(): BelongsTo { return $this->belongsTo(TrainingProgram::class, 'program_id'); }
    public function participant(): BelongsTo { return $this->belongsTo(User::class, 'participant_id'); }
    public function sessionParticipants(): HasMany { return $this->hasMany(TrainingSessionParticipant::class, 'enrollment_id'); }
    public function assessment(): HasOne { return $this->hasOne(TrainingAssessment::class, 'enrollment_id'); }
    public function completion(): HasOne { return $this->hasOne(TrainingCompletion::class, 'enrollment_id'); }
}
