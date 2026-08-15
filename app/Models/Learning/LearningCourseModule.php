<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LearningCourseModule extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function lessons(): HasMany
    {
        return $this->hasMany(LearningCourseLesson::class, 'module_id')->orderBy('display_order');
    }
}
