<?php

namespace App\Services\AI\System;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class UsersQueryService
{
    public function __construct(
        private readonly UsersContextService $context,
    ) {}

    /**
     * Attempt to answer a User Management question deterministically.
     *
     * Returns null when the Users engine cannot answer safely.
     * Returning null is important: Aevyn must never invent an answer.
     */
    public function answer(string $message): ?array
    {
        $question = $this->normalize($message);

        if ($question === '') {
            return null;
        }

        $users = $this->context->users();

        /*
         * Person-specific questions take priority over aggregate questions.
         */
        $person = $this->resolvePerson($message, $users);

        if ($person !== null) {
            $answer = $this->answerPersonQuestion($question, $person);

            if ($answer !== null) {
                return $this->result(
                    $answer,
                    'person_lookup',
                    [
                        'personnelKey' => $person['personnelKey'],
                        'name' => $person['name'],
                    ],
                );
            }
        }

        /*
         * Directory-wide filters.
         */
        $filtered = $this->applyFilters($question, $users);

        /*
         * List / who questions.
         */
        if ($this->isWhoQuestion($question)) {
            return $this->answerWhoQuestion(
                $question,
                $filtered,
                $users,
            );
        }

        /*
         * Count / how-many questions.
         */
        if ($this->isCountQuestion($question)) {
            return $this->answerCountQuestion(
                $question,
                $filtered,
                $users,
            );
        }

        /*
         * Yes/no availability or existence questions.
         */
        if ($this->isExistenceQuestion($question)) {
            return $this->answerExistenceQuestion(
                $question,
                $filtered,
                $users,
            );
        }

        /*
         * High-level User Management summaries.
         */
        if ($this->isSummaryQuestion($question)) {
            $summary = $this->context->summary();

            return $this->result(
                sprintf(
                    'User Management currently contains %d governed accounts: %d employees and %d trainee%s. '
                    .'All %d account%s are currently active. There are %d Admin accounts and %d HR accounts.',
                    $summary['total'],
                    $summary['employees'],
                    $summary['trainees'],
                    $summary['trainees'] === 1 ? '' : 's',
                    $summary['active'],
                    $summary['active'] === 1 ? '' : 's',
                    $summary['admins'],
                    $summary['hr'],
                ),
                'directory_summary',
                $summary,
            );
        }

        return null;
    }

    private function answerPersonQuestion(
        string $question,
        array $person,
    ): ?string {
        $name = $person['name'];

        if ($this->containsAny($question, [
            'manager',
            'supervisor',
            'direct manager',
            'direct supervisor',
            'kanino naka report',
            'reports to',
        ])) {
            return sprintf(
                '%s reports to %s.',
                $name,
                $person['directManagerName'],
            );
        }

        if ($this->containsAny($question, [
            'department',
            'dept',
            'anong department',
            'which department',
        ])) {
            return sprintf(
                '%s is assigned to the %s department.',
                $name,
                $person['department'],
            );
        }

        if ($this->containsAny($question, [
            'role',
            'access role',
            'admin ba',
            'hr ba',
            'user ba',
        ])) {
            return sprintf(
                '%s has the %s access role.',
                $name,
                $person['role'],
            );
        }

        if ($this->containsAny($question, [
            'mfa',
            'multi factor',
            'multi-factor',
        ])) {
            return sprintf(
                '%s has MFA status: %s.',
                $name,
                $person['mfaStatus'],
            );
        }

        if ($this->containsAny($question, [
            'evaluator',
            'evaluator capable',
            'can evaluate',
            'pwede mag evaluate',
        ])) {
            return $person['evaluatorCapable']
                ? sprintf('%s is evaluator-capable.', $name)
                : sprintf('%s is not currently marked as evaluator-capable.', $name);
        }

        if ($this->containsAny($question, [
            'status',
            'account status',
            'active ba',
            'suspended ba',
            'inactive ba',
            'activation',
        ])) {
            return sprintf(
                '%s has an %s account. Activation status: %s.',
                $name,
                $person['accountStatus'],
                $person['activationStatus'],
            );
        }

        if ($this->containsAny($question, [
            'account',
            'may account',
            'has account',
        ])) {
            return sprintf(
                '%s has a governed P&D account with status %s.',
                $name,
                $person['accountStatus'],
            );
        }

        if ($this->containsAny($question, [
            'position',
            'job title',
            'designation',
        ])) {
            return sprintf(
                '%s is recorded as %s in %s.',
                $name,
                $person['position'],
                $person['department'],
            );
        }

        /*
         * Person was identified, but intent was not clear enough.
         * Do not guess.
         */
        return null;
    }

