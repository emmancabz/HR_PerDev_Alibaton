<?php

namespace App\Services\Competency;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\Competency\{AssessmentAcknowledgment, AssessmentCycle, AssessorAuthorization, CompetencyAssessment, CompetencyDefinition, DevelopmentRecommendation, RoleProfile};
use App\Services\Personnel\CanonicalPersonnelService;
use App\Services\Learning\LearningRequestService;
use App\Services\Training\TrainingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\CarbonImmutable;

class CompetencyService
{
    public const MODELS = ['competencies'=>CompetencyDefinition::class,'roleProfiles'=>RoleProfile::class,'cycles'=>AssessmentCycle::class,'assessorAuthorizations'=>AssessorAuthorization::class,'assessments'=>CompetencyAssessment::class,'recommendations'=>DevelopmentRecommendation::class,'acknowledgmentEvents'=>AssessmentAcknowledgment::class];

    public function __construct(private readonly CanonicalPersonnelService $personnel, private readonly CompetencyDomain $domain, private readonly CompetencyProjection $projection) {}

    public function rawState(): array
    {
        $state = CompetencyDomain::emptyState();
        foreach (self::MODELS as $key=>$model) $state[$key] = $model::query()->orderBy('created_at')->orderBy('id')->get()->map(fn ($row)=>$row->payload)->all();
        // The append-only finalization table is the authority for immutable result history.
        $snapshots = DB::table('competency_finalizations')->orderBy('version')->get()->groupBy('assessment_id');
        foreach ($state['assessments'] as &$a) {
            $a['finalizedSnapshots'] = ($snapshots->get($a['id']) ?? collect())->map(fn ($row)=>json_decode($row->payload,true,512,JSON_THROW_ON_ERROR))->all();
            $a['finalizedSnapshot'] = $a['finalizedSnapshots'] ? end($a['finalizedSnapshots']) : null;
        }
        unset($a);
        return $state;
    }

