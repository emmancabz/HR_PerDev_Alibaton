<?php

namespace App\Policies\Learning;

use App\Enums\UserRole;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class LearningCourseVersionPolicy
{
    public function edit(User $actor, LearningCourseVersion $version): bool
    {
        return $actor->role === UserRole::HR
            && $version->version_number === null
            && in_array($version->status, ['Draft', 'Changes Requested'], true)
            && $this->collaborates($actor, $version, ['Owner', 'Author']);
    }

    public function submitReview(User $actor, LearningCourseVersion $version): bool
    {
        return $this->edit($actor, $version);
    }

    public function review(User $actor, LearningCourseVersion $version): bool
    {
        return $actor->role === UserRole::Admin
            && $version->status === 'In Review'
            && $this->collaborates($actor, $version, ['Publisher'])
            && DB::table('learning_review_requests')->where('course_version_id', $version->id)
                ->where('reviewer_id', $actor->id)->where('status', 'Pending')->exists();
    }

    public function publish(User $actor, LearningCourseVersion $version): bool
    {
        return $actor->role === UserRole::Admin
            && $version->version_number === null
            && in_array($version->status, ['In Review', 'Approved'], true)
            && $this->collaborates($actor, $version, ['Publisher']);
    }

    public function createWorkingDraft(User $actor, LearningCourseVersion $version): bool
    {
        return $actor->role === UserRole::HR
            && $version->version_number !== null
            && in_array($version->status, ['Published', 'Archived'], true)
            && $this->collaborates($actor, $version, ['Owner', 'Author']);
    }

    private function collaborates(User $actor, LearningCourseVersion $version, array $permissions): bool
    {
        return DB::table('learning_course_collaborators')->where('course_id', $version->course_id)
            ->where('user_id', $actor->id)->whereIn('permission', $permissions)->exists();
    }
}