    private function answerCountQuestion(
        string $question,
        Collection $filtered,
        Collection $allUsers,
    ): array {
        $count = $filtered->count();
        $description = $this->describeFilters($question);

        if ($description === null) {
            $description = 'governed account';
        }

        return $this->result(
            sprintf(
                'There %s %d %s%s in the current User Management directory.',
                $count === 1 ? 'is' : 'are',
                $count,
                $description,
                $count === 1 ? '' : 's',
            ),
            'count',
            [
                'count' => $count,
                'directoryTotal' => $allUsers->count(),
                'scope' => $description,
            ],
        );
    }

    private function answerWhoQuestion(
        string $question,
        Collection $filtered,
        Collection $allUsers,
    ): array {
        $names = $filtered
            ->pluck('name')
            ->filter()
            ->values();

        $description = $this->describeFilters($question)
            ?? 'matching account';

        if ($names->isEmpty()) {
            return $this->result(
                sprintf(
                    'No %ss currently match that User Management query.',
                    $description,
                ),
                'list',
                [
                    'count' => 0,
                    'matches' => [],
                ],
            );
        }

        $visibleNames = $names->take(10);

        $answer = sprintf(
            '%d %s%s found: %s',
            $names->count(),
            $description,
            $names->count() === 1 ? '' : 's',
            $visibleNames->implode(', '),
        );

        if ($names->count() > 10) {
            $answer .= sprintf(
                ', and %d more.',
                $names->count() - 10,
            );
        } else {
            $answer .= '.';
        }

        return $this->result(
            $answer,
            'list',
            [
                'count' => $names->count(),
                'matches' => $names->all(),
                'directoryTotal' => $allUsers->count(),
            ],
        );
    }

    private function answerExistenceQuestion(
        string $question,
        Collection $filtered,
        Collection $allUsers,
    ): array {
        $count = $filtered->count();
        $description = $this->describeFilters($question)
            ?? 'matching account';

        return $this->result(
            $count > 0
                ? sprintf(
                    'Yes. %d %s%s currently match that User Management query.',
                    $count,
                    $description,
                    $count === 1 ? '' : 's',
                )
                : sprintf(
                    'No. There are currently no %ss matching that User Management query.',
                    $description,
                ),
            'existence',
            [
                'exists' => $count > 0,
                'count' => $count,
                'directoryTotal' => $allUsers->count(),
            ],
        );
    }