    /**
     * Reconcile all date-driven Competency automation without relying on a browser.
     * This method is intentionally idempotent and revision-locked so it is safe from
     * both the scheduler and ordinary page/API reads.
     */
    public function synchronizeAutomation(): array
    {
        $summary = ['activated'=>0,'closed'=>0,'assignmentsCreated'=>0,'reassessmentsCreated'=>0,'recommendationsLinked'=>0];
        DB::transaction(function () use (&$summary) {
            $lock = DB::table('competency_revisions')->where('id',1)->lockForUpdate()->first();
            if (!$lock) return;

            $before = $this->rawState();
            $state = $before;
            $people = $this->personnel->active()->values()->all();
            $today = now('Asia/Manila')->toDateString();
            $now = now('Asia/Manila')->toIso8601String();
            $actor = ['databaseId'=>null,'personnelKey'=>'system-automation','name'=>'System automation','role'=>'admin'];

            $apply = function (string $collection, array $record) use (&$state,$actor,$people,$now): void {
                $state = $this->domain->apply($state,[['collection'=>$collection,'record'=>$record]],$actor,$people,$now);
            };

            // Governed date lifecycle: Scheduled -> Active -> Closed. Expired cycles
            // stay open when unresolved assessments still require governance action.
            foreach (array_values($state['cycles']) as $cycle) {
                if ($cycle['status'] === 'Scheduled' && $cycle['startDate'] <= $today && $cycle['endDate'] >= $today) {
                    $cycle['status'] = 'Active';
                    $apply('cycles',$cycle);
                    $summary['activated']++;
                }
            }
            foreach (array_values($state['cycles']) as $cycle) {
                if (!in_array($cycle['status'],['Scheduled','Active'],true) || $cycle['endDate'] >= $today) continue;
                $unresolved = array_filter($state['assessments'],fn ($assessment) => $assessment['cycleId'] === $cycle['id'] && !in_array($assessment['status'],['Finalized','Cancelled'],true));
                if ($unresolved) continue;
                $cycle['status'] = 'Closed';
                $apply('cycles',$cycle);
                $summary['closed']++;
            }

            $existing = [];
            foreach ($state['assessments'] as $assessment) if ($assessment['status'] !== 'Cancelled') $existing[$assessment['personId'].'::'.$assessment['cycleId']] = true;

            // Routine full-profile assignments are generated automatically for active
            // governed cycles. Manual Authorized Assignment remains an exception path.
            foreach (array_values($state['cycles']) as $cycle) {
                if ($cycle['status'] !== 'Active' || ($cycle['autoAssign'] ?? true) === false || $cycle['assignmentMethod'] === 'Manual Authorized Assignment' || $cycle['type'] === 'Post-Training Reassessment') continue;
                foreach ($cycle['roleProfileIds'] as $profileId) {
                    $profile = CompetencyDomain::find($state['roleProfiles'],$profileId);
                    if (!$profile || $profile['status'] !== 'Active') continue;
                    foreach ($people as $person) {
                        if (!$this->cyclePopulationMatches($cycle,$person,$profile,$state,$today)) continue;
                        $key = $person['id'].'::'.$cycle['id'];
                        if (isset($existing[$key])) continue;
                        $assessor = $this->resolveAutomationAssessor($state,$people,$cycle,$person,$profile);
                        if (!$assessor) continue;
                        $id = 'competency-auto-'.substr(hash('sha256',$key),0,40);
                        $apply('assessments',[
                            'id'=>$id,
                            'personId'=>$person['id'],
                            'cycleId'=>$cycle['id'],
                            'roleProfileId'=>$profile['id'],
                            'assessorId'=>$assessor['id'],
                            'dueDate'=>$this->automationDueDate($cycle,$today),
                            'status'=>'Pending',
                            'scope'=>'Full Role Profile',
                            'targetCompetencyIds'=>array_column($profile['requirements'],'competencyId'),
                            'sourceRecommendationIds'=>[],
                        ]);
                        $existing[$key] = true;
                        $summary['assignmentsCreated']++;
                    }
                }
            }

            // Development completion is external evidence only. Once its governed
            // reassessment date is due, create/link a targeted official reassessment.
            // Enrichment is projection-only; never persist integration/transient fields.
            $projected = $state;
            $this->enrichDevelopment($projected,$people);
            $due = array_values(array_filter($projected['recommendations'],fn ($recommendation) =>
                $recommendation['status'] !== 'Reassessed'
                && !empty($recommendation['integration']['completedAt'])
                && !empty($recommendation['reassessmentDue'])
                && $recommendation['reassessmentDue'] <= $today
            ));

            $groups = [];
            foreach ($due as $recommendation) {
                $stored = CompetencyDomain::find($state['recommendations'],$recommendation['id']);
                if (!$stored) continue;

                $linked = !empty($stored['reassessmentAssessmentId']) ? CompetencyDomain::find($state['assessments'],$stored['reassessmentAssessmentId']) : null;
                if ($linked && $linked['status'] !== 'Cancelled') {
                    $stored['status'] = 'Reassessment Requested';
                    $stored['reassessmentAssessmentId'] = $linked['id'];
                    $apply('recommendations',$stored);
                    $summary['recommendationsLinked']++;
                    continue;
                }

                $person = CompetencyDomain::find($people,$stored['personId']);
                if (!$person) continue;
                $profile = CompetencyDomain::resolveProfile($state,$person,$today);
                if (!$profile) continue;

                // Reuse a governed reassessment that already covers this competency,
                // including a finalized reassessment completed after development.
                $reusable = null;
                foreach ($state['assessments'] as $assessment) {
                    if ($assessment['personId'] !== $person['id'] || $assessment['status'] === 'Cancelled') continue;
                    $targetCycle = CompetencyDomain::find($state['cycles'],$assessment['cycleId']);
                    if (!$targetCycle || $targetCycle['type'] !== 'Post-Training Reassessment') continue;
                    $targets = $assessment['targetCompetencyIds'] ?? array_column($assessment['roleProfileSnapshot']['requirements'],'competencyId');
                    if (!in_array($stored['competencyId'],$targets,true)) continue;
                    if ($assessment['status'] === 'Finalized' && ($assessment['finalizedAt'] ?? '') < ($stored['createdAt'] ?? '')) continue;
                    $reusable = $assessment;
                    break;
                }
                if ($reusable) {
                    $stored['status'] = 'Reassessment Requested';
                    $stored['reassessmentAssessmentId'] = $reusable['id'];
                    $apply('recommendations',$stored);
                    $summary['recommendationsLinked']++;
                    continue;
                }

                $cycle = null;
                $cycles = array_values(array_filter($state['cycles'],fn ($candidate) =>
                    $candidate['status'] === 'Active'
                    && $candidate['type'] === 'Post-Training Reassessment'
                    && $this->cyclePopulationMatches($candidate,$person,$profile,$state,$today)
                    && !isset($existing[$person['id'].'::'.$candidate['id']])
                ));
                usort($cycles,fn ($a,$b) => [$a['startDate'],$a['id']] <=> [$b['startDate'],$b['id']]);
                $cycle = $cycles[0] ?? null;
                if (!$cycle) continue;
                $key = $person['id'].'::'.$cycle['id'];
                $groupKey = $key;
                if (!isset($groups[$groupKey])) $groups[$groupKey] = ['cycle'=>$cycle,'profile'=>$profile,'person'=>$person,'competencyIds'=>[],'recommendationIds'=>[],'sourceAssessmentId'=>$stored['sourceAssessmentId']];
                if (!in_array($stored['competencyId'],$groups[$groupKey]['competencyIds'],true)) $groups[$groupKey]['competencyIds'][] = $stored['competencyId'];
                $groups[$groupKey]['recommendationIds'][] = $stored['id'];
            }

            foreach ($groups as $key=>$group) {
                if (isset($existing[$key])) continue;
                $assessor = $this->resolveAutomationAssessor($state,$people,$group['cycle'],$group['person'],$group['profile']);
                if (!$assessor) continue;
                $id = 'competency-reassessment-'.substr(hash('sha256',$key.'::'.implode('|',$group['competencyIds'])),0,40);
                $apply('assessments',[
                    'id'=>$id,
                    'personId'=>$group['person']['id'],
                    'cycleId'=>$group['cycle']['id'],
                    'roleProfileId'=>$group['profile']['id'],
                    'assessorId'=>$assessor['id'],
                    'dueDate'=>$this->automationDueDate($group['cycle'],$today),
                    'status'=>'Pending',
                    'scope'=>'Targeted Competencies',
                    'targetCompetencyIds'=>$group['competencyIds'],
                    'sourceRecommendationIds'=>$group['recommendationIds'],
                    'revisionSourceAssessmentId'=>$group['sourceAssessmentId'],
                ]);
                $existing[$key] = true;
                $summary['reassessmentsCreated']++;
                foreach ($group['recommendationIds'] as $recommendationId) {
                    $stored = CompetencyDomain::find($state['recommendations'],$recommendationId);
                    if (!$stored) continue;
                    $stored['status'] = 'Reassessment Requested';
                    $stored['reassessmentAssessmentId'] = $id;
                    $apply('recommendations',$stored);
                    $summary['recommendationsLinked']++;
                }
            }

            if ($state == $before) return;
            $this->persist($before,$state,null);
            DB::table('competency_revisions')->where('id',1)->increment('revision');
        },3);
        return $summary;
    }

