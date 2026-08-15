<?php

namespace App\Models\Learning;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LearningAssignment extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'immutable_datetime', 'available_from' => 'immutable_datetime', 'due_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime', 'cancelled_at' => 'immutable_datetime', 'is_mandatory' => 'boolean',
        ];
    }

    public function learner(): BelongsTo { return $this->belongsTo(User::class, 'learner_id'); }
    public function course(): BelongsTo { return $this->belongsTo(LearningCourse::class, 'course_id'); }
    public function version(): BelongsTo { return $this->belongsTo(LearningCourseVersion::class, 'course_version_id'); }
    public function progress(): HasMany { return $this->hasMany(LearningLessonProgress::class, 'assignment_id'); }
    public function attempts(): HasMany { return $this->hasMany(LearningAssessmentAttempt::class, 'assignment_id'); }

    public function displayStatus(?CarbonImmutable $at = null): string
    {
        $at ??= CarbonImmutable::now('Asia/Manila');
        if (! in_array($this->status, ['Completed', 'Cancelled', 'Expired'], true) && $this->due_at?->setTimezone('Asia/Manila')->isBefore($at)) {
            return 'Overdue';
        }
        return $this->status;
    }
}
