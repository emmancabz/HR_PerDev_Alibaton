<?php

namespace App\Models\Training;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingProgramCompetency extends Model
{
    protected $guarded = [];
    public function program(): BelongsTo { return $this->belongsTo(TrainingProgram::class, 'program_id'); }
}
