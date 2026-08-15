<?php

namespace App\Policies\Learning;

use App\Models\Learning\LearningCourse;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class LearningCoursePolicy
{
    public function archive(User $actor, LearningCourse $course): bool
    {
        return DB::table('learning_course_collaborators')->where('course_id', $course->id)
            ->where('user_id', $actor->id)->whereIn('permission', ['Owner', 'Publisher'])->exists();
    }
}
