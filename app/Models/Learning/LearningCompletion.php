<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LearningCompletion extends Model
{
    use HasUuids;
    protected $guarded = [];
    protected function casts(): array { return ['rules_satisfied' => 'array', 'completed_at' => 'immutable_datetime']; }
}
