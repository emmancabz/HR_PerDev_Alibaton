<?php

namespace App\Http\Controllers;

use App\Services\Competency\{CompetencyService, CompetencyViolation};
use App\Support\ReadModelCache;
use Illuminate\Http\{JsonResponse, Request};
use Inertia\Inertia;
use Inertia\Response;

class CompetencyController extends Controller
{
    public function __construct(private readonly CompetencyService $competency) {}

    public function page(): Response
    {
        return Inertia::render('AdminCompetency');
    }

    public function wallet(): Response
    {
        return Inertia::render('UserSkillsWallet');
    }

    public function show(Request $request): JsonResponse
    {
        $payload = ReadModelCache::rememberRequest(
            'competency',
            $request->user(),
            $request,
            fn (): array => $this->competency->payload($request->user()),
        );

        return response()->json($payload);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:0'],
            'changes' => ['required', 'array', 'min:1', 'max:200'],
            'changes.*.collection' => ['required', 'string', 'in:competencies,roleProfiles,cycles,assessorAuthorizations,assessments,recommendations,acknowledgmentEvents'],
            'changes.*.record' => ['required', 'array'],
            'changes.*.record.id' => ['required', 'string', 'max:160'],
        ]);
        $data['changes'] = $request->input('changes');

        try {
            return response()->json($this->competency->mutate($request->user(), $data['revision'], $data['changes']));
        } catch (CompetencyViolation $error) {
            return response()->json(['message' => $error->getMessage()], $error->status);
        }
    }
}
