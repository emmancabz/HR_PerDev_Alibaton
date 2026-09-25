<?php

namespace Tests\Feature\Learning;

use App\Enums\UserRole;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use App\Services\Learning\LearningCourseService;
use App\Services\Microservices\InternalRequestSigner;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LearningGovernanceActorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.groq.key' => null,
            'services.learning_lms.url' => null,
            'services.learning_lms.token' => null,
        ]);
    }

    private function internalHeaders(User $user): array
    {
        return app(InternalRequestSigner::class)->headers(
            'learning',
            \Illuminate\Http\Request::create('/'),
            $user->id,
        );
    }

    public function test_admin_cannot_create_or_edit_an_hr_course_draft(): void
    {
        [$hr, $admin] = $this->actors();
        $courses = app(LearningCourseService::class);

        try {
            $courses->createDraft($admin, $this->payload($hr));
            $this->fail('Admin created a course draft.');
        } catch (AuthorizationException) {
            $this->assertTrue(true);
        }

        $draft = $courses->createDraft($hr, $this->payload($hr));
        try {
            $courses->saveDraft($admin, $draft, $this->payload($hr));
            $this->fail('Admin edited the HR course draft.');
        } catch (AuthorizationException) {
            $this->assertTrue(true);
        }
    }

    public function test_hr_creation_automatically_assigns_hr_author_and_admin_publisher(): void
    {
        [$hr, $admin] = $this->actors();
        $draft = app(LearningCourseService::class)->createDraft($hr, $this->payload($hr));

        $this->assertDatabaseHas('learning_course_collaborators', [
            'course_id' => $draft->course_id,
            'user_id' => $hr->id,
            'permission' => 'Owner',
        ]);
        $this->assertDatabaseHas('learning_course_collaborators', [
            'course_id' => $draft->course_id,
            'user_id' => $hr->id,
            'permission' => 'Author',
        ]);
        $this->assertDatabaseHas('learning_course_collaborators', [
            'course_id' => $draft->course_id,
            'user_id' => $admin->id,
            'permission' => 'Publisher',
        ]);
        $this->assertDatabaseMissing('learning_course_collaborators', [
            'course_id' => $draft->course_id,
            'user_id' => $admin->id,
            'permission' => 'Author',
        ]);
    }

    public function test_hr_can_create_a_persistent_draft_through_http_but_admin_cannot(): void
    {
        [$hr, $admin] = $this->actors();

        $this->withHeaders($this->internalHeaders($admin))
            ->postJson(route('learning.api.courses.create'), $this->payload($hr))
            ->assertForbidden();

        $response = $this->withHeaders($this->internalHeaders($hr))
            ->postJson(route('learning.api.courses.create'), $this->payload($hr))
            ->assertCreated()
            ->assertJsonPath('data.code', 'LRN-'.now()->format('Y').'-001');

        $versionId = $response->json('data.versionId');
        $this->assertDatabaseHas('learning_course_versions', [
            'id' => $versionId,
            'created_by' => $hr->id,
            'status' => 'Draft',
        ]);
    }

    public function test_submission_routes_to_the_assigned_admin_and_admin_controls_publication(): void
    {
        [$hr, $admin, $otherAdmin] = $this->actors();
        $courses = app(LearningCourseService::class);
        $draft = $courses->createDraft($hr, $this->payload($hr));
        $courses->submitForReview($hr, $draft);

        $this->assertDatabaseHas('learning_review_requests', [
            'course_version_id' => $draft->id,
            'reviewer_id' => $admin->id,
            'status' => 'Pending',
        ]);
        $this->assertDatabaseHas('learning_course_source_reviews', [
            'course_version_id' => $draft->id,
        ]);

        try {
            $courses->decideReview($otherAdmin, $draft->fresh(), 'Approved', 'Not assigned');
            $this->fail('An unassigned Admin reviewed the course.');
        } catch (AuthorizationException) {
            $this->assertTrue(true);
        }

        $courses->decideReview($admin, $draft->fresh(), 'Approved', 'Sources and course content reviewed.');

        try {
            $courses->publish($hr, $draft->fresh());
            $this->fail('HR published the course.');
        } catch (AuthorizationException) {
            $this->assertTrue(true);
        }

        $result = $courses->publish($admin, $draft->fresh());
        $this->assertSame('Published', $draft->fresh()->status);
        $this->assertSame('Queued', $result['status']);
        $this->assertDatabaseHas('learning_publication_deliveries', [
            'course_version_id' => $draft->id,
            'status' => 'Queued',
            'published_by' => $admin->id,
        ]);
    }

    public function test_changes_requested_returns_the_same_working_version_to_hr(): void
    {
        [$hr, $admin] = $this->actors();
        $courses = app(LearningCourseService::class);
        $draft = $courses->createDraft($hr, $this->payload($hr));
        $courses->submitForReview($hr, $draft);
        $courses->decideReview($admin, $draft->fresh(), 'Changes Requested', 'Clarify the final handover step.');

        $this->assertSame('Changes Requested', $draft->fresh()->status);
        $courses->saveDraft($hr, $draft->fresh(), array_replace($this->payload($hr), [
            'description' => 'Updated source-grounded operational handover course with the final handover step clarified.',
        ]));
        $this->assertSame('Changes Requested', $draft->fresh()->status);
    }

    public function test_only_hr_can_open_a_revision_from_an_official_published_version(): void
    {
        [$hr, $admin] = $this->actors();
        $courses = app(LearningCourseService::class);
        $draft = $courses->createDraft($hr, $this->payload($hr));
        $courses->submitForReview($hr, $draft);
        $courses->decideReview($admin, $draft->fresh(), 'Approved', 'Ready');
        $courses->publish($admin, $draft->fresh());
        $published = $draft->fresh();

        try {
            $courses->workingDraft($admin, $published);
            $this->fail('Admin opened an authoring revision.');
        } catch (AuthorizationException) {
            $this->assertTrue(true);
        }

        $revision = $courses->workingDraft($hr, $published);
        $this->assertNull($revision->version_number);
        $this->assertSame($published->id, $revision->based_on_version_id);
        $this->assertSame('Draft', $revision->status);
        $this->assertSame(
            DB::table('learning_course_source_links')->where('course_version_id', $published->id)->count(),
            DB::table('learning_course_source_links')->where('course_version_id', $revision->id)->count(),
        );
    }

    private function actors(): array
    {
        $hr = $this->user('hr-author', 'HR Course Author', UserRole::HR, 'Human Resources');
        $admin = $this->user('admin-publisher', 'Learning Admin', UserRole::Admin, 'Administration');
        $otherAdmin = $this->user('admin-other', 'Other Admin', UserRole::Admin, 'Administration');
        $this->user('learner-operations', 'Operations Learner', UserRole::User, 'Operations');

        return [$hr, $admin, $otherAdmin];
    }

    private function user(string $key, string $name, UserRole $role, string $department): User
    {
        return User::factory()->create([
            'personnel_key' => $key,
            'core_person_id' => 'CORE-'.$key,
            'employee_or_trainee_id' => 'EMP-'.$key,
            'name' => $name,
            'role' => $role,
            'person_type' => 'Employee',
            'department' => $department,
            'position' => $role === UserRole::HR ? 'HR Business Partner' : 'Staff Professional',
            'employment_status' => 'Active',
            'evaluator_capable' => $role === UserRole::HR,
        ]);
    }

    private function payload(User $hr): array
    {
        $question = fn (string $text): array => [
            'type' => 'Multiple Choice',
            'text' => $text,
            'explanation' => 'Follow the documented procedure.',
            'points' => 1,
            'options' => [
                ['text' => 'Follow the documented procedure', 'correct' => true],
                ['text' => 'Ignore the documented procedure', 'correct' => false],
            ],
        ];

        return [
            'title' => 'Operational Handover',
            'description' => 'A source-grounded operational handover course prepared by Human Resources.',
            'category' => 'Operations',
            'difficulty' => 'Beginner',
            'language' => 'English',
            'learningObjectives' => ['Apply the documented handover procedure correctly.'],
            'ownerId' => $hr->id,
            'subjectMatterExpertId' => $hr->id,
            'authorIds' => [$hr->id],
            'reviewerIds' => [],
            'publisherId' => null,
            'sourceDocumentIds' => ['ALB-PND-SOP-002'],
            'audience' => [
                'personTypes' => ['Employee'],
                'allDepartments' => false,
                'departments' => ['Operations'],
                'positions' => [],
                'roleProfileIds' => [],
                'catalogVisibility' => 'Assigned only',
                'defaultDueDays' => 30,
                'mandatoryDefault' => true,
            ],
            'competencies' => [],
            'modules' => [[
                'clientId' => 'module-1',
                'title' => 'Handover Foundation',
                'description' => 'Required handover controls.',
                'lessons' => [[
                    'title' => 'Shift Handover',
                    'objective' => 'Apply the handover process correctly.',
                    'description' => 'Review the required handover process.',
                    'contentType' => 'Text/Reading',
                    'textContent' => 'Complete the documented handover and the required operational record.',
                    'externalUrl' => null,
                    'estimatedMinutes' => 10,
                    'required' => true,
                ]],
            ]],
            'assessments' => [
                [
                    'type' => 'Knowledge Check', 'title' => 'Module Quiz', 'required' => true,
                    'passingScore' => 80, 'attemptsAllowed' => 3, 'shuffleQuestions' => false,
                    'shuffleOptions' => false, 'feedbackPolicy' => 'After submission',
                    'moduleClientId' => 'module-1', 'questions' => [$question('After studying this module, which action follows the procedure?')],
                ],
            ],
            'completion' => [
                'completeRequiredLessons' => true,
                'passRequiredKnowledgeChecks' => true,
                'passFinalAssessment' => false,
                'issueCertificate' => true,
                'certificateValidityMonths' => 12,
                'renewalIntervalMonths' => 12,
            ],
        ];
    }
}
