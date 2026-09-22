<?php

namespace App\Models\Recognition;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecognitionDecision extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['actor_snapshot' => 'array', 'decided_at' => 'datetime'];
    }

    public function recognition(): BelongsTo
    {
        return $this->belongsTo(RecognitionRecord::class, 'recognition_record_id');
    }
}
