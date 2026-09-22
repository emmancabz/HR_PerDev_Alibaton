<?php

namespace App\Models\Training;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrainingSession extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'enrollment_closes_at' => 'immutable_datetime',
            'attendance_finalized_at' => 'immutable_datetime',
            'cancelled_at' => 'immutable_datetime',
        ];
    }

    public function program(): BelongsTo { return $this->belongsTo(TrainingProgram::class, 'program_id'); }
    public function facilitator(): BelongsTo { return $this->belongsTo(User::class, 'facilitator_id'); }
    public function participants(): HasMany { return $this->hasMany(TrainingSessionParticipant::class, 'session_id'); }
}
