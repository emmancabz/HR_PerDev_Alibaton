<?php

namespace App\Services\AI\System;

class UsersAevynRouter
{
    public function __construct(
        private readonly UsersQueryExecutor $executor,
        private readonly UsersAiIntentInterpreter $interpreter,
    ) {}

    public function answer(string $message): array
    {
        /*
         * Layer 1:
         * Try deterministic understanding first.
         *
         * Groq usage: ZERO.
         */
        $local = $this->executor->execute($message);

        if (($local['handled'] ?? false) === true) {
            return [
                ...$local,
                'pipeline' => [
                    'normalizer' => true,
                    'entityResolver' => true,
                    'localIntentMatcher' => true,
                    'aiInterpreter' => false,
                    'systemQuery' => true,
                ],
            ];
        }

        /*
         * If the local engine intentionally routed somewhere other
         * than the AI interpreter, preserve that decision.
         */
        if (
            ($local['route'] ?? null)
            !== 'ai_interpreter'
        ) {
            return $local;
        }

        /*
         * Layer 2:
         * AI understands the language ONLY.
         */
        $interpretation =
            $this->interpreter->interpret($message);

        if (
            ($interpretation['interpreted'] ?? false)
            !== true
        ) {
            return [
                'handled' => false,
                'route' => 'full_ai',

                'source' => 'system',
                'module' => 'Users',

                'answer' => null,

                'aiUsed' => true,
                'aiPurpose' =>
                    'intent_interpretation',

                'reason' =>
                    $interpretation['reason']
                    ?? 'intent_interpretation_failed',

                'pipeline' => [
                    'normalizer' => true,
                    'entityResolver' => true,
                    'localIntentMatcher' => true,
                    'aiInterpreter' => true,
                    'systemQuery' => false,
                ],
            ];
        }

        /*
         * Layer 3:
         * Laravel executes the validated interpretation
         * against authoritative User Management data.
         */
        $result =
            $this->executor->executeInterpreted(
                $interpretation
            );

        $result['pipeline'] = [
            'normalizer' => true,
            'entityResolver' => true,
            'localIntentMatcher' => true,
            'aiInterpreter' => true,
            'systemQuery' =>
                ($result['handled'] ?? false)
                === true,
        ];

        return $result;
    }
}
