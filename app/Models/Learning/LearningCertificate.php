<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LearningCertificate extends Model
{
    use HasUuids;
    protected $guarded = [];
    protected function casts(): array { return ['issued_on' => 'immutable_date', 'expires_on' => 'immutable_date', 'revoked_at' => 'immutable_datetime']; }
}