    private function cyclePopulationMatches(array $cycle, array $person, array $profile, array $state, string $today): bool
    {
        $resolved = CompetencyDomain::resolveProfile($state,$person,$today);
        return $resolved !== null
            && $resolved['id'] === $profile['id']
            && in_array($profile['id'],$cycle['roleProfileIds'],true)
            && ($cycle['appliesTo'] === 'Both' || CompetencyDomain::personType($cycle['appliesTo']) === CompetencyDomain::personType($person['personType']))
            && (!$cycle['departments'] || in_array($person['department'],$cycle['departments'],true))
            && (!$cycle['positions'] || in_array($person['position'],$cycle['positions'],true));
    }

    private function resolveAutomationAssessor(array $state, array $people, array $cycle, array $person, array $profile): ?array
    {
        if ($cycle['assignmentMethod'] === 'Manual Authorized Assignment') return null;
        if ($cycle['assignmentMethod'] === 'Reporting Relationship') {
            $managerId = $person['managerPersonnelKey'] ?? null;
            return $managerId && CompetencyDomain::authorized($state,$people,$managerId,$person,$profile) ? CompetencyDomain::find($people,$managerId) : null;
        }
        if (!$cycle['roleBasedAssessorScope'] || !$cycle['roleBasedAssessorPositions']) return null;
        $candidates = array_values(array_filter($people,function ($candidate) use ($state,$people,$cycle,$person,$profile) {
            if (!in_array($candidate['position'],$cycle['roleBasedAssessorPositions'],true)) return false;
            if (!CompetencyDomain::authorized($state,$people,$candidate['id'],$person,$profile)) return false;
            foreach ($state['assessorAuthorizations'] as $authorization) {
                if (!$authorization['active'] || $authorization['assessorId'] !== $candidate['id'] || $authorization['scope'] !== $cycle['roleBasedAssessorScope']) continue;
                $value = match ($authorization['scope']) {
                    'Department'=>$person['department'],
                    'Position'=>$person['position'],
                    'Role Profile'=>$profile['id'],
                    default=>null,
                };
                if ($value !== null && CompetencyDomain::key($authorization['scopeValue']) === CompetencyDomain::key($value)) return true;
            }
            return false;
        }));
        if (!$candidates) return null;
        $workload = [];
        foreach ($state['assessments'] as $assessment) if (!in_array($assessment['status'],['Finalized','Cancelled'],true)) $workload[$assessment['assessorId']] = ($workload[$assessment['assessorId']] ?? 0) + 1;
        usort($candidates,fn ($a,$b) => [($workload[$a['id']] ?? 0),($a['fullName'] ?? $a['name'] ?? $a['id'])] <=> [($workload[$b['id']] ?? 0),($b['fullName'] ?? $b['name'] ?? $b['id'])]);
        return $candidates[0] ?? null;
    }

