<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LearningCourseLesson extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_required' => 'boolean'];
    }

    public function materials(): HasMany
    {
        return $this->hasMany(LearningMaterial::class, 'lesson_id');
    }
}
