<?php

namespace Tests\Feature\Defense;

use App\Models\Learning\LearningCourse;
use App\Models\Recognition\RecognitionRecord;
use App\Models\Succession\CriticalPosition;
use App\Models\Training\TrainingAttendanceRecord;
use App\Models\Training\TrainingEnrollment;
use App\Models\Training\TrainingProgram;
use App\Models\User;
use Database\Seeders\DefenseReadinessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DefenseReadinessSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_defense_dataset_is_integrated_idempotent_and_does_not_fabricate_hr2_attendance(): void
    {
        $this->seed(DefenseReadinessSeeder::class);
        $this->seed(DefenseReadinessSeeder::class);

        $this->assertSame(count(config('personnel')), User::query()->activePersonnel()->count());
        $this->assertGreaterThanOrEqual(8, LearningCourse::query()->count());
        $this->assertGreaterThanOrEqual(4, TrainingProgram::query()->count());
        // Defense readiness seeds the governed Training catalog only.
        // Participant enrollments must come from an authorized assignment workflow.
        $this->assertSame(0, TrainingEnrollment::query()->count());
        $this->assertGreaterThanOrEqual(5, CriticalPosition::query()->where('status', 'Active')->count());
        $this->assertGreaterThanOrEqual(7, RecognitionRecord::query()->count());

        $this->assertFalse(TrainingAttendanceRecord::query()->where('workforce_sync_status', '!=', 'Not Connected')->exists());
        $this->assertFalse(TrainingAttendanceRecord::query()->whereNotNull('finalized_at')->exists());
    }
}
