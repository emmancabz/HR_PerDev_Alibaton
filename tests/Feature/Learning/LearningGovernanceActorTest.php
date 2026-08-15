<?php

namespace Tests\Feature\Learning;

use App\Models\Learning\LearningAssignment;
use App\Models\User;
use App\Services\Learning\LearningAssignmentService;
use App\Services\Learning\LearningCourseService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LearningGovernanceActorTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_default_admin_is_an_authorized_system_account_without_a_personnel_identity(): void
    {
        $this->seed(DatabaseSeeder::class);

        $admin = User::query()->where('email', 'admin@alibaton.com')->firstOrFail();

        $this->assertSame('Admin User', $admin->name);
        $this->assertSame('admin', $admin->role->value);
        $this->assertNull($admin->personnel_key);
    }

    public function test_default_admin_creates_saves_and_reopens_a_persistent_draft_through_http(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = User::query()->where('email', 'admin@alibaton.com')->firstOrFail();
        $payload = $this->incompletePayload($admin);

        $created = $this->actingAs($admin)->postJson(route('learning.api.courses.create'), $payload);

        $created->assertCreated()->assertJsonStructure(['data' => ['versionId', 'courseId', 'code']]);
        $this->assertMatchesRegularExpression('/^LRN-\d{4}-\d{3,}$/', $created->json('data.code'));
        $this->assertDatabaseHas('learning_course_collaborators', [
            'course_id' => $created->json('data.courseId'),
            'user_id' => $admin->id,
            'permission' => 'Owner',
        ]);
        $this->assertDatabaseHas('learning_course_collaborators', [
            'course_id' => $created->json('data.courseId'),
            'user_id' => $admin->id,
            'permission' => 'Author',
        ]);

        $state = $this->actingAs($admin)->getJson(route('learning.api.state'))->assertOk()->json('data');
        $governanceAdmin = collect($state['governanceActors'])->firstWhere('id', $admin->id);
        $this->assertNotNull($governanceAdmin);
        $this->assertNull($governanceAdmin['personnel_key']);
        $this->assertTrue($governanceAdmin['canOwn']);
        $this->assertTrue($governanceAdmin['canAuthor']);
        $this->assertTrue($governanceAdmin['canPublish']);
        $this->assertFalse($governanceAdmin['canReview']);
        $this->assertFalse(collect($state['personnel'])->contains(fn (array $person) => $person['id'] === $admin->id));

        $payload['title'] = 'Workplace readiness';
        $payload['description'] = 'A governed online course Draft that persists the completed first stage.';
        $payload['learningObjectives'] = ['Apply the documented workplace requirement correctly.'];
        $this->actingAs($admin)->putJson(
            route('learning.api.versions.save', ['version' => $created->json('data.versionId')]),
            $payload,
        )->assertOk();

        $reopenedState = $this->actingAs($admin)->getJson(route('learning.api.state'))->assertOk()->json('data');
        $course = collect($reopenedState['courses'])->firstWhere('id', $created->json('data.courseId'));
        $this->assertSame($admin->id, $course['draftDetail']['ownerId']);
        $this->assertContains($admin->id, $course['draftDetail']['authorIds']);
        $this->assertSame('Workplace readiness', $course['draftDetail']['title']);
        $this->assertSame($created->json('data.code'), $course['draftDetail']['code']);
    }

    public function test_http_draft_uses_canonical_person_types_and_normalizes_only_known_legacy_aliases(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = User::query()->where('email', 'admin@alibaton.com')->firstOrFail();
        $canonical = User::query()->whereNotNull('personnel_key')->where('employment_status', 'Active')->firstOrFail();
        $canonical->update(['person_type' => 'Project Employee']);

        $payload = $this->incompletePayload($admin);
        $payload['audience']['personTypes'] = ['Project Employee'];
        $created = $this->actingAs($admin)->postJson(route('learning.api.courses.create'), $payload)->assertCreated();
        $this->assertSame(
            ['Project Employee'],
            \App\Models\Learning\LearningCourseVersion::query()->findOrFail($created->json('data.versionId'))->audience_rules['personTypes'],
        );

        $payload['audience']['personTypes'] = ['Employees'];
        $legacy = $this->actingAs($admin)->postJson(route('learning.api.courses.create'), $payload)->assertCreated();
        $this->assertSame(
            ['Employee'],
            \App\Models\Learning\LearningCourseVersion::query()->findOrFail($legacy->json('data.versionId'))->audience_rules['personTypes'],
        );

        $payload['audience']['personTypes'] = ['Invented Type'];
        $this->actingAs($admin)->postJson(route('learning.api.courses.create'), $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('audience.personTypes');
    }

    public function test_http_step_one_draft_saves_without_configuring_step_two_audience(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = User::query()->where('email', 'admin@alibaton.com')->firstOrFail();
        $payload = $this->incompletePayload($admin);
        $payload['audience']['personTypes'] = [];

        $this->actingAs($admin)->postJson(route('learning.api.courses.create'), $payload)
            ->assertCreated()
            ->assertJsonStructure(['data' => ['versionId', 'courseId', 'code']]);
    }

    public function test_system_admin_is_not_learner_eligible_and_has_no_course_lifecycle_bypass(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = User::query()->where('email', 'admin@alibaton.com')->firstOrFail();
        $reviewer = User::query()->where('personnel_key', 'user-gen-10')->firstOrFail();
        $publisher = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $courses = app(LearningCourseService::class);
        $draft = $courses->createDraft($admin, $this->completePayload($admin, $reviewer, $publisher));

        try {
            $courses->submitForReview($admin, $draft, $admin->id);
            $this->fail('Admin status bypassed course-specific reviewer authorization.');
        } catch (ValidationException) {
        }

        $courses->submitForReview($admin, $draft->fresh(), $reviewer->id);
        try {
            $courses->decideReview($admin, $draft->fresh(), 'Approved', 'Self approval attempt');
            $this->fail('The owner approved their own course.');
        } catch (AuthorizationException) {
        }
        $courses->decideReview($reviewer, $draft->fresh(), 'Approved', 'Independent review complete');
        try {
            $courses->publish($admin, $draft->fresh());
            $this->fail('Admin status bypassed course-specific Publisher authorization.');
        } catch (AuthorizationException) {
        }
        $courses->publish($publisher, $draft->fresh());
        $published = $draft->fresh();

        $preview = app(LearningAssignmentService::class)->preview($publisher, $published, [$admin->id]);
        $this->assertSame('Ineligible', $preview[0]['result']);
        try {
            app(LearningAssignmentService::class)->assign($publisher, $published, [
                'learnerIds' => [$admin->id],
                'source' => 'Manual Assignment',
                'priority' => 'Normal',
                'reason' => 'Learner boundary check',
            ]);
            $this->fail('A system-only account was assigned as a learner.');
        } catch (ValidationException) {
        }
        try {
            app(LearningAssignmentService::class)->selfEnroll($admin, $published);
            $this->fail('A system-only account self-enrolled as a learner.');
        } catch (AuthorizationException) {
        }

        $this->assertSame(0, LearningAssignment::query()->where('learner_id', $admin->id)->count());
    }

    public function test_independent_review_and_evaluator_authorization_remain_enforced(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = User::query()->where('email', 'admin@alibaton.com')->firstOrFail();
        $reviewer = User::query()->where('personnel_key', 'user-gen-10')->firstOrFail();
        $publisher = User::query()->where('personnel_key', 'user-1')->firstOrFail();
        $courses = app(LearningCourseService::class);

        $notIndependent = $this->completePayload($admin, $reviewer, $publisher);
        $notIndependent['authorIds'][] = $reviewer->id;
        $draft = $courses->createDraft($admin, $notIndependent);
        try {
            $courses->submitForReview($admin, $draft, $reviewer->id);
            $this->fail('A Safety author was accepted as the independent reviewer.');
        } catch (ValidationException) {
        }

        $nonEvaluator = User::query()->where('personnel_key', 'user-6')->firstOrFail();
        $unauthorizedReviewer = $this->completePayload($admin, $reviewer, $publisher);
        $unauthorizedReviewer['reviewerIds'] = [$nonEvaluator->id];
        try {
            $courses->createDraft($admin, $unauthorizedReviewer);
            $this->fail('Canonical personnel without evaluator authorization became a reviewer.');
        } catch (ValidationException) {
        }
    }

    private function incompletePayload(User $owner): array
    {
        return [
            'title' => '',
            'description' => '',
            'category' => 'General',
            'difficulty' => 'Beginner',
            'language' => 'English',
            'learningObjectives' => [''],
            'ownerId' => $owner->id,
            'subjectMatterExpertId' => null,
            'durationOverrideMinutes' => null,
            'authorIds' => [$owner->id],
            'reviewerIds' => [],
            'publisherId' => null,
            'audience' => [
                'personTypes' => ['Employee'],
                'allDepartments' => true,
                'departments' => [],
                'positions' => [],
                'roleProfileIds' => [],
                'catalogVisibility' => 'Assigned only',
                'defaultDueDays' => 30,
                'mandatoryDefault' => true,
            ],
            'competencies' => [],
            'modules' => [],
            'assessments' => [],
            'completion' => [
                'completeRequiredLessons' => true,
                'passRequiredKnowledgeChecks' => true,
                'passFinalAssessment' => true,
                'issueCertificate' => false,
                'certificateValidityMonths' => null,
                'renewalIntervalMonths' => null,
            ],
        ];
    }

    private function completePayload(User $owner, User $reviewer, User $publisher): array
    {
        $payload = $this->incompletePayload($owner);
        $payload['title'] = 'Workplace Safety Orientation';
        $payload['description'] = 'A governed online safety course with independently reviewed learning content.';
        $payload['category'] = 'Safety & Compliance';
        $payload['learningObjectives'] = ['Apply the documented workplace safety procedure correctly.'];
        $payload['subjectMatterExpertId'] = $reviewer->id;
        $payload['reviewerIds'] = [$reviewer->id];
        $payload['publisherId'] = $publisher->id;
        $payload['audience']['catalogVisibility'] = 'Eligible users may self-enroll';
        $payload['modules'] = [[
            'clientId' => 'safety-foundation',
            'title' => 'Safety foundation',
            'description' => 'Required foundation module.',
            'lessons' => [[
                'title' => 'Workplace controls',
                'objective' => 'Apply the documented workplace controls correctly.',
                'description' => 'Review the required controls.',
                'contentType' => 'Text/Reading',
                'textContent' => 'Review each required control and use the authorized escalation path.',
                'externalUrl' => null,
                'estimatedMinutes' => 10,
                'required' => true,
            ]],
        ]];
        $payload['assessments'] = [[
            'type' => 'Final Assessment',
            'title' => 'Final Assessment',
            'required' => true,
            'passingScore' => 80,
            'attemptsAllowed' => 3,
            'shuffleQuestions' => false,
            'shuffleOptions' => false,
            'feedbackPolicy' => 'After submission',
            'questions' => [[
                'type' => 'Multiple Choice',
                'text' => 'Which action follows the documented safety control?',
                'explanation' => 'Use the documented control.',
                'points' => 1,
                'options' => [
                    ['text' => 'Apply the documented control', 'correct' => true],
                    ['text' => 'Skip the documented control', 'correct' => false],
                ],
            ]],
        ]];

        return $payload;
    }
}
