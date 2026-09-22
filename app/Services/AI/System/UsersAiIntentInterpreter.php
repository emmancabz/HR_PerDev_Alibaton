<?php

namespace App\Services\AI\System;

use App\Services\AI\AevynService;
use JsonException;
use Throwable;

class UsersAiIntentInterpreter
{
    public function __construct(
        private readonly AevynService $aevyn,
        private readonly UsersContextService $context,
    ) {}

    /**
     * AI is used ONLY to interpret the user's language/intent.
     *
     * It must never determine authoritative workforce facts.
     */
    public function interpret(string $message): array
    {
        $departments = $this->context
            ->users()
            ->pluck('department')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $systemPrompt = $this->systemPrompt($departments);

        try {
            $raw = $this->aevyn->chat(
                $message,
                $systemPrompt,
            );

            $payload = $this->decodeJson($raw);

            if (! is_array($payload)) {
                return $this->failure(
                    'invalid_interpreter_response'
                );
            }

            return $this->validateInterpretation(
                $payload,
                $departments,
            );
        } catch (Throwable $exception) {
            report($exception);

            return $this->failure(
                'interpreter_unavailable'
            );
        }
    }

    private function systemPrompt(array $departments): string
    {
        $departmentList = implode(
            ', ',
            array_map(
                fn (string $department): string =>
                    '"'.$department.'"',
                $departments,
            )
        );

        return <<<PROMPT
You are the language and intent interpreter for Aevyn's User Management module.

Your ONLY job is to understand what the user is asking.

DO NOT answer the user's question.
DO NOT invent employee counts.
DO NOT invent names.
DO NOT claim any database facts.
DO NOT provide explanations.
DO NOT output Markdown.

Understand:
- English
- Filipino / Tagalog
- Taglish
- slang
- shorthand
- misspellings
- unusual grammar
- other natural languages

Return exactly ONE valid JSON object.

Allowed intent values:
- "count"
- "list"
- "existence"
- "summary"
- "person_detail"
- "person_summary"
- "unknown"

Allowed requestedField values:
- "directManager"
- "department"
- "position"
- "role"
- "mfaStatus"
- "evaluatorCapable"
- "activationStatus"
- "accountStatus"
- null

Required subjectScope values:
- "Employee"
- "Trainee"
- "AllPersonnel"
- "Unclear"

subjectScope is REQUIRED for every request.

Use:
- "Employee" when the user specifically refers to employees/workers/employees in any language.
- "Trainee" when the user specifically refers to trainees/interns/apprentices/learners in that workforce sense.
- "AllPersonnel" when the user refers generally to people, persons, personnel, staff, workforce, users, accounts, or does not narrow the population.
- "Unclear" only when you genuinely cannot determine the intended population.

IMPORTANT:
Evaluator/assessment wording does NOT imply Employee.
If the user asks which person/people can evaluate or assess, use "AllPersonnel"
unless the user explicitly says employee, trainee, or an equivalent narrower workforce term.

Examples:
- English "employees" -> "Employee"
- Filipino "empleyado" -> "Employee"
- Spanish "empleados" -> "Employee"
- French "employés" -> "Employee"
- Japanese "従業員" -> "Employee"
- Japanese "人" or "人々" -> "AllPersonnel"
- Korean "직원" -> "Employee"
- generic "person/people" in any language -> "AllPersonnel"
- English "trainees" -> "Trainee"
- Filipino "trainee" -> "Trainee"
- Japanese "研修生" -> "Trainee"
- general "people/personnel/staff" -> "AllPersonnel"

Allowed personType values inside filters:
- "Employee"
- "Trainee"
- null

filters.personType MUST agree with subjectScope:
- subjectScope "Employee" -> personType "Employee"
- subjectScope "Trainee" -> personType "Trainee"
- subjectScope "AllPersonnel" -> personType null
- subjectScope "Unclear" -> personType null

Allowed role values:
- "Admin"
- "HR"
- "User"
- null

Allowed accountStatus values:
- "Active"
- "Inactive"
- "Suspended"
- "Pending Activation"
- null

Allowed mfaStatus values:
- "Enabled"
- "Not Enrolled"
- null

Allowed departments are:
{$departmentList}

Rules:

1. Use an exact department value from the allowed department list.
2. If no department was requested, use null.
3. Never broaden a narrower workforce term.
   If the user says the equivalent of "employee" in ANY language, subjectScope MUST be "Employee".
   If the user says the equivalent of "trainee" in ANY language, subjectScope MUST be "Trainee".
   General words such as people/personnel/staff/workforce should use "AllPersonnel".

4. Distinguish role from department.
   "HR role" means role = "HR".
   "Human Resources department" means department = "Human Resources".

5. evaluatorCapable must be true only when the user specifically asks about personnel who can evaluate/assess.
6. personQuery should contain the person's name, email, ID, or other identifier exactly as understood from the user's request.
7. Never guess a person if none was mentioned.
8. requestedField is used only for person-specific detail questions.
9. responseLanguage should identify the language the user used, such as "English", "Filipino", "Spanish", "Japanese".
10. confidence must be a number from 0 to 1 indicating confidence in YOUR INTERPRETATION, not confidence in any database fact.
11. If the meaning is genuinely unclear, use intent "unknown".

JSON schema:

{
  "intent": "count|list|existence|summary|person_detail|person_summary|unknown",
  "requestedField": null,
  "subjectScope": "Employee|Trainee|AllPersonnel|Unclear",
  "filters": {
    "department": null,
    "role": null,
    "personType": null,
    "accountStatus": null,
    "mfaStatus": null,
    "evaluatorCapable": null
  },
  "personQuery": null,
  "responseLanguage": "English",
  "confidence": 0.0
}
PROMPT;
    }

