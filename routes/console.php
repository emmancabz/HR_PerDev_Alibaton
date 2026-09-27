<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Schema;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('accounts:anonymize-expired')
    ->dailyAt('02:00')
    ->withoutOverlapping();

Artisan::command('performance:provision-reviews', function () {
    app(\App\Services\Performance\PerformanceService::class)->provisionScheduledReviews();
    $this->info('Scheduled review assignments reconciled.');
})->purpose('Provision missing reviews inside their authorized review windows');

Schedule::command('performance:provision-reviews')->dailyAt('00:05')->withoutOverlapping();

Artisan::command('competency:sync-automation', function () {
    $result = app(\App\Services\Competency\CompetencyService::class)->synchronizeAutomation();
    $this->info('Competency automation reconciled: '.json_encode($result, JSON_UNESCAPED_SLASHES));
})->purpose('Reconcile governed Competency cycle, assignment, and reassessment automation');

Schedule::command('competency:sync-automation')
    ->hourly()
    ->withoutOverlapping();


Artisan::command('pd:audit-integrity {--json}', function () {
    $issues = [];

    $addIssue = function (string $type, string $scope, int $count, array $details = []) use (&$issues): void {
        if ($count <= 0) return;
        $issues[] = compact('type', 'scope', 'count', 'details');
    };

    foreach (['personnel_key', 'core_person_id', 'employee_or_trainee_id', 'email'] as $column) {
        if (! Schema::hasColumn('users', $column)) continue;

        $query = DB::table('users')
            ->select($column, DB::raw('COUNT(*) as duplicate_count'))
            ->whereNotNull($column)
            ->whereRaw('TRIM(CAST('.$column.' AS TEXT)) <> \'\'');
        if (Schema::hasColumn('users', 'archived_at')) $query->whereNull('archived_at');

        $duplicates = $query->groupBy($column)->havingRaw('COUNT(*) > 1')->get();
        $addIssue(
            'duplicate_canonical_identifier',
            'users.'.$column,
            $duplicates->count(),
            $duplicates->map(fn ($row) => [
                'value' => $row->{$column},
                'count' => (int) $row->duplicate_count,
            ])->values()->all(),
        );
    }

    if (DB::getDriverName() === 'pgsql') {
        $foreignKeys = DB::select(<<<'SQL'
SELECT
    con.conname AS constraint_name,
    child_ns.nspname AS child_schema,
    child.relname AS child_table,
    child_col.attname AS child_column,
    parent_ns.nspname AS parent_schema,
    parent.relname AS parent_table,
    parent_col.attname AS parent_column
FROM pg_constraint con
JOIN pg_class child ON child.oid = con.conrelid
JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
JOIN pg_class parent ON parent.oid = con.confrelid
JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY child_key(attnum, ord) ON true
JOIN LATERAL unnest(con.confkey) WITH ORDINALITY parent_key(attnum, ord) ON parent_key.ord = child_key.ord
JOIN pg_attribute child_col ON child_col.attrelid = child.oid AND child_col.attnum = child_key.attnum
JOIN pg_attribute parent_col ON parent_col.attrelid = parent.oid AND parent_col.attnum = parent_key.attnum
WHERE con.contype = 'f'
  AND array_length(con.conkey, 1) = 1
  AND child_ns.nspname NOT IN ('pg_catalog', 'information_schema')
SQL);

        $quote = static fn (string $identifier): string => '"'.str_replace('"', '""', $identifier).'"';
        foreach ($foreignKeys as $foreignKey) {
            $child = $quote($foreignKey->child_schema).'.'.$quote($foreignKey->child_table);
            $parent = $quote($foreignKey->parent_schema).'.'.$quote($foreignKey->parent_table);
            $childColumn = $quote($foreignKey->child_column);
            $parentColumn = $quote($foreignKey->parent_column);
            $count = (int) DB::selectOne(
                "SELECT COUNT(*) AS aggregate FROM {$child} c LEFT JOIN {$parent} p ON p.{$parentColumn} = c.{$childColumn} WHERE c.{$childColumn} IS NOT NULL AND p.{$parentColumn} IS NULL"
            )->aggregate;
            $addIssue('orphan_foreign_key', $foreignKey->constraint_name, $count, [
                'child' => $foreignKey->child_schema.'.'.$foreignKey->child_table.'.'.$foreignKey->child_column,
                'parent' => $foreignKey->parent_schema.'.'.$foreignKey->parent_table.'.'.$foreignKey->parent_column,
            ]);
        }
    }

    if (Schema::hasTable('learning_assignments') && Schema::hasTable('learning_course_versions')) {
        $count = (int) DB::table('learning_assignments as assignment')
            ->join('learning_course_versions as version', 'version.id', '=', 'assignment.course_version_id')
            ->whereColumn('assignment.course_id', '!=', 'version.course_id')
            ->count();
        $addIssue('cross_module_mismatch', 'learning assignment course/version lineage', $count);
    }

    if (Schema::hasTable('learning_completions') && Schema::hasTable('learning_assignments')) {
        $count = (int) DB::table('learning_completions as completion')
            ->join('learning_assignments as assignment', 'assignment.id', '=', 'completion.assignment_id')
            ->where(function ($query): void {
                $query->whereColumn('completion.learner_id', '!=', 'assignment.learner_id')
                    ->orWhereColumn('completion.course_id', '!=', 'assignment.course_id')
                    ->orWhereColumn('completion.course_version_id', '!=', 'assignment.course_version_id');
            })
            ->count();
        $addIssue('cross_module_mismatch', 'learning completion/assignment lineage', $count);
    }

    if ($this->option('json')) {
        $this->line(json_encode([
            'ok' => $issues === [],
            'issues' => $issues,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    } elseif ($issues === []) {
        $this->info('P&D integrity audit passed: no duplicate canonical identifiers, FK orphans, or checked Learning lineage mismatches found.');
    } else {
        $this->error('P&D integrity audit found '.count($issues).' issue group(s).');
        foreach ($issues as $issue) {
            $this->line(sprintf('- [%s] %s: %d', $issue['type'], $issue['scope'], $issue['count']));
        }
    }

    return $issues === [] ? 0 : 1;
})->purpose('Read-only audit of canonical identities, foreign keys, and cross-module lineage');
