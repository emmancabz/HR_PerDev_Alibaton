<?php

namespace App\Services\AI\System;

use Illuminate\Support\Collection;

class UsersQueryExecutor
{
    public function __construct(
        private readonly UsersContextService $context,
        private readonly UsersEntityResolver $resolver,
        private readonly AevynIntentMatcher $intentMatcher,
    ) {}

    /**
     * Execute a User Management question deterministically.
     *
     * IMPORTANT:
     * - This does NOT call Groq.
     * - When local understanding is insufficient, handled=false is
     *   returned so the future Aevyn router can use AI interpretation.
     */
    public function execute(string $message): array
    {
        $resolution = $this->resolver->resolve($message);
        $intent = $this->intentMatcher->matchUsers($resolution);

        /*
         * Ambiguous personnel/entity.
         * Never guess.
         */
        if (($intent['route'] ?? null) === 'clarify') {
            return $this->clarificationResponse(
                $resolution,
                $intent,
            );
        }

        /*
         * Local engine is not confident enough.
         * Future router will send ONLY the interpretation task to AI.
         */
        if (($intent['route'] ?? null) !== 'local') {
            return [
                'handled' => false,
                'route' => $intent['route'] ?? 'ai_interpreter',

                'source' => 'system',
                'module' => 'Users',

                'answer' => null,

                'aiUsed' => false,
                'aiRequiredFor' => 'intent_interpretation',

                'resolution' => $resolution,
                'intent' => $intent,
            ];
        }

        $intentName = (string) ($intent['intent'] ?? 'unknown');

        if ($intentName === 'summary') {
            return $this->summaryResponse(
                $resolution,
                $intent,
            );
        }

        if ($intentName === 'person_detail') {
            return $this->personDetailResponse(
                $resolution,
                $intent,
            );
        }

        if ($intentName === 'person_summary') {
            return $this->personSummaryResponse(
                $resolution,
                $intent,
            );
        }

        $users = $this->applyEntities(
            $this->context->users(),
            $resolution['entities'] ?? [],
        );

        return match ($intentName) {
            'count' => $this->countResponse(
                $users,
                $resolution,
                $intent,
            ),

            'list' => $this->listResponse(
                $users,
                $resolution,
                $intent,
            ),

            'existence' => $this->existenceResponse(
                $users,
                $resolution,
                $intent,
            ),

            default => [
                'handled' => false,
                'route' => 'ai_interpreter',

                'source' => 'system',
                'module' => 'Users',

                'answer' => null,

                'aiUsed' => false,
                'aiRequiredFor' => 'intent_interpretation',

                'resolution' => $resolution,
                'intent' => $intent,
            ],
        };
    }

