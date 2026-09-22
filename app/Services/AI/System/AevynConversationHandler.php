<?php

namespace App\Services\AI\System;

use Illuminate\Support\Str;

class AevynConversationHandler
{
    public function handle(string $message): ?array
    {
        $normalized = $this->normalize($message);

        if ($normalized === '') {
            return null;
        }

        /*
         * Keep this layer intentionally conservative.
         *
         * It only handles short, obvious conversational messages.
         * Anything that could contain a real workforce/system request
         * continues to the normal Aevyn intelligence pipeline.
         */
        if (str_word_count($normalized) > 5) {
            return null;
        }

        if ($this->matches($normalized, [
            'ok',
            'okay',
            'oki',
            'okie',
            'sige',
            'ge',
            'noted',
            'got it',
            'gets',
            'understood',
            'copy',
            'copy that',
            'alright',
            'all right',
            'sure',
            'sounds good',
            'fine',
        ])) {
            return $this->response(
                'Got it. Ask me anything about the Performance & Development system whenever you need me.',
                'acknowledgement',
            );
        }

        if ($this->matches($normalized, [
            'thanks',
            'thank you',
            'thankyou',
            'ty',
            'thx',
            'salamat',
            'salamat po',
            'maraming salamat',
            'thanks a lot',
            'thank you so much',
        ])) {
            return $this->response(
                "You're welcome. I'm here if you need anything else.",
                'gratitude',
            );
        }

        if ($this->matches($normalized, [
            'hi',
            'hello',
            'hey',
            'yo',
            'hii',
            'helloo',
            'good morning',
            'good afternoon',
            'good evening',
            'kamusta',
            'kumusta',
        ])) {
            return $this->response(
                'Hi! What would you like to check in the Performance & Development system?',
                'greeting',
            );
        }

        if ($this->matches($normalized, [
            'none',
            'nothing',
            'nothing else',
            'wala',
            'wala lang',
            'wala muna',
            'not now',
            'maybe later',
            'later na',
            'mamaya na',
            'nope',
        ])) {
            return $this->response(
                "No problem. I'll be here whenever you need me.",
                'dismissal',
            );
        }

        if ($this->matches($normalized, [
            'bye',
            'goodbye',
            'see you',
            'see ya',
            'later',
            'good night',
            'goodnight',
        ])) {
            return $this->response(
                'Got it. See you next time.',
                'goodbye',
            );
        }

        /*
         * Common combined conversational messages.
         */
        if ($this->matches($normalized, [
            'ok thanks',
            'okay thanks',
            'ok thank you',
            'okay thank you',
            'sige thanks',
            'sige salamat',
            'got it thanks',
            'got it thank you',
        ])) {
            return $this->response(
                "You're welcome. I'm here whenever you need me.",
                'acknowledgement_gratitude',
            );
        }

        return null;
    }

    private function response(
        string $answer,
        string $intent,
    ): array {
        return [
            'handled' => true,
            'route' => 'local_conversation',

            'source' => 'system',
            'module' => null,
            'intent' => $intent,

            'answer' => $answer,

            'aiUsed' => false,
            'aiPurpose' => null,
            'authoritative' => false,

            'understandingConfidence' => 1.0,

            'pipeline' => [
                'conversationHandler' => true,
                'systemQuery' => false,
                'aiInterpreter' => false,
                'fullAiFallback' => false,
            ],
        ];
    }

    private function matches(
        string $message,
        array $phrases,
    ): bool {
        return in_array(
            $message,
            $phrases,
            true,
        );
    }

    private function normalize(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->ascii()
            ->replaceMatches(
                '/[^a-z0-9 ]+/',
                ' ',
            )
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }
}
