<?php

namespace App\Providers;

use App\Models\Learning\LearningAssignment;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseVersion;
use App\Policies\Learning\LearningAssignmentPolicy;
use App\Policies\Learning\LearningCoursePolicy;
use App\Policies\Learning\LearningCourseVersionPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(LearningCourse::class, LearningCoursePolicy::class);
        Gate::policy(LearningCourseVersion::class, LearningCourseVersionPolicy::class);
        Gate::policy(LearningAssignment::class, LearningAssignmentPolicy::class);
        Vite::prefetch(concurrency: 3);
    }
}
