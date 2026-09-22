<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ReportExport extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['report_key', 'format', 'filters', 'row_count', 'actor_id', 'exported_at'];

    protected function casts(): array
    {
        return ['filters' => 'array', 'exported_at' => 'datetime'];
    }
}
