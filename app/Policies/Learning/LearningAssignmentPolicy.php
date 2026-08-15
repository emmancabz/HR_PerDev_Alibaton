<?php

namespace App\Policies\Learning;

use App\Models\Learning\LearningAssignment;
use App\Models\User;

class LearningAssignmentPolicy
{
    public function view(User $actor, LearningAssignment $assignment): bool
    {
        return $assignment->learner_id === $actor->id || $actor->isPerformanceOperator();
    }

    public function manage(User $actor, LearningAssignment $assignment): bool
    {
        return $actor->isPerformanceOperator();
    }
}
