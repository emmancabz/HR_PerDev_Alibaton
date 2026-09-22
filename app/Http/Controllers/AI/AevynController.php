<?php

namespace App\Http\Controllers\AI;

use App\Http\Controllers\Controller;
use App\Services\AI\AevynService;
use App\Services\AI\System\AevynSystemRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class AevynController extends Controller
{
    public function chat(
        Request $request,
        AevynSystemRouter $systemRouter,
        AevynService $aevyn,
    ): JsonResponse {
        $validated = $request->validate([
            'message' => [
                'required',
                'string',
                'max:4000',
            ],
        ]);

        $message = trim($validated['message']);

        try {
            /*
             * =====================================================
             * LAYERS 0–3:
             * System intelligence first.
             * =====================================================
             *
             * This may:
             * - answer fully locally with ZERO AI;
             * - use AI only to interpret difficult language,
             *   then query authoritative system data;
             * - or return handled=false for full AI fallback.
             */
            $system = $systemRouter->answer($message);

            if (($system['handled'] ?? false) === true) {
                return response()->json([
                    'reply' => $system['answer'],

                    'meta' => [
                        'source' =>
                            $system['source']
                            ?? 'system',

                        'module' =>
                            $system['module']
                            ?? null,

                        'intent' =>
                            $system['intent']
                            ?? null,

                        'route' =>
                            $system['route']
                            ?? 'local',

                        'authoritative' =>
                            (bool) (
                                $system['authoritative']
                                ?? true
                            ),

                        'aiUsed' =>
                            (bool) (
                                $system['aiUsed']
                                ?? false
                            ),

                        'aiPurpose' =>
                            $system['aiPurpose']
                            ?? null,

                        'responseLanguage' =>
                            $system['responseLanguage']
                            ?? null,

                        'confidence' =>
                            $system[
                                'understandingConfidence'
                            ]
                            ?? null,

                        'pipeline' =>
                            $system['pipeline']
                            ?? null,
                    ],
                ]);
            }

            /*
             * =====================================================
             * FINAL LAYER:
             * Full generative AI fallback.
             * =====================================================
             *
             * This should happen only when the deterministic/system
             * intelligence layers could not safely answer.
             */
            $reply = $aevyn->chat(
                $message,
                <<<'PROMPT'
You are Aevyn, the AI Workforce Intelligence assistant for the Performance & Development system.

The authoritative system-intelligence layers were unable to fully answer this request.

Help the user accurately and concisely.

Important governance rules:
- Do not claim that you approved, finalized, changed, or modified official employee records.
- Do not invent current employee counts, statuses, assignments, review states, account states, competency results, training records, or other live system facts when they were not provided to you.
- If the answer requires live system data that is unavailable in your context, clearly say that the specific live data could not be verified.
- You may explain concepts, workflows, definitions, recommendations, and reasoning.
- Prefer concise, professional responses.
PROMPT
            );

            return response()->json([
                'reply' => $reply,

                'meta' => [
                    'source' => 'ai',
                    'module' => null,
                    'intent' => null,
                    'route' => 'full_ai',
                    'authoritative' => false,
                    'aiUsed' => true,
                    'aiPurpose' => 'full_reasoning',
                    'responseLanguage' => null,
                    'confidence' => null,

                    'pipeline' => [
                        'systemRouter' => true,
                        'fullAiFallback' => true,
                    ],
                ],
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' =>
                    'Aevyn is temporarily unavailable.',
            ], 503);
        }
    }
}
