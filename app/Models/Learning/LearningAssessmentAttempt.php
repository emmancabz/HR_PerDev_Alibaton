<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LearningAssessmentAttempt extends Model
{
    use HasUuids;
    protected $guarded = [];
    protected function casts(): array { return ['question_snapshot' => 'array', 'passed' => 'boolean', 'started_at' => 'immutable_datetime', 'submitted_at' => 'immutable_datetime']; }
}
