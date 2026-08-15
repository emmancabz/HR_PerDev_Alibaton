<?php

namespace App\Services\Learning;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LearningAuditService
{
    public function record(?User $actor, string $event, string $type, string|int $id, array $metadata = []): void
    {
        DB::table('learning_audit_events')->insert([
            'id' => (string) Str::uuid(),
            'actor_id' => $actor?->id,
            'event_type' => $event,
            'auditable_type' => $type,
            'auditable_id' => (string) $id,
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'occurred_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
