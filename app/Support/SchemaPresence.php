<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

final class SchemaPresence
{
    /** @var array<string, bool> */
    private static array $memo = [];

    /** @var array<string, array<string, true>> */
    private static array $visibleRelations = [];

    /**
     * Check whether a table is visible to the current runtime.
     *
     * Laravel's PostgreSQL Schema::hasTable() is schema-oriented and can miss
     * domain tables that were moved out of public even when PostgreSQL can
     * resolve them through search_path. For PostgreSQL we load the visible
     * relation names once per connection/search_path instead of issuing one
     * to_regclass() round-trip for every dashboard/search/notification check.
     */
    public static function hasTable(string $table): bool
    {
        // PHPUnit reuses the same PHP process while refreshing/rebuilding the
        // database between tests. Static relation caches would otherwise outlive
        // those schema changes and return stale table-presence results.
        if (app()->runningUnitTests()) {
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

        $connection = DB::getDefaultConnection();
        $searchPath = (string) config("database.connections.{$connection}.search_path", '');
        $scopeKey = $connection.'|'.$searchPath;
        $cacheKey = $scopeKey.'|'.$table;

        if (array_key_exists($cacheKey, self::$memo)) {
            return self::$memo[$cacheKey];
        }

        if (DB::getDriverName() !== 'pgsql' || str_contains($table, '.')) {
            return self::$memo[$cacheKey] = Schema::hasTable($table);
        }

        try {
            if (! array_key_exists($scopeKey, self::$visibleRelations)) {
                $rows = DB::select(<<<'SQL'
                    SELECT DISTINCT c.relname
                    FROM pg_catalog.pg_class AS c
                    INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                    WHERE n.nspname = ANY (current_schemas(true))
                      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
                SQL);

                self::$visibleRelations[$scopeKey] = collect($rows)
                    ->mapWithKeys(fn (object $row): array => [(string) $row->relname => true])
                    ->all();
            }

            return self::$memo[$cacheKey] = isset(self::$visibleRelations[$scopeKey][$table]);
        } catch (Throwable) {
            try {
                $row = DB::selectOne('select to_regclass(?) as relation_name', [$table]);

                return self::$memo[$cacheKey] = $row !== null && $row->relation_name !== null;
            } catch (Throwable) {
                return self::$memo[$cacheKey] = Schema::hasTable($table);
            }
        }
    }
}
