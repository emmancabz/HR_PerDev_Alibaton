<?php

namespace App\Http\Controllers;

use App\Services\Competency\{CompetencyService, CompetencyViolation};
use Illuminate\Http\{JsonResponse, Request};
use Inertia\Inertia;
use Inertia\Response;

class CompetencyController extends Controller
{
    public function __construct(private readonly CompetencyService $competency) {}
    public function page(Request $request): Response
    {
        $payload = $this->competency->payload($request->user());
        return Inertia::render('AdminCompetency',['competency'=>$payload,'canonicalPersonnel'=>$payload['personnel']]);
    }
    public function wallet(Request $request): Response
    {
        $payload = $this->competency->payload($request->user());
        return Inertia::render('UserSkillsWallet',['competency'=>$payload,'canonicalPersonnel'=>$payload['personnel']]);
    }
    public function show(Request $request): JsonResponse { return response()->json($this->competency->payload($request->user())); }
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['revision'=>['required','integer','min:0'],'changes'=>['required','array','min:1','max:200'],'changes.*.collection'=>['required','string','in:competencies,roleProfiles,cycles,assessorAuthorizations,assessments,recommendations,acknowledgmentEvents'],'changes.*.record'=>['required','array'],'changes.*.record.id'=>['required','string','max:160']]);
        // Laravel's validated nested-array output keeps only the explicitly listed
        // envelope keys. The domain validates and whitelists each complete record.
        $data['changes'] = $request->input('changes');
        try { return response()->json($this->competency->mutate($request->user(),$data['revision'],$data['changes'])); }
        catch (CompetencyViolation $error) { return response()->json(['message'=>$error->getMessage()],$error->status); }
    }
}
