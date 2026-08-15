<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LearningAssessmentQuestion extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function options(): HasMany
    {
        return $this->hasMany(LearningAnswerOption::class, 'question_id')->orderBy('display_order');
    }
}
