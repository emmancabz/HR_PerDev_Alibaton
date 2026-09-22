<?php

namespace Tests\Feature\Defense;

use App\Support\CanonicalLearningReference;
use Tests\TestCase;

class UserManagementCanonicalLearningPathTest extends TestCase
{
    public function test_alejandro_current_learning_path_comes_from_canonical_lms_reference(): void
    {
        $course = app(CanonicalLearningReference::class)->currentCourse('user-gen-22');

        $this->assertNotNull($course);
        $this->assertSame('LRN-2026-915', $course['courseCode']);
        $this->assertSame('Administrative Services Coordination', $course['title']);
        $this->assertSame(47, $course['progressPercent']);
        $this->assertSame('Course Content', $course['stage']);
        $this->assertSame('Submitted', $course['preTest']['status']);
        $this->assertSame(66, $course['preTest']['scorePercent']);
        $this->assertSame('Not Yet Available', $course['postTest']['status']);
        $this->assertSame([
            'Service Requests and Prioritization',
            'Cross-Department Coordination',
            'Tracking, Handover, and Closure',
        ], collect($course['modules'])->pluck('title')->all());
        $this->assertFalse($course['certificateEnabled']);
    }
}
