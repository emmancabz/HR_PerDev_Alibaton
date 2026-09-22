<?php

namespace App\Services\AI\System;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class UsersEntityResolver
{
    public function __construct(
        private readonly UsersContextService $context,
        private readonly AevynNormalizer $normalizer,
    ) {}

    public function resolve(string $message): array
    {
        $users = $this->context->users();

        $departments = $users
            ->pluck('department')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $normalization = $this->normalizer->normalize(
            $message,
            [
                ...$departments,

                'employee',
                'trainee',

                'admin',
                'hr',
                'user',

                'active',
                'inactive',
                'suspended',
                'pending activation',

                'mfa',
                'evaluator',
                'manager',
                'supervisor',

                'department',
                'position',
                'role',
                'account',
            ],
            [
                'crane ops' => 'crane operations',
                'info tech' => 'information technology',
                'it dept' => 'information technology',
                'it department' => 'information technology',

                'hr dept' => 'human resources',
                'hr department' => 'human resources',

                'no mfa' => 'without mfa',
                'walang mfa' => 'without mfa',
                'dont have mfa' => 'without mfa',
                'do not have mfa' => 'without mfa',
                'doesnt have mfa' => 'without mfa',
                'does not have mfa' => 'without mfa',
                'not enrolled in mfa' => 'without mfa',

                'can evaluate' => 'evaluator capable',
                'can assess' => 'evaluator capable',
                'can perform assessments' => 'evaluator capable',
                'can conduct assessments' => 'evaluator capable',
                'pwede mag evaluate' => 'evaluator capable',
                'pwedeng mag evaluate' => 'evaluator capable',
                'pwede mag assess' => 'evaluator capable',
                'pwedeng mag assess' => 'evaluator capable',
            ],
        );

        $text = $normalization['corrected'];

        $entities = [
            'person' => null,
            'department' => null,
            'role' => null,
            'personType' => null,
            'accountStatus' => null,
            'mfaStatus' => null,
            'evaluatorCapable' => null,
        ];

        $confidence = [
            'department' => null,
            'person' => null,
        ];

        $ambiguities = [];

        /*
         * ---------------------------------------------------------
         * Department
         * ---------------------------------------------------------
         */
        $departmentMatches = collect($departments)
            ->sortByDesc(
                fn (string $department): int =>
                    mb_strlen($department)
            )
            ->filter(function (string $department) use ($text): bool {
                return $this->containsPhrase(
                    $text,
                    $this->normalize($department),
                );
            })
            ->values();

        if ($departmentMatches->isNotEmpty()) {
            $entities['department'] = $departmentMatches->first();
            $confidence['department'] = 1.0;
        } else {
            $departmentFuzzy = $this->resolveDepartmentFuzzy(
                $text,
                collect($departments),
            );

            if ($departmentFuzzy !== null) {
                $entities['department'] = $departmentFuzzy['value'];
                $confidence['department'] = $departmentFuzzy['confidence'];
            }
        }

        /*
         * ---------------------------------------------------------
         * Person type
         * ---------------------------------------------------------
         */
        if ($this->hasWord($text, 'trainee')) {
            $entities['personType'] = 'Trainee';
        } elseif ($this->hasWord($text, 'employee')) {
            $entities['personType'] = 'Employee';
        }

        /*
         * "personnel", "people", and "staff" intentionally do not
         * set personType. They refer to the full governed directory,
         * which may contain both employees and trainees.
         */

        /*
         * ---------------------------------------------------------
         * Access role
         *
         * HR needs special handling because "Human Resources"
         * may refer to a department rather than the HR access role.
         * ---------------------------------------------------------
         */
        if (
            $this->hasWord($text, 'admin')
            || $this->hasWord($text, 'administrator')
        ) {
            $entities['role'] = 'Admin';
        } elseif (
            $this->hasWord($text, 'hr')
            && ! $this->containsPhrase($text, 'hr department')
            && ! $this->containsPhrase($text, 'human resources department')
        ) {
            $entities['role'] = 'HR';
        } elseif (
            $this->containsPhrase($text, 'user role')
            || $this->containsPhrase($text, 'access role user')
        ) {
            $entities['role'] = 'User';
        }

        /*
         * ---------------------------------------------------------
         * Account status
         * ---------------------------------------------------------
         */
        if ($this->hasWord($text, 'suspended')) {
            $entities['accountStatus'] = 'Suspended';
        } elseif ($this->hasWord($text, 'inactive')) {
            $entities['accountStatus'] = 'Inactive';
        } elseif (
            $this->containsPhrase($text, 'pending activation')
            || $this->containsPhrase($text, 'invitation pending')
            || $this->containsPhrase($text, 'not activated')
        ) {
            $entities['accountStatus'] = 'Pending Activation';
        } elseif ($this->hasWord($text, 'active')) {
            $entities['accountStatus'] = 'Active';
        }

        /*
         * ---------------------------------------------------------
         * MFA
         * ---------------------------------------------------------
         */
        if (
            $this->containsPhrase($text, 'without mfa')
            || $this->containsPhrase($text, 'no mfa')
            || $this->containsPhrase($text, 'mfa not enrolled')
            || $this->containsPhrase($text, 'not enrolled mfa')
        ) {
            $entities['mfaStatus'] = 'Not Enrolled';
        } elseif (
            $this->containsPhrase($text, 'with mfa')
            || $this->containsPhrase($text, 'mfa enabled')
            || $this->containsPhrase($text, 'enabled mfa')
        ) {
            $entities['mfaStatus'] = 'Enabled';
        }

        /*
         * ---------------------------------------------------------
         * Evaluator capability
         * ---------------------------------------------------------
         */
        if (
            $this->hasWord($text, 'evaluator')
            || $this->containsPhrase($text, 'evaluator capable')
            || $this->containsPhrase($text, 'can evaluate')
        ) {
            $entities['evaluatorCapable'] = true;
        }

        /*
         * ---------------------------------------------------------
         * Person
         * ---------------------------------------------------------
         */
        $personResolution = $this->resolvePerson(
            $message,
            $users,
        );

        if ($personResolution['status'] === 'resolved') {
            $entities['person'] = $personResolution['person'];
            $confidence['person'] = $personResolution['confidence'];
        }

        if ($personResolution['status'] === 'ambiguous') {
            $ambiguities['person'] = $personResolution['candidates'];
        }

        return [
            'original' => $message,

            'normalization' => $normalization,

            'entities' => $entities,

            'confidence' => $confidence,

            'ambiguities' => $ambiguities,

            'needsClarification' => $ambiguities !== [],
        ];
    }

