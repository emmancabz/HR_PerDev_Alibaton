<?php

namespace App\Services\AI\System;

class AevynSystemRouter
{
    public function __construct(
        private readonly AevynConversationHandler $conversation,
        private readonly UsersAevynRouter $users,
    ) {}

    /**
     * Try authoritative system intelligence before full AI.
     *
     * More module routers will be registered here later:
     * - Competency
     * - Learning
     * - Training
     * - Performance
     * - Recognition
     * - Succession
     */
    public function answer(string $message, array $context = []): array
    {
        /*
         * Layer 0:
         * Simple conversational messages should never consume AI.
         */
        $conversationResult =
            $this->conversation->handle($message);

        if ($conversationResult !== null) {
            return $conversationResult;
        }

        /*
         * Learner/employee portal questions use the authenticated screen and
         * connected LMS context in the controller's AI fallback. Do not route
         * them through the Admin/HR User Management intelligence domain.
         */
        if (($context['learnerMode'] ?? false) === true) {
            return [
                'handled' => false,
                'route' => 'full_ai',
                'systemAttempted' => true,
                'source' => 'learner_context',
                'module' => null,
                'intent' => null,
                'authoritative' => false,
                'aiUsed' => false,
                'pipeline' => [
                    'conversationHandler' => true,
                    'usersRouter' => false,
                    'fullAiFallback' => true,
                ],
            ];
        }

        /*
         * Users / User Management is our first implemented
         * authoritative system-intelligence domain.
         */
        $usersResult = $this->users->answer($message);

        if (($usersResult['handled'] ?? false) === true) {
            return $usersResult;
        }

        /*
         * If Users already consumed AI for interpretation but still
         * cannot safely answer, allow the global controller to use
         * full AI reasoning as the final fallback.
         */
        return [
            ...$usersResult,

            'handled' => false,
            'route' => 'full_ai',

            'systemAttempted' => true,
        ];
    }
}
