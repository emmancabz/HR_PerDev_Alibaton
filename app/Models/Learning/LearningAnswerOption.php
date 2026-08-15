<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LearningAnswerOption extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_correct' => 'boolean'];
    }
}
