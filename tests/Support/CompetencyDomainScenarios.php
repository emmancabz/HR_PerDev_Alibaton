<?php

use App\Services\Competency\{CompetencyDomain, CompetencyProjection, CompetencyViolation};

/** Also executable without Laravel to validate the actual domain engine. */
function runCompetencyDomainScenarios(string $root): array
{
    $domain = new CompetencyDomain();
    $projection = new CompetencyProjection();
    $catalog = json_decode(file_get_contents($root.'/database/seeders/data/competency/framework.json'),true,512,JSON_THROW_ON_ERROR);
    $state = array_merge(CompetencyDomain::emptyState(),$catalog);
    $now = '2026-09-08T10:00:00+08:00';
    $people = [
        ['id'=>'user-5','fullName'=>'Nina Soriano','position'=>'Finance Staff','department'=>'Finance','personType'=>'Employee','employmentStatus'=>'Employee','accessRole'=>'User','managerPersonnelKey'=>'user-gen-11'],
        ['id'=>'user-gen-11','fullName'=>'Valeria Herrera','position'=>'Finance Manager','department'=>'Finance','personType'=>'Employee','employmentStatus'=>'Employee','accessRole'=>'User','evaluatorCapable'=>true],
        ['id'=>'user-4','fullName'=>'Celso Ramirez','position'=>'HR Business Partner','department'=>'Human Resources','personType'=>'Employee','employmentStatus'=>'Employee','accessRole'=>'HR','evaluatorCapable'=>true],
    ];
    $hr = ['databaseId'=>4,'personnelKey'=>'user-4','name'=>'Celso Ramirez','role'=>'hr'];
    $manager = ['databaseId'=>11,'personnelKey'=>'user-gen-11','name'=>'Valeria Herrera','role'=>'user'];
    $subject = ['databaseId'=>5,'personnelKey'=>'user-5','name'=>'Nina Soriano','role'=>'user'];
    $checks = [];
    $assert = function (bool $value,string $name) use (&$checks) { if (!$value) throw new RuntimeException('FAILED: '.$name); $checks[] = $name; };
    $reject = function (callable $action,string $name,int $status=422) use ($assert) { try { $action(); } catch (CompetencyViolation $e) { $assert($e->status === $status,$name); return; } throw new RuntimeException('Expected rejection: '.$name); };
    $change = function (string $collection,array $record,array $actor) use (&$state,$domain,$people,&$now) { $state = $domain->apply($state,[['collection'=>$collection,'record'=>$record]],$actor,$people,$now); };
    $personProfile = CompetencyDomain::resolveProfile($state,$people[0],'2026-09-08');
    $assert($personProfile['id'] === 'profile-finance-staff','Exact organizational role resolves');
    $alias = $people[0]; $alias['position'] = ' finance STAFF '; $alias['personType'] = 'Employees';
    $assert(CompetencyDomain::resolveProfile($state,$alias,'2026-09-08')['id'] === $personProfile['id'],'Known aliases and title whitespace normalize centrally');
    $missing = $people[0]; $missing['position'] = 'Unmapped Specialist';
    $assert(CompetencyDomain::resolveProfile($state,$missing,'2026-09-08') === null,'Unknown roles are not given catch-all requirements');
    $rows = $projection->people($state,$people,'2026-09-08');
    $assert($rows[0]['requirements'][0]['currentLevel'] === null && $rows[0]['requirements'][0]['gap'] === null,'Not Assessed is null, never zero or an invented gap');
    $cycle = ['id'=>'cycle-test','name'=>'September review','type'=>'Periodic Assessment','startDate'=>'2026-09-01','endDate'=>'2026-09-30','appliesTo'=>'Both','departments'=>[],'positions'=>[],'roleProfileIds'=>[$personProfile['id']],'assignmentMethod'=>'Reporting Relationship','roleBasedAssessorScope'=>null,'roleBasedAssessorPositions'=>[],'requireSelfAssessment'=>false,'requireSupportingEvidence'=>true,'requireHrValidation'=>true,'requireAcknowledgment'=>true,'dueDaysAfterAssignment'=>20,'reassessmentRule'=>'Reassess validated gaps','autoAssign'=>true,'status'=>'Scheduled'];
    $reject(fn ()=>$domain->apply($state,[['collection'=>'cycles','record'=>$cycle]],$subject,$people,$now),'User cannot govern cycles',403);
    $change('cycles',$cycle,$hr);
    $cycle = CompetencyDomain::find($state['cycles'],'cycle-test'); $cycle['status'] = 'Active'; $change('cycles',$cycle,$hr);
    $assignment = ['id'=>'assessment-test','personId'=>'user-5','cycleId'=>'cycle-test','roleProfileId'=>$personProfile['id'],'assessorId'=>'user-gen-11','dueDate'=>'2026-09-30','status'=>'Pending','scope'=>'Full Role Profile','targetCompetencyIds'=>array_column($personProfile['requirements'],'competencyId'),'sourceRecommendationIds'=>[]];
    $forged = $assignment; $forged['assessorId'] = 'user-5';
    $reject(fn ()=>$domain->apply($state,[['collection'=>'assessments','record'=>$forged]],$hr,$people,$now),'Self-assessor assignment rejected',403);
    $change('assessments',$assignment,$hr);
    $duplicate = $assignment; $duplicate['id'] = 'duplicate';
    $reject(fn ()=>$domain->apply($state,[['collection'=>'assessments','record'=>$duplicate]],$hr,$people,$now),'Duplicate official person/cycle assignment rejected');
    $a = CompetencyDomain::find($state['assessments'],'assessment-test');
    $assert($a['roleProfileSnapshot']['version'] === 1 && count($a['ratings']) === count($personProfile['requirements']),'Assignment snapshots requirements and version server-side');
    $a['ratings'][0]['selectedLevel'] = 0;
    $reject(fn ()=>$domain->apply($state,[['collection'=>'assessments','record'=>$a]],$manager,$people,$now),'Proficiency level zero rejected');
    $a['ratings'][0]['selectedLevel'] = 2;
    $reject(fn ()=>$domain->apply($state,[['collection'=>'assessments','record'=>$a]],$subject,$people,$now),'Employee cannot set official rating',403);
    $reject(fn ()=>$domain->apply($state,[['collection'=>'assessments','record'=>$a]],$hr,$people,$now),'Governor cannot silently replace the assigned assessor',403);
    foreach ($a['ratings'] as &$r) {
        $q = current(array_filter($a['roleProfileSnapshot']['requirements'],fn ($q)=>$q['competencyId'] === $r['competencyId']));
        $r['selectedLevel'] = $r['competencyId'] === $a['ratings'][0]['competencyId'] ? 2 : $q['requiredLevel'];
        $r['assessorComments'] = 'Verified work sample demonstrates the selected behavior.';
        $r['evidence'] = [['id'=>'evidence-'.$r['competencyId'],'type'=>$q['competency']['requiredEvidenceTypes'][0],'title'=>'Verified work sample','reference'=>'Internal review record','description'=>'Reviewed by assigned assessor','verificationState'=>$q['critical'] ? 'Verified' : 'Reviewed']];
    }
    unset($r);
    $a['status'] = 'In Progress'; $change('assessments',$a,$manager);
    $assert(CompetencyProjection::latest($state,'user-5',$a['ratings'][0]['competencyId']) === null,'Draft does not establish official proficiency');
    $a = CompetencyDomain::find($state['assessments'],'assessment-test'); $a['status'] = 'Finalized';
    $reject(fn ()=>$domain->apply($state,[['collection'=>'assessments','record'=>$a]],$manager,$people,$now),'Assessor cannot skip required HR validation');
    $a['status'] = 'Pending Validation'; $change('assessments',$a,$manager);
    $assert(CompetencyProjection::latest($state,'user-5',$a['ratings'][0]['competencyId']) === null,'Submitted results remain unofficial');
    $a = CompetencyDomain::find($state['assessments'],'assessment-test'); $a['status'] = 'Finalized'; $a['hrValidationNotes'] = 'Validated against the required behaviors and reviewed evidence.';
    $change('assessments',$a,$hr);
    $final = CompetencyDomain::find($state['assessments'],'assessment-test');
    $rows = $projection->people($state,$people,'2026-09-08');
    $assert($rows[0]['requirements'][0]['currentLevel'] === 2 && $rows[0]['requirements'][0]['gap'] === 1,'Finalization establishes validated level and correct gap');
    $assert($final['finalizedSnapshot']['finalizedBy'] === 'Celso Ramirez','Finalization actor is assigned on the server');
    $forged = $final; $forged['finalizedSnapshots'][0]['ratings'][0]['selectedLevel'] = 5; $forged['finalizedSnapshot']['ratings'][0]['selectedLevel'] = 5;
    $change('assessments',$forged,$hr);
    $assert(CompetencyProjection::latest($state,'user-5',$a['ratings'][0]['competencyId'])['level'] === 2,'Client snapshot forgery cannot overwrite immutable results');
    $ack = ['id'=>'ack-1','assessmentId'=>'assessment-test','finalizedVersion'=>1];
    $reject(fn ()=>$domain->apply($state,[['collection'=>'acknowledgmentEvents','record'=>$ack]],$manager,$people,$now),'Another employee cannot acknowledge a result',403);
    $change('acknowledgmentEvents',$ack,$subject);
    $assert($state['acknowledgmentEvents'][0]['personId'] === 'user-5','Employee acknowledgment is version linked');
    $r = ['id'=>'development-test','personId'=>'user-5','competencyId'=>$a['ratings'][0]['competencyId'],'sourceAssessmentId'=>'assessment-test','type'=>'Learning','title'=>'Relevant learning intervention','note'=>'Practice and provide new evidence for reassessment.','status'=>'Recommended','reassessmentDue'=>'2026-09-30'];
    $change('recommendations',$r,$hr);
    $assert(count($state['recommendations']) === 1,'A real validated gap permits development');
    $assert($state['recommendations'][0]['reassessmentDue'] === null,'Recommendation reassessment timing is system-owned instead of manually persisted');
    $fake = $r; $fake['id'] = 'no-gap'; $fake['competencyId'] = $a['ratings'][1]['competencyId'];
    $reject(fn ()=>$domain->apply($state,[['collection'=>'recommendations','record'=>$fake]],$hr,$people,$now),'Development without a validated gap is rejected');
    $r = CompetencyDomain::find($state['recommendations'],'development-test'); $r['status'] = 'Reassessment Requested'; $change('recommendations',$r,$hr);
    $reopen = CompetencyDomain::find($state['assessments'],'assessment-test'); $reopen['status'] = 'Returned for Revision'; $reopen['revisionHistory'][] = ['reason'=>'New verified development evidence requires reassessment.'];
    $change('assessments',$reopen,$hr);
    $assert(CompetencyProjection::latest($state,'user-5',$r['competencyId'])['level'] === 2,'Reopening preserves the last finalized official result');
    $cycle2 = $cycle; $cycle2['id'] = 'cycle-reassessment'; $cycle2['name'] = 'Post-training reassessment'; $cycle2['type'] = 'Post-Training Reassessment'; $cycle2['status'] = 'Scheduled'; $change('cycles',$cycle2,$hr);
    $cycle2 = CompetencyDomain::find($state['cycles'],'cycle-reassessment'); $cycle2['status'] = 'Active'; $change('cycles',$cycle2,$hr);
    $new = $assignment; $new['id'] = 'assessment-reassessment'; $new['cycleId'] = 'cycle-reassessment'; $new['revisionSourceAssessmentId'] = 'assessment-test'; $new['scope'] = 'Targeted Competencies'; $new['targetCompetencyIds'] = [$r['competencyId']]; $new['sourceRecommendationIds'] = ['development-test']; $change('assessments',$new,$hr);
    $a2 = CompetencyDomain::find($state['assessments'],'assessment-reassessment');
    $assert($a2['scope'] === 'Targeted Competencies' && count($a2['ratings']) === 1,'Post-training reassessment targets only the governed competency gap');
    $r = CompetencyDomain::find($state['recommendations'],'development-test'); $r['reassessmentAssessmentId'] = 'assessment-reassessment'; $change('recommendations',$r,$hr);
    $a2['ratings'][0] = $final['ratings'][0]; $a2['ratings'][0]['selectedLevel'] = 3; $a2['status'] = 'In Progress'; $change('assessments',$a2,$manager);
    $a2 = CompetencyDomain::find($state['assessments'],'assessment-reassessment'); $a2['status'] = 'Pending Validation'; $change('assessments',$a2,$manager);
    $now = '2026-09-09T10:00:00+08:00';
    $a2 = CompetencyDomain::find($state['assessments'],'assessment-reassessment'); $a2['status'] = 'Finalized'; $a2['hrValidationNotes'] = 'Improvement validated using new work evidence.'; $change('assessments',$a2,$hr);
    $rows = $projection->people($state,$people,'2026-09-09');
    $assert($rows[0]['requirements'][0]['gap'] === 0,'Reassessment can close a gap through validation');
    $assert(CompetencyDomain::find($state['recommendations'],'development-test')['status'] === 'Reassessed','Development follows the later finalized reassessment');
    $assert(CompetencyDomain::find($state['assessments'],'assessment-test')['finalizedSnapshots'][0]['ratings'][0]['selectedLevel'] === 2,'Previous assessment history remains unchanged after improvement');
    $profile = CompetencyDomain::find($state['roleProfiles'],$personProfile['id']);
    $invalidProfile = $profile;
    $invalidProfile['id'] = 'profile-invalid-context';
    $invalidProfile['draftSourceId'] = null;
    $invalidProfile['lineageId'] = 'profile-invalid-context';
    $invalidProfile['status'] = 'Draft';
    $invalidProfile['position'] = 'Imaginary Position';
    $invalidProfile['department'] = 'Finance';
    $reject(fn ()=>$domain->apply($state,[['collection'=>'roleProfiles','record'=>$invalidProfile]],$hr,$people,$now),'Role Profile identity must exist in the canonical workforce source');
    $bad = $profile; $bad['requirements'][0]['requiredLevel'] = 5;
    $reject(fn ()=>$domain->apply($state,[['collection'=>'roleProfiles','record'=>$bad]],$hr,$people,$now),'Published requirements cannot be edited in place');
    $draft = $profile; $draft['id'] = 'profile-finance-v2'; $draft['draftSourceId'] = $profile['id']; $draft['status'] = 'Draft'; $draft['requirements'][0]['requiredLevel'] = 4;
    $change('roleProfiles',$draft,$hr);
    $draft = CompetencyDomain::find($state['roleProfiles'],'profile-finance-v2'); $draft['status'] = 'Active'; $change('roleProfiles',$draft,$hr);
    $publishedProfile = CompetencyDomain::find($state['roleProfiles'],'profile-finance-v2');
    $publishedCompetency = CompetencyDomain::find($state['competencies'],$publishedProfile['requirements'][0]['competencyId']);
    $assert($publishedProfile['requirements'][0]['reassessmentIntervalMonths'] === $publishedCompetency['reassessmentIntervalMonths'],'Role Profile reassessment interval inherits from the governed Competency Library');
    $assert(CompetencyDomain::resolveProfile($state,$people[0],'2026-09-09')['version'] === 2,'Publishing activates a new governed version');
    $assert(CompetencyDomain::find($state['assessments'],'assessment-test')['roleProfileSnapshot']['requirements'][0]['requiredLevel'] === 3,'Role changes do not rewrite historical assessment requirements');
    $rows = $projection->people($state,$people,'2026-09-09');
    $assert($rows[0]['requirements'][0]['gap'] === 1,'Current gap recalculates against the newly published requirement');
    $metrics = $projection->metrics($state,$rows,'2026-09-09');
    $assert($metrics['activeValidatedGaps'] === array_sum(array_column($rows,'openGaps')),'Overview and People use the same gap projection');
    return ['passed'=>count($checks),'checks'=>$checks];
}