    private function validateInterpretation(
        array $payload,
        array $departments,
    ): array {
        $allowedIntents = [
            'count',
            'list',
            'existence',
            'summary',
            'person_detail',
            'person_summary',
            'unknown',
        ];

        $allowedFields = [
            'directManager',
            'department',
            'position',
            'role',
            'mfaStatus',
            'evaluatorCapable',
            'activationStatus',
            'accountStatus',
        ];

        $allowedRoles = [
            'Admin',
            'HR',
            'User',
        ];

        $allowedPersonTypes = [
            'Employee',
            'Trainee',
        ];

        $allowedStatuses = [
            'Active',
            'Inactive',
            'Suspended',
            'Pending Activation',
        ];

        $allowedMfaStatuses = [
            'Enabled',
            'Not Enrolled',
        ];

        $intent = $payload['intent'] ?? 'unknown';

        if (! in_array($intent, $allowedIntents, true)) {
            $intent = 'unknown';
        }

        $requestedField = $payload['requestedField'] ?? null;

        if (
            $requestedField !== null
            && ! in_array(
                $requestedField,
                $allowedFields,
                true,
            )
        ) {
            $requestedField = null;
        }

        $filters = is_array(
            $payload['filters'] ?? null
        )
            ? $payload['filters']
            : [];

        $allowedSubjectScopes = [
            'Employee',
            'Trainee',
            'AllPersonnel',
            'Unclear',
        ];

        $subjectScope =
            $payload['subjectScope']
            ?? 'Unclear';

        if (
            ! is_string($subjectScope)
            || ! in_array(
                $subjectScope,
                $allowedSubjectScopes,
                true,
            )
        ) {
            $subjectScope = 'Unclear';
        }

        $department = $this->canonicalDepartment(
            $filters['department'] ?? null,
            $departments,
        );

        $role = $filters['role'] ?? null;

        if (
            $role !== null
            && ! in_array($role, $allowedRoles, true)
        ) {
            $role = null;
        }

        /*
         * subjectScope is authoritative for population semantics.
         * We intentionally do not trust filters.personType on its own.
         */
        $personType = match ($subjectScope) {
            'Employee' => 'Employee',
            'Trainee' => 'Trainee',
            'AllPersonnel', 'Unclear' => null,
            default => null,
        };

        $accountStatus =
            $filters['accountStatus'] ?? null;

        if (
            $accountStatus !== null
            && ! in_array(
                $accountStatus,
                $allowedStatuses,
                true,
            )
        ) {
            $accountStatus = null;
        }

        $mfaStatus = $filters['mfaStatus'] ?? null;

        if (
            $mfaStatus !== null
            && ! in_array(
                $mfaStatus,
                $allowedMfaStatuses,
                true,
            )
        ) {
            $mfaStatus = null;
        }

        $evaluatorCapable =
            $filters['evaluatorCapable'] ?? null;

        if (! is_bool($evaluatorCapable)) {
            $evaluatorCapable = null;
        }

        $personQuery = $payload['personQuery'] ?? null;

        if (! is_string($personQuery)) {
            $personQuery = null;
        } else {
            $personQuery = trim(
                mb_substr($personQuery, 0, 160)
            );

            if ($personQuery === '') {
                $personQuery = null;
            }
        }

        $responseLanguage =
            $payload['responseLanguage']
            ?? 'English';

        if (! is_string($responseLanguage)) {
            $responseLanguage = 'English';
        }

        $responseLanguage = trim(
            mb_substr($responseLanguage, 0, 40)
        );

        $confidence = $payload['confidence'] ?? 0;

        if (! is_numeric($confidence)) {
            $confidence = 0;
        }

        $confidence = max(
            0,
            min(1, (float) $confidence),
        );

        /*
         * AI is not allowed to claim high-confidence interpretation
         * when it could not determine the requested population.
         */
        if ($subjectScope === 'Unclear') {
            $confidence = min(
                $confidence,
                0.60,
            );
        }

        return [
            'interpreted' => true,
            'aiUsed' => true,
            'aiPurpose' => 'intent_interpretation',

            'intent' => $intent,
            'requestedField' => $requestedField,
            'subjectScope' => $subjectScope,

            'filters' => [
                'department' => $department,
                'role' => $role,
                'personType' => $personType,
                'accountStatus' => $accountStatus,
                'mfaStatus' => $mfaStatus,
                'evaluatorCapable' =>
                    $evaluatorCapable,
            ],

            'personQuery' => $personQuery,

            'responseLanguage' =>
                $responseLanguage,

            'confidence' => round(
                $confidence,
                3,
            ),
        ];
    }

