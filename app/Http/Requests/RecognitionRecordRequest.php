<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RecognitionRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'recipientId' => ['required', 'integer', 'exists:users,id'],
            'categoryId' => ['required', 'uuid', 'exists:recognition_categories,id'],
            'title' => ['required', 'string', 'min:5', 'max:255'],
            'achievementDetails' => ['required', 'string', 'min:10', 'max:10000'],
            'achievementDate' => ['required', 'date', 'before_or_equal:today'],
            'saveAsDraft' => ['sometimes', 'boolean'],
            'replacesId' => ['nullable', 'uuid', 'exists:recognition_records,id'],
            'evidence' => ['sometimes', 'array', 'max:10'],
            'evidence.*.type' => ['nullable', 'string', 'max:100'],
            'evidence.*.sourceModule' => ['nullable', 'in:Performance,Competency,Learning,Training,Other'],
            'evidence.*.sourceRecordId' => ['nullable', 'string', 'max:255'],
            'evidence.*.sourceFinalizedAt' => ['nullable', 'date'],
            'evidence.*.description' => ['nullable', 'string', 'max:5000'],
            'evidence.*.sourceSnapshot' => ['nullable', 'array', 'max:100'],
        ];
    }
}