    private function applyFilters(
        string $question,
        Collection $users,
    ): Collection {
        $filtered = $users;

        /*
         * Person type.
         */
        if ($this->containsAny($question, [
            'trainee',
            'trainees',
        ])) {
            $filtered = $filtered->where(
                'personType',
                'Trainee',
            );
        } elseif ($this->containsAny($question, [
            'employee',
            'employees',
        ])) {
            $filtered = $filtered->where(
                'personType',
                'Employee',
            );
        }

        /*
         * Access roles.
         */
        if ($this->containsWord($question, 'admin')
            || $this->containsWord($question, 'admins')
            || str_contains($question, 'administrator')) {
            $filtered = $filtered->where('role', 'Admin');
        } elseif ($this->containsWord($question, 'hr')
            || str_contains($question, 'human resources role')) {
            $filtered = $filtered->where('role', 'HR');
        } elseif ($this->containsAny($question, [
            'privileged',
            'admin and hr',
            'admin or hr',
        ])) {
            $filtered = $filtered->filter(
                fn (array $user): bool =>
                    in_array(
                        $user['role'],
                        ['Admin', 'HR'],
                        true,
                    )
            );
        }

        /*
         * Account status.
         */
        if ($this->containsWord($question, 'suspended')) {
            $filtered = $filtered->where(
                'accountStatus',
                'Suspended',
            );
        } elseif ($this->containsWord($question, 'inactive')) {
            $filtered = $filtered->where(
                'accountStatus',
                'Inactive',
            );
        } elseif ($this->containsAny($question, [
            'pending activation',
            'invitation pending',
            'not activated',
            'not yet activated',
        ])) {
            $filtered = $filtered->where(
                'accountStatus',
                'Pending Activation',
            );
        } elseif ($this->containsWord($question, 'active')) {
            $filtered = $filtered->where(
                'accountStatus',
                'Active',
            );
        }

        /*
         * MFA.
         */
        if ($this->containsAny($question, [
            'without mfa',
            'no mfa',
            'walang mfa',
            'mfa not enrolled',
            'not enrolled in mfa',
        ])) {
            $filtered = $filtered->where(
                'mfaStatus',
                'Not Enrolled',
            );
        } elseif ($this->containsAny($question, [
            'mfa enabled',
            'with mfa',
            'may mfa',
        ])) {
            $filtered = $filtered->where(
                'mfaStatus',
                'Enabled',
            );
        }

        /*
         * Evaluator capability.
         */
        if ($this->containsAny($question, [
            'evaluator capable',
            'evaluator-capable',
            'can evaluate',
            'pwede mag evaluate',
            'evaluators',
        ])) {
            $filtered = $filtered->where(
                'evaluatorCapable',
                true,
            );
        }

        /*
         * Department.
         * Match only against actual department values in the directory.
         */
        $departments = $users
            ->pluck('department')
            ->filter()
            ->unique();

        foreach ($departments as $department) {
            if (
                str_contains(
                    $question,
                    $this->normalize((string) $department),
                )
            ) {
                $filtered = $filtered->where(
                    'department',
                    $department,
                );

                break;
            }
        }

        return $filtered->values();
    }

    private function resolvePerson(
        string $message,
        Collection $users,
    ): ?array {
        $normalizedMessage = $this->normalize($message);

        /*
         * Strong identifiers first.
         */
        foreach ($users as $user) {
            foreach ([
                $user['email'] ?? null,
                $user['employeeOrTraineeId'] ?? null,
                $user['personnelKey'] ?? null,
            ] as $identifier) {
                if (! is_string($identifier) || trim($identifier) === '') {
                    continue;
                }

                if (
                    str_contains(
                        $normalizedMessage,
                        $this->normalize($identifier),
                    )
                ) {
                    return $user;
                }
            }
        }

        /*
         * Exact full-name occurrence.
         */
        $nameMatches = $users
            ->filter(function (array $user) use ($normalizedMessage): bool {
                $name = $this->normalize(
                    (string) ($user['name'] ?? ''),
                );

                return $name !== ''
                    && str_contains($normalizedMessage, $name);
            })
            ->values();

        if ($nameMatches->count() === 1) {
            return $nameMatches->first();
        }

        /*
         * Unique first-name / surname match.
         * Never resolve an ambiguous name.
         */
        $messageTokens = collect(
            preg_split(
                '/\s+/u',
                $normalizedMessage,
                -1,
                PREG_SPLIT_NO_EMPTY,
            )
        );

        $candidateScores = [];

        foreach ($users as $index => $user) {
            $nameTokens = collect(
                preg_split(
                    '/\s+/u',
                    $this->normalize(
                        (string) ($user['name'] ?? ''),
                    ),
                    -1,
                    PREG_SPLIT_NO_EMPTY,
                )
            )->filter(
                fn (string $token): bool =>
                    mb_strlen($token) >= 3,
            );

            $score = $nameTokens
                ->intersect($messageTokens)
                ->count();

            if ($score > 0) {
                $candidateScores[$index] = $score;
            }
        }

        if ($candidateScores === []) {
            return null;
        }

        $maxScore = max($candidateScores);

        $bestIndexes = array_keys(
            $candidateScores,
            $maxScore,
            true,
        );

        if (count($bestIndexes) !== 1) {
            return null;
        }

        return $users
            ->values()
            ->get($bestIndexes[0]);
    }

