<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LearningCourseRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }

    /** Draft saves validate safe structure; review/publication readiness lives in the domain service. */
    public function rules(): array
    {
        return [
            'title'=>['nullable','string','max:255'], 'description'=>['nullable','string','max:20000'],
            'category'=>['required','string','max:100'], 'difficulty'=>['required','in:Beginner,Intermediate,Advanced'], 'language'=>['required','string','max:80'],
            'learningObjectives'=>['present','array','max:30'], 'learningObjectives.*'=>['nullable','string','max:1000'],
            'ownerId'=>['required','integer','exists:users,id'], 'subjectMatterExpertId'=>['nullable','integer','exists:users,id'], 'durationOverrideMinutes'=>['nullable','integer','between:1,100000'],
            'authorIds'=>['present','array','max:50'], 'authorIds.*'=>['integer','distinct','exists:users,id'], 'reviewerIds'=>['present','array','max:20'], 'reviewerIds.*'=>['integer','distinct','exists:users,id'], 'publisherId'=>['nullable','integer','exists:users,id'],
            'audience'=>['required','array'], 'audience.personTypes'=>['present','array'], 'audience.personTypes.*'=>['string','distinct','max:160'], 'audience.allDepartments'=>['required','boolean'],
            'audience.departments'=>['present','array'], 'audience.departments.*'=>['string','max:160'], 'audience.positions'=>['present','array'], 'audience.positions.*'=>['string','max:160'],
            'audience.roleProfileIds'=>['present','array','max:50'], 'audience.roleProfileIds.*'=>['string','distinct','max:160'],
            'audience.catalogVisibility'=>['required','in:Assigned only,Eligible users may self-enroll,Unlisted'], 'audience.defaultDueDays'=>['nullable','integer','between:1,3650'], 'audience.mandatoryDefault'=>['required','boolean'],
            'audience.availableFrom'=>['nullable','date'], 'audience.availableUntil'=>['nullable','date','after:audience.availableFrom'],
            'competencies'=>['present','array','max:20'], 'competencies.*.id'=>['required','string','max:160'], 'competencies.*.version'=>['nullable','integer','min:1'],
            'competencies.*.code'=>['nullable','string','max:100'], 'competencies.*.name'=>['nullable','string','max:255'], 'competencies.*.targetLevel'=>['required','integer','between:1,5'],
            'modules'=>['present','array','max:100'], 'modules.*.clientId'=>['required','string','max:100'], 'modules.*.title'=>['nullable','string','max:255'], 'modules.*.description'=>['nullable','string','max:5000'],
            'modules.*.lessons'=>['present','array','max:200'], 'modules.*.lessons.*.id'=>['nullable','uuid'], 'modules.*.lessons.*.title'=>['nullable','string','max:255'], 'modules.*.lessons.*.objective'=>['nullable','string','max:2000'],
            'modules.*.lessons.*.contentType'=>['required','in:Text/Reading,Video,PDF/Document,Downloadable File,External Resource'], 'modules.*.lessons.*.estimatedMinutes'=>['required','integer','between:1,10000'], 'modules.*.lessons.*.required'=>['required','boolean'],
            'modules.*.lessons.*.textContent'=>['nullable','string','max:200000'], 'modules.*.lessons.*.externalUrl'=>['nullable','url:http,https','max:2000'],
            'assessments'=>['present','array','max:100'], 'assessments.*.id'=>['nullable','uuid'], 'assessments.*.moduleClientId'=>['nullable','string','max:100'], 'assessments.*.type'=>['required','in:Knowledge Check,Final Assessment'], 'assessments.*.title'=>['nullable','string','max:255'], 'assessments.*.required'=>['required','boolean'],
            'assessments.*.passingScore'=>['required','integer','between:1,100'], 'assessments.*.attemptsAllowed'=>['required','integer','between:1,20'], 'assessments.*.shuffleQuestions'=>['required','boolean'], 'assessments.*.shuffleOptions'=>['required','boolean'], 'assessments.*.feedbackPolicy'=>['required','string','max:100'],
            'assessments.*.questions'=>['present','array','max:200'], 'assessments.*.questions.*.id'=>['nullable','uuid'], 'assessments.*.questions.*.type'=>['required','in:Multiple Choice,Multiple Response,True/False'], 'assessments.*.questions.*.text'=>['nullable','string','max:5000'], 'assessments.*.questions.*.explanation'=>['nullable','string','max:5000'], 'assessments.*.questions.*.points'=>['required','integer','between:1,1000'],
            'assessments.*.questions.*.options'=>['present','array','max:20'], 'assessments.*.questions.*.options.*.id'=>['nullable','uuid'], 'assessments.*.questions.*.options.*.text'=>['nullable','string','max:2000'], 'assessments.*.questions.*.options.*.correct'=>['required','boolean'],
            'completion'=>['required','array'], 'completion.completeRequiredLessons'=>['required','boolean'], 'completion.passRequiredKnowledgeChecks'=>['required','boolean'], 'completion.passFinalAssessment'=>['required','boolean'], 'completion.issueCertificate'=>['required','boolean'],
            'completion.certificateValidityMonths'=>['nullable','integer','between:1,600'], 'completion.renewalIntervalMonths'=>['nullable','integer','between:1,600'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $audience=$this->input('audience', []); if (($audience['allDepartments']??false) && !empty($audience['departments'])) $audience['departments']=[];
        $this->merge(['title'=>$this->input('title',''), 'description'=>$this->input('description',''), 'audience'=>$audience]);
    }
}