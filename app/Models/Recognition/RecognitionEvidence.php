<?php

namespace App\Models\Recognition;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecognitionEvidence extends Model
{
    use HasUuids;

    protected $table = 'recognition_evidence';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['source_snapshot' => 'array', 'source_finalized_at' => 'datetime'];
    }

    public function recognition(): BelongsTo
    {
        return $this->belongsTo(RecognitionRecord::class, 'recognition_record_id');
    }
}
