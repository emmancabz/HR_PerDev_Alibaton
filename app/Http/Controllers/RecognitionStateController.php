<?php

namespace App\Http\Controllers;

use App\Http\Requests\RecognitionRecordRequest;
use App\Models\Recognition\RecognitionCategory;
use App\Models\Recognition\RecognitionRecord;
use App\Services\Recognition\RecognitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecognitionStateController extends Controller
{
    public function __construct(private readonly RecognitionService $recognition) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->recognition->state($request->user())]);
    }

    public function create(RecognitionRecordRequest $request): JsonResponse
    {
        $record = $this->recognition->create($request->user(), $request->validated());
        return response()->json(['data' => ['recordId' => $record->id]], 201);
    }

    public function update(RecognitionRecordRequest $request, RecognitionRecord $record): JsonResponse
    {
        $this->recognition->updateDraft($request->user(), $record, $request->validated());
        return $this->show($request);
    }

    public function submit(Request $request, RecognitionRecord $record): JsonResponse
    {
        $this->recognition->submit($request->user(), $record);
        return $this->show($request);
    }

    public function decision(Request $request, RecognitionRecord $record): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', 'in:Recognized,Declined'], 'reason' => ['nullable', 'string', 'max:5000']]);
        $this->recognition->decide($request->user(), $record, $data['decision'], $data['reason'] ?? null);
        return $this->show($request);
    }

    public function revoke(Request $request, RecognitionRecord $record): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:5000']]);
        $this->recognition->revoke($request->user(), $record, $data['reason']);
        return $this->show($request);
    }

    public function createCategory(Request $request): JsonResponse
    {
        $category = $this->recognition->saveCategory($request->user(), $this->categoryData($request));
        return response()->json(['data' => ['categoryId' => $category->id]], 201);
    }

    public function updateCategory(Request $request, RecognitionCategory $category): JsonResponse
    {
        $this->recognition->saveCategory($request->user(), $this->categoryData($request, $category));
        return $this->show($request);
    }

    private function categoryData(Request $request, ?RecognitionCategory $category = null): array
    {
        $id = $category?->id;
        return $request->validate([
            'code' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9_]+$/', 'unique:recognition_categories,code,'.($id ?? 'NULL').',id'],
            'name' => ['required', 'string', 'max:150', 'unique:recognition_categories,name,'.($id ?? 'NULL').',id'],
            'description' => ['nullable', 'string', 'max:5000'],
            'color' => ['required', 'in:amber,blue,purple,cyan,green,rose,slate'],
            'icon' => ['required', 'in:trophy,users,award,lightbulb,sparkles,shield'],
            'isActive' => ['required', 'boolean'], 'displayOrder' => ['required', 'integer', 'min:0', 'max:999'],
        ]);
    }
}
