<?php

namespace Tests\Feature\Learning;

use App\Enums\UserRole;
use App\Models\Learning\LearningAssessment;
use App\Models\Learning\LearningAssignment;
use App\Models\Learning\LearningAssessmentAttempt;
use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseLesson;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use App\Services\Learning\LearningAssignmentService;
use App\Services\Learning\LearningCourseService;
use App\Services\Learning\LearningDeliveryService;
use App\Services\Learning\LearningMaterialService;
use App\Services\Learning\LearningRequestService;
use App\Services\Learning\LearningGroqService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LearningWorkflowTest extends TestCase
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

    public function test_new_draft_persists_without_incrementing_official_version(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors();
        $draft = app(LearningCourseService::class)->createDraft($admin, $this->payload($admin, $reviewer, $publisher));
        $this->assertDatabaseHas('learning_course_versions', ['id' => $draft->id, 'status' => 'Draft', 'version_number' => null]);
        app(LearningCourseService::class)->saveDraft($admin, $draft, array_replace($this->payload($admin, $reviewer, $publisher), ['title' => 'Saved after reload']));
        $this->assertNull($draft->fresh()->version_number);
        $this->assertSame('Saved after reload', $draft->fresh()->title);
    }

    public function test_curriculum_reordering_is_collision_safe_and_preserves_module_and_lesson_ids(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors();
        $payload = $this->payload($admin, $reviewer, $publisher);
        $lessonTemplate = $payload['modules'][0]['lessons'][0];
        $payload['modules'] = collect(['Alpha', 'Beta', 'Gamma'])->map(function (string $module) use ($lessonTemplate): array {
            return [
                'clientId' => 'module-'.strtolower($module),
                'title' => $module,
                'description' => $module.' module',
                'lessons' => collect([1, 2, 3])->map(function (int $number) use ($module, $lessonTemplate): array {
                    return array_replace($lessonTemplate, [
                        'title' => $module.' lesson '.$number,
                        'objective' => 'Complete '.$module.' lesson '.$number.'.',
                    ]);
                })->all(),
            ];
        })->all();

        $courses = app(LearningCourseService::class);
        $draft = $courses->createDraft($admin, $payload);
        $detail = collect($courses->state($admin)['courses'])->firstWhere('id', $draft->course_id)['draftDetail'];
        $modulesByTitle = collect($detail['modules'])->keyBy('title');
        $originalModuleIds = $modulesByTitle->pluck('clientId')->sort()->values()->all();
        $gammaLessonsByTitle = collect($modulesByTitle['Gamma']['lessons'])->keyBy('title');
        $originalGammaLessonIds = $gammaLessonsByTitle->pluck('id')->sort()->values()->all();
        $payload['assessments'] = $detail['assessments'];

        $saveOrder = function (array $moduleTitles, array $gammaLessonTitles) use ($admin, $courses, $draft, &$payload, $modulesByTitle, $gammaLessonsByTitle, $originalModuleIds, $originalGammaLessonIds): void {
            $modules = collect($moduleTitles)->map(fn (string $title) => $modulesByTitle[$title])->all();
            foreach ($modules as &$module) {
                if ($module['title'] === 'Gamma') {
                    $module['lessons'] = collect($gammaLessonTitles)->map(fn (string $title) => $gammaLessonsByTitle[$title])->all();
                }
            }
            unset($module);
            $payload['modules'] = $modules;
            $courses->saveDraft($admin, $draft->fresh(), $payload);

            $persistedModules = DB::table('learning_course_modules')->where('course_version_id', $draft->id)->orderBy('display_order')->get();
            $this->assertSame($moduleTitles, $persistedModules->pluck('title')->all());
            $this->assertSame($originalModuleIds, $persistedModules->pluck('id')->sort()->values()->all());
            $gammaId = $persistedModules->firstWhere('title', 'Gamma')->id;
            $persistedLessons = DB::table('learning_course_lessons')->where('module_id', $gammaId)->orderBy('display_order')->get();
            $this->assertSame($gammaLessonTitles, $persistedLessons->pluck('title')->all());
            $this->assertSame($originalGammaLessonIds, $persistedLessons->pluck('id')->sort()->values()->all());
        };

        $saveOrder(['Gamma', 'Alpha', 'Beta'], ['Gamma lesson 3', 'Gamma lesson 1', 'Gamma lesson 2']);
        $saveOrder(['Alpha', 'Beta', 'Gamma'], ['Gamma lesson 1', 'Gamma lesson 2', 'Gamma lesson 3']);
        $saveOrder(['Beta', 'Alpha', 'Gamma'], ['Gamma lesson 2', 'Gamma lesson 1', 'Gamma lesson 3']);
        $saveOrder(['Beta', 'Alpha', 'Gamma'], ['Gamma lesson 2', 'Gamma lesson 1', 'Gamma lesson 3']);
    }

    public function test_assessment_question_and_option_delete_reorder_is_collision_safe_stable_and_idempotent(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors();
        $payload = $this->payload($admin, $reviewer, $publisher);
        $question = $payload['assessments'][0]['questions'][0];
        $payload['assessments'][0]['questions'] = collect(range(1, 6))->map(function (int $number) use ($question): array {
            $row = $question;
            $row['text'] = "Persisted question {$number}?";
            $row['options'] = collect(range(1, 6))->map(fn (int $option): array => [
                'text' => "Question {$number} option {$option}",
                'correct' => $option === 1,
            ])->all();
            return $row;
        })->all();

        $courses = app(LearningCourseService::class);
        $draft = $courses->createDraft($admin, $payload);
        $detail = collect($courses->state($admin)['courses'])->firstWhere('id', $draft->course_id)['draftDetail'];
        $payload['modules'] = $detail['modules'];
        $payload['assessments'] = $detail['assessments'];
        $assessmentId = $payload['assessments'][0]['id'];
        $originalQuestionIds = collect($payload['assessments'][0]['questions'])->pluck('id')->all();

        array_shift($payload['assessments'][0]['questions']);
        $courses->saveDraft($admin, $draft->fresh(), $payload);
        array_splice($payload['assessments'][0]['questions'], 2, 1);
        $payload['assessments'][0]['questions'] = array_reverse($payload['assessments'][0]['questions']);
        $courses->saveDraft($admin, $draft->fresh(), $payload);
        array_pop($payload['assessments'][0]['questions']);
        $courses->saveDraft($admin, $draft->fresh(), $payload);

        $remainingQuestionIds = collect($payload['assessments'][0]['questions'])->pluck('id')->all();
        $this->assertSame(
            $remainingQuestionIds,
            DB::table('learning_assessment_questions')->where('assessment_id', $assessmentId)->orderBy('display_order')->pluck('id')->all(),
        );
        $this->assertEmpty(array_diff($remainingQuestionIds, $originalQuestionIds));

        $options =& $payload['assessments'][0]['questions'][0]['options'];
        $originalOptionIds = collect($options)->pluck('id')->all();
        array_shift($options);
        $courses->saveDraft($admin, $draft->fresh(), $payload);
        array_splice($options, intdiv(count($options), 2), 1);
        $options = array_reverse($options);
        $courses->saveDraft($admin, $draft->fresh(), $payload);
        array_pop($options);
        $courses->saveDraft($admin, $draft->fresh(), $payload);
        $courses->saveDraft($admin, $draft->fresh(), $payload);

        $questionId = $payload['assessments'][0]['questions'][0]['id'];
        $remainingOptionIds = collect($options)->pluck('id')->all();
        $this->assertSame(
            $remainingOptionIds,
            DB::table('learning_answer_options')->where('question_id', $questionId)->orderBy('display_order')->pluck('id')->all(),
        );
        $this->assertEmpty(array_diff($remainingOptionIds, $originalOptionIds));
        $this->assertSame(range(1, count($remainingQuestionIds)), DB::table('learning_assessment_questions')->where('assessment_id', $assessmentId)->orderBy('display_order')->pluck('display_order')->all());
        $this->assertSame(range(1, count($remainingOptionIds)), DB::table('learning_answer_options')->where('question_id', $questionId)->orderBy('display_order')->pluck('display_order')->all());
    }

    public function test_incomplete_course_cannot_enter_publication_flow(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors();
        $payload = $this->payload($admin, $reviewer, $publisher); $payload['modules'] = [];
        $draft = app(LearningCourseService::class)->createDraft($admin, $payload);
        $this->expectException(ValidationException::class);
        app(LearningCourseService::class)->submitForReview($admin, $draft);
    }

    public function test_submit_for_review_creates_append_only_review_request(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->draft($admin, $reviewer, $publisher);
        app(LearningCourseService::class)->submitForReview($admin, $draft);
        $this->assertDatabaseHas('learning_review_requests', ['course_version_id' => $draft->id, 'reviewer_id' => $reviewer->id, 'status' => 'Pending']);
        $this->assertDatabaseHas('learning_audit_events', ['event_type' => 'Course submitted to Admin for publication', 'auditable_id' => $draft->id]);
    }

    public function test_unauthorized_actor_cannot_review(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->draft($admin, $reviewer, $publisher); app(LearningCourseService::class)->submitForReview($admin, $draft);
        $this->expectException(AuthorizationException::class);
        app(LearningCourseService::class)->decideReview($publisher, $draft->fresh(), 'Approved', 'Not assigned');
    }

    public function test_reviewer_may_request_changes_only_with_comment(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->draft($admin, $reviewer, $publisher); app(LearningCourseService::class)->submitForReview($admin, $draft);
        try { app(LearningCourseService::class)->decideReview($reviewer, $draft->fresh(), 'Changes Requested'); $this->fail('Missing comment was accepted.'); } catch (ValidationException) {}
        app(LearningCourseService::class)->decideReview($reviewer, $draft->fresh(), 'Changes Requested', 'Clarify the required lesson.');
        $this->assertSame('Changes Requested', $draft->fresh()->status);
    }

    public function test_approved_first_publication_creates_v1_and_rejects_unauthorized_publisher(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->approved($admin, $reviewer, $publisher);
        try { app(LearningCourseService::class)->publish($admin, $draft); $this->fail('Author published without Publisher permission.'); } catch (AuthorizationException) {}
        app(LearningCourseService::class)->publish($reviewer, $draft);
        $this->assertSame(1, $draft->fresh()->version_number); $this->assertSame($draft->id, $draft->course->fresh()->current_published_version_id);
    }

    public function test_admin_publish_dispatches_the_official_course_package_to_the_configured_lms(): void
    {
        [$hr, $adminPublisher, $otherAdmin] = $this->actors();
        config([
            'services.learning_lms.url' => 'https://lms.example.test/api/course-publications',
            'services.learning_lms.token' => 'integration-token',
        ]);
        Http::fake([
            'https://lms.example.test/api/course-publications' => Http::response(['accepted' => true], 202),
        ]);

        $version = $this->approved($hr, $adminPublisher, $otherAdmin);
        $delivery = app(LearningCourseService::class)->publish($adminPublisher, $version);

        $this->assertSame('Delivered', $delivery['status']);
        $this->assertGreaterThanOrEqual(1, $delivery['targetCount']);
        $this->assertDatabaseHas('learning_publication_deliveries', [
            'course_version_id' => $version->id,
            'status' => 'Delivered',
            'published_by' => $adminPublisher->id,
        ]);

        Http::assertSent(function ($request) use ($version): bool {
            $payload = $request->data();

            return $request->url() === 'https://lms.example.test/api/course-publications'
                && $request->hasHeader('Authorization', 'Bearer integration-token')
                && $request->hasHeader('X-Learning-Event', 'course.published')
                && $request->hasHeader('X-Publication-Id')
                && ($payload['event'] ?? null) === 'course.published'
                && ($payload['course']['courseVersionId'] ?? null) === $version->id
                && ($payload['course']['version'] ?? null) === 1
                && ($payload['audience']['targetCount'] ?? 0) >= 1
                && in_array('learner-Canonical', $payload['audience']['eligiblePersonnelKeys'] ?? [], true)
                && collect($payload['sourceDocuments'] ?? [])->contains(
                    fn (array $source) => ($source['documentId'] ?? null) === 'ALB-PND-SOP-002',
                )
                && collect($payload['assessments'] ?? [])->pluck('type')->contains('Pre-Test')
                && collect($payload['assessments'] ?? [])->pluck('type')->contains('Post-Test');
        });
    }

    public function test_editing_published_v1_creates_separate_draft_and_keeps_v1_immutable(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $v1 = $this->publish($admin, $reviewer, $publisher); $title = $v1->title;
        $v2 = app(LearningCourseService::class)->workingDraft($admin, $v1); $payload = $this->payload($admin, $reviewer, $publisher); $payload['title'] = 'Version two working title'; app(LearningCourseService::class)->saveDraft($admin, $v2, $payload);
        $this->assertSame($title, $v1->fresh()->title); $this->assertSame('Published', $v1->fresh()->status); $this->assertNull($v2->fresh()->version_number); $this->assertSame($v1->id, $v2->based_on_version_id);
    }

    public function test_publishing_v2_preserves_v1_and_exactly_one_current_publication(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $v1 = $this->publish($admin, $reviewer, $publisher); $v2 = app(LearningCourseService::class)->workingDraft($admin, $v1);
        app(LearningCourseService::class)->submitForReview($admin, $v2); app(LearningCourseService::class)->decideReview($reviewer, $v2->fresh(), 'Approved', 'Reviewed'); app(LearningCourseService::class)->publish($reviewer, $v2->fresh());
        $this->assertSame(2, $v2->fresh()->version_number); $this->assertDatabaseHas('learning_course_versions', ['id' => $v1->id, 'version_number' => 1, 'status' => 'Archived']); $this->assertSame(1, LearningCourseVersion::where('course_id', $v1->course_id)->where('status', 'Published')->count());
    }

    public function test_existing_assignment_stays_on_v1_and_new_assignment_uses_v2(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $learnerA=$this->learner('A');$learnerB=$this->learner('B'); $v1=$this->publish($admin,$reviewer,$publisher);
        $first=app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learnerA->id]))[0]; $v2=app(LearningCourseService::class)->workingDraft($admin,$v1); app(LearningCourseService::class)->submitForReview($admin, $v2);app(LearningCourseService::class)->decideReview($reviewer,$v2->fresh(),'Approved','Ready');app(LearningCourseService::class)->publish($reviewer,$v2->fresh()); $second=app(LearningAssignmentService::class)->assign($admin,$v2->fresh(),$this->assignment([$learnerB->id]))[0];
        $this->assertSame($v1->id,LearningAssignment::find($first)->course_version_id);$this->assertSame($v2->id,LearningAssignment::find($second)->course_version_id);
    }

    public function test_archived_course_rejects_new_assignments(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$v1=$this->publish($admin,$reviewer,$publisher);app(LearningCourseService::class)->archive($reviewer,$v1->course);
        $this->expectException(ValidationException::class);app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]));
    }

    public function test_duplicate_active_assignments_are_prevented_and_bulk_rows_are_person_level(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$a=$this->learner('A');$b=$this->learner('B');$v1=$this->publish($admin,$reviewer,$publisher);$ids=app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$a->id,$b->id]));
        $this->assertCount(2,$ids);$this->assertSame(2,LearningAssignment::count());$preview=app(LearningAssignmentService::class)->preview($admin,$v1,[$a->id]);$this->assertSame('Already assigned',$preview[0]['result']);
    }

    public function test_audience_rules_exclude_invalid_people(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$outsider=$this->learner('Outside','Finance');$v1=$this->publish($admin,$reviewer,$publisher);$preview=app(LearningAssignmentService::class)->preview($admin,$v1,[$outsider->id]);$this->assertSame('Ineligible',$preview[0]['result']);
    }

    public function test_inactive_personnel_is_rejected_consistently_by_catalog_assignment_enrollment_migration_delivery_and_protected_assets(): void
    {
        Storage::fake('local');
        [$admin, $reviewer, $publisher] = $this->actors();
        $assignedLearner = $this->learner('EligibilityAssigned');
        $candidate = $this->learner('EligibilityCandidate');
        $courses = app(LearningCourseService::class);
        $assignments = app(LearningAssignmentService::class);
        $materials = app(LearningMaterialService::class);
        $payload = $this->payload($admin, $reviewer, $publisher);
        $draft = $courses->createDraft($admin, $payload);
        $lesson = LearningCourseLesson::whereIn('module_id', DB::table('learning_course_modules')->where('course_version_id', $draft->id)->pluck('id'))->firstOrFail();
        $material = $materials->store($admin, $lesson, UploadedFile::fake()->createWithContent('eligibility.pdf', '%PDF-1.7 protected eligibility content'));
        $materials->storeThumbnail($admin, $draft->fresh(), UploadedFile::fake()->image('eligibility.png', 40, 40));
        $courses->submitForReview($admin, $draft->fresh());
        $courses->decideReview($reviewer, $draft->fresh(), 'Approved', 'Reviewed');
        $courses->publish($reviewer, $draft->fresh());
        $v1 = $draft->fresh();
        $assignment = LearningAssignment::findOrFail($assignments->assign($admin, $v1, $this->assignment([$assignedLearner->id]))[0]);

        $v2 = $courses->workingDraft($admin, $v1);
        $courses->submitForReview($admin, $v2);
        $courses->decideReview($reviewer, $v2->fresh(), 'Approved', 'Reviewed');
        $courses->publish($reviewer, $v2->fresh());
        $assignedLearner->update(['employment_status' => 'Inactive']);
        $candidate->update(['employment_status' => 'Inactive']);

        $this->assertEmpty($courses->state($candidate)['catalog']);
        $this->assertSame('Ineligible', $assignments->preview($admin, $v2->fresh(), [$candidate->id])[0]['result']);
        foreach ([
            fn () => $assignments->assign($admin, $v2->fresh(), $this->assignment([$candidate->id])),
            fn () => $assignments->selfEnroll($candidate->fresh(), $v2->fresh()),
            fn () => $assignments->migrate($admin, $assignment->fresh(), $v2->fresh(), 'Eligibility changed before migration'),
            fn () => app(LearningDeliveryService::class)->player($assignedLearner->fresh(), $assignment->fresh()),
            fn () => $materials->download($assignedLearner->fresh(), $material->fresh()),
            fn () => $materials->downloadThumbnail($assignedLearner->fresh(), $v1),
        ] as $operation) {
            try {
                $operation();
                $this->fail('An inactive learner identity passed a Learning eligibility boundary.');
            } catch (AuthorizationException|ValidationException) {
            }
        }
    }

    public function test_competency_recommendation_does_not_auto_enroll_or_close_gap(): void
    {
        [$admin]=$this->actors();$learner=$this->learner('A');$id=app(LearningRequestService::class)->receive($admin,['sourceRecommendationId'=>'rec-1','personnelKey'=>$learner->personnel_key,'sourceAssessmentId'=>'final-1','sourceAssessmentVersion'=>4,'competencyId'=>'comp-1','competencyVersion'=>2,'competencyName'=>'Safety','requiredLevel'=>3,'validatedLevel'=>2,'title'=>'Develop safety','note'=>'Human review required','recommendedByName'=>'Reviewer']);
        $this->assertSame(0,LearningAssignment::count());$this->assertDatabaseHas('learning_requests',['id'=>$id,'status'=>'New','assignment_id'=>null]);
    }

    public function test_recommendation_ingestion_returns_one_immutable_record_for_identical_repeats_and_rejects_identity_conflicts(): void
    {
        [$admin] = $this->actors();
        $learner = $this->learner('Recommendation');
        $other = $this->learner('RecommendationConflict');
        $payload = [
            'sourceRecommendationId' => 'rec-concurrency-stable',
            'personnelKey' => $learner->personnel_key,
            'sourceAssessmentId' => 'assessment-immutable',
            'sourceAssessmentVersion' => 4,
            'competencyId' => 'comp-1',
            'competencyVersion' => 2,
            'competencyName' => 'Safety',
            'requiredLevel' => 3,
            'validatedLevel' => 2,
            'title' => 'Develop safety',
            'note' => 'Human review required',
            'recommendedByName' => 'Reviewer',
            'targetReassessmentDate' => '2026-12-01',
            'requestedAt' => '2026-08-01T09:00:00+08:00',
        ];
        $queries = [];
        DB::listen(function ($query) use (&$queries): void { $queries[] = strtolower($query->sql); });
        $service = app(LearningRequestService::class);
        $first = $service->receive($admin, $payload);
        $second = $service->receive($admin, $payload);
        $this->assertSame($first, $second);
        $this->assertDatabaseCount('learning_requests', 1);
        $this->assertDatabaseCount('learning_audit_events', 1);
        $this->assertTrue(collect($queries)->contains(fn (string $sql) => str_contains($sql, 'pg_advisory_xact_lock')));

        foreach ([
            array_replace($payload, ['personnelKey' => $other->personnel_key]),
            array_replace($payload, ['competencyId' => 'comp-conflict']),
            array_replace($payload, ['sourceAssessmentId' => 'assessment-conflict']),
            array_replace($payload, ['title' => 'Conflicting immutable title']),
        ] as $conflict) {
            try {
                $service->receive($admin, $conflict);
                $this->fail('A conflicting immutable recommendation overwrote the original.');
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('sourceRecommendationId', $exception->errors());
            }
        }
        $this->assertDatabaseHas('learning_requests', [
            'id' => $first,
            'personnel_key' => $learner->personnel_key,
            'competency_id' => 'comp-1',
            'source_assessment_id' => 'assessment-immutable',
            'recommendation_title' => 'Develop safety',
        ]);
    }

    public function test_linking_recommendation_does_not_resolve_it_or_modify_competency(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$v1=$this->publish($admin,$reviewer,$publisher);$id=app(LearningRequestService::class)->receive($admin,['sourceRecommendationId'=>'rec-2','personnelKey'=>$learner->personnel_key,'sourceAssessmentId'=>'final-1','sourceAssessmentVersion'=>4,'competencyId'=>'comp-1','competencyVersion'=>2,'competencyName'=>'Safety','requiredLevel'=>3,'validatedLevel'=>2,'title'=>'Develop safety','note'=>'Human review required','recommendedByName'=>'Reviewer']);app(LearningRequestService::class)->act($admin,$id,'Triage',[]);app(LearningRequestService::class)->act($admin,$id,'Link Course',['courseId'=>$v1->course_id,'courseVersionId'=>$v1->id]);
        $this->assertDatabaseHas('learning_requests',['id'=>$id,'status'=>'Ready for Assignment','validated_level'=>2]);$this->assertSame(0,LearningAssignment::count());$this->assertDatabaseCount('learning_request_actions',2);
    }

    public function test_lesson_progress_and_resume_location_persist(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$v1=$this->publish($admin,$reviewer,$publisher);$id=app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0];$assignment=LearningAssignment::find($id);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,false,45);
        $this->assertDatabaseHas('learning_lesson_progress',['assignment_id'=>$id,'lesson_id'=>$lesson->id,'status'=>'In Progress','time_spent_seconds'=>45]);$this->assertSame($lesson->id,DB::table('learning_lesson_progress')->where('assignment_id',$id)->orderByDesc('last_activity_at')->value('lesson_id'));
    }

    public function test_submitted_attempts_are_immutable_attempt_limits_and_passing_score_apply(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$payload=$this->payload($admin,$reviewer,$publisher);$payload['assessments'][1]['attemptsAllowed']=1;$v1=$this->publish($admin,$reviewer,$publisher,$payload);$assignment=LearningAssignment::find(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->where('assessment_type','Post-Test')->firstOrFail();$attempt=app(LearningDeliveryService::class)->startAttempt($learner,$assignment->fresh(),$assessment);$correct=collect($attempt->question_snapshot[0]['options'])->firstWhere('correct',true)['id'];$result=app(LearningDeliveryService::class)->submitAttempt($learner,$attempt,[['questionId'=>$attempt->question_snapshot[0]['id'],'optionIds'=>[$correct]]]);$this->assertTrue($result['passed']);$this->assertSame(100.0,$result['score']);
        $this->expectException(ValidationException::class);app(LearningDeliveryService::class)->saveResponses($learner,$attempt->fresh(),[]);
    }

    public function test_completion_creates_certificate_and_exact_version_transcript_without_closing_gap(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$v1=$this->publish($admin,$reviewer,$publisher);$assignment=LearningAssignment::find(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->where('assessment_type','Post-Test')->firstOrFail();$attempt=app(LearningDeliveryService::class)->startAttempt($learner,$assignment->fresh(),$assessment);$correct=collect($attempt->question_snapshot[0]['options'])->firstWhere('correct',true)['id'];app(LearningDeliveryService::class)->submitAttempt($learner,$attempt,[['questionId'=>$attempt->question_snapshot[0]['id'],'optionIds'=>[$correct]]]);
        $completion=DB::table('learning_completions')->where('assignment_id',$assignment->id)->first();$this->assertNotNull($completion);$this->assertSame($v1->id,$completion->course_version_id);$this->assertDatabaseHas('learning_certificates',['completion_id'=>$completion->id,'status'=>'Valid']);$this->assertDatabaseHas('learning_transcript_entries',['completion_id'=>$completion->id,'course_version_id'=>$v1->id]);$this->assertStringContainsString('"competencyGapClosed":false',DB::table('learning_audit_events')->where('event_type','Completion recorded')->value('metadata'));
        $certificateId=DB::table('learning_certificates')->where('completion_id',$completion->id)->value('id');app(LearningDeliveryService::class)->revokeCertificate($admin,$certificateId,'Superseded credential record');$this->assertDatabaseHas('learning_certificates',['id'=>$certificateId,'status'=>'Revoked','revocation_reason'=>'Superseded credential record']);$this->assertDatabaseHas('learning_transcript_entries',['completion_id'=>$completion->id,'certificate_id'=>$certificateId]);$this->assertDatabaseHas('learning_audit_events',['event_type'=>'Certificate revoked','auditable_id'=>$certificateId]);
    }

    public function test_cancelled_assignments_are_excluded_from_analytics_denominator(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$a=$this->learner('A');$b=$this->learner('B');$v1=$this->publish($admin,$reviewer,$publisher);$ids=app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$a->id,$b->id]));app(LearningAssignmentService::class)->cancel($admin,LearningAssignment::find($ids[0]),'No longer required');$analytics=app(LearningCourseService::class)->state($admin)['analytics'];$this->assertSame(1,$analytics['assigned']);$this->assertSame(1,$analytics['cancelled']);
    }

    public function test_secure_file_validation_accepts_pdf_and_rejects_executable_content(): void
    {
        Storage::fake('local');[$admin,$reviewer,$publisher]=$this->actors();$draft=$this->draft($admin,$reviewer,$publisher);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$draft->id)->pluck('id'))->firstOrFail();$material=app(LearningMaterialService::class)->store($admin,$lesson,UploadedFile::fake()->createWithContent('guide.pdf','%PDF-1.7 safe learning content'));$this->assertSame('guide.pdf',$material->display_name);Storage::disk('local')->assertExists($material->storage_path);
        $this->expectException(ValidationException::class);app(LearningMaterialService::class)->store($admin,$lesson,UploadedFile::fake()->createWithContent('payload.exe','MZ executable'));
    }

    public function test_draft_curriculum_removal_audits_and_cleans_materials_after_commit_while_rollback_and_published_history_are_protected(): void
    {
        Storage::fake('local');
        [$admin, $reviewer, $publisher] = $this->actors();
        $courses = app(LearningCourseService::class);
        $materials = app(LearningMaterialService::class);

        $payload = $this->payload($admin, $reviewer, $publisher);
        $draft = $courses->createDraft($admin, $payload);
        $lesson = LearningCourseLesson::whereIn('module_id', DB::table('learning_course_modules')->where('course_version_id', $draft->id)->pluck('id'))->firstOrFail();
        $material = $materials->store($admin, $lesson, UploadedFile::fake()->createWithContent('remove.pdf', '%PDF-1.7 removable content'));
        $path = $material->storage_path;
        $detail = collect($courses->state($admin)['courses'])->firstWhere('id', $draft->course_id)['draftDetail'];
        $payload['modules'] = [];
        $payload['assessments'] = $detail['assessments'];
        $courses->saveDraft($admin, $draft->fresh(), $payload);

        $this->assertDatabaseMissing('learning_course_lessons', ['id' => $lesson->id]);
        $this->assertDatabaseHas('learning_materials', ['id' => $material->id, 'lesson_id' => null, 'cleanup_status' => 'Complete']);
        Storage::disk('local')->assertMissing($path);
        $this->assertDatabaseHas('learning_audit_events', ['event_type' => 'Material removed with Draft lesson', 'auditable_id' => $material->id]);

        $rollbackPayload = $this->payload($admin, $reviewer, $publisher);
        $rollbackDraft = $courses->createDraft($admin, $rollbackPayload);
        $rollbackLesson = LearningCourseLesson::whereIn('module_id', DB::table('learning_course_modules')->where('course_version_id', $rollbackDraft->id)->pluck('id'))->firstOrFail();
        $rollbackMaterial = $materials->store($admin, $rollbackLesson, UploadedFile::fake()->createWithContent('rollback.pdf', '%PDF-1.7 rollback content'));
        $rollbackDetail = collect($courses->state($admin)['courses'])->firstWhere('id', $rollbackDraft->course_id)['draftDetail'];
        $rollbackPayload['modules'] = [];
        $rollbackPayload['assessments'] = $rollbackDetail['assessments'];
        $rollbackPayload['assessments'][0]['questions'][0]['type'] = str_repeat('x', 300);
        try {
            $courses->saveDraft($admin, $rollbackDraft->fresh(), $rollbackPayload);
            $this->fail('Invalid assessment content did not roll back curriculum removal.');
        } catch (\Throwable) {
        }
        $this->assertDatabaseHas('learning_course_lessons', ['id' => $rollbackLesson->id]);
        $this->assertNull($rollbackMaterial->fresh()->revoked_at);
        $this->assertNull($rollbackMaterial->fresh()->cleanup_status);
        Storage::disk('local')->assertExists($rollbackMaterial->storage_path);

        $publishedPayload = $this->payload($admin, $reviewer, $publisher);
        $publishedDraft = $courses->createDraft($admin, $publishedPayload);
        $publishedLesson = LearningCourseLesson::whereIn('module_id', DB::table('learning_course_modules')->where('course_version_id', $publishedDraft->id)->pluck('id'))->firstOrFail();
        $publishedMaterial = $materials->store($admin, $publishedLesson, UploadedFile::fake()->createWithContent('history.pdf', '%PDF-1.7 immutable history'));
        $courses->submitForReview($admin, $publishedDraft->fresh());
        $courses->decideReview($reviewer, $publishedDraft->fresh(), 'Approved', 'Reviewed');
        $courses->publish($reviewer, $publishedDraft->fresh());
        try {
            $publishedPayload['modules'] = [];
            $courses->saveDraft($admin, $publishedDraft->fresh(), $publishedPayload);
            $this->fail('Published curriculum history was rewritten.');
        } catch (ValidationException) {
        }
        $this->assertDatabaseHas('learning_course_lessons', ['id' => $publishedLesson->id]);
        $this->assertNull($publishedMaterial->fresh()->revoked_at);
        Storage::disk('local')->assertExists($publishedMaterial->storage_path);
    }

    public function test_failed_physical_material_cleanup_is_retryable_without_falsely_reporting_completion(): void
    {
        Storage::fake('local');
        [$admin, $reviewer, $publisher] = $this->actors();
        $courses = app(LearningCourseService::class);
        $payload = $this->payload($admin, $reviewer, $publisher);
        $draft = $courses->createDraft($admin, $payload);
        $lesson = LearningCourseLesson::whereIn('module_id', DB::table('learning_course_modules')->where('course_version_id', $draft->id)->pluck('id'))->firstOrFail();
        $material = app(LearningMaterialService::class)->store($admin, $lesson, UploadedFile::fake()->createWithContent('retry.pdf', '%PDF-1.7 retry content'));
        $detail = collect($courses->state($admin)['courses'])->firstWhere('id', $draft->course_id)['draftDetail'];
        $payload['modules'] = [];
        $payload['assessments'] = $detail['assessments'];

        $disk = \Mockery::mock(Storage::disk('local'))->makePartial();
        $disk->shouldReceive('exists')->twice()->andReturn(true);
        $disk->shouldReceive('delete')->twice()->andReturn(false, true);
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);

        $courses->saveDraft($admin, $draft->fresh(), $payload);
        $this->assertDatabaseHas('learning_materials', ['id' => $material->id, 'cleanup_status' => 'Failed']);
        $this->assertNotNull($material->fresh()->cleanup_error);
        app(LearningMaterialService::class)->retryPendingCleanup();
        $this->assertDatabaseHas('learning_materials', ['id' => $material->id, 'cleanup_status' => 'Complete', 'cleanup_error' => null]);
    }

    public function test_published_status_cannot_be_reused_to_bypass_review_lifecycle(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$v1=$this->publish($admin,$reviewer,$publisher);
        $this->expectException(ValidationException::class);app(LearningCourseService::class)->submitForReview($admin, $v1);
    }

    public function test_client_competency_labels_are_replaced_with_canonical_snapshot_values(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$payload=$this->payload($admin,$reviewer,$publisher);$payload['competencies']=[['id'=>'comp-communication','version'=>99,'code'=>'FAKE','name'=>'Client supplied','targetLevel'=>3]];$draft=$this->draft($admin,$reviewer,$publisher,$payload);
        $this->assertDatabaseHas('learning_course_competencies',['course_version_id'=>$draft->id,'competency_id'=>'comp-communication','competency_version'=>1,'competency_code'=>'CMP-001','competency_name'=>'Communication']);
    }

    public function test_groq_context_sanitizer_removes_nested_personal_identifiers(): void
    {
        $clean=app(LearningGroqService::class)->sanitizeContext(['course'=>['title'=>'Safe operations','learner'=>['email'=>'person@example.test']], 'notes'=>'Contact EMP-123 or person@example.test']);
        $encoded=json_encode($clean);$this->assertStringNotContainsString('person@example.test',$encoded);$this->assertStringNotContainsString('EMP-123',$encoded);$this->assertStringContainsString('Safe operations',$encoded);
    }

    public function test_attempt_start_response_never_exposes_correct_answers_or_explanations(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Leak');$v1=$this->publish($admin,$reviewer,$publisher);$assignment=LearningAssignment::find(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->where('assessment_type','Post-Test')->firstOrFail();
        $response=$this->actingAs($learner)->postJson(route('learning.api.attempts.start',['assignment'=>$assignment,'assessment'=>$assessment]));$response->assertCreated();$json=json_encode($response->json());$this->assertStringNotContainsString('"correct"',$json);$this->assertStringNotContainsString('"explanation"',$json);
    }

    public function test_archive_retires_working_state_and_rejects_content_review_ai_governance_and_material_mutations(): void
    {
        Storage::fake('local');
        [$admin,$reviewer,$publisher]=$this->actors();$v1=$this->publish($admin,$reviewer,$publisher);$draft=app(LearningCourseService::class)->workingDraft($admin,$v1);
        $lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$draft->id)->pluck('id'))->firstOrFail();
        $material=app(LearningMaterialService::class)->store($admin,$lesson,UploadedFile::fake()->createWithContent('archive.pdf','%PDF-1.7 protected content'));
        app(LearningCourseService::class)->submitForReview($admin, $draft);app(LearningCourseService::class)->archive($reviewer,$v1->course);
        $this->assertSame('Archived',$draft->fresh()->status);$this->assertDatabaseHas('learning_review_requests',['course_version_id'=>$draft->id,'status'=>'Cancelled']);
        foreach ([
            fn()=>app(LearningCourseService::class)->saveDraft($admin,$draft->fresh(),$this->payload($admin,$reviewer,$publisher)),
            fn()=>app(LearningCourseService::class)->submitForReview($admin, $draft->fresh()),
            fn()=>app(LearningCourseService::class)->workingDraft($admin,$v1->fresh()),
            fn()=>app(LearningGroqService::class)->generate($admin,$draft->fresh(),'Course Outline',['learner'=>['email'=>'leak@example.test']]),
            fn()=>app(LearningMaterialService::class)->revoke($admin,$material),
        ] as $operation) {
            try { $operation(); $this->fail('Archived lineage mutation was accepted.'); } catch (AuthorizationException|ValidationException) {}
        }
        $this->assertNull($material->fresh()->revoked_at);
    }

    public function test_hr_owns_course_content_while_admin_publication_authority_is_automatic(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();
        $payload=$this->payload($admin,$reviewer,$publisher);
        $payload['publisherId']=$publisher->id;
        $payload['reviewerIds']=[$publisher->id];
        $draft=$this->draft($admin,$reviewer,$publisher,$payload);

        $content=$payload;
        $content['title']='HR content revision';
        app(LearningCourseService::class)->saveDraft($admin,$draft,$content);

        $this->assertSame('HR content revision',$draft->fresh()->title);
        $this->assertSame($admin->id,$draft->course->fresh()->owner_id);
        $this->assertDatabaseHas('learning_course_collaborators',['course_id'=>$draft->course_id,'user_id'=>$admin->id,'permission'=>'Owner']);
        $this->assertDatabaseHas('learning_course_collaborators',['course_id'=>$draft->course_id,'user_id'=>$admin->id,'permission'=>'Author']);
        $this->assertDatabaseHas('learning_course_collaborators',['course_id'=>$draft->course_id,'user_id'=>$reviewer->id,'permission'=>'Publisher']);
        $this->assertDatabaseMissing('learning_course_collaborators',['course_id'=>$draft->course_id,'user_id'=>$publisher->id,'permission'=>'Publisher']);

        try { app(LearningCourseService::class)->saveDraft($reviewer,$draft->fresh(),$content);$this->fail('Admin edited an HR-owned Draft.'); } catch (AuthorizationException) {}
    }

    public function test_groq_grounding_is_a_strict_course_content_allowlist_without_personnel_leakage(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$payload=$this->payload($admin,$reviewer,$publisher);$payload['description']='Contact owner@example.test, EMP-9911 or +639171234567 for this course.';$draft=$this->draft($admin,$reviewer,$publisher,$payload);
        $context=app(LearningGroqService::class)->buildGroundingContext($draft,'Course Outline');$encoded=json_encode($context);
        $this->assertSame(['useCase','sourceDocuments','course'],array_keys($context));$this->assertSame(['title','description','category','difficulty','language','targetDepartments','companyWide','learningObjectives','modules'],array_keys($context['course']));$this->assertNotEmpty($context['sourceDocuments']);
        foreach (['owner@example.test','EMP-9911','+639171234567',$admin->email,$admin->personnel_key,$admin->name] as $forbidden) $this->assertStringNotContainsString((string)$forbidden,$encoded);
        $this->assertStringContainsString('Governed online course',$encoded);
    }

    public function test_learning_request_requires_completion_or_authorized_reasoned_manual_resolution(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Gate');$v1=$this->publish($admin,$reviewer,$publisher);$request=app(LearningRequestService::class)->receive($admin,['sourceRecommendationId'=>'rec-gate','personnelKey'=>$learner->personnel_key,'sourceAssessmentId'=>'final-gate','sourceAssessmentVersion'=>1,'competencyId'=>'comp-1','competencyVersion'=>1,'competencyName'=>'Safety','requiredLevel'=>3,'validatedLevel'=>1,'title'=>'Development','note'=>'Requires explicit Learning action','recommendedByName'=>'Reviewer']);
        app(LearningRequestService::class)->act($admin,$request,'Triage',[]);app(LearningRequestService::class)->act($admin,$request,'Link Course',['courseId'=>$v1->course_id,'courseVersionId'=>$v1->id]);$assignment=app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0];app(LearningRequestService::class)->act($admin,$request,'Assigned',['courseId'=>$v1->course_id,'courseVersionId'=>$v1->id,'assignmentId'=>$assignment]);
        try { app(LearningRequestService::class)->act($admin,$request,'Resolve',[]);$this->fail('Assignment creation resolved the request.'); } catch (ValidationException) {}
        try { app(LearningRequestService::class)->act($admin,$request,'Manual Resolve',['reason'=>'Administrative exception','resolutionPolicy'=>'Administrative closure without competency outcome']);$this->fail('HR used the Admin-only manual policy.'); } catch (AuthorizationException) {}
        app(LearningRequestService::class)->act($reviewer,$request,'Manual Resolve',['reason'=>'Documented administrative closure','resolutionPolicy'=>'Administrative closure without competency outcome']);
        $this->assertDatabaseHas('learning_requests',['id'=>$request,'status'=>'Resolved','validated_level'=>1]);$this->assertDatabaseHas('learning_request_actions',['learning_request_id'=>$request,'action'=>'Manual Resolve','reason'=>'Documented administrative closure']);$this->assertDatabaseCount('learning_competency_evidence',0);
    }

    public function test_assignment_defaults_and_renewal_source_lineage_are_applied(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-01-15 08:00:00','Asia/Manila'));
        try {
            [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Renew');$v1=$this->publish($admin,$reviewer,$publisher);
            $sourceId=app(LearningAssignmentService::class)->assign($admin,$v1,['learnerIds'=>[$learner->id],'source'=>'Manual Assignment','priority'=>'Normal','reason'=>'Initial requirement'])[0];$source=LearningAssignment::findOrFail($sourceId);
            $this->assertTrue($source->is_mandatory);$this->assertSame('2026-02-14',$source->due_at->setTimezone('Asia/Manila')->toDateString());
            $completedAt=Carbon::parse('2026-02-01 09:00:00','Asia/Manila');$source->update(['status'=>'Completed','progress_percent'=>100,'completed_at'=>$completedAt]);$completionId=(string)Str::uuid();
            DB::table('learning_completions')->insert(['id'=>$completionId,'assignment_id'=>$source->id,'learner_id'=>$learner->id,'course_id'=>$v1->course_id,'course_version_id'=>$v1->id,'completed_at'=>$completedAt,'rules_satisfied'=>json_encode($v1->completion_rules),'assessment_score'=>100,'completion_basis'=>'Published online course rules','source_context'=>'Online Learning','created_at'=>now(),'updated_at'=>now()]);$certificateId=(string)Str::uuid();DB::table('learning_certificates')->insert(['id'=>$certificateId,'completion_id'=>$completionId,'certificate_number'=>'ALB-LRN-SOURCE','issued_on'=>'2026-02-01','expires_on'=>'2027-02-01','status'=>'Valid','created_at'=>now(),'updated_at'=>now()]);
            $renewalId=app(LearningAssignmentService::class)->assign($admin,$v1,['learnerIds'=>[$learner->id],'source'=>'Reassignment/Renewal','priority'=>'High','reason'=>'Annual renewal','sourceCompletionId'=>$completionId,'sourceCertificateId'=>$certificateId])[0];$renewal=LearningAssignment::findOrFail($renewalId);
            $this->assertSame($completionId,$renewal->renewal_from_completion_id);$this->assertSame($certificateId,$renewal->renewal_from_certificate_id);$this->assertTrue($renewal->is_mandatory);$this->assertSame('2027-02-01',$renewal->available_from->setTimezone('Asia/Manila')->toDateString());$this->assertSame('2027-03-03',$renewal->due_at->setTimezone('Asia/Manila')->toDateString());
        } finally { Carbon::setTestNow(); }
    }

    public function test_authorized_regrade_reconciles_assignment_completion_certificate_transcript_and_audit(): void
    {
        $queries = [];
        DB::listen(function ($query) use (&$queries): void { $queries[] = strtolower($query->sql); });
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Regrade');$v1=$this->publish($admin,$reviewer,$publisher);$assignment=LearningAssignment::findOrFail(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->where('assessment_type','Post-Test')->firstOrFail();$attempt=app(LearningDeliveryService::class)->startAttempt($learner,$assignment->fresh(),$assessment);$question=$attempt->question_snapshot[0];$correct=collect($question['options'])->firstWhere('correct',true)['id'];app(LearningDeliveryService::class)->saveResponses($learner,$attempt,[['questionId'=>$question['id'],'optionIds'=>[$correct]]]);
        $savedSnapshot=$attempt->question_snapshot;LearningAssessmentAttempt::whereKey($attempt->id)->update(['status'=>'Submitted','score_percent'=>0,'passed'=>false,'submitted_at'=>now()]);$assignment->update(['status'=>'Failed/Attempts Exhausted']);$result=app(LearningDeliveryService::class)->regradeAttempt($admin,$attempt->fresh(),'Correct deterministic grading regression');
        $this->assertTrue($result['passed']);$this->assertNotNull($result['completionId']);$this->assertDatabaseHas('learning_assignments',['id'=>$assignment->id,'status'=>'Completed']);$this->assertDatabaseHas('learning_certificates',['completion_id'=>$result['completionId'],'status'=>'Valid']);$this->assertDatabaseHas('learning_transcript_entries',['completion_id'=>$result['completionId'],'course_version_id'=>$v1->id]);$this->assertDatabaseHas('learning_audit_events',['event_type'=>'Attempt regraded','auditable_id'=>$attempt->id]);
        $this->assertSame($savedSnapshot,$attempt->fresh()->question_snapshot);$audit=json_decode(DB::table('learning_audit_events')->where(['event_type'=>'Attempt regraded','auditable_id'=>$attempt->id])->value('metadata'),true);$this->assertSame('Correct deterministic grading regression',$audit['reason']);
        $this->assertTrue(collect($queries)->contains(fn (string $sql) => str_contains($sql, 'learning_attempt_responses') && str_contains($sql, 'for update')));
        $this->assertFalse(collect($queries)->contains(fn (string $sql) => str_contains($sql, 'for update') && preg_match('/\b(count|sum|avg|min|max)\s*\(/', $sql) === 1));
        try { app(LearningDeliveryService::class)->regradeAttempt($admin,$attempt->fresh(),'Try to rewrite completion');$this->fail('Regrade rewrote an immutable completion.'); } catch (ValidationException) {}
    }

    public function test_version_history_exposes_working_and_official_versions(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$v1=$this->publish($admin,$reviewer,$publisher);$v2=app(LearningCourseService::class)->workingDraft($admin,$v1);$summary=collect(app(LearningCourseService::class)->state($admin)['courses'])->firstWhere('id',$v1->course_id);$history=collect($summary['versionHistory']);
        $this->assertCount(2,$history);$this->assertTrue($history->contains(fn($row)=>$row['id']===$v1->id&&$row['versionNumber']===1&&$row['status']==='Published'));$this->assertTrue($history->contains(fn($row)=>$row['id']===$v2->id&&$row['versionNumber']===null&&$row['basedOnVersionId']===$v1->id));
    }

    public function test_course_code_sequence_skips_existing_yearly_codes(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01','Asia/Manila'));
        try { [$admin,$reviewer,$publisher]=$this->actors();LearningCourse::create(['code'=>'LRN-2026-042','owner_id'=>$admin->id]);DB::table('learning_course_code_sequences')->updateOrInsert(['year'=>2026],['last_value'=>0,'created_at'=>now(),'updated_at'=>now()]);$draft=$this->draft($admin,$reviewer,$publisher);$this->assertSame('LRN-2026-043',$draft->course->code);$this->assertSame(43,(int)DB::table('learning_course_code_sequences')->where('year',2026)->value('last_value')); } finally { Carbon::setTestNow(); }
    }

    public function test_failed_draft_creation_rolls_back_course_code_allocation_without_a_gap(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01', 'Asia/Manila'));
        try {
            [$admin, $reviewer, $publisher] = $this->actors();
            DB::table('learning_course_code_sequences')->insert(['year' => 2026, 'last_value' => 0, 'created_at' => now(), 'updated_at' => now()]);
            $invalid = $this->payload($admin, $reviewer, $publisher);
            $invalid['sourceDocumentIds'] = ['UNKNOWN-SOURCE'];
            try {
                app(LearningCourseService::class)->createDraft($admin, $invalid);
                $this->fail('Invalid source selection unexpectedly persisted a course.');
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('sourceDocumentIds', $exception->errors());
            }
            $this->assertDatabaseCount('learning_courses', 0);
            $this->assertSame(0, (int) DB::table('learning_course_code_sequences')->where('year', 2026)->value('last_value'));

            $draft = $this->draft($admin, $reviewer, $publisher);
            $this->assertSame('LRN-2026-001', $draft->course->code);
            $this->assertSame(1, (int) DB::table('learning_course_code_sequences')->where('year', 2026)->value('last_value'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_sequential_course_creates_use_the_locked_sequence_and_unique_codes(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01', 'Asia/Manila'));
        try {
            [$admin, $reviewer, $publisher] = $this->actors();
            $queries = [];
            DB::listen(function ($query) use (&$queries): void { $queries[] = strtolower($query->sql); });
            $first = $this->draft($admin, $reviewer, $publisher);
            $second = $this->draft($admin, $reviewer, $publisher);

            $this->assertSame(['LRN-2026-001', 'LRN-2026-002'], [$first->course->code, $second->course->code]);
            $this->assertSame(2, LearningCourse::query()->distinct()->count('code'));
            $this->assertTrue(collect($queries)->contains(fn (string $sql) => str_contains($sql, 'learning_course_code_sequences') && str_contains($sql, 'for update')));
            $uniqueIndexes = collect(DB::select("select indexdef from pg_indexes where tablename = 'learning_courses'"))->pluck('indexdef');
            $this->assertTrue($uniqueIndexes->contains(fn (string $definition) => str_contains($definition, 'UNIQUE') && str_contains($definition, '(code)')));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_learning_http_authorization_and_validation_are_server_enforced(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Http');$draft=$this->draft($admin,$reviewer,$publisher);
        $this->actingAs($learner)->putJson(route('learning.api.versions.save',['version'=>$draft]),$this->payload($admin,$reviewer,$publisher))->assertForbidden();
        $this->actingAs($reviewer)->postJson(route('learning.api.versions.review',['version'=>$draft]),[])->assertForbidden();
        $this->actingAs($admin)->postJson(route('learning.api.versions.review',['version'=>$draft]),[])->assertOk();
    }

    public function test_assignment_migration_is_explicit_version_pinned_and_preserves_cancelled_history(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Migrate');$v1=$this->publish($admin,$reviewer,$publisher);$old=LearningAssignment::findOrFail(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$v2=app(LearningCourseService::class)->workingDraft($admin,$v1);app(LearningCourseService::class)->submitForReview($admin, $v2);app(LearningCourseService::class)->decideReview($reviewer,$v2->fresh(),'Approved','Reviewed migration target');app(LearningCourseService::class)->publish($reviewer,$v2->fresh());$new=app(LearningAssignmentService::class)->migrate($admin,$old,$v2->fresh(),'Move active work after reviewed impact preview');
        $this->assertDatabaseHas('learning_assignments',['id'=>$old->id,'course_version_id'=>$v1->id,'status'=>'Cancelled']);$this->assertSame($v2->id,$new->course_version_id);$this->assertSame($old->id,$new->migrated_from_assignment_id);$this->assertSame('Reassignment/Renewal',$new->source);$this->assertDatabaseHas('learning_audit_events',['event_type'=>'Assignment migrated','auditable_id'=>$new->id]);
    }

    public function test_future_catalog_availability_blocks_self_enrollment(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-03-01 08:00:00','Asia/Manila'));
        try { [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Future');$payload=$this->payload($admin,$reviewer,$publisher);$payload['audience']['availableFrom']='2026-04-01T08:00:00+08:00';$v1=$this->publish($admin,$reviewer,$publisher,$payload);$this->expectException(ValidationException::class);app(LearningAssignmentService::class)->selfEnroll($learner,$v1); } finally { Carbon::setTestNow(); }
    }

    public function test_role_profile_eligibility_requires_the_canonical_profile_dimensions(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$matching=$this->learner('Supervisor');$matching->update(['position'=>'Operations Supervisor']);$outsider=$this->learner('Staff');$payload=$this->payload($admin,$reviewer,$publisher);$payload['audience']['roleProfileIds']=['profile-operations-supervisor'];$v1=$this->publish($admin,$reviewer,$publisher,$payload);$preview=collect(app(LearningAssignmentService::class)->preview($admin,$v1,[$matching->id,$outsider->id]))->keyBy('id');
        $this->assertSame('Eligible',$preview[$matching->id]['result']);$this->assertSame('Ineligible',$preview[$outsider->id]['result']);
    }

    private function actors(): array
    {
        $actors = [
            $this->user('hr-author', 'HR Course Author', UserRole::HR, 'Human Resources'),
            $this->user('admin-publisher', 'Assigned Admin Publisher', UserRole::Admin, 'Administration'),
            $this->user('other-admin', 'Other Admin', UserRole::Admin, 'Administration'),
        ];
        $this->learner('Canonical');

        return $actors;
    }
    private function learner(string $suffix,string $department='Operations'): User { return $this->user('learner-'.$suffix,'Learner '.$suffix,UserRole::User,$department); }
    private function user(string $key,string $name,UserRole $role,string $department='Operations'): User { return User::factory()->create(['personnel_key'=>$key,'core_person_id'=>'CORE-'.$key,'employee_or_trainee_id'=>'EMP-'.$key,'name'=>$name,'role'=>$role,'person_type'=>'Employee','department'=>$department,'position'=>'Staff Professional','employment_status'=>'Active','evaluator_capable'=>$role===UserRole::HR]); }
    private function draft(User $hr, User $adminPublisher, User $otherAdmin, ?array $payload = null): LearningCourseVersion
    {
        return app(LearningCourseService::class)->createDraft($hr, $payload ?? $this->payload($hr, $adminPublisher, $otherAdmin));
    }

    private function approved(User $hr, User $adminPublisher, User $otherAdmin, ?array $payload = null): LearningCourseVersion
    {
        $draft = $this->draft($hr, $adminPublisher, $otherAdmin, $payload);
        app(LearningCourseService::class)->submitForReview($hr, $draft);
        app(LearningCourseService::class)->decideReview($adminPublisher, $draft->fresh(), 'Approved', 'Reviewed against the submitted source documents.');
        return $draft->fresh();
    }

    private function publish(User $hr, User $adminPublisher, User $otherAdmin, ?array $payload = null): LearningCourseVersion
    {
        $version = $this->approved($hr, $adminPublisher, $otherAdmin, $payload);
        app(LearningCourseService::class)->publish($adminPublisher, $version);
        return $version->fresh();
    }

    private function assignment(array $ids): array
    {
        return [
            'learnerIds' => $ids,
            'source' => 'Manual Assignment',
            'availableFrom' => null,
            'dueAt' => '2026-12-31T17:00:00+08:00',
            'mandatory' => true,
            'priority' => 'Normal',
            'reason' => 'Development requirement',
        ];
    }

    private function payload(User $hr, User $adminPublisher, User $otherAdmin): array
    {
        $question = fn (string $text): array => [
            'type' => 'Multiple Choice',
            'text' => $text,
            'explanation' => 'Follow the documented procedure.',
            'points' => 1,
            'options' => [
                ['text' => 'Follow the documented procedure', 'correct' => true],
                ['text' => 'Ignore the procedure', 'correct' => false],
            ],
        ];

        return [
            'title' => 'Governed online course',
            'description' => 'A meaningful persisted course used to exercise production Learning rules.',
            'category' => 'Operations',
            'difficulty' => 'Beginner',
            'language' => 'English',
            'learningObjectives' => ['Apply the documented procedure correctly.'],
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
                'catalogVisibility' => 'Eligible users may self-enroll',
                'defaultDueDays' => 30,
                'mandatoryDefault' => true,
            ],
            'competencies' => [],
            'modules' => [[
                'clientId' => 'module-1',
                'title' => 'Foundation',
                'description' => 'Foundation module',
                'lessons' => [[
                    'title' => 'Required reading',
                    'objective' => 'Apply the procedure correctly.',
                    'description' => 'Read this lesson',
                    'contentType' => 'Text/Reading',
                    'textContent' => 'Persistent lesson content grounded in the approved operational handover procedure.',
                    'externalUrl' => null,
                    'estimatedMinutes' => 10,
                    'required' => true,
                ]],
            ]],
            'assessments' => [
                [
                    'type' => 'Pre-Test',
                    'title' => 'Pre-Test',
                    'required' => false,
                    'passingScore' => 80,
                    'attemptsAllowed' => 1,
                    'shuffleQuestions' => false,
                    'shuffleOptions' => false,
                    'feedbackPolicy' => 'After submission',
                    'moduleClientId' => null,
                    'questions' => [$question('Before training, which action follows the procedure?')],
                ],
                [
                    'type' => 'Post-Test',
                    'title' => 'Post-Test',
                    'required' => true,
                    'passingScore' => 80,
                    'attemptsAllowed' => 3,
                    'shuffleQuestions' => false,
                    'shuffleOptions' => false,
                    'feedbackPolicy' => 'After submission',
                    'moduleClientId' => null,
                    'questions' => [$question('After training, which action follows the procedure?')],
                ],
            ],
            'completion' => [
                'completeRequiredLessons' => true,
                'passRequiredKnowledgeChecks' => true,
                'passFinalAssessment' => true,
                'issueCertificate' => true,
                'certificateValidityMonths' => 12,
                'renewalIntervalMonths' => 12,
            ],
        ];
    }

}