    /**
     * Execute an already validated AI interpretation.
     *
     * AI only interpreted language.
     * All factual results still come from UsersContextService.
     */
    public function executeInterpreted(
        array $interpretation,
    ): array {
        if (
            ($interpretation['interpreted'] ?? false) !== true
            || ($interpretation['intent'] ?? 'unknown') === 'unknown'
        ) {
            return [
                'handled' => false,
                'route' => 'full_ai',

                'source' => 'system',
                'module' => 'Users',

                'answer' => null,

                'aiUsed' => true,
                'aiPurpose' => 'intent_interpretation',

                'reason' => 'interpreter_could_not_resolve_request',
            ];
        }

        $confidence = (float) (
            $interpretation['confidence'] ?? 0
        );

        /*
         * Even AI interpretation needs a minimum confidence.
         * Never trust the model just because it returned JSON.
         */
        if ($confidence < 0.78) {
            return [
                'handled' => false,
                'route' => 'full_ai',

                'source' => 'system',
                'module' => 'Users',

                'answer' => null,

                'aiUsed' => true,
                'aiPurpose' => 'intent_interpretation',

                'reason' => 'ai_interpretation_low_confidence',
                'confidence' => $confidence,
            ];
        }

        $filters = is_array(
            $interpretation['filters'] ?? null
        )
            ? $interpretation['filters']
            : [];

        $entities = [
            'person' => null,

            'department' =>
                $filters['department'] ?? null,

            'role' =>
                $filters['role'] ?? null,

            'personType' =>
                $filters['personType'] ?? null,

            'accountStatus' =>
                $filters['accountStatus'] ?? null,

            'mfaStatus' =>
                $filters['mfaStatus'] ?? null,

            'evaluatorCapable' =>
                $filters['evaluatorCapable'] ?? null,
        ];

        /*
         * AI may identify the text of a person name/ID,
         * but the actual personnel record must still be resolved
         * by our deterministic system.
         */
        $personQuery =
            $interpretation['personQuery'] ?? null;

        if (
            is_string($personQuery)
            && trim($personQuery) !== ''
        ) {
            $personResolution =
                $this->resolver->resolve(
                    trim($personQuery)
                );

            if (
                ($personResolution['needsClarification']
                    ?? false) === true
            ) {
                return $this->clarificationResponse(
                    $personResolution,
                    [
                        'route' => 'clarify',
                        'intent' => 'clarification',
                        'understandingConfidence' =>
                            $confidence,
                    ],
                );
            }

            $resolvedPerson =
                $personResolution['entities']['person']
                ?? null;

            if (! is_array($resolvedPerson)) {
                return [
                    'handled' => true,
                    'route' => 'ai_interpreted',

                    'source' => 'system',
                    'module' => 'Users',
                    'intent' => 'person_not_found',

                    'answer' =>
                        'I could not find a matching person in the current User Management directory.',

                    'data' => [
                        'personQuery' => $personQuery,
                    ],

                    'aiUsed' => true,
                    'aiPurpose' =>
                        'intent_interpretation',

                    'authoritative' => true,
                    'responseLanguage' =>
                        $interpretation['responseLanguage']
                        ?? 'English',

                    'understandingConfidence' =>
                        $confidence,
                ];
            }

            $entities['person'] = $resolvedPerson;
        }

        $resolution = [
            'original' => null,

            'normalization' => [
                'original' => null,
                'normalized' => null,
                'corrected' => null,
                'tokens' => [],
                'corrections' => [],
                'correctionConfidence' => 1.0,
            ],

            'entities' => $entities,

            'confidence' => [
                'department' =>
                    $entities['department']
                        ? $confidence
                        : null,

                'person' =>
                    $entities['person']
                        ? $confidence
                        : null,
            ],

            'ambiguities' => [],
            'needsClarification' => false,
        ];

        $intent = [
            'intent' =>
                $interpretation['intent'],

            'requestedField' =>
                $interpretation['requestedField']
                ?? null,

            'intentConfidence' =>
                $confidence,

            'understandingConfidence' =>
                $confidence,

            'recognizedCoverage' => 1.0,

            'route' => 'local',
            'reason' => null,
        ];

        $intentName =
            (string) $interpretation['intent'];

        if ($intentName === 'summary') {
            $result = $this->summaryResponse(
                $resolution,
                $intent,
            );

            return $this->markAiInterpreted(
                $result,
                $interpretation,
            );
        }

        if ($intentName === 'person_detail') {
            $result = $this->personDetailResponse(
                $resolution,
                $intent,
            );

            return $this->markAiInterpreted(
                $result,
                $interpretation,
            );
        }

        if ($intentName === 'person_summary') {
            $result = $this->personSummaryResponse(
                $resolution,
                $intent,
            );

            return $this->markAiInterpreted(
                $result,
                $interpretation,
            );
        }

        $users = $this->applyEntities(
            $this->context->users(),
            $entities,
        );

        $result = match ($intentName) {
            'count' => $this->countResponse(
                $users,
                $resolution,
                $intent,
            ),

            'list' => $this->listResponse(
                $users,
                $resolution,
                $intent,
            ),

            'existence' =>
                $this->existenceResponse(
                    $users,
                    $resolution,
                    $intent,
                ),

            default => [
                'handled' => false,
                'route' => 'full_ai',
                'answer' => null,
                'source' => 'system',
                'module' => 'Users',
                'aiUsed' => true,
                'aiPurpose' =>
                    'intent_interpretation',
            ],
        };

        return $this->markAiInterpreted(
            $result,
            $interpretation,
        );
    }

    private function markAiInterpreted(
        array $result,
        array $interpretation,
    ): array {
        /*
         * Factual source stays "system".
         *
         * aiUsed=true only means AI helped understand the
         * language. It did not create the database answer.
         */
        $result['route'] = 'ai_interpreted';
        $result['source'] = 'system';
        $result['aiUsed'] = true;
        $result['aiPurpose'] =
            'intent_interpretation';

        $result['authoritative'] = true;

        $result['responseLanguage'] =
            $interpretation['responseLanguage']
            ?? 'English';

        $result['understandingConfidence'] =
            $interpretation['confidence']
            ?? null;

        $result['interpretation'] =
            $interpretation;

        return $result;
    }