    private function resolvePerson(
        string $message,
        Collection $users,
    ): array {
        $normalizedMessage = $this->normalize($message);

        /*
         * Strong exact identifiers.
         */
        foreach ($users as $user) {
            foreach ([
                $user['email'] ?? null,
                $user['employeeOrTraineeId'] ?? null,
                $user['personnelKey'] ?? null,
            ] as $identifier) {
                if (! is_string($identifier)) {
                    continue;
                }

                $identifier = trim($identifier);

                if ($identifier === '') {
                    continue;
                }

                if (
                    str_contains(
                        $normalizedMessage,
                        $this->normalize($identifier),
                    )
                ) {
                    return [
                        'status' => 'resolved',
                        'person' => $this->personPayload($user),
                        'confidence' => 1.0,
                    ];
                }
            }
        }

        /*
         * Exact full-name mention.
         */
        $exactNameMatches = $users
            ->filter(function (array $user) use ($normalizedMessage): bool {
                $name = $this->normalize(
                    (string) ($user['name'] ?? ''),
                );

                return $name !== ''
                    && $this->containsPhrase(
                        $normalizedMessage,
                        $name,
                    );
            })
            ->values();

        if ($exactNameMatches->count() === 1) {
            return [
                'status' => 'resolved',
                'person' => $this->personPayload(
                    $exactNameMatches->first()
                ),
                'confidence' => 1.0,
            ];
        }

        /*
         * Token-level fuzzy name resolution.
         *
         * We use only name-sized tokens and require a strong score.
         * This prevents random words from becoming personnel names.
         */
        $messageTokens = collect(
            preg_split(
                '/\s+/u',
                $normalizedMessage,
                -1,
                PREG_SPLIT_NO_EMPTY,
            ) ?: []
        )
            ->filter(
                fn (string $token): bool =>
                    mb_strlen($token) >= 3
                    && ! in_array(
                        $token,
                        $this->stopWords(),
                        true,
                    )
            )
            ->values();

        if ($messageTokens->isEmpty()) {
            return [
                'status' => 'none',
                'person' => null,
                'confidence' => null,
            ];
        }

        $scored = [];

        foreach ($users as $user) {
            $name = (string) ($user['name'] ?? '');

            if ($name === '') {
                continue;
            }

            $nameTokens = collect(
                preg_split(
                    '/\s+/u',
                    $this->normalize($name),
                    -1,
                    PREG_SPLIT_NO_EMPTY,
                ) ?: []
            )
                ->filter(
                    fn (string $token): bool =>
                        mb_strlen($token) >= 3
                )
                ->values();

            if ($nameTokens->isEmpty()) {
                continue;
            }

            $matchedScores = [];

            foreach ($messageTokens as $messageToken) {
                foreach ($nameTokens as $nameToken) {
                    $score = $this->tokenSimilarity(
                        $messageToken,
                        $nameToken,
                    );

                    if ($score >= 0.78) {
                        $matchedScores[] = $score;
                    }
                }
            }

            if ($matchedScores === []) {
                continue;
            }

            rsort($matchedScores);

            $matchedCount = min(
                count($matchedScores),
                $nameTokens->count(),
            );

            $coverage = $matchedCount / max(
                1,
                $nameTokens->count(),
            );

            $average = array_sum(
                array_slice(
                    $matchedScores,
                    0,
                    $matchedCount,
                )
            ) / $matchedCount;

            /*
             * Coverage matters because matching only one generic
             * name token should not automatically identify someone.
             */
            $finalScore = (
                ($average * 0.65)
                + ($coverage * 0.35)
            );

            if ($finalScore < 0.68) {
                continue;
            }

            $scored[] = [
                'user' => $user,
                'score' => round($finalScore, 3),
            ];
        }

        if ($scored === []) {
            return [
                'status' => 'none',
                'person' => null,
                'confidence' => null,
            ];
        }

        usort(
            $scored,
            fn (array $a, array $b): int =>
                $b['score'] <=> $a['score'],
        );

        $best = $scored[0];

        /*
         * If another candidate is almost equally likely,
         * Aevyn must ask the user instead of guessing.
         */
        $closeMatches = array_values(
            array_filter(
                $scored,
                fn (array $candidate): bool =>
                    ($best['score'] - $candidate['score']) <= 0.04
            )
        );

        if (count($closeMatches) > 1) {
            return [
                'status' => 'ambiguous',
                'person' => null,
                'confidence' => $best['score'],
                'candidates' => collect($closeMatches)
                    ->take(5)
                    ->map(
                        fn (array $candidate): array =>
                            $this->personPayload(
                                $candidate['user']
                            )
                    )
                    ->values()
                    ->all(),
            ];
        }

        return [
            'status' => 'resolved',
            'person' => $this->personPayload(
                $best['user']
            ),
            'confidence' => $best['score'],
        ];
    }

