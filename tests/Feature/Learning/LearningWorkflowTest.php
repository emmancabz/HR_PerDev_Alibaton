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
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LearningWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_draft_persists_without_incrementing_official_version(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors();
        $draft = app(LearningCourseService::class)->createDraft($admin, $this->payload($admin, $reviewer, $publisher));
        $this->assertDatabaseHas('learning_course_versions', ['id' => $draft->id, 'status' => 'Draft', 'version_number' => null]);
        app(LearningCourseService::class)->saveDraft($admin, $draft, array_replace($this->payload($admin, $reviewer, $publisher), ['title' => 'Saved after reload']));
        $this->assertNull($draft->fresh()->version_number);
        $this->assertSame('Saved after reload', $draft->fresh()->title);
    }

    public function test_incomplete_course_cannot_enter_publication_flow(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors();
        $payload = $this->payload($admin, $reviewer, $publisher); $payload['modules'] = [];
        $draft = app(LearningCourseService::class)->createDraft($admin, $payload);
        $this->expectException(ValidationException::class);
        app(LearningCourseService::class)->submitForReview($admin, $draft, $reviewer->id);
    }

    public function test_submit_for_review_creates_append_only_review_request(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->draft($admin, $reviewer, $publisher);
        app(LearningCourseService::class)->submitForReview($admin, $draft, $reviewer->id);
        $this->assertDatabaseHas('learning_review_requests', ['course_version_id' => $draft->id, 'reviewer_id' => $reviewer->id, 'status' => 'Pending']);
        $this->assertDatabaseHas('learning_audit_events', ['event_type' => 'Review submitted', 'auditable_id' => $draft->id]);
    }

    public function test_unauthorized_actor_cannot_review(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->draft($admin, $reviewer, $publisher); app(LearningCourseService::class)->submitForReview($admin, $draft, $reviewer->id);
        $this->expectException(AuthorizationException::class);
        app(LearningCourseService::class)->decideReview($publisher, $draft->fresh(), 'Approved', 'Not assigned');
    }

    public function test_reviewer_may_request_changes_only_with_comment(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->draft($admin, $reviewer, $publisher); app(LearningCourseService::class)->submitForReview($admin, $draft, $reviewer->id);
        try { app(LearningCourseService::class)->decideReview($reviewer, $draft->fresh(), 'Changes Requested'); $this->fail('Missing comment was accepted.'); } catch (ValidationException) {}
        app(LearningCourseService::class)->decideReview($reviewer, $draft->fresh(), 'Changes Requested', 'Clarify the required lesson.');
        $this->assertSame('Changes Requested', $draft->fresh()->status);
    }

    public function test_approved_first_publication_creates_v1_and_rejects_unauthorized_publisher(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $draft = $this->approved($admin, $reviewer, $publisher);
        try { app(LearningCourseService::class)->publish($admin, $draft); $this->fail('Author published without Publisher permission.'); } catch (AuthorizationException) {}
        app(LearningCourseService::class)->publish($publisher, $draft);
        $this->assertSame(1, $draft->fresh()->version_number); $this->assertSame($draft->id, $draft->course->fresh()->current_published_version_id);
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
        app(LearningCourseService::class)->submitForReview($admin, $v2, $reviewer->id); app(LearningCourseService::class)->decideReview($reviewer, $v2->fresh(), 'Approved', 'Reviewed'); app(LearningCourseService::class)->publish($publisher, $v2->fresh());
        $this->assertSame(2, $v2->fresh()->version_number); $this->assertDatabaseHas('learning_course_versions', ['id' => $v1->id, 'version_number' => 1, 'status' => 'Archived']); $this->assertSame(1, LearningCourseVersion::where('course_id', $v1->course_id)->where('status', 'Published')->count());
    }

    public function test_existing_assignment_stays_on_v1_and_new_assignment_uses_v2(): void
    {
        [$admin, $reviewer, $publisher] = $this->actors(); $learnerA=$this->learner('A');$learnerB=$this->learner('B'); $v1=$this->publish($admin,$reviewer,$publisher);
        $first=app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learnerA->id]))[0]; $v2=app(LearningCourseService::class)->workingDraft($admin,$v1); app(LearningCourseService::class)->submitForReview($admin,$v2,$reviewer->id);app(LearningCourseService::class)->decideReview($reviewer,$v2->fresh(),'Approved','Ready');app(LearningCourseService::class)->publish($publisher,$v2->fresh()); $second=app(LearningAssignmentService::class)->assign($admin,$v2->fresh(),$this->assignment([$learnerB->id]))[0];
        $this->assertSame($v1->id,LearningAssignment::find($first)->course_version_id);$this->assertSame($v2->id,LearningAssignment::find($second)->course_version_id);
    }

    public function test_archived_course_rejects_new_assignments(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$v1=$this->publish($admin,$reviewer,$publisher);app(LearningCourseService::class)->archive($publisher,$v1->course);
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

    public function test_competency_recommendation_does_not_auto_enroll_or_close_gap(): void
    {
        [$admin]=$this->actors();$learner=$this->learner('A');$id=app(LearningRequestService::class)->receive($admin,['sourceRecommendationId'=>'rec-1','personnelKey'=>$learner->personnel_key,'sourceAssessmentId'=>'final-1','sourceAssessmentVersion'=>4,'competencyId'=>'comp-1','competencyVersion'=>2,'competencyName'=>'Safety','requiredLevel'=>3,'validatedLevel'=>2,'title'=>'Develop safety','note'=>'Human review required','recommendedByName'=>'Reviewer']);
        $this->assertSame(0,LearningAssignment::count());$this->assertDatabaseHas('learning_requests',['id'=>$id,'status'=>'New','assignment_id'=>null]);
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
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$payload=$this->payload($admin,$reviewer,$publisher);$payload['assessments'][0]['attemptsAllowed']=1;$v1=$this->publish($admin,$reviewer,$publisher,$payload);$assignment=LearningAssignment::find(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->firstOrFail();$attempt=app(LearningDeliveryService::class)->startAttempt($learner,$assignment->fresh(),$assessment);$correct=collect($attempt->question_snapshot[0]['options'])->firstWhere('correct',true)['id'];$result=app(LearningDeliveryService::class)->submitAttempt($learner,$attempt,[['questionId'=>$attempt->question_snapshot[0]['id'],'optionIds'=>[$correct]]]);$this->assertTrue($result['passed']);$this->assertSame(100.0,$result['score']);
        $this->expectException(ValidationException::class);app(LearningDeliveryService::class)->saveResponses($learner,$attempt->fresh(),[]);
    }

    public function test_completion_creates_certificate_and_exact_version_transcript_without_closing_gap(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('A');$v1=$this->publish($admin,$reviewer,$publisher);$assignment=LearningAssignment::find(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->firstOrFail();$attempt=app(LearningDeliveryService::class)->startAttempt($learner,$assignment->fresh(),$assessment);$correct=collect($attempt->question_snapshot[0]['options'])->firstWhere('correct',true)['id'];app(LearningDeliveryService::class)->submitAttempt($learner,$attempt,[['questionId'=>$attempt->question_snapshot[0]['id'],'optionIds'=>[$correct]]]);
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

    public function test_published_status_cannot_be_reused_to_bypass_review_lifecycle(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$v1=$this->publish($admin,$reviewer,$publisher);
        $this->expectException(ValidationException::class);app(LearningCourseService::class)->submitForReview($admin,$v1,$reviewer->id);
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
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Leak');$v1=$this->publish($admin,$reviewer,$publisher);$assignment=LearningAssignment::find(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->firstOrFail();
        $response=$this->actingAs($learner)->postJson(route('learning.api.attempts.start',['assignment'=>$assignment,'assessment'=>$assessment]));$response->assertCreated();$json=json_encode($response->json());$this->assertStringNotContainsString('"correct"',$json);$this->assertStringNotContainsString('"explanation"',$json);
    }

    public function test_archive_retires_working_state_and_rejects_content_review_ai_governance_and_material_mutations(): void
    {
        Storage::fake('local');
        [$admin,$reviewer,$publisher]=$this->actors();$v1=$this->publish($admin,$reviewer,$publisher);$draft=app(LearningCourseService::class)->workingDraft($admin,$v1);
        $lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$draft->id)->pluck('id'))->firstOrFail();
        $material=app(LearningMaterialService::class)->store($admin,$lesson,UploadedFile::fake()->createWithContent('archive.pdf','%PDF-1.7 protected content'));
        app(LearningCourseService::class)->submitForReview($admin,$draft,$reviewer->id);app(LearningCourseService::class)->archive($publisher,$v1->course);
        $this->assertSame('Archived',$draft->fresh()->status);$this->assertDatabaseHas('learning_review_requests',['course_version_id'=>$draft->id,'status'=>'Cancelled']);
        foreach ([
            fn()=>app(LearningCourseService::class)->saveDraft($admin,$draft->fresh(),$this->payload($admin,$reviewer,$publisher)),
            fn()=>app(LearningCourseService::class)->submitForReview($admin,$draft->fresh(),$reviewer->id),
            fn()=>app(LearningCourseService::class)->workingDraft($admin,$v1->fresh()),
            fn()=>app(LearningGroqService::class)->generate($admin,$draft->fresh(),'Course Outline',['learner'=>['email'=>'leak@example.test']]),
            fn()=>app(LearningMaterialService::class)->revoke($admin,$material),
        ] as $operation) {
            try { $operation(); $this->fail('Archived lineage mutation was accepted.'); } catch (AuthorizationException|ValidationException) {}
        }
        $this->assertNull($material->fresh()->revoked_at);
    }

    public function test_author_can_edit_content_but_cannot_change_governance_or_self_elevate(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$author=$this->user('author','Course Author',UserRole::User);$payload=$this->payload($admin,$reviewer,$publisher);$payload['authorIds'][]=$author->id;$draft=$this->draft($admin,$reviewer,$publisher,$payload);
        $content=$payload;$content['title']='Author content revision';app(LearningCourseService::class)->saveDraft($author,$draft,$content);$this->assertSame('Author content revision',$draft->fresh()->title);
        $elevation=$content;$elevation['ownerId']=$author->id;$elevation['publisherId']=$author->id;
        try { app(LearningCourseService::class)->saveDraft($author,$draft->fresh(),$elevation);$this->fail('Author changed governance.'); } catch (AuthorizationException) {}
        $this->assertSame($admin->id,$draft->course->fresh()->owner_id);$this->assertDatabaseHas('learning_course_collaborators',['course_id'=>$draft->course_id,'user_id'=>$publisher->id,'permission'=>'Publisher']);$this->assertDatabaseMissing('learning_course_collaborators',['course_id'=>$draft->course_id,'user_id'=>$author->id,'permission'=>'Publisher']);
    }

    public function test_groq_grounding_is_a_strict_course_content_allowlist_without_personnel_leakage(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$payload=$this->payload($admin,$reviewer,$publisher);$payload['description']='Contact owner@example.test, EMP-9911 or +639171234567 for this course.';$draft=$this->draft($admin,$reviewer,$publisher,$payload);
        $context=app(LearningGroqService::class)->buildGroundingContext($draft,'Course Outline');$encoded=json_encode($context);
        $this->assertSame(['useCase','course'],array_keys($context));$this->assertSame(['title','description','category','difficulty','language','learningObjectives','modules'],array_keys($context['course']));
        foreach (['owner@example.test','EMP-9911','+639171234567',$admin->email,$admin->personnel_key,$admin->name,'learner','personnel','metadata'] as $forbidden) $this->assertStringNotContainsString((string)$forbidden,$encoded);
        $this->assertStringContainsString('Governed online course',$encoded);
    }

    public function test_learning_request_requires_completion_or_authorized_reasoned_manual_resolution(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Gate');$v1=$this->publish($admin,$reviewer,$publisher);$request=app(LearningRequestService::class)->receive($admin,['sourceRecommendationId'=>'rec-gate','personnelKey'=>$learner->personnel_key,'sourceAssessmentId'=>'final-gate','sourceAssessmentVersion'=>1,'competencyId'=>'comp-1','competencyVersion'=>1,'competencyName'=>'Safety','requiredLevel'=>3,'validatedLevel'=>1,'title'=>'Development','note'=>'Requires explicit Learning action','recommendedByName'=>'Reviewer']);
        app(LearningRequestService::class)->act($admin,$request,'Triage',[]);app(LearningRequestService::class)->act($admin,$request,'Link Course',['courseId'=>$v1->course_id,'courseVersionId'=>$v1->id]);$assignment=app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0];app(LearningRequestService::class)->act($admin,$request,'Assigned',['courseId'=>$v1->course_id,'courseVersionId'=>$v1->id,'assignmentId'=>$assignment]);
        try { app(LearningRequestService::class)->act($admin,$request,'Resolve',[]);$this->fail('Assignment creation resolved the request.'); } catch (ValidationException) {}
        try { app(LearningRequestService::class)->act($reviewer,$request,'Manual Resolve',['reason'=>'Administrative exception','resolutionPolicy'=>'Administrative closure without competency outcome']);$this->fail('HR used the Admin-only manual policy.'); } catch (AuthorizationException) {}
        app(LearningRequestService::class)->act($admin,$request,'Manual Resolve',['reason'=>'Documented administrative closure','resolutionPolicy'=>'Administrative closure without competency outcome']);
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
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Regrade');$v1=$this->publish($admin,$reviewer,$publisher);$assignment=LearningAssignment::findOrFail(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$lesson=LearningCourseLesson::whereIn('module_id',DB::table('learning_course_modules')->where('course_version_id',$v1->id)->pluck('id'))->firstOrFail();app(LearningDeliveryService::class)->recordLesson($learner,$assignment,$lesson->id,true);$assessment=LearningAssessment::where('course_version_id',$v1->id)->firstOrFail();$attempt=app(LearningDeliveryService::class)->startAttempt($learner,$assignment->fresh(),$assessment);$question=$attempt->question_snapshot[0];$correct=collect($question['options'])->firstWhere('correct',true)['id'];app(LearningDeliveryService::class)->saveResponses($learner,$attempt,[['questionId'=>$question['id'],'optionIds'=>[$correct]]]);
        LearningAssessmentAttempt::whereKey($attempt->id)->update(['status'=>'Submitted','score_percent'=>0,'passed'=>false,'submitted_at'=>now()]);$assignment->update(['status'=>'Failed/Attempts Exhausted']);$result=app(LearningDeliveryService::class)->regradeAttempt($admin,$attempt->fresh(),'Correct deterministic grading regression');
        $this->assertTrue($result['passed']);$this->assertNotNull($result['completionId']);$this->assertDatabaseHas('learning_assignments',['id'=>$assignment->id,'status'=>'Completed']);$this->assertDatabaseHas('learning_certificates',['completion_id'=>$result['completionId'],'status'=>'Valid']);$this->assertDatabaseHas('learning_transcript_entries',['completion_id'=>$result['completionId'],'course_version_id'=>$v1->id]);$this->assertDatabaseHas('learning_audit_events',['event_type'=>'Attempt regraded','auditable_id'=>$attempt->id]);
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

    public function test_learning_http_authorization_and_validation_are_server_enforced(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Http');$draft=$this->draft($admin,$reviewer,$publisher);
        $this->actingAs($learner)->putJson(route('learning.api.versions.save',['version'=>$draft]),$this->payload($admin,$reviewer,$publisher))->assertForbidden();
        $this->actingAs($admin)->postJson(route('learning.api.versions.review',['version'=>$draft]),[])->assertUnprocessable()->assertJsonValidationErrors('reviewerId');
    }

    public function test_assignment_migration_is_explicit_version_pinned_and_preserves_cancelled_history(): void
    {
        [$admin,$reviewer,$publisher]=$this->actors();$learner=$this->learner('Migrate');$v1=$this->publish($admin,$reviewer,$publisher);$old=LearningAssignment::findOrFail(app(LearningAssignmentService::class)->assign($admin,$v1,$this->assignment([$learner->id]))[0]);$v2=app(LearningCourseService::class)->workingDraft($admin,$v1);app(LearningCourseService::class)->submitForReview($admin,$v2,$reviewer->id);app(LearningCourseService::class)->decideReview($reviewer,$v2->fresh(),'Approved','Reviewed migration target');app(LearningCourseService::class)->publish($publisher,$v2->fresh());$new=app(LearningAssignmentService::class)->migrate($admin,$old,$v2->fresh(),'Move active work after reviewed impact preview');
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

    private function actors(): array { return [$this->user('admin','Admin',UserRole::Admin),$this->user('reviewer','Reviewer',UserRole::HR),$this->user('publisher','Publisher',UserRole::Admin)]; }
    private function learner(string $suffix,string $department='Operations'): User { return $this->user('learner-'.$suffix,'Learner '.$suffix,UserRole::User,$department); }
    private function user(string $key,string $name,UserRole $role,string $department='Operations'): User { return User::factory()->create(['personnel_key'=>$key,'core_person_id'=>'CORE-'.$key,'employee_or_trainee_id'=>'EMP-'.$key,'name'=>$name,'role'=>$role,'person_type'=>'Employee','department'=>$department,'position'=>'Staff Professional','employment_status'=>'Active','evaluator_capable'=>$role===UserRole::HR]); }
    private function draft(User $admin,User $reviewer,User $publisher,?array $payload=null): LearningCourseVersion { return app(LearningCourseService::class)->createDraft($admin,$payload??$this->payload($admin,$reviewer,$publisher)); }
    private function approved(User $admin,User $reviewer,User $publisher,?array $payload=null): LearningCourseVersion { $draft=$this->draft($admin,$reviewer,$publisher,$payload);app(LearningCourseService::class)->submitForReview($admin,$draft,$reviewer->id);app(LearningCourseService::class)->decideReview($reviewer,$draft->fresh(),'Approved','Reviewed');return $draft->fresh(); }
    private function publish(User $admin,User $reviewer,User $publisher,?array $payload=null): LearningCourseVersion { $version=$this->approved($admin,$reviewer,$publisher,$payload);app(LearningCourseService::class)->publish($publisher,$version);return $version->fresh(); }
    private function assignment(array $ids): array { return ['learnerIds'=>$ids,'source'=>'Manual Assignment','availableFrom'=>null,'dueAt'=>'2026-12-31T17:00:00+08:00','mandatory'=>true,'priority'=>'Normal','reason'=>'Development requirement']; }
    private function payload(User $owner,User $reviewer,User $publisher): array { return ['title'=>'Governed online course','description'=>'A meaningful persisted course used to exercise production Learning rules.','category'=>'Operations','difficulty'=>'Beginner','language'=>'English','learningObjectives'=>['Apply the documented procedure correctly.'],'ownerId'=>$owner->id,'subjectMatterExpertId'=>$owner->id,'authorIds'=>[$owner->id],'reviewerIds'=>[$reviewer->id],'publisherId'=>$publisher->id,'audience'=>['personTypes'=>['Employee'],'allDepartments'=>false,'departments'=>['Operations'],'positions'=>[],'roleProfileIds'=>[],'catalogVisibility'=>'Eligible users may self-enroll','defaultDueDays'=>30,'mandatoryDefault'=>true],'competencies'=>[],'modules'=>[['clientId'=>'module-1','title'=>'Foundation','description'=>'Foundation module','lessons'=>[['title'=>'Required reading','objective'=>'Apply the procedure correctly.','description'=>'Read this lesson','contentType'=>'Text/Reading','textContent'=>'Persistent lesson content','externalUrl'=>null,'estimatedMinutes'=>10,'required'=>true]]]],'assessments'=>[['type'=>'Final Assessment','title'=>'Final Assessment','required'=>true,'passingScore'=>80,'attemptsAllowed'=>3,'shuffleQuestions'=>false,'shuffleOptions'=>false,'feedbackPolicy'=>'After submission','questions'=>[['type'=>'Multiple Choice','text'=>'Which action follows the procedure?','explanation'=>'Follow it','points'=>1,'options'=>[['text'=>'Follow the documented procedure','correct'=>true],['text'=>'Ignore the procedure','correct'=>false]]]]]],'completion'=>['completeRequiredLessons'=>true,'passRequiredKnowledgeChecks'=>true,'passFinalAssessment'=>true,'issueCertificate'=>true,'certificateValidityMonths'=>12,'renewalIntervalMonths'=>12]]; }
}