    private function automationDueDate(array $cycle, string $assignedDate): string
    {
        $calculated = CarbonImmutable::parse($assignedDate,'Asia/Manila')->addDays((int)$cycle['dueDaysAfterAssignment'])->toDateString();
        $earliest = max($assignedDate,$cycle['startDate']);
        $bounded = min($calculated,$cycle['endDate']);
        return max($earliest,$bounded);
    }

    public function payload(User $user): array
    {
        // Reconcile date-driven Competency automation on the server before every read.
        // The scheduler performs the same idempotent reconciliation even when nobody
        // has the Competency page open.
        $this->synchronizeAutomation();
        $actor = $this->actor($user);
        $allPeople = $this->personnel->active()->values()->all();
        if (!CompetencyDomain::governor($actor) && !CompetencyDomain::find($allPeople,$actor['personnelKey'])) abort(403,'An active personnel record is required.');
        return DB::transaction(function () use ($actor,$allPeople) {
            $revision = DB::table('competency_revisions')->where('id',1)->sharedLock()->value('revision');
            $state = $this->rawState();
            $people = $allPeople;
            if (!CompetencyDomain::governor($actor)) {
                $state['assessments'] = array_values(array_filter($state['assessments'],function ($a) use ($actor,$state,$allPeople) {
                    if ($a['personId'] === $actor['personnelKey']) return true;
                    $person = CompetencyDomain::find($allPeople,$a['personId']);
                    $profile = CompetencyDomain::find($state['roleProfiles'],$a['roleProfileId']);
                    return $a['assessorId'] === $actor['personnelKey'] && $person && $profile && CompetencyDomain::authorized($state,$allPeople,$a['assessorId'],$person,$profile);
                }));
                $ids = array_unique(array_merge([$actor['personnelKey']],array_column($state['assessments'],'personId')));
                $people = array_values(array_filter($allPeople,fn ($p)=>in_array($p['id'],$ids,true)));
                $state['assessorAuthorizations'] = array_values(array_filter($state['assessorAuthorizations'],fn ($r)=>$r['assessorId'] === $actor['personnelKey']));
                $state['recommendations'] = array_values(array_filter($state['recommendations'],fn ($r)=>in_array($r['personId'],$ids,true)));
                $state['acknowledgmentEvents'] = array_values(array_filter($state['acknowledgmentEvents'],fn ($r)=>in_array($r['personId'],$ids,true)));
            }
            $this->enrichDevelopment($state,$people);
            $today = now('Asia/Manila')->toDateString();
            $rows = $this->projection->people($state,$people,$today);
            $state['governanceAllowed'] = CompetencyDomain::governor($actor);
            $state['profileRows'] = $rows;
            $state['metrics'] = $this->projection->metrics($state,$rows,$today);
            if (CompetencyDomain::governor($actor)) {
                $state['auditLog'] = DB::table('competency_audits')->leftJoin('users','users.id','=','competency_audits.actor_id')->orderByDesc('competency_audits.id')->limit(500)->get(['competency_audits.*','users.name','users.personnel_key'])->map(fn ($a)=>['id'=>(string)$a->id,'action'=>$a->action,'detail'=>$a->action,'actorId'=>$a->personnel_key ?? '', 'actorName'=>$a->name ?? 'Framework initialization','createdAt'=>$a->created_at,'entityType'=>$this->entityType($a->entity_type),'entityId'=>$a->entity_id])->all();
            }
            return ['state'=>$state,'revision'=>(int)$revision,'personnel'=>$people,'permissions'=>['govern'=>CompetencyDomain::governor($actor)],'actor'=>$actor];
        });
    }

