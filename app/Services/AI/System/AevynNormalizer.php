<?php

namespace App\Services\AI\System;

use Illuminate\Support\Str;

class AevynNormalizer
{
    /**
     * These aliases are safe, generic language shortcuts.
     * Module-specific aliases such as department names will be
     * supplied by the module/entity resolver later.
     */
    private const PHRASE_ALIASES = [
        'how many' => 'count',
        'number of' => 'count',
        'gaano karami' => 'count',
        'ilan ang' => 'count',
        'ilang' => 'count',
        'ilan' => 'count',

        'who are' => 'who',
        'who is' => 'who',
        'sino ang' => 'who',
        'sino sino' => 'who',
        'sinu sino' => 'who',

        'are there' => 'exists',
        'is there' => 'exists',
        'meron bang' => 'exists',
        'mayroon bang' => 'exists',
    ];

    private const TOKEN_ALIASES = [
        'ppl' => 'people',
        'personnels' => 'personnel',
        'staffs' => 'staff',

        'empleyado' => 'employee',
        'empleyados' => 'employee',
        'empleyada' => 'employee',
        'empleyadas' => 'employee',
        'empleydo' => 'employee',
        'empleido' => 'employee',

        'usr' => 'user',
        'users' => 'user',

        'trainees' => 'trainee',
        'employees' => 'employee',
        'admins' => 'admin',

        'eval' => 'evaluator',
        'evaluators' => 'evaluator',

        'acct' => 'account',
        'accts' => 'account',
        'accounts' => 'account',

        'dept' => 'department',
        'depts' => 'department',

        'ops' => 'operations',

        'w/o' => 'without',
        'wout' => 'without',
    ];

    /**
     * Normalize a natural-language request.
     *
     * @param  array<int, string>  $vocabulary
     * @param  array<string, string>  $aliases
     */
    public function normalize(
        string $message,
        array $vocabulary = [],
        array $aliases = [],
    ): array {
        $original = trim($message);

        if ($original === '') {
            return [
                'original' => '',
                'normalized' => '',
                'corrected' => '',
                'tokens' => [],
                'corrections' => [],
                'correctionConfidence' => 1.0,
            ];
        }

        $normalized = Str::of($original)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9@._&\/\- ]+/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        /*
         * Normalize common multi-word expressions first.
         */
        foreach (self::PHRASE_ALIASES as $from => $to) {
            $normalized = $this->replacePhrase(
                $normalized,
                $from,
                $to,
            );
        }

        foreach ($aliases as $from => $to) {
            if (str_contains($from, ' ')) {
                $normalized = $this->replacePhrase(
                    $normalized,
                    $this->baseNormalize($from),
                    $this->baseNormalize($to),
                );
            }
        }

        $tokens = preg_split(
            '/\s+/u',
            $normalized,
            -1,
            PREG_SPLIT_NO_EMPTY,
        ) ?: [];

        $canonicalVocabulary = $this->buildVocabulary(
            $vocabulary,
            $aliases,
        );

        $corrections = [];
        $correctedTokens = [];

        foreach ($tokens as $token) {
            $originalToken = $token;

            /*
             * Exact generic aliases.
             */
            if (isset(self::TOKEN_ALIASES[$token])) {
                $token = self::TOKEN_ALIASES[$token];

                $corrections[] = [
                    'from' => $originalToken,
                    'to' => $token,
                    'type' => 'alias',
                    'confidence' => 1.0,
                ];
            }

            /*
             * Exact module-provided aliases.
             */
            if (isset($aliases[$token])) {
                $replacement = $this->baseNormalize(
                    (string) $aliases[$token],
                );

                $corrections[] = [
                    'from' => $token,
                    'to' => $replacement,
                    'type' => 'module_alias',
                    'confidence' => 1.0,
                ];

                /*
                 * Replacement may contain multiple words.
                 */
                foreach (
                    preg_split(
                        '/\s+/u',
                        $replacement,
                        -1,
                        PREG_SPLIT_NO_EMPTY,
                    ) ?: []
                    as $replacementToken
                ) {
                    $correctedTokens[] = $replacementToken;
                }

                continue;
            }

            /*
             * Never fuzzy-correct identifiers, email addresses,
             * numbers, or very short tokens.
             */
            if (
                str_contains($token, '@')
                || preg_match('/\d/u', $token)
                || mb_strlen($token) < 4
                || isset($canonicalVocabulary[$token])
            ) {
                $correctedTokens[] = $token;

                continue;
            }

            $match = $this->fuzzyMatch(
                $token,
                array_keys($canonicalVocabulary),
            );

            if ($match !== null) {
                $corrections[] = [
                    'from' => $token,
                    'to' => $match['value'],
                    'type' => 'typo',
                    'confidence' => $match['confidence'],
                ];

                $token = $match['value'];
            }

            $correctedTokens[] = $token;
        }

