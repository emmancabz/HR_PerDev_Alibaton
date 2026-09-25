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
            'screenContext' => ['nullable', 'array'],
            'connectedContext' => ['nullable', 'array'],
        ]);

        $message = trim($validated['message']);
        $screenContext = $this->sanitizeContext($validated['screenContext'] ?? []);
        $connectedContext = $this->sanitizeContext($validated['connectedContext'] ?? []);
        $actor = $request->user();
        $role = $actor?->role;
        $roleValue = $role instanceof \BackedEnum ? $role->value : (string) $role;
        $persona = strtolower(trim((string) ($actor?->persona ?? '')));
        $learnerMode = $roleValue === 'user' && in_array($persona, [
            'trainee', 'employee', 'supervisor', 'manager',
        ], true);

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
            $system = $systemRouter->answer($message, ['learnerMode' => $learnerMode]);

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
            $viewerContext = [
                'viewer' => [
                    'id' => $actor?->id,
                    'name' => $actor?->name,
                    'role' => $roleValue,
                    'persona' => $actor?->persona,
                    'personnelKey' => $actor?->personnel_key,
                    'position' => $actor?->position,
                    'department' => $actor?->department,
                ],
                'currentScreen' => $screenContext,
                'connectedAuthorizedContext' => $connectedContext,
            ];

            $contextJson = json_encode(
                $viewerContext,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
            ) ?: '{}';

            $reply = $aevyn->chat(
                $message,
                <<<PROMPT
You are Aevyn, the AI Learning & Workforce Intelligence assistant for the Performance & Development system.

The authoritative system-intelligence layers were unable to fully answer this request.

Use the authenticated viewer context below as read-only context for this response:
{$contextJson}

Context rules:
- The user's explicit question has the highest priority.
- Use currentScreen to resolve words such as "this", "current", "here", "this course", "this module", or "this lesson".
- If the user clearly asks about another LMS feature, use connectedAuthorizedContext even when the current screen is different.
- connectedAuthorizedContext contains read-only data already returned to this authenticated viewer by authorized LMS endpoints. Never use it to infer access to records that are not present.
- Treat missing data as unavailable, never as zero or false.
- Never invent courses, progress, assessments, attendance, skill gaps, certificates, achievements, notifications, or completion records.
- Course completion does not automatically mean a certificate was issued.
- Completed learning may be supporting development/evaluation evidence, but it must not automatically change an official performance rating or competency level.
- Keep assessment wording generic unless the user explicitly names a specific configured assessment.

Governance rules:
- Do not claim that you approved, finalized, changed, enrolled, completed, issued, revoked, or modified any official record.
- Do not reveal answers to assessments or bypass workflow/unlock rules.
- If the requested live fact is not present in the supplied context, clearly say that it could not be verified from the available authorized records.
- You may explain, summarize, compare the viewer's own authorized records, and suggest reasonable next steps.
- Prefer concise, practical answers in the user's language.
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

    private function sanitizeContext(mixed $value, int $depth = 0): mixed
    {
        if ($depth > 6) {
            return null;
        }

        if (is_string($value)) {
            return mb_substr($value, 0, 4000);
        }

        if (is_int($value) || is_float($value) || is_bool($value) || $value === null) {
            return $value;
        }

        if (! is_array($value)) {
            return null;
        }

        $result = [];
        $count = 0;

        foreach ($value as $key => $item) {
            if ($count >= 60) {
                break;
            }

            $safeKey = is_string($key)
                ? mb_substr($key, 0, 120)
                : $key;

            $result[$safeKey] = $this->sanitizeContext($item, $depth + 1);
            $count++;
        }

        return $result;
    }

}