    public function mutate(User $user, int $revision, array $changes): array
    {
        DB::transaction(function () use ($user,$revision,$changes) {
            $lock = DB::table('competency_revisions')->where('id',1)->lockForUpdate()->first();
            if (!$lock || (int)$lock->revision !== $revision) throw new CompetencyViolation('Competency changed in another session. Reload the latest records before trying again.',409);
            $before = $this->rawState();
            $after = $this->domain->apply($before,$changes,$this->actor($user),$this->personnel->active()->values()->all(),now('Asia/Manila')->toIso8601String());
            $this->persist($before,$after,$user);
            DB::table('competency_revisions')->where('id',1)->increment('revision');
        },3);
        return $this->payload($user);
    }

    /** Must be called inside a transaction holding the revision lock. */
    public function persist(array $before, array $after, ?User $user): void
    {
        $users = User::query()->whereNotNull('personnel_key')->pluck('id','personnel_key');
        foreach (self::MODELS as $collection=>$model) foreach ($after[$collection] as $record) {
            $previous = CompetencyDomain::find($before[$collection],$record['id']);
            if ($previous == $record) continue;
            $attributes = ['payload'=>$record];
            if (in_array($collection,['competencies','roleProfiles'],true)) $attributes += ['lineage_id'=>$record['lineageId'],'version'=>$record['version'],'status'=>$record['status']];
            if (in_array($collection,['cycles','assessments','recommendations'],true)) $attributes['status'] = $record['status'];
            if ($collection === 'assessorAuthorizations') $attributes += ['assessor_id'=>$users[$record['assessorId']],'active'=>$record['active']];
            if ($collection === 'assessments') $attributes += ['person_id'=>$users[$record['personId']],'assessor_id'=>$users[$record['assessorId']],'role_profile_id'=>$record['roleProfileId'],'cycle_id'=>$record['cycleId'],'official_context'=>$record['status'] === 'Cancelled' ? null : hash('sha256',$record['personId'].'::'.$record['cycleId'])];
            if ($collection === 'recommendations') $attributes += ['person_id'=>$users[$record['personId']],'source_assessment_id'=>$record['sourceAssessmentId'],'competency_id'=>$record['competencyId']];
            if ($collection === 'acknowledgmentEvents') $attributes += ['person_id'=>$users[$record['personId']],'assessment_id'=>$record['assessmentId'],'finalized_version'=>$record['finalizedVersion']];
            $model::query()->updateOrCreate(['id'=>$record['id']],$attributes);
            if ($collection === 'assessments') foreach ($record['finalizedSnapshots'] as $snapshot) {
                if (DB::table('competency_finalizations')->where('assessment_id',$record['id'])->where('version',$snapshot['version'])->exists()) continue;
                if (!$user) throw new CompetencyViolation('Finalization must identify the validating actor.');
                DB::table('competency_finalizations')->insert(['assessment_id'=>$record['id'],'version'=>$snapshot['version'],'finalized_by'=>$user->id,'finalized_at'=>$snapshot['finalizedAt'],'payload'=>json_encode($snapshot,JSON_THROW_ON_ERROR)]);
            }
            if ($collection === 'recommendations' && !$previous && $user) $this->dispatchRecommendation($record,$after,$user);
            DB::table('competency_audits')->insert(['actor_id'=>$user?->id,'entity_type'=>$collection,'entity_id'=>$record['id'],'action'=>($previous ? 'Updated ' : 'Created ').$this->entityType($collection).(isset($record['status']) ? ': '.$record['status'] : ''),'before'=>$previous ? json_encode($previous,JSON_THROW_ON_ERROR) : null,'after'=>json_encode($record,JSON_THROW_ON_ERROR),'created_at'=>now()]);
        }
    }