        $corrected = implode(' ', $correctedTokens);

        $confidence = collect($corrections)
            ->pluck('confidence')
            ->map(fn ($value): float => (float) $value)
            ->min();

        return [
            'original' => $original,
            'normalized' => $normalized,
            'corrected' => $corrected,
            'tokens' => $correctedTokens,
            'corrections' => $corrections,
            'correctionConfidence' => $confidence ?? 1.0,
        ];
    }

    /**
     * @param  array<int, string>  $vocabulary
     * @param  array<string, string>  $aliases
     * @return array<string, true>
     */
    private function buildVocabulary(
        array $vocabulary,
        array $aliases,
    ): array {
        $words = [
            'count',
            'who',
            'exists',
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
        ];

        foreach ($vocabulary as $value) {
            foreach (
                preg_split(
                    '/\s+/u',
                    $this->baseNormalize($value),
                    -1,
                    PREG_SPLIT_NO_EMPTY,
                ) ?: []
                as $word
            ) {
                $words[] = $word;
            }
        }

        foreach ($aliases as $value) {
            foreach (
                preg_split(
                    '/\s+/u',
                    $this->baseNormalize((string) $value),
                    -1,
                    PREG_SPLIT_NO_EMPTY,
                ) ?: []
                as $word
            ) {
                $words[] = $word;
            }
        }

        return array_fill_keys(
            array_values(array_unique($words)),
            true,
        );
    }

    /**
     * Return a fuzzy correction only when there is one
     * sufficiently strong, unambiguous candidate.
     *
     * @param  array<int, string>  $vocabulary
     */
    private function fuzzyMatch(
        string $token,
        array $vocabulary,
    ): ?array {
        $candidates = [];

        foreach ($vocabulary as $candidate) {
            if ($candidate === $token) {
                continue;
            }

            /*
             * Avoid absurd comparisons.
             */
            if (
                abs(
                    mb_strlen($candidate)
                    - mb_strlen($token)
                ) > 3
            ) {
                continue;
            }

            $distance = levenshtein(
                $token,
                $candidate,
            );

            $maxLength = max(
                strlen($token),
                strlen($candidate),
            );

            if ($maxLength === 0) {
                continue;
            }

            $similarity = 1 - ($distance / $maxLength);

            $requiredSimilarity = match (true) {
                $maxLength <= 4 => 0.75,
                $maxLength <= 7 => 0.70,
                default => 0.72,
            };

            if ($similarity < $requiredSimilarity) {
                continue;
            }

            $candidates[] = [
                'value' => $candidate,
                'distance' => $distance,
                'confidence' => round($similarity, 3),
            ];
        }

        if ($candidates === []) {
            return null;
        }

        usort(
            $candidates,
            fn (array $a, array $b): int =>
                [$a['distance'], -$a['confidence']]
                <=>
                [$b['distance'], -$b['confidence']],
        );

        $best = $candidates[0];

        /*
         * If two different candidates are equally plausible,
         * do not guess.
         */
        if (
            isset($candidates[1])
            && $candidates[1]['distance'] === $best['distance']
            && abs(
                $candidates[1]['confidence']
                - $best['confidence']
            ) < 0.02
        ) {
            return null;
        }

        return $best;
    }

    private function replacePhrase(
        string $text,
        string $from,
        string $to,
    ): string {
        return preg_replace(
            '/(?<![a-z0-9])'
            .preg_quote($from, '/')
            .'(?![a-z0-9])/u',
            $to,
            $text,
        ) ?? $text;
    }

    private function baseNormalize(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9@._&\/\- ]+/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }
}
