<?php

namespace App\Models\Training;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingAttendanceRecord extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'workforce_snapshot' => 'array',
            'workforce_synced_at' => 'immutable_datetime',
            'marked_at' => 'immutable_datetime',
            'finalized_at' => 'immutable_datetime',
        ];
    }

    public function sessionParticipant(): BelongsTo { return $this->belongsTo(TrainingSessionParticipant::class, 'session_participant_id'); }
}
