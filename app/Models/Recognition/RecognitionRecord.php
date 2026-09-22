<?php

namespace App\Models\Recognition;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecognitionRecord extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'recipient_snapshot' => 'array',
            'nominator_snapshot' => 'array',
            'source_metadata' => 'array',
            'achievement_date' => 'date',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'recognized_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function recipient(): BelongsTo { return $this->belongsTo(User::class, 'recipient_id'); }
    public function nominator(): BelongsTo { return $this->belongsTo(User::class, 'nominator_id'); }
    public function reviewer(): BelongsTo { return $this->belongsTo(User::class, 'reviewed_by'); }
    public function revoker(): BelongsTo { return $this->belongsTo(User::class, 'revoked_by'); }
    public function category(): BelongsTo { return $this->belongsTo(RecognitionCategory::class, 'category_id'); }
    public function evidence(): HasMany { return $this->hasMany(RecognitionEvidence::class); }
    public function decisions(): HasMany { return $this->hasMany(RecognitionDecision::class); }
}
