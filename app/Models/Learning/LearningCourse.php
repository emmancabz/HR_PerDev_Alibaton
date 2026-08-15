<?php

namespace App\Models\Learning;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LearningCourse extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['archived_at' => 'immutable_datetime'];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(LearningCourseVersion::class, 'course_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(LearningAssignment::class, 'course_id');
    }
}
