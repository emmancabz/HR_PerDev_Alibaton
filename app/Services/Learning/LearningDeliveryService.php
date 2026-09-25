<?php

namespace App\Services\Learning;

use App\Models\Learning\LearningAssessment;
use App\Models\Learning\LearningAssessmentAttempt;
use App\Models\Learning\LearningAssignment;
use App\Models\Learning\LearningCompletion;
use App\Models\Learning\LearningCertificate;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LearningDeliveryService
{
    public function __construct(private readonly LearningAuditService $audit, private readonly LearningEligibilityService $eligibility) {}

    public function player(User $actor, LearningAssignment $assignment): array
    {
        $this->own($actor, $assignment); $this->launchable($assignment);
        $assignment->load(['version.modules.lessons.materials', 'version.assessments', 'progress']);
        $version = $assignment->version;
        $modules = $version->modules->map(fn ($module) => ['id' => $module->id, 'title' => $module->title, 'description' => $module->description, 'lessons' => $module->lessons->map(fn ($lesson) => [
            'id' => $lesson->id, 'title' => $lesson->title, 'objective' => $lesson->objective, 'description' => $lesson->description,
            'content_type' => $lesson->content_type, 'text_content' => $lesson->text_content, 'external_url' => $lesson->external_url,
            'estimated_minutes' => $lesson->estimated_minutes, 'is_required' => $lesson->is_required,
            'materials' => $lesson->materials->whereNull('revoked_at')->map(fn ($material) => [
                'id' => $material->id,
                'display_name' => $material->display_name,
                'mime_type' => $material->mime_type,
                'size_bytes' => $material->size_bytes,
                'download_url' => URL::temporarySignedRoute('learning.api.materials.download', now()->addMinutes(15), ['material' => $material->id]),
            ])->values(),
        ])->values()])->values();
        return ['assignment' => $assignment, 'course' => ['id' => $version->id, 'title' => $version->title, 'status' => $version->status, 'version_number' => $version->version_number, 'assessments' => $version->assessments
            ->where('assessment_type', 'Knowledge Check')
            ->map(fn ($assessment) => [
                'id' => $assessment->id,
                'module_id' => $assessment->module_id,
                'title' => $assessment->title,
                'assessment_type' => $assessment->assessment_type,
                'passing_score' => $assessment->passing_score,
                'attempts_allowed' => $assessment->attempts_allowed,
            ])->values()], 'modules' => $modules, 'progress' => $assignment->progress, 'attempts' => $assignment->attempts()->select(['id', 'assignment_id', 'assessment_id', 'attempt_number', 'status', 'score_percent', 'passed', 'started_at', 'submitted_at'])->orderByDesc('started_at')->get()];
    }

    public function recordLesson(User $actor, LearningAssignment $assignment, string $lessonId, bool $completed, int $seconds = 0): array
    {
        $this->own($actor, $assignment); $this->active($assignment);
        $lesson = DB::table('learning_course_lessons as l')->join('learning_course_modules as m', 'm.id', '=', 'l.module_id')->where('l.id', $lessonId)->where('m.course_version_id', $assignment->course_version_id)->first(['l.*']);
        if (! $lesson) throw ValidationException::withMessages(['lesson' => 'The lesson is not part of the assigned course version.']);
        DB::transaction(function () use ($assignment, $lessonId, $completed, $seconds) {
            $previous = DB::table('learning_lesson_progress')->where(['assignment_id' => $assignment->id, 'lesson_id' => $lessonId])->first();
            DB::table('learning_lesson_progress')->updateOrInsert(['assignment_id' => $assignment->id, 'lesson_id' => $lessonId], [
                'status' => $completed ? 'Completed' : 'In Progress', 'started_at' => $previous?->started_at ?? now(),
                'completed_at' => $completed ? now() : null, 'time_spent_seconds' => (int) ($previous->time_spent_seconds ?? 0) + max(0, min($seconds, 86400)),
                'last_activity_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->reconcileProgress($assignment);
        }, 3);
        $this->reconcileCompletion($actor, $assignment->fresh());
        return ['progress' => $assignment->fresh()->progress_percent, 'status' => $assignment->fresh()->status];
    }

    public function startAttempt(User $actor, LearningAssignment $assignment, LearningAssessment $assessment): LearningAssessmentAttempt
    {
        $this->own($actor, $assignment); $this->active($assignment);
        if ($assessment->course_version_id !== $assignment->course_version_id) throw ValidationException::withMessages(['assessment' => 'Assessment version does not match the assignment.']);
        if ($assessment->assessment_type !== 'Knowledge Check') {
            throw ValidationException::withMessages(['assessment' => 'Pre-Test and Post-Test are handled outside the Learning Management module.']);
        }
        if (! $assessment->module_id) {
            throw ValidationException::withMessages(['assessment' => 'A module quiz must be linked to a course module.']);
        }
        $requiredLessons = DB::table('learning_course_lessons')
            ->where('module_id', $assessment->module_id)
            ->where('is_required', true)
            ->pluck('id');
        $complete = DB::table('learning_lesson_progress')
            ->where('assignment_id', $assignment->id)
            ->whereIn('lesson_id', $requiredLessons)
            ->where('status', 'Completed')
            ->count();
        if ($complete !== $requiredLessons->count()) {
            throw ValidationException::withMessages(['assessment' => 'Complete the required lessons in this module before starting its quiz.']);
        }
        return DB::transaction(function () use ($assignment,$assessment) {
            LearningAssignment::query()->lockForUpdate()->findOrFail($assignment->id);
            $existing=LearningAssessmentAttempt::where(['assignment_id'=>$assignment->id,'assessment_id'=>$assessment->id,'status'=>'In Progress'])->first(); if ($existing) return $existing;
            $submitted=LearningAssessmentAttempt::where(['assignment_id'=>$assignment->id,'assessment_id'=>$assessment->id])->where('status','Submitted')->count();
            if ($submitted >= $assessment->attempts_allowed) throw ValidationException::withMessages(['assessment'=>'No assessment attempts remain.']);
            $assessment->load('questions.options');
            $questions=$assessment->questions->map(fn($q)=>['id'=>$q->id,'type'=>$q->question_type,'text'=>$q->question_text,'points'=>$q->points,'explanation'=>$q->explanation,'options'=>$q->options->map(fn($o)=>['id'=>$o->id,'text'=>$o->option_text,'correct'=>$o->is_correct])->values()->all()])->values()->all();
            if ($assessment->shuffle_questions) shuffle($questions); if ($assessment->shuffle_options) foreach ($questions as &$question) shuffle($question['options']);
            return LearningAssessmentAttempt::create(['assignment_id'=>$assignment->id,'assessment_id'=>$assessment->id,'attempt_number'=>$submitted+1,'status'=>'In Progress','question_snapshot'=>$questions,'started_at'=>now()]);
        },3);
    }

    public function saveResponses(User $actor, LearningAssessmentAttempt $attempt, array $responses): void
    {
        $assignment = LearningAssignment::findOrFail($attempt->assignment_id); $this->own($actor, $assignment);
        DB::transaction(function () use ($attempt, $responses) {
            $attempt = LearningAssessmentAttempt::query()->lockForUpdate()->findOrFail($attempt->id);
            $assignment = LearningAssignment::query()->lockForUpdate()->findOrFail($attempt->assignment_id); $this->active($assignment);
            if ($attempt->status !== 'In Progress') throw ValidationException::withMessages(['attempt' => 'Submitted attempts are immutable.']);
            $valid = collect($attempt->question_snapshot)->keyBy('id');
            foreach ($responses as $response) {
                if (! $valid->has($response['questionId'])) throw ValidationException::withMessages(['responses' => 'A response does not belong to this attempt snapshot.']);
                $optionIds = collect($valid->get($response['questionId'])['options'] ?? [])->pluck('id');
                if (collect($response['optionIds'] ?? [])->contains(fn ($id) => ! $optionIds->contains($id))) throw ValidationException::withMessages(['responses' => 'A selected option does not belong to its question snapshot.']);
                DB::table('learning_attempt_responses')->updateOrInsert(['attempt_id' => $attempt->id, 'question_id' => $response['questionId']], ['selected_option_ids' => json_encode(array_values($response['optionIds'] ?? [])), 'updated_at' => now(), 'created_at' => now()]);
            }
        }, 3);
    }

    public function submitAttempt(User $actor, LearningAssessmentAttempt $attempt, array $responses): array
    {
        $assignment = LearningAssignment::findOrFail($attempt->assignment_id); $this->own($actor, $assignment); $this->active($assignment);
        if ($attempt->status !== 'In Progress') throw ValidationException::withMessages(['attempt' => 'Submitted attempts are immutable.']);
        $this->saveResponses($actor, $attempt, $responses);
        $assessment = LearningAssessment::findOrFail($attempt->assessment_id);
        return DB::transaction(function () use ($actor, $attempt, $assignment, $assessment) {
            $attempt = LearningAssessmentAttempt::query()->lockForUpdate()->findOrFail($attempt->id);
            if ($attempt->status !== 'In Progress') throw ValidationException::withMessages(['attempt' => 'Submitted attempts are immutable.']);
            $rows = DB::table('learning_attempt_responses')->where('attempt_id', $attempt->id)->get()->keyBy('question_id');
            $earned = 0; $total = 0;
            foreach ($attempt->question_snapshot as $question) {
                $total += $question['points']; $selected = collect(json_decode($rows->get($question['id'])?->selected_option_ids ?? '[]', true))->sort()->values()->all();
                $correct = collect($question['options'])->where('correct', true)->pluck('id')->sort()->values()->all();
                $ok = $selected === $correct; $points = $ok ? $question['points'] : 0; $earned += $points;
                DB::table('learning_attempt_responses')->updateOrInsert(['attempt_id' => $attempt->id, 'question_id' => $question['id']], ['selected_option_ids' => json_encode($selected), 'is_correct' => $ok, 'points_awarded' => $points, 'updated_at' => now(), 'created_at' => now()]);
            }
            $score = $total ? round($earned / $total * 100, 2) : 0; $passed = $score >= $assessment->passing_score;
            $attempt->update(['status' => 'Submitted', 'score_percent' => $score, 'passed' => $passed, 'submitted_at' => now()]);
            $this->audit->record($actor, 'Attempt submitted', 'LearningAssessmentAttempt', $attempt->id, ['score' => $score, 'passed' => $passed]);
            if (! $passed && $attempt->attempt_number >= $assessment->attempts_allowed) $assignment->update(['status' => 'Failed/Attempts Exhausted']);
            $this->reconcileCompletion($actor, $assignment->fresh());
            return ['score' => $score, 'passed' => $passed, 'attemptNumber' => $attempt->attempt_number, 'feedbackPolicy' => $assessment->feedback_policy];
        }, 3);
    }

    public function regradeAttempt(User $actor, LearningAssessmentAttempt $attempt, string $reason): array
    {
        if (! $actor->isPerformanceOperator()) throw new AuthorizationException('Only Admin or HR may regrade an objective Learning attempt.');
        if (trim($reason) === '') throw ValidationException::withMessages(['reason' => 'A regrade reason is required.']);
        return DB::transaction(function () use ($actor, $attempt, $reason) {
            if (! $actor->isPerformanceOperator()) throw new AuthorizationException('Only Admin or HR may regrade an objective Learning attempt.');
            $attempt = LearningAssessmentAttempt::query()->lockForUpdate()->findOrFail($attempt->id);
            if ($attempt->status !== 'Submitted') throw ValidationException::withMessages(['attempt' => 'Only a submitted attempt can be regraded.']);
            $assignment = LearningAssignment::query()->lockForUpdate()->findOrFail($attempt->assignment_id);
            $completion = LearningCompletion::query()->where('assignment_id', $attempt->assignment_id)->lockForUpdate()->first();
            if ($completion) throw ValidationException::withMessages(['attempt' => 'A completion already exists and is immutable. Revoke or replace certificate records separately; do not rewrite completion history.']);
            $assessment = LearningAssessment::query()->lockForUpdate()->findOrFail($attempt->assessment_id);
            $rows = DB::table('learning_attempt_responses')->where('attempt_id', $attempt->id)->lockForUpdate()->get()->keyBy('question_id');
            $earned = 0; $total = 0;
            foreach ($attempt->question_snapshot as $question) {
                $total += $question['points']; $selected = collect(json_decode($rows->get($question['id'])?->selected_option_ids ?? '[]', true))->sort()->values()->all();
                $correct = collect($question['options'])->where('correct', true)->pluck('id')->sort()->values()->all();
                $ok = $selected === $correct; $points = $ok ? $question['points'] : 0; $earned += $points;
                DB::table('learning_attempt_responses')->where(['attempt_id' => $attempt->id, 'question_id' => $question['id']])->update(['is_correct' => $ok, 'points_awarded' => $points, 'updated_at' => now()]);
            }
            $old = ['score' => $attempt->score_percent, 'passed' => $attempt->passed];
            $score = $total ? round($earned / $total * 100, 2) : 0; $passed = $score >= $assessment->passing_score;
            $attempt->update(['score_percent' => $score, 'passed' => $passed]);
            $this->audit->record($actor, 'Attempt regraded', 'LearningAssessmentAttempt', $attempt->id, ['reason' => trim($reason), 'before' => $old, 'after' => ['score' => $score, 'passed' => $passed]]);

            $submittedAttemptIds = LearningAssessmentAttempt::query()
                ->where(['assignment_id' => $assignment->id, 'assessment_id' => $assessment->id, 'status' => 'Submitted'])
                ->orderBy('id')->lockForUpdate()->pluck('id');
            $submittedCount = LearningAssessmentAttempt::query()->whereIn('id', $submittedAttemptIds)->count();
            $assignment->update(['status' => ! $passed && $assessment->is_required && $submittedCount >= $assessment->attempts_allowed
                ? 'Failed/Attempts Exhausted'
                : ((int) $assignment->progress_percent > 0 ? 'In Progress' : 'Not Started')]);
            $completion = $passed ? $this->reconcileCompletion($actor, $assignment->fresh()) : null;

            return ['score' => $score, 'passed' => $passed, 'attemptNumber' => $attempt->attempt_number, 'assignmentStatus' => $assignment->fresh()->status, 'completionId' => $completion?->id];
        }, 3);
    }

    public function reconcileCompletion(User $actor, LearningAssignment $assignment): ?LearningCompletion
    {
        return DB::transaction(function () use ($actor, $assignment) {
            $assignment = LearningAssignment::query()->lockForUpdate()->findOrFail($assignment->id);
            $existing = LearningCompletion::query()->where('assignment_id', $assignment->id)->first();
            if ($existing) return $existing;

            $rules = $assignment->version()->value('completion_rules') ?? [];
            if (is_string($rules)) $rules = json_decode($rules, true) ?? [];
            $requiredLessons = DB::table('learning_course_lessons as l')->join('learning_course_modules as m', 'm.id', '=', 'l.module_id')->where('m.course_version_id', $assignment->course_version_id)->where('l.is_required', true)->pluck('l.id');
            $done = DB::table('learning_lesson_progress')->where('assignment_id', $assignment->id)->whereIn('lesson_id', $requiredLessons)->where('status', 'Completed')->count();
            if (($rules['completeRequiredLessons'] ?? true) && $done !== $requiredLessons->count()) return null;
            $requiredAssessments = LearningAssessment::where('course_version_id', $assignment->course_version_id)
                ->where('is_required', true)
                ->where('assessment_type', 'Knowledge Check')
                ->when(! ($rules['passRequiredKnowledgeChecks'] ?? true), fn ($query) => $query->whereRaw('1 = 0'))
                ->get();
            foreach ($requiredAssessments as $assessment) if (! LearningAssessmentAttempt::where(['assignment_id' => $assignment->id, 'assessment_id' => $assessment->id, 'status' => 'Submitted', 'passed' => true])->exists()) return null;

            $score = LearningAssessmentAttempt::query()
                ->join('learning_assessments as assessment', 'assessment.id', '=', 'learning_assessment_attempts.assessment_id')
                ->where('learning_assessment_attempts.assignment_id', $assignment->id)
                ->where('learning_assessment_attempts.passed', true)
                ->where('assessment.assessment_type', 'Knowledge Check')
                ->avg('learning_assessment_attempts.score_percent');
            $completion = LearningCompletion::create(['assignment_id' => $assignment->id, 'learner_id' => $assignment->learner_id, 'course_id' => $assignment->course_id, 'course_version_id' => $assignment->course_version_id, 'completed_at' => now(), 'rules_satisfied' => $rules, 'assessment_score' => $score, 'completion_basis' => 'Published online course rules', 'source_context' => 'Online Learning']);
            $assignment->update(['status' => 'Completed', 'progress_percent' => 100, 'completed_at' => now()]);
            $certificateId = null;
            DB::table('learning_transcript_entries')->insert(['id' => (string) Str::uuid(), 'learner_id' => $assignment->learner_id, 'completion_id' => $completion->id, 'course_id' => $assignment->course_id, 'course_version_id' => $assignment->course_version_id, 'certificate_id' => $certificateId, 'recorded_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            foreach (DB::table('learning_course_competencies')->where('course_version_id', $assignment->course_version_id)->get() as $mapping) {
                DB::table('learning_competency_evidence')->insert(['id' => (string) Str::uuid(), 'completion_id' => $completion->id, 'course_version_id' => $assignment->course_version_id, 'competency_id' => $mapping->competency_id, 'competency_version' => $mapping->competency_version, 'competency_code' => $mapping->competency_code, 'official_result_changed' => false, 'gap_closed' => false, 'recorded_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            }
            $this->audit->record($actor, 'Completion recorded', 'LearningCompletion', $completion->id, ['courseVersionId' => $assignment->course_version_id, 'competencyGapClosed' => false]);
            return $completion;
        }, 3);
    }

    public function issueCertificate(User $actor, string $completionId): LearningCertificate
    {
        if (! $actor->isPerformanceOperator()) {
            throw new AuthorizationException('Only Admin or HR may issue a Learning certificate.');
        }

        return DB::transaction(function () use ($actor, $completionId) {
            $completion = LearningCompletion::query()->lockForUpdate()->findOrFail($completionId);
            $existing = LearningCertificate::query()->where('completion_id', $completion->id)->first();
            if ($existing) {
                return $existing;
            }

            $rules = $completion->rules_satisfied ?? [];
            if (is_string($rules)) {
                $rules = json_decode($rules, true) ?? [];
            }
            if (! ($rules['issueCertificate'] ?? false)) {
                throw ValidationException::withMessages(['certificate' => 'This course version is not configured for certificate issuance.']);
            }

            $validMonths = (int) ($rules['certificateValidityMonths'] ?? 0);
            $certificate = LearningCertificate::create([
                'completion_id' => $completion->id,
                'certificate_number' => 'ALB-LRN-'.now()->format('Ym').'-'.strtoupper(Str::random(8)),
                'issued_on' => today(),
                'expires_on' => $validMonths ? today()->addMonths($validMonths) : null,
                'status' => 'Valid',
            ]);

            DB::table('learning_transcript_entries')
                ->where('completion_id', $completion->id)
                ->update(['certificate_id' => $certificate->id, 'updated_at' => now()]);

            $this->audit->record($actor, 'Certificate issued by HR/Admin', 'LearningCertificate', $certificate->id, ['completionId' => $completion->id]);

            return $certificate;
        }, 3);
    }

    public function revokeCertificate(User $actor, string $certificateId, string $reason): void
    {
        if (! $actor->isPerformanceOperator()) throw new AuthorizationException('Only Admin or HR may revoke a Learning certificate.');
        if (trim($reason) === '') throw ValidationException::withMessages(['reason' => 'A revocation reason is required.']);
        DB::transaction(function () use ($actor, $certificateId, $reason) {
            $updated = DB::table('learning_certificates')->where('id', $certificateId)->where('status', 'Valid')->update(['status' => 'Revoked', 'revoked_at' => now(), 'revocation_reason' => trim($reason), 'updated_at' => now()]);
            if (! $updated) throw ValidationException::withMessages(['certificate' => 'Only a valid certificate can be revoked.']);
            $this->audit->record($actor, 'Certificate revoked', 'LearningCertificate', $certificateId, ['reason' => trim($reason)]);
        }, 3);
    }

    public function downloadCertificate(User $actor, LearningCertificate $certificate): Response
    {
        $record = DB::table('learning_certificates as certificate')
            ->join('learning_completions as completion', 'completion.id', '=', 'certificate.completion_id')
            ->join('learning_course_versions as version', 'version.id', '=', 'completion.course_version_id')
            ->join('users as learner', 'learner.id', '=', 'completion.learner_id')
            ->where('certificate.id', $certificate->id)
            ->first([
                'certificate.certificate_number', 'certificate.issued_on', 'certificate.expires_on', 'certificate.status',
                'completion.learner_id', 'completion.completed_at', 'version.title', 'version.version_number', 'learner.name as learner_name',
            ]);
        if (! $record) abort(404);
        if ((int) $record->learner_id !== $actor->id && ! $actor->isPerformanceOperator()) {
            throw new AuthorizationException('This Learning certificate belongs to another person.');
        }

        $escape = static fn ($value): string => e((string) ($value ?? '—'));
        $status = $escape($record->status);
        $html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            .'<title>Learning Certificate '.$escape($record->certificate_number).'</title><style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:48px}.certificate{max-width:960px;margin:auto;background:white;border:10px solid #0f172a;padding:64px;text-align:center;box-shadow:inset 0 0 0 3px #f4b400}.eyebrow{font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#92400e}.title{font-size:42px;margin:24px 0 10px}.name{font-size:32px;font-weight:800;margin:24px 0}.course{font-size:24px}.meta{margin-top:36px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px;text-align:left;border-top:1px solid #cbd5e1;padding-top:24px}.label{font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b}.value{margin-top:5px;font-size:16px}@media(max-width:640px){body{padding:12px}.certificate{padding:28px}.title{font-size:30px}.name{font-size:25px}.meta{grid-template-columns:1fr}}</style></head><body><main class="certificate"><p class="eyebrow">Alibaton Learning</p><h1 class="title">Certificate of Completion</h1><p>This certifies that</p><p class="name">'.$escape($record->learner_name).'</p><p>successfully completed</p><p class="course">'.$escape($record->title).' · official v'.$escape($record->version_number).'</p><section class="meta"><div><div class="label">Certificate number</div><div class="value">'.$escape($record->certificate_number).'</div></div><div><div class="label">Status</div><div class="value">'.$status.'</div></div><div><div class="label">Completed</div><div class="value">'.$escape($record->completed_at).'</div></div><div><div class="label">Issued / expires</div><div class="value">'.$escape($record->issued_on).' / '.$escape($record->expires_on).'</div></div></section></main></body></html>';

        $filename = preg_replace('/[^A-Za-z0-9._-]/', '-', (string) $record->certificate_number).'.html';
        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function reconcileProgress(LearningAssignment $assignment): void
    {
        $required = DB::table('learning_course_lessons as l')->join('learning_course_modules as m', 'm.id', '=', 'l.module_id')->where('m.course_version_id', $assignment->course_version_id)->where('l.is_required', true)->pluck('l.id');
        $complete = DB::table('learning_lesson_progress')->where('assignment_id', $assignment->id)->whereIn('lesson_id', $required)->where('status', 'Completed')->count();
        $percent = $required->count() ? min(99, (int) floor($complete / $required->count() * 100)) : 0;
        $assignment->update(['progress_percent' => $percent, 'status' => $percent > 0 ? 'In Progress' : 'Not Started']);
    }
    private function own(User $actor, LearningAssignment $assignment): void { if ($assignment->learner_id !== $actor->id || ! $this->eligibility->isActiveLearner($actor)) throw new AuthorizationException('This learning assignment is not available to this learner identity.'); }
    private function active(LearningAssignment $assignment): void { if (in_array($assignment->status, ['Cancelled', 'Expired', 'Completed', 'Failed/Attempts Exhausted'], true)) throw ValidationException::withMessages(['assignment' => 'This assignment cannot accept new learning activity.']); }
    private function launchable(LearningAssignment $assignment): void
    {
        if (in_array($assignment->status, ['Cancelled', 'Expired'], true)) throw ValidationException::withMessages(['assignment' => 'This assignment is not available.']);
        $now=now(); $version=$assignment->version()->firstOrFail();
        if (($assignment->available_from && $now->lt($assignment->available_from)) || ($version->availability_starts_at && $now->lt($version->availability_starts_at))) throw ValidationException::withMessages(['assignment'=>'This course is not available yet.']);
        if ($version->availability_ends_at && $now->gt($version->availability_ends_at)) throw ValidationException::withMessages(['assignment'=>'This course availability window has ended.']);
    }
}