    private function resolveDepartmentFuzzy(
        string $text,
        Collection $departments,
    ): ?array {
        $textTokens = preg_split(
            '/\s+/u',
            $text,
            -1,
            PREG_SPLIT_NO_EMPTY,
        ) ?: [];

        $candidates = [];

        foreach ($departments as $department) {
            $departmentTokens = preg_split(
                '/\s+/u',
                $this->normalize($department),
                -1,
                PREG_SPLIT_NO_EMPTY,
            ) ?: [];

            foreach ($textTokens as $textToken) {
                foreach ($departmentTokens as $departmentToken) {
                    if (
                        mb_strlen($textToken) < 4
                        || mb_strlen($departmentToken) < 4
                    ) {
                        continue;
                    }

                    $similarity = $this->tokenSimilarity(
                        $textToken,
                        $departmentToken,
                    );

                    if ($similarity >= 0.82) {
                        $candidates[] = [
                            'value' => $department,
                            'confidence' => $similarity,
                        ];
                    }
                }
            }
        }

        if ($candidates === []) {
            return null;
        }

        usort(
            $candidates,
            fn (array $a, array $b): int =>
                $b['confidence'] <=> $a['confidence'],
        );

        if (
            isset($candidates[1])
            && $candidates[0]['value'] !== $candidates[1]['value']
            && abs(
                $candidates[0]['confidence']
                - $candidates[1]['confidence']
            ) < 0.03
        ) {
            return null;
        }

        return $candidates[0];
    }

    private function personPayload(array $user): array
    {
        return [
            'databaseId' => $user['databaseId'],
            'personnelKey' => $user['personnelKey'],
            'employeeOrTraineeId' =>
                $user['employeeOrTraineeId'],

            'name' => $user['name'],
            'email' => $user['email'],

            'position' => $user['position'],
            'department' => $user['department'],

            'role' => $user['role'],
            'personType' => $user['personType'],

            'accountStatus' => $user['accountStatus'],
            'activationStatus' => $user['activationStatus'],

            'mfaStatus' => $user['mfaStatus'],
            'evaluatorCapable' => $user['evaluatorCapable'],

            'directManagerName' =>
                $user['directManagerName'],
        ];
    }

    private function tokenSimilarity(
        string $a,
        string $b,
    ): float {
        if ($a === $b) {
            return 1.0;
        }

        $distance = levenshtein($a, $b);

        $maxLength = max(
            strlen($a),
            strlen($b),
        );

        if ($maxLength === 0) {
            return 0.0;
        }

        return max(
            0.0,
            1 - ($distance / $maxLength),
        );
    }

    private function containsPhrase(
        string $haystack,
        string $needle,
    ): bool {
        return preg_match(
            '/(?<![a-z0-9])'
            .preg_quote($needle, '/')
            .'(?![a-z0-9])/u',
            $haystack,
        ) === 1;
    }

    private function hasWord(
        string $text,
        string $word,
    ): bool {
        return $this->containsPhrase(
            $text,
            $this->normalize($word),
        );
    }

    private function normalize(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->ascii()
            ->replaceMatches(
                '/[^a-z0-9@._&\/\- ]+/',
                ' ',
            )
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }

    private function stopWords(): array
    {
        return [
            'count',
            'who',
            'exists',

            'what',
            'where',
            'when',
            'which',
            'show',
            'tell',

            'user',
            'people',
            'personnel',
            'staff',
            'employee',
            'trainee',

            'account',
            'status',
            'active',
            'inactive',
            'suspended',

            'admin',
            'role',
            'department',
            'position',

            'manager',
            'supervisor',
            'evaluator',
            'operations',

            'with',
            'without',
            'have',
            'does',
            'from',

            'ang',
            'mga',
            'sino',
            'ilan',
            'may',
            'meron',
            'wala',
            'walang',
            'ano',
            'anong',
            'nasa',
            'para',
        ];
    }
}
