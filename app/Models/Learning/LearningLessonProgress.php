<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Model;

class LearningLessonProgress extends Model
{
    protected $table = 'learning_lesson_progress';
    protected $guarded = [];
    protected function casts(): array { return ['started_at' => 'immutable_datetime', 'completed_at' => 'immutable_datetime', 'last_activity_at' => 'immutable_datetime']; }
}
