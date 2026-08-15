<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LearningAssessment extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_required' => 'boolean', 'shuffle_questions' => 'boolean', 'shuffle_options' => 'boolean'];
    }

    public function questions(): HasMany
    {
        return $this->hasMany(LearningAssessmentQuestion::class, 'assessment_id')->orderBy('display_order');
    }
}
