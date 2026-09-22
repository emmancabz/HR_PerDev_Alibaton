<?php

namespace App\Services\AI\System;

use Illuminate\Support\Str;

class AevynIntentMatcher
{
    /**
     * Interpret a resolved Users request without an LLM.
     *
     * This layer does not query data.
     * It only decides WHAT the user is asking for and how
     * confident Aevyn is that it understood correctly.
     */
    public function matchUsers(array $resolution): array
    {
        $normalization = $resolution['normalization'] ?? [];

        $text = trim(
            (string) (
                $normalization['corrected']
                ?? $normalization['normalized']
                ?? ''
            )
        );

        $entities = $resolution['entities'] ?? [];

        if ($text === '') {
            return $this->unknown(
                0.0,
                'empty_request',
            );
        }

        if (($resolution['needsClarification'] ?? false) === true) {
            return [
                'intent' => 'clarification',
                'requestedField' => null,
                'intentConfidence' => 1.0,
                'understandingConfidence' => 1.0,
                'route' => 'clarify',
                'reason' => 'ambiguous_entity',
                'recognizedCoverage' => 1.0,
            ];
        }

        /*
         * Person-specific detail queries have priority.
         */
        if (! empty($entities['person'])) {
            $field = $this->requestedPersonField($text);

            if ($field !== null) {
                return $this->result(
                    intent: 'person_detail',
                    requestedField: $field,
                    intentConfidence: 0.99,
                    text: $text,
                    resolution: $resolution,
                );
            }

            if ($this->containsAny($text, [
                'account',
                'profile',
                'details',
                'information',
                'info',
                'tell me about',
                'who is',
                'sino si',
            ])) {
                return $this->result(
                    intent: 'person_summary',
                    requestedField: null,
                    intentConfidence: 0.94,
                    text: $text,
                    resolution: $resolution,
                );
            }
        }

        /*
         * Explicit deterministic intents.
         */
        if ($this->hasWord($text, 'count')) {
            return $this->result(
                intent: 'count',
                requestedField: null,
                intentConfidence: 0.99,
                text: $text,
                resolution: $resolution,
            );
        }

        if ($this->hasWord($text, 'exists')) {
            return $this->result(
                intent: 'existence',
                requestedField: null,
                intentConfidence: 0.99,
                text: $text,
                resolution: $resolution,
            );
        }

        if ($this->containsAny($text, [
            'who',
            'sino',
            'show me',
            'show',
            'list',
            'ipakita',
            'which user',
            'which employee',
            'which personnel',
        ])) {
            return $this->result(
                intent: 'list',
                requestedField: null,
                intentConfidence: 0.96,
                text: $text,
                resolution: $resolution,
            );
        }

        if ($this->containsAny($text, [
            'summary',
            'overview',
            'summarize',
            'kamusta user',
            'kamusta users',
            'kamusta user management',
            'user management status',
            'account overview',
        ])) {
            return $this->result(
                intent: 'summary',
                requestedField: null,
                intentConfidence: 0.96,
                text: $text,
                resolution: $resolution,
            );
        }

        /*
         * Natural Taglish existence questions that did not pass
         * through phrase normalization.
         */
        if ($this->containsAny($text, [
            'may ',
            'meron ',
            'may ba',
            'meron ba',
            'mayroon ',
        ])) {
            return $this->result(
                intent: 'existence',
                requestedField: null,
                intentConfidence: 0.89,
                text: $text,
                resolution: $resolution,
            );
        }

        /*
         * We detected useful entities, but not enough language
         * to safely determine what operation was requested.
         */
        $entityCount = collect($entities)
            ->filter(
                fn ($value): bool =>
                    $value !== null
                    && $value !== false
            )
            ->count();

        if ($entityCount > 0) {
            return $this->result(
                intent: 'unknown',
                requestedField: null,
                intentConfidence: 0.35,
                text: $text,
                resolution: $resolution,
                forceAiInterpreter: true,
                reason: 'entities_found_but_intent_unclear',
            );
        }

        return $this->unknown(
            $this->languageCoverage(
                $text,
                $resolution,
            ),
            'insufficient_local_understanding',
        );
    }

    private function requestedPersonField(
        string $text,
    ): ?string {
        if ($this->containsAny($text, [
            'manager',
            'supervisor',
            'reports to',
            'report to',
            'kanino naka report',
            'kanino nag rereport',
        ])) {
            return 'directManager';
        }

        if ($this->containsAny($text, [
            'department',
            'dept',
        ])) {
            return 'department';
        }

        if ($this->containsAny($text, [
            'position',
            'job title',
            'designation',
        ])) {
            return 'position';
        }

        if ($this->containsAny($text, [
            'role',
            'access role',
        ])) {
            return 'role';
        }

        if ($this->containsAny($text, [
            'mfa',
            'multi factor',
            'multi-factor',
        ])) {
            return 'mfaStatus';
        }

        if ($this->containsAny($text, [
            'evaluator',
            'can evaluate',
            'pwede mag evaluate',
        ])) {
            return 'evaluatorCapable';
        }

        if ($this->containsAny($text, [
            'activation',
            'invitation',
        ])) {
            return 'activationStatus';
        }

        if ($this->containsAny($text, [
            'status',
            'active',
            'inactive',
            'suspended',
            'account',
        ])) {
            return 'accountStatus';
        }

        return null;
    }

