<?php

namespace App\Models\Learning;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LearningMaterial extends Model
{
    use HasUuids;

    protected $guarded = [];
    protected $hidden = ['storage_path', 'stored_name', 'sha256'];

    protected function casts(): array
    {
        return ['revoked_at' => 'immutable_datetime'];
    }
}
