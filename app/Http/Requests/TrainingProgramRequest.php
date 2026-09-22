<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TrainingProgramRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role?->value, ['admin', 'hr'], true);
    }

    public function rules(): array
    {
        $programId = $this->route('program')?->id;

        return [
            'code' => ['nullable', 'string', 'max:40', Rule::unique('training_programs', 'code')->ignore($programId)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'category' => ['required', 'string', 'max:120'],
            'deliveryType' => ['required', Rule::in(['Instructor-led', 'Onsite', 'Workshop', 'Practical', 'Simulation', 'Blended'])],
            'objectives' => ['required', 'array', 'min:1', 'max:20'],
            'objectives.*' => ['required', 'string', 'max:1000'],
            'audienceRules' => ['required', 'array'],
            'audienceRules.personTypes' => ['present', 'array', 'max:20'],
            'audienceRules.personTypes.*' => ['string', 'max:120', 'distinct'],
            'audienceRules.departments' => ['present', 'array', 'max:100'],
            'audienceRules.departments.*' => ['string', 'max:255', 'distinct'],
            'audienceRules.positions' => ['present', 'array', 'max:100'],
            'audienceRules.positions.*' => ['string', 'max:255', 'distinct'],
            'audienceRules.roleProfileIds' => ['present', 'array', 'max:100'],
            'audienceRules.roleProfileIds.*' => ['string', 'max:160', 'distinct'],
            'completionRules' => ['required', 'array'],
            'completionRules.attendanceThreshold' => ['required', 'integer', 'between:1,100'],
            'completionRules.assessmentRequired' => ['required', 'boolean'],
            'completionRules.passingScore' => ['nullable', 'numeric', 'between:0,100'],
            'completionRules.issueCertificate' => ['required', 'boolean'],
            'completionRules.certificateValidityMonths' => ['nullable', 'integer', 'between:1,120'],
            'relatedLearningCourseId' => ['nullable', 'uuid', 'exists:learning_courses,id'],
            'ownerId' => ['nullable', 'integer', 'exists:users,id'],
            'competencies' => ['present', 'array', 'max:100'],
            'competencies.*.id' => ['required', 'string', 'max:160'],
            'competencies.*.version' => ['required', 'integer', 'min:1'],
            'competencies.*.code' => ['required', 'string', 'max:160'],
            'competencies.*.name' => ['required', 'string', 'max:255'],
            'competencies.*.targetLevel' => ['required', 'integer', 'between:1,5'],
            'competencies.*.purpose' => ['nullable', 'string', 'max:255'],
        ];
    }
}