    private function applyEntities(
        Collection $users,
        array $entities,
    ): Collection {
        $filtered = $users;

        if (! empty($entities['person']['databaseId'])) {
            $databaseId = $entities['person']['databaseId'];

            $filtered = $filtered->filter(
                fn (array $user): bool =>
                    $user['databaseId'] === $databaseId
            );
        }

        if (! empty($entities['department'])) {
            $filtered = $filtered->where(
                'department',
                $entities['department'],
            );
        }

        if (! empty($entities['role'])) {
            $filtered = $filtered->where(
                'role',
                $entities['role'],
            );
        }

        if (! empty($entities['personType'])) {
            $filtered = $filtered->where(
                'personType',
                $entities['personType'],
            );
        }

        if (! empty($entities['accountStatus'])) {
            $filtered = $filtered->where(
                'accountStatus',
                $entities['accountStatus'],
            );
        }

        if (! empty($entities['mfaStatus'])) {
            $filtered = $filtered->where(
                'mfaStatus',
                $entities['mfaStatus'],
            );
        }

        if (($entities['evaluatorCapable'] ?? null) === true) {
            $filtered = $filtered->where(
                'evaluatorCapable',
                true,
            );
        }

        return $filtered->values();
    }

    private function countResponse(
        Collection $users,
        array $resolution,
        array $intent,
    ): array {
        $count = $users->count();
        $scope = $this->scopeLabel(
            $resolution['entities'] ?? [],
        );

        $answer = $scope
            ? sprintf(
                'There %s %d %s in the current User Management directory.',
                $count === 1 ? 'is' : 'are',
                $count,
                $this->pluralizeScope($scope, $count),
            )
            : sprintf(
                'There are %d governed accounts in the current User Management directory.',
                $count,
            );

        return $this->success(
            $answer,
            'count',
            [
                'count' => $count,
                'scope' => $scope,
            ],
            $resolution,
            $intent,
        );
    }

    private function listResponse(
        Collection $users,
        array $resolution,
        array $intent,
    ): array {
        $count = $users->count();
        $scope = $this->scopeLabel(
            $resolution['entities'] ?? [],
        ) ?? 'matching personnel';

        if ($count === 0) {
            return $this->success(
                sprintf(
                    'No %s currently match that User Management query.',
                    $scope,
                ),
                'list',
                [
                    'count' => 0,
                    'matches' => [],
                    'scope' => $scope,
                ],
                $resolution,
                $intent,
            );
        }

        $names = $users
            ->pluck('name')
            ->filter()
            ->values();

        $visible = $names->take(10);

        $answer = sprintf(
            '%d %s found: %s',
            $count,
            $this->pluralizeScope($scope, $count),
            $visible->implode(', '),
        );

        if ($count > 10) {
            $answer .= sprintf(
                ', and %d more.',
                $count - 10,
            );
        } else {
            $answer .= '.';
        }

        return $this->success(
            $answer,
            'list',
            [
                'count' => $count,
                'matches' => $users
                    ->map(fn (array $user): array => [
                        'databaseId' => $user['databaseId'],
                        'personnelKey' => $user['personnelKey'],
                        'name' => $user['name'],
                        'position' => $user['position'],
                        'department' => $user['department'],
                        'role' => $user['role'],
                        'accountStatus' => $user['accountStatus'],
                    ])
                    ->values()
                    ->all(),
                'scope' => $scope,
            ],
            $resolution,
            $intent,
        );
    }

    private function existenceResponse(
        Collection $users,
        array $resolution,
        array $intent,
    ): array {
        $count = $users->count();
        $exists = $count > 0;

        $scope = $this->scopeLabel(
            $resolution['entities'] ?? [],
        ) ?? 'matching personnel';

        $answer = $exists
            ? sprintf(
                'Yes. %d %s currently match that User Management query.',
                $count,
                $this->pluralizeScope($scope, $count),
            )
            : sprintf(
                'No. There are currently no %s matching that User Management query.',
                $scope,
            );

        return $this->success(
            $answer,
            'existence',
            [
                'exists' => $exists,
                'count' => $count,
                'scope' => $scope,
            ],
            $resolution,
            $intent,
        );
    }

