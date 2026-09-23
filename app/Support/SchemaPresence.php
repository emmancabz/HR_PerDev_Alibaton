<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

final class SchemaPresence
{
    /**
     * Check whether a table is visible to the current runtime.
     *
     * Laravel's PostgreSQL Schema::hasTable() is schema-oriented and can miss
     * domain tables that were moved out of public even when PostgreSQL can
     * resolve them through search_path. to_regclass() resolves relation names
     * using the active search_path, matching how DB::table('...') behaves.
     */
    public static function hasTable(string $table): bool
    {
        if (DB::getDriverName() !== 'pgsql' || str_contains($table, '.')) {
            return Schema::hasTable($table);
        }

        try {
            $row = DB::selectOne('select to_regclass(?) as relation_name', [$table]);

            return $row !== null && $row->relation_name !== null;
        } catch (Throwable) {
            return Schema::hasTable($table);
        }
    }
}
