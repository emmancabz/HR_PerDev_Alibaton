<?php

namespace Database\Seeders;

use App\Models\Learning\LearningCourseVersion;
use App\Models\User;
use App\Services\Learning\LearningAssignmentService;
use App\Services\Learning\LearningCourseService;
use App\Services\Learning\LearningRequestService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LearningSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::table('learning_courses')->exists()) return;
        $admin = User::where('personnel_key', 'user-1')->firstOrFail();
        $reviewer = User::where('personnel_key', 'user-4')->firstOrFail();
        $publisher = User::where('personnel_key', 'user-2')->firstOrFail();
        $courses = app(LearningCourseService::class);

        $safety = $courses->createDraft($admin, $this->payload('Port Operations Safety Essentials', 'Safety & Compliance', $admin, $reviewer, $publisher, ['Employee', 'Trainee'], ['Operations', 'Crane Operations', 'Logistics']));
        $courses->submitForReview($admin, $safety, $reviewer->id);
        $courses->decideReview($reviewer, $safety->fresh(), 'Approved', 'Content and completion controls independently reviewed.');
        $courses->publish($publisher, $safety->fresh());

        $finance = $courses->createDraft($admin, $this->payload('Accurate Financial Recordkeeping', 'Finance', $admin, $reviewer, $publisher, ['Employee'], ['Finance']));
        $courses->submitForReview($admin, $finance, $reviewer->id);
        $courses->decideReview($reviewer, $finance->fresh(), 'Approved', 'Ready for online delivery.');
        $courses->publish($publisher, $finance->fresh());

        $courses->createDraft($admin, $this->payload('Operational Handover Fundamentals', 'Operations', $admin, $reviewer, $publisher, ['Employee', 'Trainee'], ['Operations']));

        $learners = User::whereIn('personnel_key', ['user-6', 'user-gen-2', 'user-gen-0'])->pluck('id')->all();
        app(LearningAssignmentService::class)->assign($admin, LearningCourseVersion::findOrFail($safety->id), [
            'learnerIds' => $learners, 'source' => 'Manual Assignment', 'availableFrom' => now(), 'dueAt' => now()->addDays(30),
            'mandatory' => true, 'priority' => 'High', 'reason' => 'Core online safety development',
        ]);

        app(LearningRequestService::class)->receive($admin, [
            'sourceRecommendationId' => 'competency-rec-demo-001', 'personnelKey' => 'user-6', 'sourceAssessmentId' => 'competency-assessment-final-001',
            'sourceAssessmentVersion' => 3, 'competencyId' => 'competency-operational-safety', 'competencyVersion' => 2,
            'competencyName' => 'Operational Safety', 'requiredLevel' => 3, 'validatedLevel' => 2,
            'title' => 'Strengthen operational safety knowledge', 'note' => 'Pending human Learning review. No enrollment or gap closure has occurred.',
            'targetReassessmentDate' => now()->addMonths(3)->toDateString(), 'recommendedByName' => 'Celso Ramirez', 'requestedAt' => now(),
        ]);
    }

    private function payload(string $title, string $category, User $owner, User $reviewer, User $publisher, array $types, array $departments): array
    {
        return [
            'title' => $title, 'description' => 'A governed online course with durable lessons, deterministic assessment, and version-pinned learner activity.',
            'category' => $category, 'difficulty' => 'Beginner', 'language' => 'English',
            'learningObjectives' => ['Apply the course requirements accurately in realistic workplace situations.'],
            'ownerId' => $owner->id, 'subjectMatterExpertId' => $owner->id, 'authorIds' => [$owner->id], 'reviewerIds' => [$reviewer->id], 'publisherId' => $publisher->id,
            'audience' => ['personTypes' => $types, 'allDepartments' => false, 'departments' => $departments, 'positions' => [], 'roleProfileIds' => [], 'catalogVisibility' => 'Eligible users may self-enroll', 'defaultDueDays' => 30, 'mandatoryDefault' => true, 'label' => implode(', ', $types).' in '.implode(', ', $departments)],
            'competencies' => [],
            'modules' => [['clientId' => 'module-foundations', 'title' => 'Foundations', 'description' => 'Core online concepts and application.', 'lessons' => [[
                'title' => 'Essential concepts', 'objective' => 'Identify and apply the essential course concepts.', 'description' => 'A concise guided reading.',
                'contentType' => 'Text/Reading', 'textContent' => 'Review the stated requirements, examples, and decision points. Use the knowledge check to confirm understanding.',
                'externalUrl' => null, 'estimatedMinutes' => 15, 'required' => true,
            ]]]],
            'assessments' => [[
                'type' => 'Final Assessment', 'title' => 'Final Assessment', 'required' => true, 'passingScore' => 80, 'attemptsAllowed' => 3,
                'shuffleQuestions' => false, 'shuffleOptions' => false, 'feedbackPolicy' => 'After submission',
                'questions' => [['type' => 'Multiple Choice', 'text' => 'Which action best demonstrates correct application of the documented requirement?', 'points' => 1,
                    'explanation' => 'Use the documented process and escalate uncertainty.', 'options' => [['text' => 'Follow the documented process and record the action', 'correct' => true], ['text' => 'Skip the requirement when time is limited', 'correct' => false]]]],
            ]],
            'completion' => ['completeRequiredLessons' => true, 'passRequiredKnowledgeChecks' => true, 'passFinalAssessment' => true, 'issueCertificate' => true, 'certificateValidityMonths' => 12, 'renewalIntervalMonths' => 12],
        ];
    }
}
