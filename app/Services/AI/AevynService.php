<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class AevynService
{
    public function chat(string $message, ?string $systemPrompt = null): string
    {
        $messages = [];

        if ($systemPrompt) {
            $messages[] = [
                'role' => 'system',
                'content' => $systemPrompt,
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $message,
        ];

        $response = Http::withToken(config('services.groq.key'))
            ->acceptJson()
            ->timeout(30)
            ->post(
                rtrim(config('services.groq.base_url'), '/') . '/chat/completions',
                [
                    'model' => config('services.groq.model'),
                    'messages' => $messages,
                    'temperature' => 0.2,
                ]
            );

        if ($response->failed()) {
            throw new RuntimeException(
                'Aevyn request failed with status ' . $response->status()
            );
        }

        $content = $response->json('choices.0.message.content');

        if (!is_string($content) || trim($content) === '') {
            throw new RuntimeException('Aevyn returned an empty response.');
        }

        return trim($content);
    }
}
