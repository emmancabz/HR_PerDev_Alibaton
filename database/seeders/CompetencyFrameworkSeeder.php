<?php

namespace Database\Seeders;

use App\Services\Competency\{CompetencyDomain, CompetencyService};
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Adds missing framework lineages. Never changes personnel or published records on rerun. */
class CompetencyFrameworkSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            DB::table('competency_revisions')->where('id',1)->lockForUpdate()->first();
            $service = app(CompetencyService::class);
            $before = $service->rawState();
            $after = $before;
            $catalog = json_decode(file_get_contents(database_path('seeders/data/competency/framework.json')),true,512,JSON_THROW_ON_ERROR);
            foreach (['competencies','roleProfiles'] as $collection) foreach ($catalog[$collection] as $record) {
                $lineageExists = array_filter($after[$collection],fn ($r)=>$r['lineageId'] === $record['lineageId']);
                if (!$lineageExists) $after[$collection][] = $record;
            }
            $service->persist($before,$after,null);
            if ($before !== $after) DB::table('competency_revisions')->where('id',1)->increment('revision');
        });
    }
}
