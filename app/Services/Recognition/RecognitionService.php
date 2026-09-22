<?php

namespace App\Services\Recognition;

use App\Enums\UserRole;
use App\Models\Recognition\RecognitionCategory;
use App\Models\Recognition\RecognitionRecord;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecognitionService
{
    public function __construct(private readonly RecognitionAuditService $audit) {}

    public function state(User $actor): array
    {
        $operator = $this->isOperator($actor);
        $records = RecognitionRecord::query()
            ->with(['category', 'evidence', 'decisions' => fn ($query) => $query->orderByDesc('decided_at')])
            ->when(! $operator, function (Builder $query) use ($actor): void {
                $query->where(function (Builder $visibility) use ($actor): void {
                    $visibility->where('status', 'Recognized')
                        ->orWhere('nominator_id', $actor->id)
                        ->orWhere('recipient_id', $actor->id);
                });
            })
            ->orderByDesc('created_at')->get();

        $published = RecognitionRecord::query()->with('category')->where('status', 'Recognized')->get();
        $categories = RecognitionCategory::query()->orderBy('display_order')->orderBy('name')->get();
        $personnel = User::query()->activePersonnel()->orderBy('name')->get()->map(fn (User $person) => $this->person($person))->values();
        $now = now();
        $monthly = collect(range(5, 0))->map(function (int $offset) use ($published, $now): array {
            $month = $now->copy()->subMonths($offset);
            return [
                'key' => $month->format('Y-m'), 'label' => $month->format('M'),
                'count' => $published->filter(fn (RecognitionRecord $record) => $record->recognized_at?->format('Y-m') === $month->format('Y-m'))->count(),
            ];
        })->values();

        $leaderboard = $published->groupBy('recipient_personnel_key')->map(function ($items): array {
            /** @var RecognitionRecord $first */
            $first = $items->first();
            $snapshot = $first->recipient_snapshot;
            return [
                'personnelKey' => $first->recipient_personnel_key,
                'name' => $snapshot['name'] ?? 'Unknown personnel',
                'position' => $snapshot['position'] ?? '',
                'department' => $snapshot['department'] ?? '',
                'count' => $items->count(),
                'latestRecognizedAt' => $items->max(fn (RecognitionRecord $record) => $record->recognized_at?->toIso8601String()),
            ];
        })->sortByDesc('count')->values();

        return [
            'actor' => [
                'id' => $actor->id, 'role' => $actor->role->value, 'name' => $actor->name,
                'personnelKey' => $actor->personnel_key, 'canReview' => $operator,
                'canManageCategories' => $operator, 'canNominate' => true,
            ],
            'personnel' => $personnel,
            'categories' => $categories->map(fn (RecognitionCategory $category) => $this->category($category))->values(),
            'records' => $records->map(fn (RecognitionRecord $record) => $this->record($record, $operator))->values(),
            'leaderboard' => $leaderboard,
            'metrics' => [
                'recognized' => $published->count(),
                'thisMonth' => $published->filter(fn (RecognitionRecord $record) => $record->recognized_at?->isSameMonth($now))->count(),
                'peopleRecognized' => $published->pluck('recipient_personnel_key')->unique()->count(),
                'pendingReview' => $operator ? $records->where('status', 'Pending Review')->count() : null,
            ],
            'analytics' => [
                'monthlyTrend' => $monthly,
                'byDepartment' => $published->groupBy(fn (RecognitionRecord $record) => $record->recipient_snapshot['department'] ?? 'Unassigned')->map->count()->sortDesc(),
                'byCategory' => $published->groupBy(fn (RecognitionRecord $record) => $record->category?->name ?? 'Uncategorized')->map->count()->sortDesc(),
            ],
            'audit' => $operator ? $this->auditRows() : [],
            'governance' => [
                'nominators' => ['Admin', 'HR', 'User'], 'finalizers' => ['Admin', 'HR'],
                'selfRecognitionAllowed' => false, 'publishedRecordsImmutable' => true,
                'userVisibility' => 'Recognized feed, transparent count-based leaderboard, personal recognitions, and own submissions. Review reasons and audit history remain private.',
                'crossModuleImpact' => 'Recognition is contextual evidence only and never changes Performance, Competency, Learning, Training, or Succession outcomes automatically.',
                'certificates' => 'Recognition issues no certificates. Learning and Training retain certificate ownership.',
                'ai' => ['enabled' => false, 'reason' => 'Aevyn/Groq is deferred until an approved API is configured.'],
            ],
        ];
    }

    public function create(User $actor, array $data): RecognitionRecord
    {
        $this->validateEvidence($actor, $data['evidence'] ?? []);
        $recipient = $this->recipient((int) $data['recipientId']);
        $this->guardSelfRecognition($actor, $recipient);
        $category = RecognitionCategory::query()->whereKey($data['categoryId'])->where('is_active', true)->first();
        if (! $category) throw ValidationException::withMessages(['categoryId' => 'Choose an active Recognition category.']);
        $this->guardDuplicate($recipient, $category, $data['title']);
        $replacement = null;
        if (! empty($data['replacesId'])) {
            $replacement = RecognitionRecord::query()->find($data['replacesId']);
            if (! $replacement || ! in_array($replacement->status, ['Declined', 'Revoked'], true) || $replacement->recipient_personnel_key !== $recipient->personnel_key) {
                throw ValidationException::withMessages(['replacesId' => 'A replacement must reference a declined or revoked record for the same recipient.']);
            }
        }

        return DB::transaction(function () use ($actor, $data, $recipient, $category, $replacement): RecognitionRecord {
            $draft = (bool) ($data['saveAsDraft'] ?? false);
            $record = RecognitionRecord::query()->create([
                'recipient_id' => $recipient->id, 'recipient_personnel_key' => $recipient->personnel_key,
                'recipient_snapshot' => $this->person($recipient), 'nominator_id' => $actor->id,
                'nominator_snapshot' => $this->actor($actor), 'category_id' => $category->id,
                'title' => trim($data['title']), 'achievement_details' => trim($data['achievementDetails']),
                'achievement_date' => $data['achievementDate'], 'status' => $draft ? 'Draft' : 'Pending Review',
                'submitted_at' => $draft ? null : now(), 'replaces_id' => $replacement?->id,
                'source_metadata' => ['automaticImpact' => false, 'certificateOwner' => null],
            ]);
            foreach ($data['evidence'] ?? [] as $evidence) {
                $record->evidence()->create([
                    'evidence_type' => $evidence['type'] ?? 'Supporting Note',
                    'source_module' => $evidence['sourceModule'] ?? null,
                    'source_record_id' => $evidence['sourceRecordId'] ?? null,
                    'source_finalized_at' => $evidence['sourceFinalizedAt'] ?? null,
                    'description' => isset($evidence['description']) ? trim($evidence['description']) : null,
                    'source_snapshot' => $evidence['sourceSnapshot'] ?? null, 'created_by' => $actor->id,
                ]);
            }
            $this->audit->record($actor, $draft ? 'RecognitionDraftCreated' : 'RecognitionSubmitted', 'RecognitionRecord', $record->id, ['category' => $category->code]);
            return $record->fresh(['category', 'evidence', 'decisions']);
        });
    }

    public function updateDraft(User $actor, RecognitionRecord $record, array $data): void
    {
        $this->requireDraftOwner($actor, $record);
        $this->validateEvidence($actor, $data['evidence'] ?? []);
        $recipient = $this->recipient((int) $data['recipientId']);
        $this->guardSelfRecognition($actor, $recipient);
        $category = RecognitionCategory::query()->whereKey($data['categoryId'])->where('is_active', true)->first();
        if (! $category) throw ValidationException::withMessages(['categoryId' => 'Choose an active Recognition category.']);
        $this->guardDuplicate($recipient, $category, $data['title'], $record->id);
        DB::transaction(function () use ($actor, $record, $data, $recipient, $category): void {
            $record->update([
                'recipient_id' => $recipient->id, 'recipient_personnel_key' => $recipient->personnel_key,
                'recipient_snapshot' => $this->person($recipient), 'category_id' => $category->id,
                'title' => trim($data['title']), 'achievement_details' => trim($data['achievementDetails']),
                'achievement_date' => $data['achievementDate'],
            ]);
            $record->evidence()->delete();
            foreach ($data['evidence'] ?? [] as $evidence) $record->evidence()->create([
                'evidence_type' => $evidence['type'] ?? 'Supporting Note', 'source_module' => $evidence['sourceModule'] ?? null,
                'source_record_id' => $evidence['sourceRecordId'] ?? null, 'source_finalized_at' => $evidence['sourceFinalizedAt'] ?? null,
                'description' => isset($evidence['description']) ? trim($evidence['description']) : null,
                'source_snapshot' => $evidence['sourceSnapshot'] ?? null, 'created_by' => $actor->id,
            ]);
            $this->audit->record($actor, 'RecognitionDraftUpdated', 'RecognitionRecord', $record->id);
        });
    }

    public function submit(User $actor, RecognitionRecord $record): void
    {
        $this->requireDraftOwner($actor, $record);
        $record->update(['status' => 'Pending Review', 'submitted_at' => now()]);
        $this->audit->record($actor, 'RecognitionSubmitted', 'RecognitionRecord', $record->id);
    }

    public function decide(User $actor, RecognitionRecord $record, string $decision, ?string $reason): void
    {
        $this->requireOperator($actor);
        if (! in_array($decision, ['Recognized', 'Declined'], true)) throw ValidationException::withMessages(['decision' => 'Choose Recognized or Declined.']);
        if ($record->status !== 'Pending Review') throw ValidationException::withMessages(['status' => 'Only Pending Review nominations may be approved or declined.']);
        if ($decision === 'Declined' && trim((string) $reason) === '') throw ValidationException::withMessages(['reason' => 'A decline reason is required.']);
        DB::transaction(function () use ($actor, $record, $decision, $reason): void {
            $recognized = $decision === 'Recognized';
            $record->update([
                'status' => $decision, 'reviewed_by' => $actor->id, 'reviewed_at' => now(),
                'recognized_at' => $recognized ? now() : null,
                'decline_reason' => $recognized ? null : trim((string) $reason),
            ]);
            $record->decisions()->create([
                'decision' => $decision, 'reason' => trim((string) $reason) ?: null,
                'actor_id' => $actor->id, 'actor_snapshot' => $this->actor($actor), 'decided_at' => now(),
            ]);
            $this->audit->record($actor, $recognized ? 'RecognitionApproved' : 'RecognitionDeclined', 'RecognitionRecord', $record->id, ['reason' => $reason]);
        });
    }

    public function revoke(User $actor, RecognitionRecord $record, string $reason): void
    {
        $this->requireOperator($actor);
        if ($record->status !== 'Recognized') throw ValidationException::withMessages(['status' => 'Only a published Recognized record may be revoked.']);
        if (trim($reason) === '') throw ValidationException::withMessages(['reason' => 'A revocation reason is required.']);
        DB::transaction(function () use ($actor, $record, $reason): void {
            $record->update(['status' => 'Revoked', 'revoked_by' => $actor->id, 'revoked_at' => now(), 'revocation_reason' => trim($reason)]);
            $record->decisions()->create(['decision' => 'Revoked', 'reason' => trim($reason), 'actor_id' => $actor->id, 'actor_snapshot' => $this->actor($actor), 'decided_at' => now()]);
            $this->audit->record($actor, 'RecognitionRevoked', 'RecognitionRecord', $record->id, ['reason' => $reason]);
        });
    }

    public function saveCategory(User $actor, array $data, ?RecognitionCategory $category = null): RecognitionCategory
    {
        $this->requireOperator($actor);
        if ($category && ! ($data['isActive'] ?? true) && $category->records()->where('status', 'Pending Review')->exists()) {
            throw ValidationException::withMessages(['isActive' => 'Resolve pending nominations before deactivating this category.']);
        }
        $category ??= new RecognitionCategory(['created_by' => $actor->id]);
        $category->fill([
            'code' => strtoupper(trim($data['code'])), 'name' => trim($data['name']),
            'description' => trim((string) ($data['description'] ?? '')) ?: null,
            'color' => $data['color'] ?? 'amber', 'icon' => $data['icon'] ?? 'award',
            'is_active' => $data['isActive'] ?? true, 'display_order' => $data['displayOrder'] ?? 0,
            'updated_by' => $actor->id,
        ])->save();
        $this->audit->record($actor, $category->wasRecentlyCreated ? 'RecognitionCategoryCreated' : 'RecognitionCategoryUpdated', 'RecognitionCategory', $category->id);
        return $category;
    }

    private function guardDuplicate(User $recipient, RecognitionCategory $category, string $title, ?string $ignoreId = null): void
    {
        $window = max((int) config('recognition.governance.duplicate_window_days', 30), 1);
        $duplicate = RecognitionRecord::query()->where('recipient_id', $recipient->id)->where('category_id', $category->id)
            ->whereRaw('LOWER(title) = ?', [mb_strtolower(trim($title))])->whereDate('achievement_date', '>=', now()->subDays($window))
            ->whereIn('status', ['Draft', 'Pending Review', 'Recognized'])->when($ignoreId, fn (Builder $query) => $query->where('id', '!=', $ignoreId))->exists();
        if ($duplicate) throw ValidationException::withMessages(['title' => 'A matching active nomination already exists for this recipient within the 30-day duplicate window.']);
    }

    private function guardSelfRecognition(User $actor, User $recipient): void
    {
        if ($actor->id === $recipient->id || ($actor->personnel_key && $actor->personnel_key === $recipient->personnel_key)) {
            throw ValidationException::withMessages(['recipientId' => 'Self-recognition is not allowed. Choose an active colleague.']);
        }
    }

    private function validateEvidence(User $actor, array $evidence): void
    {
        if (count($evidence) > 10) throw ValidationException::withMessages(['evidence' => 'A nomination may contain at most 10 evidence references.']);
        $officialModules = ['Performance', 'Competency', 'Learning', 'Training'];
        foreach ($evidence as $index => $item) {
            $source = $item['sourceModule'] ?? null;
            if (! in_array($source, $officialModules, true)) continue;
            if (! $this->isOperator($actor)) throw ValidationException::withMessages(["evidence.{$index}.sourceModule" => 'Only Admin or HR may attach finalized cross-module evidence snapshots.']);
            if (empty($item['sourceRecordId']) || empty($item['sourceFinalizedAt']) || empty($item['sourceSnapshot'])) {
                throw ValidationException::withMessages(["evidence.{$index}" => 'Official cross-module evidence requires its source record, finalized timestamp, and immutable snapshot.']);
            }
        }
    }

    private function recipient(int $id): User
    {
        $recipient = User::query()->activePersonnel()->find($id);
        if (! $recipient) throw ValidationException::withMessages(['recipientId' => 'Choose an active canonical personnel record.']);
        return $recipient;
    }

    private function requireDraftOwner(User $actor, RecognitionRecord $record): void
    {
        if ($record->status !== 'Draft') throw ValidationException::withMessages(['status' => 'Published and submitted records are immutable. Revoke and create a governed replacement when correction is required.']);
        if (! $this->isOperator($actor) && $record->nominator_id !== $actor->id) throw new AuthorizationException('You may only manage your own Recognition drafts.');
    }

    private function requireOperator(User $actor): void
    {
        if (! $this->isOperator($actor)) throw new AuthorizationException('Recognition review and governance require Admin or HR access.');
    }

    private function isOperator(User $actor): bool
    {
        return in_array($actor->role, [UserRole::Admin, UserRole::HR], true);
    }

    private function person(User $person): array
    {
        return ['id' => $person->id, 'personnelKey' => $person->personnel_key, 'employeeId' => $person->employee_or_trainee_id, 'name' => $person->name, 'position' => $person->position, 'department' => $person->department, 'personType' => $person->person_type];
    }

    private function actor(User $actor): array
    {
        return ['id' => $actor->id, 'personnelKey' => $actor->personnel_key, 'employeeId' => $actor->employee_or_trainee_id, 'name' => $actor->name, 'role' => $actor->role->value, 'position' => $actor->position, 'department' => $actor->department, 'personType' => $actor->person_type];
    }

    private function category(RecognitionCategory $category): array
    {
        return ['id' => $category->id, 'code' => $category->code, 'name' => $category->name, 'description' => $category->description, 'color' => $category->color, 'icon' => $category->icon, 'isActive' => $category->is_active, 'displayOrder' => $category->display_order];
    }

    private function record(RecognitionRecord $record, bool $operator): array
    {
        return [
            'id' => $record->id, 'recipient' => $record->recipient_snapshot, 'nominator' => $record->nominator_snapshot,
            'category' => $record->category ? $this->category($record->category) : null,
            'title' => $record->title, 'achievementDetails' => $record->achievement_details,
            'achievementDate' => $record->achievement_date?->toDateString(), 'status' => $record->status,
            'submittedAt' => $record->submitted_at?->toIso8601String(), 'reviewedAt' => $record->reviewed_at?->toIso8601String(),
            'recognizedAt' => $record->recognized_at?->toIso8601String(), 'revokedAt' => $record->revoked_at?->toIso8601String(),
            'declineReason' => $operator ? $record->decline_reason : null,
            'revocationReason' => $operator ? $record->revocation_reason : null,
            'replacesId' => $record->replaces_id,
            'evidence' => $record->evidence->map(fn ($evidence) => ['id' => $evidence->id, 'type' => $evidence->evidence_type, 'sourceModule' => $evidence->source_module, 'sourceRecordId' => $evidence->source_record_id, 'sourceFinalizedAt' => $evidence->source_finalized_at?->toIso8601String(), 'description' => $evidence->description])->values(),
            'createdAt' => $record->created_at?->toIso8601String(),
        ];
    }

    private function auditRows(): array
    {
        return DB::table('recognition_audit_events')->leftJoin('users', 'users.id', '=', 'recognition_audit_events.actor_id')
            ->orderByDesc('occurred_at')->limit(100)->get(['recognition_audit_events.*', 'users.name as actor_name'])
            ->map(fn ($event) => ['id' => $event->id, 'eventType' => $event->event_type, 'actor' => $event->actor_name, 'subjectType' => $event->subject_type, 'subjectId' => $event->subject_id, 'metadata' => json_decode($event->metadata ?? '{}', true), 'occurredAt' => $event->occurred_at])->all();
    }
}