    private function describeFilters(
        string $question,
    ): ?string {
        $parts = [];

        if ($this->containsWord($question, 'active')) {
            $parts[] = 'active';
        }

        if ($this->containsWord($question, 'suspended')) {
            $parts[] = 'suspended';
        }

        if ($this->containsWord($question, 'inactive')) {
            $parts[] = 'inactive';
        }

        if ($this->containsAny($question, [
            'pending activation',
            'invitation pending',
            'not activated',
        ])) {
            $parts[] = 'pending-activation';
        }

        if ($this->containsWord($question, 'employee')
            || $this->containsWord($question, 'employees')) {
            $parts[] = 'employee';
        }

        if ($this->containsWord($question, 'trainee')
            || $this->containsWord($question, 'trainees')) {
            $parts[] = 'trainee';
        }

        if ($this->containsWord($question, 'admin')
            || $this->containsWord($question, 'admins')) {
            $parts[] = 'Admin';
        }

        if ($this->containsWord($question, 'hr')) {
            $parts[] = 'HR';
        }

        if ($this->containsAny($question, [
            'without mfa',
            'no mfa',
            'walang mfa',
            'mfa not enrolled',
        ])) {
            $parts[] = 'account without MFA';
        }

        if ($this->containsAny($question, [
            'evaluator capable',
            'evaluator-capable',
            'can evaluate',
            'evaluators',
        ])) {
            $parts[] = 'evaluator-capable account';
        }

        return $parts === []
            ? null
            : implode(' ', $parts);
    }

    private function isCountQuestion(string $question): bool
    {
        return $this->containsAny($question, [
            'how many',
            'how much',
            'count',
            'ilan',
            'ilang',
            'gaano karami',
            'number of',
        ]);
    }

    private function isWhoQuestion(string $question): bool
    {
        return $this->containsAny($question, [
            'who',
            'sino',
            'sinu sino',
            'sino sino',
            'list',
            'show me',
            'ipakita',
            'which users',
            'which employees',
        ]);
    }

    private function isExistenceQuestion(string $question): bool
    {
        return $this->containsAny($question, [
            'are there',
            'is there',
            'mayroon bang',
            'meron bang',
            'may ',
            'do we have',
        ]);
    }

    private function isSummaryQuestion(string $question): bool
    {
        return $this->containsAny($question, [
            'user management summary',
            'users summary',
            'summarize user management',
            'summarize users',
            'overview of users',
            'user overview',
            'account overview',
            'how is user management',
            'kamusta user management',
        ]);
    }

    private function result(
        string $answer,
        string $intent,
        array $data = [],
    ): array {
        return [
            'handled' => true,
            'source' => 'system',
            'module' => 'Users',
            'intent' => $intent,
            'answer' => $answer,
            'data' => $data,
            'aiUsed' => false,
        ];
    }

    private function normalize(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9@._&\- ]+/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }

    private function containsAny(
        string $haystack,
        array $needles,
    ): bool {
        foreach ($needles as $needle) {
            if (
                str_contains(
                    $haystack,
                    $this->normalize($needle),
                )
            ) {
                return true;
            }
        }

        return false;
    }

    private function containsWord(
        string $haystack,
        string $word,
    ): bool {
        return preg_match(
            '/(?:^|\s)'
            .preg_quote(
                $this->normalize($word),
                '/',
            )
            .'(?:$|\s)/u',
            $haystack,
        ) === 1;
    }
}
