<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Organize existing domain tables into PostgreSQL schemas that match the
     * six manuscript-defined microservice boundaries. This keeps the current
     * data intact while allowing each runtime to evolve toward stricter data
     * ownership without a destructive migration.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->schemas() as $schema) {
            DB::statement('CREATE SCHEMA IF NOT EXISTS '.$this->quote($schema));
        }

        $rows = DB::select(<<<'SQL'
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND (
                tablename LIKE 'performance\_%' ESCAPE '\'
                OR tablename LIKE 'competency\_%' ESCAPE '\'
                OR tablename LIKE 'learning\_%' ESCAPE '\'
                OR tablename LIKE 'training\_%' ESCAPE '\'
                OR tablename LIKE 'succession\_%' ESCAPE '\'
                OR tablename LIKE 'recognition\_%' ESCAPE '\'
              )
            ORDER BY tablename
        SQL);

        foreach ($rows as $row) {
            $table = (string) $row->tablename;
            $schema = $this->schemaFor($table);
            if ($schema === null) {
                continue;
            }

            DB::statement(sprintf(
                'ALTER TABLE %s.%s SET SCHEMA %s',
                $this->quote('public'),
                $this->quote($table),
                $this->quote($schema),
            ));
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->schemas() as $schema) {
            $rows = DB::select(
                'SELECT tablename FROM pg_tables WHERE schemaname = ? ORDER BY tablename',
                [$schema],
            );

            foreach ($rows as $row) {
                DB::statement(sprintf(
                    'ALTER TABLE %s.%s SET SCHEMA %s',
                    $this->quote($schema),
                    $this->quote((string) $row->tablename),
                    $this->quote('public'),
                ));
            }
        }
    }

    private function schemas(): array
    {
        return ['performance', 'competency', 'learning', 'training', 'succession', 'recognition'];
    }

    private function schemaFor(string $table): ?string
    {
        foreach ($this->schemas() as $schema) {
            if (str_starts_with($table, $schema.'_')) {
                return $schema;
            }
        }

        return null;
    }

    private function quote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
};
