<?php

namespace App\Services\Recognition;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RecognitionAuditService
{
    public function record(?User $actor, string $eventType, string $subjectType, string $subjectId, array $metadata = []): void
    {
        DB::table('recognition_audit_events')->insert([
            'id' => (string) Str::uuid(), 'event_type' => $eventType, 'actor_id' => $actor?->id,
            'subject_type' => $subjectType, 'subject_id' => $subjectId,
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR), 'occurred_at' => now(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