    private function result(
        string $intent,
        ?string $requestedField,
        float $intentConfidence,
        string $text,
        array $resolution,
        bool $forceAiInterpreter = false,
        ?string $reason = null,
    ): array {
        $coverage = $this->languageCoverage(
            $text,
            $resolution,
        );

        $correctionConfidence = (float) (
            $resolution['normalization']['correctionConfidence']
            ?? 1.0
        );

        /*
         * Understanding confidence is intentionally NOT the same
         * as typo confidence.
         *
         * A foreign-language sentence may have one correctly
         * recognized entity but still have poor overall coverage.
         */
        $understanding = round(
            (
                ($intentConfidence * 0.55)
                + ($coverage * 0.30)
                + ($correctionConfidence * 0.15)
            ),
            3,
        );

        $route = match (true) {
            $forceAiInterpreter => 'ai_interpreter',

            $understanding >= 0.78
                && $intent !== 'unknown'
                => 'local',

            $understanding >= 0.50
                => 'ai_interpreter',

            default
                => 'ai_interpreter',
        };

        return [
            'intent' => $intent,
            'requestedField' => $requestedField,

            'intentConfidence' => round(
                $intentConfidence,
                3,
            ),

            'understandingConfidence' =>
                $understanding,

            'recognizedCoverage' =>
                round($coverage, 3),

            'route' => $route,

            'reason' => $reason,
        ];
    }

    private function languageCoverage(
        string $text,
        array $resolution,
    ): float {
        $tokens = preg_split(
            '/\s+/u',
            $text,
            -1,
            PREG_SPLIT_NO_EMPTY,
        ) ?: [];

        if ($tokens === []) {
            return 0.0;
        }

        $ignored = [
            'a',
            'an',
            'the',
            'is',
            'are',
            'of',
            'to',
            'in',
            'on',
            'for',
            'from',
            'with',
            'without',
            'have',
            'has',
            'do',
            'does',
            'dont',
            'not',

            'ang',
            'ng',
            'mga',
            'sa',
            'si',
            'ni',
            'ba',
            'ako',
            'natin',
            'naten',
            'yung',
            'yong',
            'na',
            'ano',
            'anong',
            'tao',
        ];

        $recognized = [
            'count',
            'who',
            'exists',
            'show',
            'list',
            'summary',
            'overview',

            'user',
            'people',
            'personnel',
            'staff',
            'employee',
            'trainee',

            'admin',
            'hr',

            'account',
            'status',
            'active',
            'inactive',
            'suspended',
            'pending',
            'activation',

            'mfa',
            'evaluator',
            'manager',
            'supervisor',

            'department',
            'position',
            'role',

            'operations',
            'administration',
            'information',
            'technology',
            'logistics',
            'crane',
            'finance',
            'safety',
            'compliance',
            'contracts',
            'human',
            'resources',

            'sino',
            'may',
            'meron',
            'mayroon',
            'ipakita',
            'kamusta',
        ];

        /*
         * Actual resolved personnel/entity data gives us additional
         * evidence that the request was understood.
         */
        $entityTokens = [];

        foreach ([
            $resolution['entities']['department'] ?? null,
            $resolution['entities']['role'] ?? null,
            $resolution['entities']['personType'] ?? null,
            $resolution['entities']['accountStatus'] ?? null,
            $resolution['entities']['mfaStatus'] ?? null,
            $resolution['entities']['person']['name'] ?? null,
        ] as $entityValue) {
            if (! is_string($entityValue)) {
                continue;
            }

            foreach (
                preg_split(
                    '/\s+/u',
                    $this->normalize($entityValue),
                    -1,
                    PREG_SPLIT_NO_EMPTY,
                ) ?: []
                as $token
            ) {
                $entityTokens[] = $token;
            }
        }

        $recognized = array_unique([
            ...$recognized,
            ...$entityTokens,
        ]);

        $meaningful = array_values(
            array_filter(
                $tokens,
                fn (string $token): bool =>
                    ! in_array(
                        $token,
                        $ignored,
                        true,
                    )
            )
        );

        if ($meaningful === []) {
            return 0.5;
        }

        $recognizedCount = 0;

        foreach ($meaningful as $token) {
            if (in_array($token, $recognized, true)) {
                $recognizedCount++;
            }
        }

        return $recognizedCount
            / count($meaningful);
    }

    private function unknown(
        float $coverage,
        string $reason,
    ): array {
        return [
            'intent' => 'unknown',
            'requestedField' => null,
            'intentConfidence' => 0.0,
            'understandingConfidence' =>
                round(min(0.49, $coverage), 3),
            'recognizedCoverage' =>
                round($coverage, 3),
            'route' => 'ai_interpreter',
            'reason' => $reason,
        ];
    }

    private function containsAny(
        string $text,
        array $phrases,
    ): bool {
        foreach ($phrases as $phrase) {
            if (
                str_contains(
                    $text,
                    $this->normalize($phrase),
                )
            ) {
                return true;
            }
        }

        return false;
    }

    private function hasWord(
        string $text,
        string $word,
    ): bool {
        return preg_match(
            '/(?:^|\s)'
            .preg_quote(
                $this->normalize($word),
                '/',
            )
            .'(?:$|\s)/u',
            $text,
        ) === 1;
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
}
