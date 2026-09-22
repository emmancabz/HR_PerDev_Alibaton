<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SuccessionPositionRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }

    public function rules(): array
    {
        return [
            'positionTitle' => ['required', 'string', 'max:255'],
            'department' => ['required', 'string', 'max:255'],
            'criticality' => ['required', 'in:Critical,High,Moderate'],
            'incumbentId' => ['nullable', 'integer', 'exists:users,id'],
            'businessImpact' => ['required', 'string', 'max:10000'],
            'vacancyRisk' => ['nullable', 'string', 'max:10000'],
            'reviewCycleMonths' => ['required', 'integer', 'between:1,36'],
            'nextReviewAt' => ['nullable', 'date'],
            'requirements' => ['required', 'array', 'min:1', 'max:100'],
            'requirements.*.type' => ['required', 'in:Competency,Certification,Experience,Performance,Learning,Training,Other'],
            'requirements.*.label' => ['required', 'string', 'max:255', 'distinct'],
            'requirements.*.sourceKey' => ['nullable', 'string', 'max:255'],
            'requirements.*.sourceVersion' => ['nullable', 'string', 'max:100'],
            'requirements.*.targetLevel' => ['nullable', 'integer', 'between:1,5'],
            'requirements.*.required' => ['sometimes', 'boolean'],
            'requirements.*.sourceSnapshot' => ['sometimes', 'array', 'max:100'],
        ];
    }
}