    private function dispatchRecommendation(array $r, array $state, User $actor): void
    {
        $source = CompetencyDomain::find($state['assessments'],$r['sourceAssessmentId']);
        $snapshot = current(array_filter($source['finalizedSnapshots'],fn ($s)=>$s['version'] === $r['sourceAssessmentVersion']));
        $requirement = current(array_filter($snapshot['profile']['requirements'],fn ($q)=>$q['competencyId'] === $r['competencyId']));
        $competency = $requirement['competency'] ?? CompetencyDomain::find($state['competencies'],$r['competencyId']);
        if ($r['type'] === 'Learning') {
            app(LearningRequestService::class)->receive($actor,['sourceRecommendationId'=>$r['id'],'personnelKey'=>$r['personId'],'sourceAssessmentId'=>$source['id'],'sourceAssessmentVersion'=>$snapshot['version'],'competencyId'=>$r['competencyId'],'competencyVersion'=>$competency['version'],'competencyName'=>$competency['name'],'requiredLevel'=>$r['sourceRequiredLevel'],'validatedLevel'=>$r['sourceValidatedLevel'],'title'=>$r['title'],'note'=>$r['note'],'targetReassessmentDate'=>$r['reassessmentDue'],'recommendedByName'=>$r['createdBy'],'requestedAt'=>$r['createdAt']]);
        } else {
            app(TrainingService::class)->receiveRecommendation($actor,['sourceRecommendationId'=>$r['id'],'sourceModule'=>'Competency','personnelKey'=>$r['personId'],'developmentNeed'=>$r['title'],'reason'=>$r['note'],'sourceSnapshot'=>['assessmentId'=>$source['id'],'assessmentVersion'=>$snapshot['version'],'competencyId'=>$r['competencyId'],'competencyVersion'=>$competency['version'],'requiredLevel'=>$r['sourceRequiredLevel'],'validatedLevel'=>$r['sourceValidatedLevel']]]);
        }
    }

