<?php

namespace App\Models\Training;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrainingProgram extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'objectives' => 'array',
            'audience_rules' => 'array',
            'completion_rules' => 'array',
            'activated_at' => 'immutable_datetime',
            'archived_at' => 'immutable_datetime',
            'cancelled_at' => 'immutable_datetime',
        ];
    }

    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function competencies(): HasMany { return $this->hasMany(TrainingProgramCompetency::class, 'program_id'); }
    public function sessions(): HasMany { return $this->hasMany(TrainingSession::class, 'program_id'); }
    public function enrollments(): HasMany { return $this->hasMany(TrainingEnrollment::class, 'program_id'); }
}