    private function summaryResponse(
        array $resolution,
        array $intent,
    ): array {
        $summary = $this->context->summary();

        $answer = sprintf(
            'User Management currently contains %d governed accounts: %d employees and %d trainee%s. '
            .'%d are active, %d are pending activation, %d are suspended, and %d are inactive. '
            .'Access roles include %d Admin, %d HR, and %d User accounts. '
            .'%d personnel are evaluator-capable.',
            $summary['total'],
            $summary['employees'],
            $summary['trainees'],
            $summary['trainees'] === 1 ? '' : 's',
            $summary['active'],
            $summary['pendingActivation'],
            $summary['suspended'],
            $summary['inactive'],
            $summary['admins'],
            $summary['hr'],
            (int) ($summary['byRole']['User'] ?? 0),
            $summary['evaluatorCapable'],
        );

        return $this->success(
            $answer,
            'summary',
            $summary,
            $resolution,
            $intent,
        );
    }

    private function personDetailResponse(
        array $resolution,
        array $intent,
    ): array {
        $person = $resolution['entities']['person'] ?? null;
        $field = $intent['requestedField'] ?? null;

        if (! is_array($person) || ! is_string($field)) {
            return $this->cannotSafelyAnswer(
                $resolution,
                $intent,
            );
        }

        $name = $person['name'];

        $answer = match ($field) {
            'directManager' =>
                $person['directManagerName'] === 'No direct supervisor recorded'
                    ? sprintf(
                        '%s currently has no direct supervisor recorded.',
                        $name,
                    )
                    : sprintf(
                        '%s reports to %s.',
                        $name,
                        $person['directManagerName'],
                    ),

            'department' => sprintf(
                '%s is assigned to %s.',
                $name,
                $person['department'],
            ),

            'position' => sprintf(
                '%s is recorded as %s in %s.',
                $name,
                $person['position'],
                $person['department'],
            ),

            'role' => sprintf(
                '%s has the %s access role.',
                $name,
                $person['role'],
            ),

            'mfaStatus' => sprintf(
                '%s has MFA status: %s.',
                $name,
                $person['mfaStatus'],
            ),

            'evaluatorCapable' =>
                $person['evaluatorCapable']
                    ? sprintf(
                        '%s is evaluator-capable.',
                        $name,
                    )
                    : sprintf(
                        '%s is not currently marked as evaluator-capable.',
                        $name,
                    ),

            'activationStatus' => sprintf(
                '%s has activation status: %s.',
                $name,
                $person['activationStatus'],
            ),

            'accountStatus' => sprintf(
                '%s has account status: %s.',
                $name,
                $person['accountStatus'],
            ),

            default => null,
        };

        if ($answer === null) {
            return $this->cannotSafelyAnswer(
                $resolution,
                $intent,
            );
        }

        return $this->success(
            $answer,
            'person_detail',
            [
                'person' => $person,
                'requestedField' => $field,
            ],
            $resolution,
            $intent,
        );
    }

    private function personSummaryResponse(
        array $resolution,
        array $intent,
    ): array {
        $person = $resolution['entities']['person'] ?? null;

        if (! is_array($person)) {
            return $this->cannotSafelyAnswer(
                $resolution,
                $intent,
            );
        }

        $managerText =
            $person['directManagerName'] === 'No direct supervisor recorded'
                ? 'No direct supervisor is currently recorded.'
                : sprintf(
                    'Their direct supervisor is %s.',
                    $person['directManagerName'],
                );

        $answer = sprintf(
            '%s is recorded as %s in %s. '
            .'Their access role is %s, account status is %s, and MFA status is %s. %s',
            $person['name'],
            $person['position'],
            $person['department'],
            $person['role'],
            $person['accountStatus'],
            $person['mfaStatus'],
            $managerText,
        );

        return $this->success(
            $answer,
            'person_summary',
            [
                'person' => $person,
            ],
            $resolution,
            $intent,
        );
    }

