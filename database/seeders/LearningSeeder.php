<?php

namespace Database\Seeders;

use App\Models\Learning\LearningCourse;
use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use App\Services\Learning\LearningCourseService;
use App\Services\Learning\LearningSourceLibraryService;
use App\Services\Learning\LearningSourceReviewService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class LearningSeeder extends Seeder
{
    private const ASSIGNMENTS = [
        'Not Started' => '10000000-0000-4000-8000-000000000001',
        'In Progress' => '10000000-0000-4000-8000-000000000002',
        'Completed' => '10000000-0000-4000-8000-000000000003',
        'Cancelled' => '10000000-0000-4000-8000-000000000004',
        'Overdue' => '10000000-0000-4000-8000-000000000005',
        'Failed/Attempts Exhausted' => '10000000-0000-4000-8000-000000000006',
    ];
    private const COURSES = [
        'Operational Handover Fundamentals' => ['80000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'LRN-2026-901'],
        'Workplace Risk Recognition' => ['80000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002', 'LRN-2026-902'],
        'Accurate Financial Recordkeeping' => ['80000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000003', 'LRN-2026-903'],
        'Port Operations Safety Essentials' => ['80000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000004', 'LRN-2026-904'],
        'Historical Site Induction' => ['80000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000005', 'LRN-2026-905'],
        'Data Privacy and Information Security Awareness' => ['80000000-0000-4000-8000-000000000006', '81000000-0000-4000-8000-000000000006', 'LRN-2026-906'],
        'Crane Operations Fundamentals' => ['80000000-0000-4000-8000-000000000007', '81000000-0000-4000-8000-000000000007', 'LRN-2026-907'],
        'Supervisory Leadership for Field Operations' => ['80000000-0000-4000-8000-000000000008', '81000000-0000-4000-8000-000000000008', 'LRN-2026-908'],
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('Learning operational population is forbidden in production.');
        }
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Learning operational population is limited to local or testing environments.');
        }
        if (! config('learning.operational_seed_enabled')) {
            throw new RuntimeException('Set LEARNING_OPERATIONAL_SEED=true to explicitly opt in.');
        }

        $hr = User::query()->activePersonnel()->where('role', 'hr')->orderBy('id')->firstOrFail();
        $admin = User::query()->where('role', 'admin')->orderBy('id')->firstOrFail();
        $courses = app(LearningCourseService::class);

        $draft = $this->ensureCourse($courses, 'Operational Handover Fundamentals', 'Draft', $hr, $admin);
        $this->ensureCourse($courses, 'Workplace Risk Recognition', 'In Review', $hr, $admin);
        $this->ensureCourse($courses, 'Accurate Financial Recordkeeping', 'Approved', $hr, $admin);
        $published = $this->ensureCourse($courses, 'Port Operations Safety Essentials', 'Published', $hr, $admin);
        $this->ensureCourse($courses, 'Historical Site Induction', 'Archived', $hr, $admin);
        $this->ensureCourse($courses, 'Data Privacy and Information Security Awareness', 'Published', $hr, $admin);
        $this->ensureCourse($courses, 'Crane Operations Fundamentals', 'Published', $hr, $admin);
        $this->ensureCourse($courses, 'Supervisory Leadership for Field Operations', 'Published', $hr, $admin);

        $this->populateOperations($admin, $published);
        $this->populateRequest($admin, $draft);
    }

    private function ensureCourse(LearningCourseService $courses, string $title, string $target, User $hr, User $admin): LearningCourseVersion
    {
        [$courseId, $versionId, $code] = self::COURSES[$title];
        $courseById = LearningCourse::query()->find($courseId);
        $courseByCode = LearningCourse::query()->where('code', $code)->first();
        if (($courseById && $courseById->code !== $code) || ($courseByCode && $courseByCode->id !== $courseId)) {
            throw new RuntimeException("Learning operational population stopped: deterministic course {$courseId}/{$code} belongs to an unexpected record.");
        }
        $course = $courseById ?? $courseByCode;
        $version = LearningCourseVersion::query()->find($versionId);
        if ($version && $version->course_id !== $courseId) {
            throw new RuntimeException("Learning operational population stopped: deterministic version {$versionId} belongs to another course.");
        }
        if (($course && ! $version) || (! $course && $version)) {
            throw new RuntimeException("Learning operational population stopped: deterministic course {$courseId}/{$code} and version {$versionId} do not have complete population provenance.");
        }
        if (! $course && ! $version) {
            $course = LearningCourse::query()->create([
                'id' => $courseId,
                'code' => $code, 'owner_id' => $hr->id, 'current_published_version_id' => null,
                'archived_at' => null, 'archived_by' => null,
            ]);
            $version = LearningCourseVersion::query()->create([
                'id' => $versionId,
                'course_id' => $course->id, 'version_number' => null, 'status' => 'Draft', 'builder_stage' => 0,
                'is_untouched_initial_draft' => false,
                'title' => '', 'description' => '', 'category' => 'Operations', 'difficulty' => 'Beginner', 'language' => 'English',
                'learning_objectives' => [], 'estimated_duration_minutes' => 0, 'audience_rules' => [], 'completion_rules' => [],
                'created_by' => $hr->id, 'updated_by' => $hr->id,
            ]);
        }

        // These deterministic records are local/testing showcase data. Realign legacy seeded
        // governance without rewriting historical version authorship: HR owns/authors course
        // content, while the first Admin account is the publication authority.
        $this->alignGovernance($course, $version, $hr, $admin);

        if (in_array($version->status, ['Draft', 'Changes Requested'], true) && $version->version_number === null) {
            $version = $courses->saveDraft($hr, $version, $this->payload($title, $hr));
        } elseif (Schema::hasTable('learning_course_source_links')) {
            app(LearningSourceLibraryService::class)->sync($hr, $version, $this->sourceDocumentIds($title));
        }
        $version = $version->fresh();

        // Legacy deterministic records may already be waiting for Admin review. Backfill a
        // source review after linking the controlled company references so the current
        // publish gate remains real rather than being bypassed by the showcase seeder.
        if (Schema::hasTable('learning_course_source_reviews')
            && in_array($version->status, ['In Review', 'Approved'], true)
            && ! DB::table('learning_course_source_reviews')->where('course_version_id', $version->id)->exists()) {
            app(LearningSourceReviewService::class)->scan($admin, $version);
        }

        if (in_array($target, ['In Review', 'Approved', 'Published', 'Archived'], true) && $version->status === 'Draft') {
            $courses->submitForReview($hr, $version);
            $version = $version->fresh();
        }
        if (in_array($target, ['Approved', 'Published', 'Archived'], true) && $version->status === 'In Review') {
            $courses->decideReview($admin, $version, 'Approved', 'Course content and source review verified for publication.');
            $version = $version->fresh();
        }
        if (in_array($target, ['Published', 'Archived'], true) && $version->status === 'Approved') {
            $courses->publish($admin, $version);
            $version = $version->fresh();
        }
        if ($target === 'Archived' && ! $version->course->archived_at) {
            $courses->archive($admin, $version->course);
            $version = $version->fresh();
        }

        return $version;
    }

    private function alignGovernance(LearningCourse $course, LearningCourseVersion $version, User $hr, User $admin): void
    {
        $course->forceFill(['owner_id' => $hr->id])->save();

        // Seeder-owned deterministic records may be upgraded from the previous Admin-authored
        // showcase. Limit the rewrite to this known course lineage and rebuild only its
        // governance collaborators.
        DB::table('learning_course_collaborators')->where('course_id', $course->id)->delete();
        foreach ([
            [$hr->id, 'Owner', $hr->id],
            [$hr->id, 'Author', $hr->id],
            [$admin->id, 'Publisher', $hr->id],
        ] as [$userId, $permission, $authorizedBy]) {
            DB::table('learning_course_collaborators')->insert([
                'course_id' => $course->id,
                'user_id' => $userId,
                'permission' => $permission,
                'authorized_by' => $authorizedBy,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($version->status === 'In Review') {
            DB::table('learning_review_requests')
                ->where('course_version_id', $version->id)
                ->where('status', 'Pending')
                ->update(['reviewer_id' => $admin->id, 'updated_at' => now()]);
        }
    }

    private function populateOperations(User $admin, LearningCourseVersion $version): void
    {
        $at = $this->referenceTime();
        $learners = User::query()->activePersonnel()->where('role', 'user')->orderBy('id')->limit(6)->get();
        if ($learners->count() < 6) throw new RuntimeException('At least six active canonical personnel records are required.');
        $rows = [
            ['Not Started', 'Not Started', 0, $at->addDays(20), null, null],
            ['In Progress', 'In Progress', 45, $at->addDays(10), null, null],
            ['Completed', 'Completed', 100, $at->subDay(), $at->subDays(2), null],
            ['Cancelled', 'Cancelled', 0, $at->addDays(12), null, $at->subDay()],
            ['Overdue', 'In Progress', 70, $at->subDays(4), null, null],
            ['Failed/Attempts Exhausted', 'Failed/Attempts Exhausted', 100, $at->subDays(2), null, null],
        ];

        DB::transaction(function () use ($rows, $learners, $admin, $version, $at): void {
            foreach ($rows as $index => [$key, $status, $progress, $dueAt, $completedAt, $cancelledAt]) {
                DB::table('learning_assignments')->updateOrInsert(['id' => self::ASSIGNMENTS[$key]], [
                    'learner_id' => $learners[$index]->id, 'course_id' => $version->course_id, 'course_version_id' => $version->id,
                    'source' => $key === 'Overdue' ? 'Role/Position Requirement' : 'Manual Assignment', 'assigned_by' => $admin->id,
                    'assigned_at' => $at->subDays(14), 'available_from' => $at->subDays(14), 'due_at' => $dueAt,
                    'is_mandatory' => true, 'priority' => $key === 'Overdue' ? 'Critical' : 'Normal', 'reason' => 'Operational Learning coverage',
                    'status' => $status, 'progress_percent' => $progress, 'migrated_from_assignment_id' => null,
                    'renewal_from_completion_id' => null, 'renewal_from_certificate_id' => null, 'completed_at' => $completedAt,
                    'cancelled_at' => $cancelledAt, 'cancellation_reason' => $cancelledAt ? 'Assignment superseded before activity began.' : null,
                    'created_at' => $at, 'updated_at' => $at,
                ]);
            }

            $lesson = DB::table('learning_course_lessons as lesson')->join('learning_course_modules as module', 'module.id', '=', 'lesson.module_id')
                ->where('module.course_version_id', $version->id)->value('lesson.id');
            $assessment = DB::table('learning_assessments')->where('course_version_id', $version->id)->where('assessment_type', 'Post-Test')->value('id');
            if ($lesson) {
                foreach ([self::ASSIGNMENTS['In Progress'] => 45, self::ASSIGNMENTS['Completed'] => 100, self::ASSIGNMENTS['Overdue'] => 70] as $assignmentId => $progress) {
                    DB::table('learning_lesson_progress')->updateOrInsert(['assignment_id' => $assignmentId, 'lesson_id' => $lesson], [
                        'status' => $progress === 100 ? 'Completed' : 'In Progress', 'started_at' => $at->subDays(5),
                        'completed_at' => $progress === 100 ? $at->subDays(2) : null, 'time_spent_seconds' => $progress * 12,
                        'last_activity_at' => $at->subDay(), 'created_at' => $at, 'updated_at' => $at,
                    ]);
                }
            }
            if ($assessment) {
                $this->attempt('20000000-0000-4000-8000-000000000001', self::ASSIGNMENTS['Completed'], $assessment, 1, 100, true);
                $this->attempt('20000000-0000-4000-8000-000000000002', self::ASSIGNMENTS['Failed/Attempts Exhausted'], $assessment, 1, 0, false);
                $this->attempt('20000000-0000-4000-8000-000000000003', self::ASSIGNMENTS['Failed/Attempts Exhausted'], $assessment, 2, 0, false);
                $this->attempt('20000000-0000-4000-8000-000000000004', self::ASSIGNMENTS['Failed/Attempts Exhausted'], $assessment, 3, 0, false);
                $this->attempt('20000000-0000-4000-8000-000000000005', self::ASSIGNMENTS['In Progress'], $assessment, 1, 100, true);
            }

            DB::table('learning_completions')->updateOrInsert(['id' => '30000000-0000-4000-8000-000000000001'], [
                'assignment_id' => self::ASSIGNMENTS['Completed'], 'learner_id' => $learners[2]->id, 'course_id' => $version->course_id,
                'course_version_id' => $version->id, 'completed_at' => $at->subDays(2),
                'rules_satisfied' => json_encode(['requiredLessons' => true, 'requiredAssessments' => true]), 'assessment_score' => 100,
                'completion_basis' => 'Published online course rules', 'source_context' => 'Online Learning', 'created_at' => $at, 'updated_at' => $at,
            ]);
            DB::table('learning_certificates')->updateOrInsert(['id' => '40000000-0000-4000-8000-000000000001'], [
                'completion_id' => '30000000-0000-4000-8000-000000000001', 'certificate_number' => 'ALB-LRN-OPS-0001',
                'issued_on' => $at->toDateString(), 'expires_on' => $at->addYear()->toDateString(), 'status' => 'Valid', 'revoked_at' => null,
                'revocation_reason' => null, 'replaced_by_certificate_id' => null, 'created_at' => $at, 'updated_at' => $at,
            ]);
            DB::table('learning_transcript_entries')->updateOrInsert(['id' => '50000000-0000-4000-8000-000000000001'], [
                'learner_id' => $learners[2]->id, 'completion_id' => '30000000-0000-4000-8000-000000000001', 'course_id' => $version->course_id,
                'course_version_id' => $version->id, 'certificate_id' => '40000000-0000-4000-8000-000000000001',
                'recorded_at' => $at->subDays(2), 'created_at' => $at, 'updated_at' => $at,
            ]);
            $mapping = DB::table('learning_course_competencies')->where('course_version_id', $version->id)->first();
            if ($mapping) DB::table('learning_competency_evidence')->updateOrInsert(['id' => '60000000-0000-4000-8000-000000000001'], [
                'completion_id' => '30000000-0000-4000-8000-000000000001', 'course_version_id' => $version->id,
                'competency_id' => $mapping->competency_id, 'competency_version' => $mapping->competency_version,
                'competency_code' => $mapping->competency_code, 'official_result_changed' => false, 'gap_closed' => false,
                'recorded_at' => $at->subDays(2), 'created_at' => $at, 'updated_at' => $at,
            ]);
        }, 3);
    }

    private function attempt(string $id, string $assignmentId, string $assessmentId, int $number, int $score, bool $passed): void
    {
        $at = $this->referenceTime();
        $questions = DB::table('learning_assessment_questions')->where('assessment_id', $assessmentId)->orderBy('display_order')->get();
        if ($questions->isEmpty()) throw new RuntimeException('Scored operational attempts require persisted assessment questions.');
        $snapshot = $questions->map(function ($question) {
            $options = DB::table('learning_answer_options')->where('question_id', $question->id)->orderBy('display_order')->get();
            return ['id' => $question->id, 'type' => $question->question_type, 'text' => $question->question_text, 'explanation' => $question->explanation, 'points' => $question->points,
                'options' => $options->map(fn ($option) => ['id' => $option->id, 'text' => $option->option_text, 'correct' => (bool) $option->is_correct])->all()];
        })->all();
        DB::table('learning_assessment_attempts')->updateOrInsert(['id' => $id], [
            'assignment_id' => $assignmentId, 'assessment_id' => $assessmentId, 'attempt_number' => $number, 'status' => 'Submitted',
            'question_snapshot' => json_encode($snapshot), 'score_percent' => $score, 'passed' => $passed,
            'started_at' => $at->subDays(3), 'submitted_at' => $at->subDays(3), 'created_at' => $at, 'updated_at' => $at,
        ]);
        foreach ($snapshot as $question) {
            $selected = collect($question['options'])->first(fn ($option) => (bool) $option['correct'] === $passed);
            if (! $selected) throw new RuntimeException('Operational assessment evidence requires both correct and incorrect answer options.');
            DB::table('learning_attempt_responses')->updateOrInsert(['attempt_id' => $id, 'question_id' => $question['id']], [
                'selected_option_ids' => json_encode([$selected['id']]), 'is_correct' => $passed,
                'points_awarded' => $passed ? $question['points'] : 0, 'created_at' => $at, 'updated_at' => $at,
            ]);
        }
    }

    private function populateRequest(User $admin, LearningCourseVersion $draft): void
    {
        $at = $this->referenceTime();
        $learner = User::query()->activePersonnel()->where('id', '!=', $admin->id)->orderBy('id')->firstOrFail();
        $competency = collect(config('learning_catalog.competencies', []))->first();
        if (! $competency) throw new RuntimeException('At least one canonical Competency definition is required.');
        DB::table('learning_requests')->updateOrInsert(['source_recommendation_id' => 'learning-recommendation-operational-001'], [
            'id' => '70000000-0000-4000-8000-000000000001', 'personnel_key' => $learner->personnel_key,
            'source_assessment_id' => 'competency-assessment-operational-001', 'source_assessment_version' => 1,
            'competency_id' => $competency['id'], 'competency_version' => (int) config('learning_catalog.competency_version', 1), 'competency_name' => $competency['name'],
            'required_level' => 3, 'validated_level' => 2, 'recommendation_title' => 'Strengthen operational safety knowledge',
            'recommendation_note' => 'Pending governed Learning review; no enrollment or competency outcome has occurred.',
            'target_reassessment_date' => $at->addMonths(3)->toDateString(), 'recommended_by_name' => $admin->name,
            'requested_at' => $at->subDays(3), 'status' => 'Triaged', 'linked_course_id' => $draft->course_id,
            'linked_course_version_id' => $draft->id, 'assignment_id' => null, 'action_reason' => 'Course design is under review.',
            'acted_by' => $admin->id, 'acted_at' => $at->subDays(2), 'created_at' => $at, 'updated_at' => $at,
        ]);
        DB::table('learning_request_actions')->updateOrInsert(['id' => '71000000-0000-4000-8000-000000000001'], [
            'learning_request_id' => '70000000-0000-4000-8000-000000000001', 'from_status' => 'New', 'to_status' => 'Triaged',
            'action' => 'Triage', 'reason' => 'Course design is under review.', 'actor_id' => $admin->id,
            'acted_at' => $at->subDays(2), 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    private function referenceTime(): CarbonImmutable
    {
        return CarbonImmutable::parse('2026-08-01 09:00:00', 'Asia/Manila');
    }

    private function payload(string $title, User $hr): array
    {
        $types = User::query()->activePersonnel()->pluck('person_type')->map(fn ($value) => trim((string) $value))->filter()->unique()->sort()->values()->all();
        $competency = collect(config('learning_catalog.competencies', []))->first();
        $profile = $this->courseProfile($title);
        return [
            'workingStage' => 6, 'title' => $title,
            'description' => $profile['description'],
            'category' => $profile['category'], 'difficulty' => $profile['difficulty'], 'language' => 'English',
            'learningObjectives' => $profile['objectives'],
            'ownerId' => $hr->id, 'subjectMatterExpertId' => $hr->id, 'durationOverrideMinutes' => null,
            'authorIds' => [$hr->id], 'reviewerIds' => [], 'publisherId' => null,
            'sourceDocumentIds' => $this->sourceDocumentIds($title),
            'audience' => ['personTypes' => $types, 'allDepartments' => $profile['allDepartments'], 'departments' => $profile['departments'], 'positions' => [],
                'roleProfileIds' => [], 'catalogVisibility' => 'Eligible users may self-enroll', 'defaultDueDays' => 30,
                'mandatoryDefault' => true, 'availableFrom' => null, 'availableUntil' => null],
            'competencies' => $competency ? [['id' => $competency['id'], 'version' => 1, 'code' => $competency['code'], 'name' => $competency['name'], 'targetLevel' => 3]] : [],
            'modules' => [['clientId' => 'module-foundations', 'title' => $profile['module'], 'description' => $profile['moduleDescription'], 'lessons' => [[
                'title' => $profile['lesson'], 'objective' => $profile['objectives'][0], 'description' => $profile['lessonDescription'],
                'contentType' => 'Text/Reading', 'textContent' => $profile['content'],
                'externalUrl' => null, 'estimatedMinutes' => $profile['minutes'], 'required' => true,
            ]]]],
            'assessments' => [
                ['type' => 'Pre-Test', 'title' => 'Pre-Test', 'required' => false, 'passingScore' => 80,
                    'attemptsAllowed' => 1, 'shuffleQuestions' => false, 'shuffleOptions' => false, 'feedbackPolicy' => 'After submission',
                    'moduleClientId' => null, 'questions' => [['type' => 'Multiple Choice', 'text' => 'Before training, which action best follows the documented requirement?',
                        'explanation' => 'Use the documented process and record the action.', 'points' => 1,
                        'options' => [['text' => 'Follow and record the documented process', 'correct' => true], ['text' => 'Skip the process when time is limited', 'correct' => false]],
                    ]]],
                ['type' => 'Post-Test', 'title' => 'Post-Test', 'required' => true, 'passingScore' => 80,
                    'attemptsAllowed' => 3, 'shuffleQuestions' => false, 'shuffleOptions' => false, 'feedbackPolicy' => 'After submission',
                    'moduleClientId' => null, 'questions' => [['type' => 'Multiple Choice', 'text' => 'After training, which action best follows the documented requirement?',
                        'explanation' => 'Use the documented process and record the action.', 'points' => 1,
                        'options' => [['text' => 'Follow and record the documented process', 'correct' => true], ['text' => 'Skip the process when time is limited', 'correct' => false]],
                    ]]],
            ],
            'completion' => ['completeRequiredLessons' => true, 'passRequiredKnowledgeChecks' => true, 'passFinalAssessment' => true,
                'issueCertificate' => true, 'certificateValidityMonths' => 12, 'renewalIntervalMonths' => 12],
        ];
    }

    private function sourceDocumentIds(string $title): array
    {
        return match ($title) {
            'Operational Handover Fundamentals' => ['ALB-PND-SOP-002'],
            'Workplace Risk Recognition' => ['ALB-PND-POL-001', 'ALB-PND-SAF-005'],
            'Accurate Financial Recordkeeping' => ['ALB-PND-GDL-009'],
            'Port Operations Safety Essentials' => ['ALB-PND-SAF-005'],
            'Historical Site Induction' => ['ALB-PND-POL-001'],
            'Data Privacy and Information Security Awareness' => ['ALB-PND-MEM-003', 'ALB-PND-GDL-011'],
            'Crane Operations Fundamentals' => ['ALB-PND-SAF-005', 'ALB-PND-TN-006'],
            'Supervisory Leadership for Field Operations' => ['ALB-PND-HBK-004', 'ALB-PND-SOP-013'],
            default => ['ALB-PND-HBK-004'],
        };
    }

    private function courseProfile(string $title): array
    {
        $profiles = [
            'Operational Handover Fundamentals' => ['Operations', 'Beginner', 'Prepare and document a complete shift handover.', 'Operational Handover', 'Handover controls and role ownership.', 'The handover record', 'Use the approved turnover checklist and confirm open actions.', 'A complete handover records work status, unresolved risks, responsible owners, and required follow-up.', 25],
            'Workplace Risk Recognition' => ['Safety & Compliance', 'Beginner', 'Identify, escalate, and document common workplace risks.', 'Risk Recognition', 'Hazard identification and escalation decisions.', 'Recognize and report risk', 'Apply immediate controls and the approved reporting path.', 'Personnel apply authorized controls, stop unsafe work when required, and document the risk through the approved channel.', 25],
            'Accurate Financial Recordkeeping' => ['Finance', 'Intermediate', 'Apply completeness, accuracy, and audit-trail controls to financial records.', 'Financial Controls', 'Source documents, approvals, and reconciliation.', 'Maintain an auditable record', 'Connect each entry to valid evidence and approval.', 'Every financial entry requires valid source documentation, the required approval, and a traceable reconciliation outcome.', 30],
            'Port Operations Safety Essentials' => ['Safety & Compliance', 'Beginner', 'Apply core safety controls for coordinated field and equipment operations.', 'Operations Safety', 'Pre-task planning and coordinated controls.', 'Prepare for safe operations', 'Confirm the task plan and operating controls.', 'Before work begins, personnel confirm the plan, equipment condition, work-zone controls, communication signals, and escalation authority.', 30],
            'Historical Site Induction' => ['Compliance', 'Beginner', 'Preserve the prior site-induction record for historical transcript reference.', 'Site Induction', 'Archived orientation reference.', 'Review the archived induction', 'Recognize the historical induction controls.', 'This archived version preserves the requirements used before the current safety orientation was published.', 15],
            'Data Privacy and Information Security Awareness' => ['Compliance', 'Beginner', 'Protect personnel, operational, and company information in daily work.', 'Information Protection', 'Classification, access, and incident reporting.', 'Handle information responsibly', 'Apply least-access and secure handling.', 'Use approved systems, verify recipients, protect credentials, and report suspected disclosure through the authorized process.', 25],
            'Crane Operations Fundamentals' => ['Technical Skills', 'Intermediate', 'Explain the controls that support safe, coordinated crane operations.', 'Crane Operations', 'Roles, lift preparation, and communication controls.', 'Prepare a controlled lifting activity', 'Recognize the controls required before lifting.', 'A lifting activity requires an approved plan, verified equipment condition, a controlled work zone, qualified personnel, and agreed signals.', 35],
            'Supervisory Leadership for Field Operations' => ['Leadership', 'Intermediate', 'Use structured communication, coaching, and accountability in field supervision.', 'Field Leadership', 'Briefing, coaching, and decision ownership.', 'Lead an operational briefing', 'Set expectations and verify understanding.', 'A supervisor explains the objective, roles, risks, decision limits, and follow-up, then verifies understanding before work proceeds.', 30],
        ];

        [$category, $difficulty, $description, $module, $moduleDescription, $lesson, $lessonDescription, $content, $minutes] = $profiles[$title];

        $departmentMap = [
            'Operational Handover Fundamentals' => ['Operations'],
            'Workplace Risk Recognition' => ['Safety & Compliance'],
            'Accurate Financial Recordkeeping' => ['Finance'],
            'Port Operations Safety Essentials' => ['Operations'],
            'Historical Site Induction' => ['Operations'],
            'Data Privacy and Information Security Awareness' => [],
            'Crane Operations Fundamentals' => ['Crane Operations'],
            'Supervisory Leadership for Field Operations' => ['Operations'],
        ];
        $departments = $departmentMap[$title] ?? [];

        return compact('category', 'difficulty', 'description', 'module', 'moduleDescription', 'lesson', 'lessonDescription', 'content', 'minutes', 'departments') + [
            'allDepartments' => $departments === [],
            'objectives' => [$description],
        ];
    }
}
