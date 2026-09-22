<?php

namespace App\Models\Competency;

use Illuminate\Database\Eloquent\Model;

abstract class CompetencyRecord extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array { return ['payload' => 'array']; }
}