    private function clarificationResponse(
        array $resolution,
        array $intent,
    ): array {
        $candidates = collect(
            $resolution['ambiguities']['person'] ?? []
        )
            ->pluck('name')
            ->filter()
            ->values();

        $answer = $candidates->isNotEmpty()
            ? 'I found multiple possible personnel matches: '
                .$candidates->implode(', ')
                .'. Please specify which person you mean.'
            : 'I need a little more information before I can answer that accurately.';

        return [
            'handled' => true,
            'route' => 'clarify',

            'source' => 'system',
            'module' => 'Users',
            'intent' => 'clarification',

            'answer' => $answer,

            'data' => [
                'candidates' => $candidates->all(),
            ],

            'aiUsed' => false,
            'authoritative' => true,

            'resolution' => $resolution,
            'understanding' => $intent,
        ];
    }

    private function cannotSafelyAnswer(
        array $resolution,
        array $intent,
    ): array {
        return [
            'handled' => false,
            'route' => 'ai_interpreter',

            'source' => 'system',
            'module' => 'Users',

            'answer' => null,

            'aiUsed' => false,
            'aiRequiredFor' => 'intent_interpretation',

            'resolution' => $resolution,
            'intent' => $intent,
        ];
    }

    private function success(
        string $answer,
        string $intent,
        array $data,
        array $resolution,
        array $understanding,
    ): array {
        return [
            'handled' => true,
            'route' => 'local',

            'source' => 'system',
            'module' => 'Users',
            'intent' => $intent,

            'answer' => $answer,
            'data' => $data,

            'aiUsed' => false,
            'authoritative' => true,

            'understandingConfidence' =>
                $understanding['understandingConfidence']
                ?? null,

            'resolution' => $resolution,
        ];
    }

    private function pluralizeScope(
        string $scope,
        int $count,
    ): string {
        if ($count === 1) {
            return $scope;
        }

        /*
         * Scope labels may contain proper department names such as
         * "Operations" or "Human Resources". Never pluralize the
         * entire phrase by appending "s".
         */
        $replacements = [
            'employee in ' => 'employees in ',
            'trainee in ' => 'trainees in ',
            'personnel in ' => 'personnel in ',
            'Admin in ' => 'Admins in ',
            'HR in ' => 'HR accounts in ',
            'evaluator-capable in ' => 'evaluator-capable personnel in ',
            'account without MFA in ' => 'accounts without MFA in ',
            'account with MFA in ' => 'accounts with MFA in ',
        ];

        foreach ($replacements as $from => $to) {
            if (str_starts_with($scope, $from)) {
                return $to.substr($scope, strlen($from));
            }
        }

        return match ($scope) {
            'employee' => 'employees',
            'trainee' => 'trainees',
            'personnel' => 'personnel',
            'Admin' => 'Admins',
            'HR' => 'HR accounts',
            'account without MFA' => 'accounts without MFA',
            'account with MFA' => 'accounts with MFA',
            'evaluator-capable personnel' => 'evaluator-capable personnel',
            'active personnel' => 'active personnel',
            'inactive personnel' => 'inactive personnel',
            'suspended personnel' => 'suspended personnel',

            'active Admin' => 'active Admin accounts',
            'inactive Admin' => 'inactive Admin accounts',
            'suspended Admin' => 'suspended Admin accounts',

            'active HR' => 'active HR accounts',
            'inactive HR' => 'inactive HR accounts',
            'suspended HR' => 'suspended HR accounts',

            default => $scope,
        };
    }

    private function scopeLabel(array $entities): ?string
    {
        $parts = [];

        if (! empty($entities['accountStatus'])) {
            $parts[] = strtolower(
                (string) $entities['accountStatus']
            );
        }

        if (! empty($entities['role'])) {
            $parts[] = $entities['role'];
        }

        if (! empty($entities['mfaStatus'])) {
            $parts[] = $entities['mfaStatus'] === 'Not Enrolled'
                ? 'account without MFA'
                : 'account with MFA';
        }

        if (($entities['evaluatorCapable'] ?? null) === true) {
            $parts[] = 'evaluator-capable';
        }

        if (! empty($entities['personType'])) {
            $parts[] = strtolower(
                (string) $entities['personType']
            );
        } elseif (
            empty($entities['role'])
            && empty($entities['mfaStatus'])
        ) {
            $parts[] = 'personnel';
        }

        if (! empty($entities['department'])) {
            $parts[] = 'in '.$entities['department'];
        }

        return $parts === []
            ? null
            : implode(' ', $parts);
    }
}