    private function enrichDevelopment(array &$state, array $people): void
    {
        $learning = Schema::hasTable('learning_requests') ? DB::table('learning_requests')->whereIn('source_recommendation_id',array_column($state['recommendations'],'id'))->get()->keyBy('source_recommendation_id') : collect();
        $training = Schema::hasTable('training_recommendations') ? DB::table('training_recommendations')->whereIn('source_recommendation_id',array_column($state['recommendations'],'id'))->get()->keyBy('source_recommendation_id') : collect();
        foreach ($state['recommendations'] as &$r) {
            $linked = $r['type'] === 'Learning' ? $learning->get($r['id']) : $training->get($r['id']);
            $r['integration'] = ['recordId'=>$linked?->id,'status'=>$linked?->status ?? 'Awaiting receipt','completedAt'=>null];
            if ($r['type'] === 'Learning' && ($linked->assignment_id ?? null)) $r['integration']['completedAt'] = DB::table('learning_completions')->where('assignment_id',$linked->assignment_id)->value('completed_at');
            if ($r['type'] === 'Training' && ($linked->linked_enrollment_id ?? null)) $r['integration']['completedAt'] = DB::table('training_completions')->where('enrollment_id',$linked->linked_enrollment_id)->where('status','Passed')->value('finalized_at');
            $person = CompetencyDomain::find($people,$r['personId']);
            $profile = $person ? CompetencyDomain::resolveProfile($state,$person,now('Asia/Manila')->toDateString()) : null;
            $q = current(array_filter($profile['requirements'] ?? [],fn ($q)=>$q['competencyId'] === $r['competencyId']));
            $competency = CompetencyDomain::find($state['competencies'],$r['competencyId']);
            $interval = $q['reassessmentIntervalMonths'] ?? $competency['reassessmentIntervalMonths'] ?? null;
            if ($r['integration']['completedAt'] && $interval) {
                $r['reassessmentDue'] = CarbonImmutable::parse($r['integration']['completedAt'],'Asia/Manila')
                    ->addMonthsNoOverflow((int)$interval)
                    ->toDateString();
            } else {
                $r['reassessmentDue'] = null;
            }
            $latest = CompetencyProjection::latest($state,$r['personId'],$r['competencyId']);
            $gap = $latest && $q ? max($q['requiredLevel']-$latest['level'],0) : null;
            $r['outcome'] = $r['status'] !== 'Reassessed' ? ($r['integration']['completedAt'] ? 'Reassessment Required' : 'Development Open') : ($gap === null ? 'Requirements Changed' : ($gap === 0 ? 'Gap Resolved' : ($gap < $r['sourceRequiredLevel']-$r['sourceValidatedLevel'] ? 'Gap Reduced' : 'Gap Still Open')));
        }
        unset($r);
        $personKeys = array_column($people,'id','databaseId');
        $state['developmentEvidence'] = [];
        if (Schema::hasTable('learning_completions')) foreach (DB::table('learning_completions as c')->join('learning_course_versions as v','v.id','=','c.course_version_id')->join('learning_course_competencies as m','m.course_version_id','=','v.id')->whereIn('c.learner_id',array_keys($personKeys))->get(['c.id','c.learner_id','c.completed_at','v.title','m.competency_id']) as $e) {
            $state['developmentEvidence'][] = ['id'=>'learning-'.$e->id.'-'.$e->competency_id,'personId'=>$personKeys[$e->learner_id],'competencyId'=>$e->competency_id,'type'=>'Learning','title'=>$e->title,'completedAt'=>$e->completed_at,'reference'=>'Learning completion '.$e->id];
        }
        if (Schema::hasTable('training_completions')) foreach (DB::table('training_completions as c')->join('training_enrollments as e','e.id','=','c.enrollment_id')->join('training_programs as p','p.id','=','e.program_id')->join('training_program_competencies as m','m.program_id','=','p.id')->where('c.status','Passed')->whereIn('e.participant_id',array_keys($personKeys))->get(['c.id','e.participant_id','c.finalized_at','p.title','m.competency_id']) as $e) {
            $state['developmentEvidence'][] = ['id'=>'training-'.$e->id.'-'.$e->competency_id,'personId'=>$personKeys[$e->participant_id],'competencyId'=>$e->competency_id,'type'=>'Training','title'=>$e->title,'completedAt'=>$e->finalized_at,'reference'=>'Training completion '.$e->id];
        }
        $state['learningReferences'] = Schema::hasTable('learning_course_competencies') ? DB::table('learning_course_competencies as m')->join('learning_course_versions as v','v.id','=','m.course_version_id')->where('v.status','Published')->get(['m.competency_id as competencyId','m.target_level as targetLevel','v.course_id as courseId','v.id as versionId','v.title'])->map(fn ($r)=>(array)$r)->all() : [];
        $state['trainingReferences'] = Schema::hasTable('training_program_competencies') ? DB::table('training_program_competencies as m')->join('training_programs as p','p.id','=','m.program_id')->where('p.status','Active')->get(['m.competency_id as competencyId','m.target_level as targetLevel','p.id as programId','p.title'])->map(fn ($r)=>(array)$r)->all() : [];
    }

    private function actor(User $user): array { return ['databaseId'=>$user->id,'personnelKey'=>$user->personnel_key ?? '', 'name'=>$user->name,'role'=>$user->role->value]; }
    private function entityType(string $collection): string { return ['competencies'=>'Competency','roleProfiles'=>'Role Profile','cycles'=>'Cycle','assessorAuthorizations'=>'Assessor Authorization','assessments'=>'Assessment','recommendations'=>'Development','acknowledgmentEvents'=>'Assessment'][$collection] ?? $collection; }
}