    private function canonicalDepartment(
        mixed $value,
        array $departments,
    ): ?string {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        foreach ($departments as $department) {
            if (
                mb_strtolower($department)
                === mb_strtolower($value)
            ) {
                return $department;
            }
        }

        /*
         * AI is not allowed to invent a new department.
         */
        return null;
    }

    private function decodeJson(
        string $raw,
    ): ?array {
        $clean = trim($raw);

        /*
         * Be tolerant if the model accidentally wraps JSON
         * in a fenced code block.
         */
        $clean = preg_replace(
            '/^```(?:json)?\s*/i',
            '',
            $clean,
        ) ?? $clean;

        $clean = preg_replace(
            '/\s*```$/',
            '',
            $clean,
        ) ?? $clean;

        /*
         * If extra text somehow appears, extract the outermost
         * JSON object rather than trusting the prose.
         */
        $start = strpos($clean, '{');
        $end = strrpos($clean, '}');

        if (
            $start === false
            || $end === false
            || $end <= $start
        ) {
            return null;
        }

        $json = substr(
            $clean,
            $start,
            ($end - $start) + 1,
        );

        try {
            $decoded = json_decode(
                $json,
                true,
                32,
                JSON_THROW_ON_ERROR,
            );
        } catch (JsonException) {
            return null;
        }

        return is_array($decoded)
            ? $decoded
            : null;
    }

    private function failure(string $reason): array
    {
        return [
            'interpreted' => false,
            'aiUsed' => true,
            'aiPurpose' => 'intent_interpretation',

            'intent' => 'unknown',
            'requestedField' => null,
            'subjectScope' => 'Unclear',

            'filters' => [
                'department' => null,
                'role' => null,
                'personType' => null,
                'accountStatus' => null,
                'mfaStatus' => null,
                'evaluatorCapable' => null,
            ],

            'personQuery' => null,
            'responseLanguage' => null,
            'confidence' => 0.0,

            'reason' => $reason,
        ];
    }
}
