<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LearningCourseVersion extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'learning_objectives' => 'array',
            'audience_rules' => 'array',
            'completion_rules' => 'array',
            'availability_starts_at' => 'immutable_datetime',
            'availability_ends_at' => 'immutable_datetime',
            'submitted_at' => 'immutable_datetime',
            'approved_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
            'is_untouched_initial_draft' => 'boolean',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(LearningCourse::class, 'course_id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(LearningCourseModule::class, 'course_version_id')->orderBy('display_order');
    }

    public function assessments(): HasMany
    {
        return $this->hasMany(LearningAssessment::class, 'course_version_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(LearningAssignment::class, 'course_version_id');
    }
}
