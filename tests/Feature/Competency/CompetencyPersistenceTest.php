<?php

namespace Tests\Feature\Competency;

use App\Models\User;
use App\Services\Competency\{CompetencyDomain, CompetencyService, CompetencyViolation};
use App\Services\Learning\LearningCatalogService;
use App\Services\Personnel\CanonicalPersonnelService;
use Database\Seeders\{CanonicalPersonnelSeeder, CompetencyFrameworkSeeder, CompetencyShowcaseSeeder};
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CompetencyPersistenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-09-09T10:00:00+08:00');
        // A new isolated in-memory database per test. No reset command and no development DB access.
        config(['database.default'=>'sqlite','database.connections.sqlite.database'=>':memory:','database.connections.sqlite.foreign_key_constraints'=>true]);
        DB::purge('sqlite');
        foreach ([
            '0001_01_01_000000_create_users_table.php',
            '2026_08_10_000100_add_performance_profile_to_users_table.php',
            '2026_08_12_000300_create_learning_management_tables.php',
            '2026_08_13_000400_strengthen_learning_integrity.php',
            '2026_08_21_001000_create_training_management_tables.php',
            '2026_08_22_005000_add_profile_archive_and_security_governance.php',
            '2026_08_23_006000_add_pnd_access_governance_to_users.php',
            '2026_09_08_230000_create_competency_management_tables.php',
        ] as $file) (require database_path('migrations/'.$file))->up();
        $this->seedCompetency([CanonicalPersonnelSeeder::class,CompetencyFrameworkSeeder::class]);
    }
    protected function tearDown(): void { Carbon::setTestNow(); DB::disconnect('sqlite'); parent::tearDown(); }
    private function user(string $key = 'user-4'): User { return User::query()->where('personnel_key',$key)->firstOrFail(); }
    private function seedCompetency(string|array $classes): void
    {
        foreach ((array)$classes as $class) app($class)->setContainer(app())->__invoke();
    }
    private function service(): CompetencyService { return app(CompetencyService::class); }

    public function test_canonical_personnel_and_governed_coverage_are_complete_without_creating_people(): void
    {
        $payload = $this->service()->payload($this->user());
        $this->assertCount(count(config('personnel')),$payload['personnel']);
        $this->assertSame(count(config('personnel')),$payload['state']['metrics']['roleProfileCoverage']);
        $this->assertSame(0,$payload['state']['metrics']['activeValidatedGaps']);
        $this->assertSame(count(config('personnel')),$payload['state']['metrics']['notAssessedPersonnel']);
        $this->assertSame(28,DB::table('competency_definitions')->count());
        $this->assertSame(34,DB::table('competency_role_profiles')->count());
        foreach ($payload['state']['profileRows'] as $row) $this->assertStringContainsString($row['person']['position'],$row['resolutionReason']);
        $this->seedCompetency(CompetencyFrameworkSeeder::class);
        $this->assertSame(34,DB::table('competency_role_profiles')->count());
        $this->assertSame(count(config('personnel')),User::query()->count());
    }

    public function test_showcase_persists_links_and_is_idempotent(): void
    {
        $this->seedCompetency(CompetencyShowcaseSeeder::class);
        $first = $this->service()->payload($this->user());
        $this->assertSame(17,$first['state']['metrics']['finalizedAssessments']);
        $this->assertSame(8,$first['state']['metrics']['pendingAssessments']);
        $this->assertSame(8,$first['state']['metrics']['activeValidatedGaps']);
        $this->assertSame(0,$first['state']['metrics']['reassessmentsDue']);
        foreach ($first['state']['recommendations'] as $recommendation) {
            $stored = json_decode((string) DB::table('competency_recommendations')->where('id',$recommendation['id'])->value('payload'), true, 512, JSON_THROW_ON_ERROR);
            $this->assertNull($stored['reassessmentDue'] ?? null);
        }
        $history = CompetencyDomain::find($first['state']['recommendations'],'competency-showcase-history-development');
        $this->assertSame('Reassessed',$history['status']);
        $this->assertSame('Gap Resolved',$history['outcome']);
        $this->assertSame(4,DB::table('learning_requests')->count());
        $this->assertSame(5,DB::table('training_recommendations')->count());
        $this->seedCompetency(CompetencyShowcaseSeeder::class);
        $again = $this->service()->payload($this->user());
        $this->assertSame($first['revision'],$again['revision']);
        $this->assertSame($first['state']['metrics'],$again['state']['metrics']);
        $this->assertSame(17,DB::table('competency_finalizations')->count());
        $this->assertSame(count(config('personnel')),User::query()->count());
    }

    public function test_ordinary_personnel_visibility_and_governance_rejection(): void
    {
        $this->seedCompetency(CompetencyShowcaseSeeder::class);
        $person = $this->user('user-5');
        $payload = $this->service()->payload($person);
        $this->assertSame(['user-5'],array_column($payload['personnel'],'id'));
        foreach ($payload['state']['assessments'] as $a) $this->assertSame('user-5',$a['personId']);
        $this->assertFalse($payload['permissions']['govern']);
        $cycle = $payload['state']['cycles'][0]; $cycle['name'] = 'Unauthorized change';
        try { $this->service()->mutate($person,$payload['revision'],[['collection'=>'cycles','record'=>$cycle]]); $this->fail('Mutation was accepted.'); }
        catch (CompetencyViolation $error) { $this->assertSame(403,$error->status); }
        $this->assertNotSame('Unauthorized change',$this->service()->rawState()['cycles'][0]['name']);
    }

    public function test_stale_revision_cannot_overwrite_other_users_changes(): void
    {
        $initial = $this->service()->payload($this->user());
        $draft = $initial['state']['competencies'][0]; $draft['id'] = 'new-draft'; $draft['status'] = 'Draft'; $draft['draftSourceId'] = null; $draft['code'] = 'CMP-TEST';
        $saved = $this->service()->mutate($this->user(),$initial['revision'],[['collection'=>'competencies','record'=>$draft]]);
        $this->assertGreaterThan($initial['revision'],$saved['revision']);
        try { $this->service()->mutate($this->user(),$initial['revision'],[['collection'=>'competencies','record'=>$draft]]); $this->fail('Stale write accepted.'); }
        catch (CompetencyViolation $error) { $this->assertSame(409,$error->status); }
        $this->assertSame(1,DB::table('competency_definitions')->where('id','new-draft')->count());
    }

    public function test_learning_catalog_reads_persistent_competency_versions(): void
    {
        $catalog = app(LearningCatalogService::class);
        $this->assertCount(28,$catalog->competencies());
        $this->assertCount(34,$catalog->roleProfiles());
        $this->assertTrue($catalog->userMatchesProfiles($this->user('user-gen-3'),['profile-finance-analyst-finance']));
        $this->assertFalse($catalog->userMatchesProfiles($this->user('user-gen-3'),['profile-safety-officer']));
    }

    public function test_failed_development_delivery_rolls_back_the_whole_competency_mutation(): void
    {
        $this->seedCompetency(CompetencyShowcaseSeeder::class);
        $payload = $this->service()->payload($this->user());
        $source = $payload['state']['recommendations'][0];
        $source['id'] = 'must-rollback'; $source['status'] = 'Recommended'; $source['title'] = 'Delivery must be atomic';
        DB::statement('DROP TABLE learning_requests');
        $source['type'] = 'Learning';
        try { $this->service()->mutate($this->user(),$payload['revision'],[['collection'=>'recommendations','record'=>$source]]); $this->fail('Delivery unexpectedly succeeded.'); }
        catch (\Illuminate\Database\QueryException $error) { $this->assertStringContainsString('learning_requests',$error->getMessage()); }
        $this->assertSame(0,DB::table('competency_recommendations')->where('id','must-rollback')->count());
        $this->assertSame($payload['revision'],(int)DB::table('competency_revisions')->value('revision'));
    }
    public function test_completed_learning_and_training_are_evidence_only_and_do_not_change_proficiency(): void
    {
        $this->seedCompetency(CompetencyShowcaseSeeder::class);
        $before = $this->service()->payload($this->user());
        $actor = $this->user()->id;
        $learning = collect($before['state']['recommendations'])->first(fn ($r)=>$r['type'] === 'Learning');
        $training = collect($before['state']['recommendations'])->first(fn ($r)=>$r['type'] === 'Training' && $r['status'] !== 'Reassessed');
        $id = fn ()=>(string)\Illuminate\Support\Str::uuid();
        $course=$id(); $version=$id(); $assignment=$id();
        DB::table('learning_courses')->insert(['id'=>$course,'code'=>'COMP-EVIDENCE-TEST','owner_id'=>$actor]);
        DB::table('learning_course_versions')->insert(['id'=>$version,'course_id'=>$course,'version_number'=>1,'status'=>'Published','title'=>'Mapped Learning evidence','description'=>'Competency integration test','category'=>'Technical','created_by'=>$actor,'updated_by'=>$actor]);
        DB::table('learning_courses')->where('id',$course)->update(['current_published_version_id'=>$version]);
        DB::table('learning_course_competencies')->insert(['course_version_id'=>$version,'competency_id'=>$learning['competencyId'],'competency_version'=>1,'competency_code'=>'TEST','competency_name'=>'Mapped requirement','target_level'=>5]);
        DB::table('learning_assignments')->insert(['id'=>$assignment,'learner_id'=>$this->user($learning['personId'])->id,'course_id'=>$course,'course_version_id'=>$version,'source'=>'Competency','assigned_by'=>$actor,'assigned_at'=>now(),'status'=>'Completed','progress_percent'=>100]);
        DB::table('learning_requests')->where('source_recommendation_id',$learning['id'])->update(['assignment_id'=>$assignment,'status'=>'Assigned']);
        DB::table('learning_completions')->insert(['id'=>$id(),'assignment_id'=>$assignment,'learner_id'=>$this->user($learning['personId'])->id,'course_id'=>$course,'course_version_id'=>$version,'completed_at'=>now(),'rules_satisfied'=>'{}','completion_basis'=>'All required learning completed']);
        $program=$id(); $enrollment=$id();
        DB::table('training_programs')->insert(['id'=>$program,'code'=>'COMP-TRAINING-TEST','title'=>'Mapped Training evidence','description'=>'Competency integration test','category'=>'Technical','delivery_type'=>'Workshop','status'=>'Active','owner_id'=>$actor,'created_by'=>$actor,'updated_by'=>$actor]);
        DB::table('training_program_competencies')->insert(['program_id'=>$program,'competency_id'=>$training['competencyId'],'competency_version'=>1,'competency_code'=>'TEST','competency_name'=>'Mapped requirement','target_level'=>5]);
        DB::table('training_enrollments')->insert(['id'=>$enrollment,'program_id'=>$program,'participant_id'=>$this->user($training['personId'])->id,'status'=>'Completed','personnel_snapshot'=>'{}','assigned_by'=>$actor,'assigned_at'=>now()]);
        DB::table('training_recommendations')->where('source_recommendation_id',$training['id'])->update(['linked_program_id'=>$program,'linked_enrollment_id'=>$enrollment,'status'=>'Assigned']);
        DB::table('training_completions')->insert(['id'=>$id(),'enrollment_id'=>$enrollment,'status'=>'Passed','attendance_rate'=>100,'attendance_snapshot'=>'{}','assessment_snapshot'=>'{}','program_snapshot'=>'{}','personnel_snapshot'=>'{}','finalized_by'=>$actor,'finalized_at'=>now()]);
        $after = $this->service()->payload($this->user());
        $this->assertSame($before['state']['metrics'],$after['state']['metrics']);
        $this->assertSame($before['state']['assessments'],$after['state']['assessments']);
        foreach ([$learning,$training] as $source) {
            $r=CompetencyDomain::find($after['state']['recommendations'],$source['id']);
            $this->assertNotNull($r['integration']['completedAt']);
            $this->assertNotNull($r['reassessmentDue']);
            $this->assertGreaterThan(substr($r['integration']['completedAt'],0,10),$r['reassessmentDue']);
            $stored = json_decode((string) DB::table('competency_recommendations')->where('id',$source['id'])->value('payload'), true, 512, JSON_THROW_ON_ERROR);
            $this->assertNull($stored['reassessmentDue'] ?? null);
            $this->assertSame('Reassessment Required',$r['outcome']);
        }
        $this->assertCount(2,$after['state']['developmentEvidence']);
        $this->assertCount(1,$after['state']['learningReferences']);
        $this->assertCount(1,$after['state']['trainingReferences']);
        $self = $this->service()->payload($this->user($learning['personId']));
        foreach ($self['state']['developmentEvidence'] as $e) $this->assertContains($e['personId'],array_column($self['personnel'],'id'));
    }

    public function test_server_owned_automation_activates_cycle_and_provisions_assignment_without_browser_state(): void
    {
        $service = $this->service();
        $governor = $this->user();
        $people = app(CanonicalPersonnelService::class)->active()->values()->all();
        $state = $service->rawState();
        $governorPerson = CompetencyDomain::find($people,$governor->personnel_key);
        $this->assertNotNull($governorPerson);

        $target = null;
        $profile = null;
        foreach ($people as $person) {
            if ($person['id'] === $governor->personnel_key) continue;
            $candidate = CompetencyDomain::resolveProfile($state,$person,'2026-09-09');
            if (!$candidate) continue;
            $target = $person;
            $profile = $candidate;
            break;
        }
        $this->assertNotNull($target);
        $this->assertNotNull($profile);

        $payload = $service->payload($governor);
        $authorization = [
            'id'=>'server-automation-authority',
            'assessorId'=>$governor->personnel_key,
            'scope'=>'Department',
            'scopeValue'=>$target['department'],
            'active'=>true,
            'reason'=>'Feature-test authority for server-owned Competency automation.',
        ];
        $saved = $service->mutate($governor,$payload['revision'],[['collection'=>'assessorAuthorizations','record'=>$authorization]]);

        $cycle = [
            'id'=>'server-automation-cycle',
            'name'=>'Server-owned Competency automation test',
            'type'=>'Periodic Assessment',
            'startDate'=>'2026-09-09',
            'endDate'=>'2026-09-30',
            'appliesTo'=>$target['personType'],
            'departments'=>[$target['department']],
            'positions'=>[$target['position']],
            'roleProfileIds'=>[$profile['id']],
            'assignmentMethod'=>'Role-based Assessor',
            'roleBasedAssessorScope'=>'Department',
            'roleBasedAssessorPositions'=>[$governorPerson['position']],
            'requireSelfAssessment'=>false,
            'requireSupportingEvidence'=>true,
            'requireHrValidation'=>true,
            'requireAcknowledgment'=>true,
            'dueDaysAfterAssignment'=>20,
            'reassessmentRule'=>'Reassess validated gaps after governed development.',
            'autoAssign'=>true,
            'status'=>'Scheduled',
            'cancellationReason'=>null,
        ];
        $after = $service->mutate($governor,$saved['revision'],[['collection'=>'cycles','record'=>$cycle]]);
        $storedCycle = CompetencyDomain::find($after['state']['cycles'],$cycle['id']);
        $this->assertSame('Active',$storedCycle['status']);

        $assessment = collect($after['state']['assessments'])->first(fn ($item)=>$item['cycleId'] === $cycle['id'] && $item['personId'] === $target['id']);
        $this->assertNotNull($assessment);
        $this->assertSame('Pending',$assessment['status']);
        $this->assertSame('Full Role Profile',$assessment['scope']);
        $this->assertSame($governor->personnel_key,$assessment['assessorId']);
        $this->assertLessThanOrEqual($cycle['endDate'],$assessment['dueDate']);
        $this->assertSame(array_column($profile['requirements'],'competencyId'),$assessment['targetCompetencyIds']);

        $again = $service->synchronizeAutomation();
        $this->assertSame(0,$again['activated']);
        $this->assertSame(0,$again['assignmentsCreated']);
        $this->assertSame(1,DB::table('competency_assessments')->where('cycle_id',$cycle['id'])->where('person_id',$this->user($target['id'])->id)->count());
    }

    public function test_competency_http_contract_checks_visibility_validation_and_governance(): void
    {
        config(['app.key'=>'base64:'.base64_encode(str_repeat('c',32))]);
        $this->getJson('/competency/api/state')->assertUnauthorized();
        $this->actingAs($this->user('user-5'))->getJson('/competency/api/state')->assertOk()->assertJsonPath('permissions.govern',false)->assertJsonCount(1,'personnel');
        $revision = (int)DB::table('competency_revisions')->value('revision');
        $draft = $this->service()->rawState()['competencies'][0]; $draft['id']='http-draft'; $draft['status']='Draft'; $draft['draftSourceId']=null;
        $this->postJson('/competency/api/changes',['revision'=>$revision,'changes'=>[['collection'=>'competencies','record'=>$draft]]])->assertForbidden();
        $this->actingAs($this->user())->postJson('/competency/api/changes',['revision'=>$revision,'changes'=>[['collection'=>'arbitrary','record'=>$draft]]])->assertUnprocessable();
        $saved = $this->postJson('/competency/api/changes',['revision'=>$revision,'changes'=>[['collection'=>'competencies','record'=>$draft]]]);
        $this->assertSame(200,$saved->status(),$saved->getContent());
        $saved->assertJsonPath('revision',$revision+1);
        $this->getJson('/competency/api/state')->assertOk()->assertJsonPath('revision',$revision+1);
    }

}
