<?php

namespace App\Models\Training;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TrainingFeedback extends Model
{
    use HasUuids;

    protected $table = 'training_feedback';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['submitted_at' => 'immutable_datetime'];
    }
}
