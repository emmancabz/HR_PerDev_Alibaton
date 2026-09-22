<?php

namespace App\Models\Competency;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompetencyAssessment extends CompetencyRecord
{
    protected $table = 'competency_assessments';
    public function person(): BelongsTo { return $this->belongsTo(User::class, 'person_id'); }
    public function assessor(): BelongsTo { return $this->belongsTo(User::class, 'assessor_id'); }
    public function profile(): BelongsTo { return $this->belongsTo(RoleProfile::class, 'role_profile_id'); }
    public function cycle(): BelongsTo { return $this->belongsTo(AssessmentCycle::class, 'cycle_id'); }
}
