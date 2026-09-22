<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Competency\{CompetencyDomain, CompetencyService};
use App\Services\Personnel\CanonicalPersonnelService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Deterministic examples on existing personnel, added once without overwriting operational work. */
class CompetencyShowcaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(CompetencyFrameworkSeeder::class);
        $governor = User::query()->activePersonnel()->where('role',UserRole::HR->value)->orderBy('id')->first();
        if (!$governor) { $this->command?->warn('No canonical HR governor is available; competency showcase was skipped.'); return; }
        $people = app(CanonicalPersonnelService::class)->active()->values()->all();
        $users = User::query()->activePersonnel()->get()->keyBy('personnel_key');
        $personnel = array_values(array_filter($people,fn ($p)=>$p['accessRole'] === 'User'));
        usort($personnel,fn ($a,$b)=>[$a['department'],$a['position'],$a['id']] <=> [$b['department'],$b['position'],$b['id']]);
        $service = app(CompetencyService::class);
        $domain = app(CompetencyDomain::class);
        $actor = fn (User $u)=>['databaseId'=>$u->id,'personnelKey'=>$u->personnel_key,'name'=>$u->name,'role'=>$u->role->value];
        $now = now('Asia/Manila');
        $start = $now->copy()->startOfMonth()->toDateString();
        $end = $now->copy()->endOfMonth()->toDateString();
        $cycleId = 'competency-showcase-current-v1';
        DB::transaction(function () use ($service,$domain,$people,$personnel,$users,$governor,$actor,$now,$start,$end,$cycleId) {
            DB::table('competency_revisions')->where('id',1)->lockForUpdate()->first();
            $before = $service->rawState();
            if (CompetencyDomain::find($before['cycles'],$cycleId)) return;
            $state = $before;
            $cycle = ['id'=>$cycleId,'name'=>'Workforce Competency Review','type'=>'Periodic Assessment','startDate'=>$start,'endDate'=>$end,'appliesTo'=>'Both','departments'=>[],'positions'=>[],'roleProfileIds'=>array_column(array_filter($state['roleProfiles'],fn ($p)=>$p['status'] === 'Active'),'id'),'assignmentMethod'=>'Manual Authorized Assignment','roleBasedAssessorScope'=>null,'roleBasedAssessorPositions'=>[],'requireSelfAssessment'=>false,'requireSupportingEvidence'=>true,'requireHrValidation'=>true,'requireAcknowledgment'=>true,'dueDaysAfterAssignment'=>20,'reassessmentRule'=>'Review development evidence and conduct an authorized reassessment.','status'=>'Scheduled','cancellationReason'=>null];
            $run = function (string $collection,array $record,User $user,?string $at = null) use (&$state,$domain,$actor,$people,$now) {
                $state = $domain->apply($state,[['collection'=>$collection,'record'=>$record]],$actor($user),$people,$at ?? $now->toIso8601String());
            };
            // Showcase data follows the governed lifecycle: create Scheduled first, then let the
            // deterministic seeder advance the already-governed window to Active. Production UI
            // automation performs this transition when the configured start date is reached.
            $run('cycles',$cycle,$governor);
            $cycle = CompetencyDomain::find($state['cycles'],$cycleId);
            $cycle['status'] = 'Active';
            $run('cycles',$cycle,$governor);
            // A prior governed review for the existing crane-supervisor role demonstrates
            // development followed by a later official result, without changing any profile.
            foreach (array_slice($personnel,0,16) as $person) {
                $profile = CompetencyDomain::resolveProfile($state,$person,$now->toDateString());
                if (($profile['id'] ?? '') !== 'profile-crane-supervisor') continue;
                $historicalAt = max($profile['effectiveDate'].'T09:00:00+08:00',$now->copy()->subDays(30)->toIso8601String());
                if ($historicalAt >= $now->toIso8601String()) continue;
                $historicalCycle = array_merge($cycle,['id'=>'competency-showcase-history-v1','name'=>'Prior Crane Capability Review','startDate'=>substr($historicalAt,0,10),'endDate'=>substr($historicalAt,0,10),'roleProfileIds'=>[$profile['id']],'status'=>'Scheduled']);
                $run('cycles',$historicalCycle,$governor,$historicalAt);
                $historicalCycle = CompetencyDomain::find($state['cycles'],$historicalCycle['id']);
                $historicalCycle['status'] = 'Active';
                $run('cycles',$historicalCycle,$governor,$historicalAt);
                $assessor = $users->get($person['managerPersonnelKey'] ?? '') ?? $governor;
                if (!CompetencyDomain::authorized($state,$people,$assessor->personnel_key,$person,$profile)) $run('assessorAuthorizations',['id'=>'competency-showcase-history-authority','assessorId'=>$assessor->personnel_key,'scope'=>'Specific Person','scopeValue'=>$person['id'],'active'=>true,'reason'=>'Scoped authority for the historical competency demonstration.'],$governor,$historicalAt);
                $historicalId = 'competency-showcase-history-assessment';
                $run('assessments',['id'=>$historicalId,'personId'=>$person['id'],'cycleId'=>$historicalCycle['id'],'roleProfileId'=>$profile['id'],'assessorId'=>$assessor->personnel_key,'dueDate'=>substr($historicalAt,0,10),'status'=>'Pending','scope'=>'Full Role Profile','targetCompetencyIds'=>array_column($profile['requirements'],'competencyId'),'sourceRecommendationIds'=>[]],$governor,$historicalAt);
                $a = CompetencyDomain::find($state['assessments'],$historicalId);
                foreach ($a['ratings'] as $i=>&$rating) {
                    $q = $a['roleProfileSnapshot']['requirements'][$i];
                    $rating['selectedLevel'] = max(1,$q['requiredLevel']-($i === 0 ? 1 : 0));
                    $rating['assessorComments'] = 'Historical demonstration: supervised practice was required before the next review.';
                    $rating['evidence'] = [['id'=>'history-evidence-'.$i,'type'=>$q['competency']['requiredEvidenceTypes'][0],'title'=>'Historical workflow demonstration','reference'=>'Internal competency walkthrough','description'=>'Deterministic demonstration, not a real workplace observation.','verificationState'=>!empty($q['critical']) ? 'Verified' : 'Reviewed']];
                }
                unset($rating);
                $a['status']='In Progress'; $run('assessments',$a,$assessor,$historicalAt);
                $a=CompetencyDomain::find($state['assessments'],$historicalId); $a['status']='Pending Validation'; $run('assessments',$a,$assessor,$historicalAt);
                $a=CompetencyDomain::find($state['assessments'],$historicalId); $a['status']='Finalized'; $a['hrValidationNotes']='Historical demonstration review of the assigned requirements.'; $run('assessments',$a,$governor,$historicalAt);
                $run('recommendations',['id'=>'competency-showcase-history-development','personId'=>$person['id'],'competencyId'=>$a['ratings'][0]['competencyId'],'sourceAssessmentId'=>$historicalId,'type'=>'Training','title'=>'Supervised crane competency practice','note'=>'Demonstration: practice the required operating behaviors, then validate them in the next formal assessment.','status'=>'Recommended'],$governor,$historicalAt);
                $development = CompetencyDomain::find($state['recommendations'],'competency-showcase-history-development');
                $development['status']='Reviewed'; $run('recommendations',$development,$governor,$historicalAt);
                $development = CompetencyDomain::find($state['recommendations'],$development['id']);
                $development['status']='Reassessment Requested'; $run('recommendations',$development,$governor,$historicalAt);
                $historicalCycle['status']='Closed'; $run('cycles',$historicalCycle,$governor,$historicalAt);
                break;
            }
            foreach (array_slice($personnel,0,24) as $index=>$person) {
                $profile = CompetencyDomain::resolveProfile($state,$person,$now->toDateString());
                if (!$profile) continue;
                $assessorKey = $person['managerPersonnelKey'] ?? $governor->personnel_key;
                $assessor = $users->get($assessorKey) ?? $governor;
                if ($assessor->personnel_key === $person['id']) $assessor = $governor;
                if (!CompetencyDomain::authorized($state,$people,$assessor->personnel_key,$person,$profile)) $run('assessorAuthorizations',['id'=>'competency-showcase-authority-'.$person['id'],'assessorId'=>$assessor->personnel_key,'scope'=>'Specific Person','scopeValue'=>$person['id'],'active'=>true,'reason'=>'Scoped authority for the competency workflow demonstration.'],$governor);
                $id = 'competency-showcase-assessment-'.$person['id'];
                $run('assessments',['id'=>$id,'personId'=>$person['id'],'cycleId'=>$cycleId,'roleProfileId'=>$profile['id'],'assessorId'=>$assessor->personnel_key,'dueDate'=>$end,'status'=>'Pending','scope'=>'Full Role Profile','targetCompetencyIds'=>array_column($profile['requirements'],'competencyId'),'sourceRecommendationIds'=>[]],$governor);
                if ($index >= 20) continue;
                $a = CompetencyDomain::find($state['assessments'],$id);
                foreach ($a['ratings'] as &$rating) {
                    $q = current(array_filter($a['roleProfileSnapshot']['requirements'],fn ($q)=>$q['competencyId'] === $rating['competencyId']));
                    // Role-specific requirements drive the example; the position selects a stable scenario.
                    $needsDevelopment = in_array($index % 4,[1,2],true) && $rating['competencyId'] === $a['ratings'][0]['competencyId'];
                    $rating['selectedLevel'] = max(1,$q['requiredLevel']-($needsDevelopment ? 1 : 0));
                    $rating['assessorComments'] = $needsDevelopment ? 'Demonstration scenario: routine work is reliable; the next required behavioral indicator needs further supervised practice.' : 'Demonstration scenario: the work sample demonstrates the required behavioral indicators.';
                    $rating['evidence'] = [['id'=>$id.'-'.$rating['competencyId'],'type'=>$q['competency']['requiredEvidenceTypes'][0],'title'=>'Competency workflow demonstration','reference'=>'Internal competency assessment walkthrough','description'=>'Deterministic showcase evidence for this role; this is not a claim of a real workplace observation.','addedAt'=>$now->toIso8601String(),'addedBy'=>$assessor->personnel_key,'verificationState'=>!empty($q['critical']) ? 'Verified' : 'Reviewed','sourceContext'=>'Metadata or link reference']];
                }
                unset($rating);
                $a['status'] = 'In Progress'; $run('assessments',$a,$assessor);
                if ($index >= 18) continue;
                $a = CompetencyDomain::find($state['assessments'],$id); $a['status'] = 'Pending Validation'; $run('assessments',$a,$assessor);
                if ($index >= 16) continue;
                $a = CompetencyDomain::find($state['assessments'],$id); $a['status'] = 'Finalized'; $a['hrValidationNotes'] = 'Governed workflow demonstration validated against the assigned role requirement snapshot.'; $run('assessments',$a,$governor);
                if (in_array($index % 4,[1,2],true)) {
                    $a = CompetencyDomain::find($state['assessments'],$id);
                    $run('recommendations',['id'=>'competency-showcase-development-'.$person['id'],'personId'=>$person['id'],'competencyId'=>$a['ratings'][0]['competencyId'],'sourceAssessmentId'=>$id,'type'=>$index % 4 === 1 ? 'Learning' : 'Training','title'=>'Develop '.$a['roleProfileSnapshot']['requirements'][0]['competency']['name'],'note'=>'Review the relevant internal reference, practice the required behavior with supervision, then provide evidence for formal reassessment.','status'=>'Recommended'],$governor);
                }
            }
            $service->persist($before,$state,$governor);
            DB::table('competency_revisions')->where('id',1)->increment('revision');
        },3);
    }
}
