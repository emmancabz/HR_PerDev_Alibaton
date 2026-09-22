<?php

namespace Tests\Feature\Defense;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\CanonicalLearningReference;
use App\Support\CanonicalWorkforceReference;
use Database\Seeders\CanonicalPersonnelSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserManagementDirectoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_users_exposes_only_canonical_non_archived_personnel(): void
    {
        $this->seed(CanonicalPersonnelSeeder::class);
        $admin = User::query()->where('personnel_key', 'user-1')->firstOrFail();

        User::factory()->create([
            'name' => 'Generic Governance Account',
            'email' => 'governance@example.test',
            'role' => UserRole::Admin,
            'personnel_key' => null,
            'core_person_id' => null,
            'employee_or_trainee_id' => null,
        ]);

        $archived = User::query()->where('personnel_key', 'user-gen-1')->firstOrFail();
        $archived->forceFill([
            'archived_at' => now(),
            'archive_reason' => 'Retention test',
        ])->save();

        $expected = User::query()
            ->canonicalPersonnel()
            ->whereNull('archived_at')
            ->where('employment_status', '!=', 'Incoming')
            ->count();

        $this->actingAs($admin)
            ->get(route('admin.users.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('UserManagement')
                ->has('initialUserDirectoryState.users', $expected)
                ->where('userDirectorySource.incomingSourceConnected', false)
            );
    }

    public function test_canonical_workforce_reference_keeps_alejandro_career_story_stable(): void
    {
        $alejandro = app(CanonicalWorkforceReference::class)->person('user-gen-22');

        $this->assertNotNull($alejandro);
        $this->assertSame('Alejandro Rios', $alejandro['name']);
        $this->assertSame('Jorge Vargas', $alejandro['direct_manager']);
        $this->assertSame('Administrative Services Supervisor', $alejandro['succession_role']);
        $this->assertSame('Ready Now', $alejandro['readiness']);
        $this->assertSame(3, $alejandro['learning_snapshot']['completed_courses']);
        $this->assertSame(1, $alejandro['learning_snapshot']['in_progress_courses']);
    }
    public function test_canonical_learning_reference_exposes_alejandro_current_course_progress(): void
    {
        $learning = app(CanonicalLearningReference::class)->currentCourse('user-gen-22');

        $this->assertNotNull($learning);
        $this->assertSame('LRN-2026-915', $learning['courseCode']);
        $this->assertSame('Administrative Services Coordination', $learning['title']);
        $this->assertSame(47, $learning['progressPercent']);
        $this->assertSame('Course Content', $learning['stage']);
    }

}
