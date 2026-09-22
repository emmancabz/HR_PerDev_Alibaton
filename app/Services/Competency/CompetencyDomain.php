<?php

namespace App\Services\Competency;

/** Governed transitions. Client projections, timestamps, actors and history are never authoritative. */
class CompetencyDomain
{
    public const COLLECTIONS = ['competencies', 'roleProfiles', 'cycles', 'assessorAuthorizations', 'assessments', 'recommendations', 'acknowledgmentEvents'];

    public static function emptyState(): array
    {
        return array_merge(['schemaVersion' => 4, 'activities' => [], 'auditLog' => []], array_fill_keys(self::COLLECTIONS, []));
    }

    public static function key(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(trim($value))), '-');
    }

    public static function personType(string $value): string
    {
        return ['Employees' => 'Employee', 'Trainees' => 'Trainee'][$value] ?? trim($value);
    }

    public static function find(array $rows, string $id): ?array
    {
        foreach ($rows as $row) if ($row['id'] === $id) return $row;
        return null;
    }

    public static function governor(array $actor): bool { return in_array($actor['role'], ['admin', 'hr'], true); }

    public static function resolveProfile(array $state, array $person, string $today): ?array
    {
        $matches = array_values(array_filter($state['roleProfiles'], fn ($p) => $p['status'] === 'Active'
            && $p['effectiveDate'] <= $today
            && self::key($p['position']) === self::key($person['position'])
            && self::key($p['department']) === self::key($person['department'])
            && ($p['appliesTo'] === 'Both' || self::personType($p['appliesTo']) === self::personType($person['personType']))));
        usort($matches, fn ($a, $b) => [$b['appliesTo'] !== 'Both', $b['effectiveDate'], $b['version']] <=> [$a['appliesTo'] !== 'Both', $a['effectiveDate'], $a['version']]);
        return $matches[0] ?? null;
    }

    public static function authorized(array $state, array $people, string $assessorId, array $person, array $profile): bool
    {
        $assessor = self::find($people, $assessorId);
        if (!$assessor || $assessorId === $person['id']) return false;
        if (($person['managerPersonnelKey'] ?? null) === $assessorId && ($assessor['evaluatorCapable'] ?? false)) return true;
        foreach ($state['assessorAuthorizations'] as $a) {
            if (!$a['active'] || $a['assessorId'] !== $assessorId) continue;
            $value = match ($a['scope']) {
                'Department' => $person['department'], 'Position' => $person['position'],
                'Role Profile' => $profile['id'], 'Specific Person' => $person['id'], default => null,
            };
            if ($value !== null && self::key($a['scopeValue']) === self::key($value)) return true;
        }
        return false;
    }

    public static function profileSnapshot(array $profile, array $state, ?array $targetCompetencyIds = null): array
    {
        $requirements = [];
        $targets = $targetCompetencyIds === null ? null : array_fill_keys($targetCompetencyIds, true);
        foreach ($profile['requirements'] as $r) {
            if ($targets !== null && !isset($targets[$r['competencyId']])) continue;
            $c = self::find($state['competencies'], $r['competencyId']);
            if (!$c) throw new CompetencyViolation('A role requirement references an unavailable definition.');
            $requirements[] = array_merge($r, ['competency' => array_intersect_key($c, array_flip(['id','code','name','category','definition','behavioralIndicators','assessmentMethods','requiredEvidenceTypes','reassessmentIntervalMonths','version']))]);
        }
        return array_merge(array_intersect_key($profile, array_flip(['name','position','department','appliesTo','version'])), ['profileId' => $profile['id'], 'requirements' => $requirements]);
    }

    public static function cycleSnapshot(array $cycle, array $state): array
    {
        $snapshot = array_diff_key($cycle, array_flip(['id','status','createdAt','createdBy','updatedAt','updatedBy','cancellationReason','cancelledAt']));
        $snapshot['cycleId'] = $cycle['id'];
        $snapshot['roleProfileVersions'] = [];
        foreach ($cycle['roleProfileIds'] as $id) {
            $profile = self::find($state['roleProfiles'], $id);
            if ($profile) $snapshot['roleProfileVersions'][] = ['profileId' => $id, 'version' => $profile['version']];
        }
        return $snapshot;
    }

    public function apply(array $state, array $changes, array $actor, array $people, string $now): array
    {
        $original = $state;
        $seen = [];
        foreach (self::COLLECTIONS as $collection) foreach ($changes as $change) {
            if (($change['collection'] ?? '') !== $collection) continue;
            $input = $change['record'];
            $id = $this->text($input, 'id', 160);
            $this->check(!isset($seen[$collection][$id]), 'A record may appear only once in one transaction.');
            $seen[$collection][$id] = true;
            $old = self::find($state[$collection], $id);
            if (!in_array($collection, ['assessments','acknowledgmentEvents'], true)) $this->check(self::governor($actor), 'This action requires Admin or HR governance.', 403);
            $record = match ($collection) {
                'competencies', 'roleProfiles' => $this->framework($collection, $input, $old, $state, $people, $actor, $now),
                'cycles' => $this->cycle($input, $old, $state, $actor, $now),
                'assessorAuthorizations' => $this->authority($input, $old, $state, $people, $actor, $now),
                'assessments' => $this->assessment($input, $old, $state, $actor, $people, $now),
                'recommendations' => $this->recommendation($input, $old, $state, $people, $actor, $now),
                'acknowledgmentEvents' => $this->acknowledgment($input, $old, $state, $actor, $now),
            };
            $state[$collection] = array_values(array_filter($state[$collection], fn ($r) => $r['id'] !== $id));
            $state[$collection][] = $record;
        }
        foreach ($changes as $change) $this->check(in_array($change['collection'] ?? '', self::COLLECTIONS, true), 'Unknown Competency record type.');
        foreach (['competencies','roleProfiles'] as $collection) {
            $active = [];
            foreach ($state[$collection] as $record) if ($record['status'] === 'Active') {
                $identity = $collection === 'competencies' ? self::key($record['code']) : implode(':', [self::key($record['position']),self::key($record['department']),self::personType($record['appliesTo'])]);
                $this->check(!isset($active[$identity]), 'Only one active version may apply to the same competency code or organizational role.');
                $active[$identity] = true;
            }
        }
        foreach ($original['competencies'] as $c) {
            $next = self::find($state['competencies'], $c['id']);
            if ($c['status'] !== 'Active' || $next['status'] !== 'Archived') continue;
            $successor = array_filter($state['competencies'], fn ($r) => $r['lineageId'] === $c['lineageId'] && $r['status'] === 'Active');
            foreach ($state['roleProfiles'] as $p) if ($p['status'] === 'Active' && !$successor) foreach ($p['requirements'] as $r) $this->check($r['competencyId'] !== $c['id'], 'Archive or revise active role requirements before archiving this competency.');
        }
        // A later formal result records reassessment even if the gap remains open or only reduces.
        foreach ($state['recommendations'] as &$r) {
            if ($r['status'] !== 'Reassessment Requested') continue;
            $latest = CompetencyProjection::latest($state, $r['personId'], $r['competencyId']);
            if (!$latest || $latest['assessment']['id'] === $r['sourceAssessmentId']) continue;
            if ($latest['snapshot']['finalizedAt'] < $r['createdAt']) continue;
            $r['status'] = 'Reassessed';
            $r['reassessedAt'] = $latest['snapshot']['finalizedAt'];
            $r['reassessmentAssessmentId'] = $latest['assessment']['id'];
        }
        unset($r);
        return $state;
    }

    private function framework(string $collection, array $input, ?array $old, array &$state, array $people, array $actor, string $now): array
    {
        $status = $this->choice($input, 'status', ['Draft','Active','Archived']);
        $isProfile = $collection === 'roleProfiles';
        $fields = $isProfile ? ['name','position','department','appliesTo','effectiveDate','requirements'] : ['code','name','category','definition','behavioralIndicators','assessmentMethods','requiredEvidenceTypes','reassessmentIntervalMonths'];
        if ($old && $old['status'] !== 'Draft') {
            foreach ($fields as $field) $this->check(($input[$field] ?? null) == ($old[$field] ?? null), 'Published requirements and definitions are immutable. Create a working draft.');
            $this->check($status === $old['status'] || ($old['status'] === 'Active' && $status === 'Archived'), 'Archived records cannot be republished in place.');
            return array_merge($old, ['status' => $status, 'lastUpdated' => $now, 'updatedBy' => $actor['name']]);
        }
        $this->check($old !== null || $status === 'Draft', 'New framework records must start as Draft.');
        $sourceId = $old['draftSourceId'] ?? $input['draftSourceId'] ?? null;
        $source = $sourceId ? self::find($state[$collection], $sourceId) : null;
        if ($sourceId) $this->check($source !== null && $source['status'] !== 'Draft', 'Choose an existing published source version.');
        $lineage = $old['lineageId'] ?? $source['lineageId'] ?? $input['id'];
        $record = array_intersect_key($input, array_flip($fields));
        $record['name'] = $this->text($input, 'name', 255);
        if ($isProfile) {
            $record['position'] = $this->text($input, 'position', 255);
            $record['department'] = $this->text($input, 'department', 255);
            $matchingPeople = array_values(array_filter($people, fn ($person) =>
                self::key($person['position']) === self::key($record['position']) &&
                self::key($person['department']) === self::key($record['department'])
            ));
            $this->check((bool)$matchingPeople, 'Role Profiles must use a position and department that exist in the canonical workforce source.');
            $types = array_values(array_unique(array_map(fn ($person) => self::personType($person['personType']), $matchingPeople)));
            sort($types);
            $expectedAppliesTo = count($types) > 1 ? 'Both' : ($types[0] ?? 'Employee');
            $record['appliesTo'] = $expectedAppliesTo;
            if (!$old && !$source) $record['name'] = $record['position'].' Competency Profile';
            $record['effectiveDate'] = $this->date($input, 'effectiveDate');
            $this->check(is_array($input['requirements'] ?? null) && count($input['requirements']) > 0 && count($input['requirements']) <= 100, 'Add between one and 100 competency requirements.');
            $ids = [];
            $record['requirements'] = [];
            foreach ($input['requirements'] as $r) {
                $id = $this->text($r, 'competencyId', 160);
                $c = self::find($state['competencies'], $id);
                $this->check($c !== null && ($status !== 'Active' || $c['status'] === 'Active'), 'Published role requirements must reference active definitions.');
                $this->check(!isset($ids[$id]), 'Duplicate competency requirements are not allowed.');
                $ids[$id] = true;
                $record['requirements'][] = ['id' => $this->text($r,'id',160), 'competencyId' => $id, 'requiredLevel' => $this->level($r['requiredLevel'] ?? null), 'critical' => (bool)($r['critical'] ?? false), 'evidenceRequirement' => $this->choice($r,'evidenceRequirement',['None','Optional','Required']), 'reassessmentIntervalMonths' => $this->interval($c['reassessmentIntervalMonths'] ?? null), 'notes' => $this->text($r,'notes',5000,false)];
            }
        } else {
            foreach (['code','category','definition'] as $field) $record[$field] = $this->text($input,$field,$field === 'definition' ? 10000 : 160);
            $record['behavioralIndicators'] = [];
            foreach (range(1,5) as $level) $record['behavioralIndicators'][$level] = $this->text($input['behavioralIndicators'] ?? [],(string)$level,5000);
            $record['assessmentMethods'] = $this->choices($input,'assessmentMethods',['Behavioral Interview','Direct Observation','Document Review','Knowledge Check','Practical Demonstration','Simulation','Work Sample Review']);
            $record['requiredEvidenceTypes'] = $this->choices($input,'requiredEvidenceTypes',['Assessor Observation','Certificate or License','Incident or Safety Record','Knowledge Check Result','Photo or Video Evidence','Supervisor Verification','Work Output']);
            $record['reassessmentIntervalMonths'] = $this->interval($input['reassessmentIntervalMonths'] ?? null);
        }
        $record = array_merge($record, ['id' => $input['id'], 'lineageId' => $lineage, 'draftSourceId' => $sourceId, 'version' => $old['version'] ?? $source['version'] ?? 1, 'status' => $status, 'versionHistory' => $old['versionHistory'] ?? $source['versionHistory'] ?? [], 'lastUpdated' => $now, 'updatedBy' => $actor['name']]);
        if ($status === 'Active') {
            $maxVersion = 0;
            foreach ($state[$collection] as &$p) if ($p['lineageId'] === $lineage && $p['status'] !== 'Draft') {
                $maxVersion = max($maxVersion, $p['version']);
                if ($p['status'] === 'Active') { $p['status'] = 'Archived'; $p['lastUpdated'] = $now; $p['updatedBy'] = $actor['name']; }
            }
            unset($p);
            $record['version'] = $maxVersion + 1;
            $history = ['version' => $record['version'], 'changedAt' => $now, 'changedBy' => $actor['name'], 'summary' => 'Governed version published', 'status' => 'Active'];
            if ($isProfile) $history = array_merge($history, array_intersect_key($record,array_flip($fields)), ['competencyDefinitions' => array_column(self::profileSnapshot($record,$state)['requirements'],'competency')]);
            else $history['definition'] = array_intersect_key($record, array_flip(array_merge(['id','version'],$fields)));
            $record['versionHistory'][] = $history;
        }
        return $record;
    }

    private function cycle(array $input, ?array $old, array &$state, array $actor, string $now): array
    {
        $status = $this->choice($input,'status',['Draft','Scheduled','Active','Closed','Cancelled']);
        $transitions = ['Draft'=>['Draft','Scheduled','Cancelled'],'Scheduled'=>['Scheduled','Active','Closed','Cancelled'],'Active'=>['Active','Closed','Cancelled'],'Closed'=>['Closed'],'Cancelled'=>['Cancelled']];
        $this->check($old ? in_array($status,$transitions[$old['status']],true) : in_array($status,['Draft','Scheduled'],true), 'Invalid assessment-cycle transition.');
        if ($old && $old['status'] === 'Scheduled' && $status === 'Closed') $this->check(substr($now,0,10) > $old['endDate'],'A Scheduled cycle can auto-close only after its assessment window expires.');
        $record = ['id'=>$input['id'], 'name'=>$this->text($input,'name',255), 'type'=>$this->choice($input,'type',['Periodic Assessment','Probationary/Trainee Assessment','Post-Training Reassessment','Certification Renewal','Ad Hoc Assessment']), 'startDate'=>$this->date($input,'startDate'), 'endDate'=>$this->date($input,'endDate'), 'appliesTo'=>$this->text($input,'appliesTo',100), 'assignmentMethod'=>$this->choice($input,'assignmentMethod',['Reporting Relationship','Role-based Assessor','Manual Authorized Assignment']), 'roleBasedAssessorScope'=>$input['roleBasedAssessorScope'] ?? null, 'dueDaysAfterAssignment'=>(int)($input['dueDaysAfterAssignment'] ?? 30), 'reassessmentRule'=>$this->text($input,'reassessmentRule',5000,false), 'autoAssign'=>(bool)($input['autoAssign'] ?? true)];
        foreach (['departments','positions','roleProfileIds','roleBasedAssessorPositions'] as $field) $record[$field] = $this->stringList($input, $field);
        foreach (['requireSelfAssessment','requireSupportingEvidence','requireHrValidation','requireAcknowledgment'] as $field) $record[$field] = (bool)($input[$field] ?? false);
        $this->check($record['endDate'] >= $record['startDate'], 'The cycle end must be on or after its start.');
        $this->check($record['dueDaysAfterAssignment'] >= 1 && $record['dueDaysAfterAssignment'] <= 365, 'Due days must be between 1 and 365.');
        $assignments = array_values(array_filter($state['assessments'], fn ($a) => $a['cycleId'] === $input['id']));
        if ($old && $assignments) foreach ($record as $field=>$value) if (!in_array($field,['name','endDate'],true)) {
            $oldValue = $field === 'autoAssign' ? (bool)($old[$field] ?? true) : ($old[$field] ?? null);
            $this->check($oldValue == $value, 'Cycle population and workflow rules are locked after assignment.');
        }
        if ($old && $assignments) $this->check($record['endDate'] >= $old['endDate'], 'An assigned cycle may only be extended.');
        foreach ($record['roleProfileIds'] as $id) $this->check(self::find($state['roleProfiles'],$id) !== null, 'Choose existing governed role profiles.');
        if ($status === 'Closed') foreach ($assignments as $a) $this->check(in_array($a['status'],['Finalized','Cancelled'],true), 'Resolve all assessments before closing the cycle.');
        if ($status === 'Cancelled') {
            $this->text($input,'cancellationReason',5000);
            foreach ($state['assessments'] as &$a) if ($a['cycleId'] === $input['id'] && !in_array($a['status'],['Finalized','Cancelled'],true)) {
                $snapshot = $a['finalizedSnapshots'] ? end($a['finalizedSnapshots']) : null;
                if ($snapshot) { $a['status'] = 'Finalized'; $a['ratings'] = $snapshot['ratings']; $a['hrValidationNotes'] = $snapshot['hrValidationNotes']; }
                else $a['status'] = 'Cancelled';
                $a = $this->assessmentAudit($a,$actor,$now,'Cycle cancelled: '.$input['cancellationReason']);
            }
            unset($a);
        }
        return array_merge($record,['status'=>$status,'createdAt'=>$old['createdAt'] ?? $now,'createdBy'=>$old['createdBy'] ?? $actor['name'],'updatedAt'=>$now,'updatedBy'=>$actor['name'],'cancellationReason'=>$status === 'Cancelled' ? $input['cancellationReason'] : null,'cancelledAt'=>$status === 'Cancelled' ? ($old['cancelledAt'] ?? $now) : null]);
    }

    private function authority(array $input, ?array $old, array $state, array $people, array $actor, string $now): array
    {
        $candidate = self::find($people,$input['assessorId'] ?? '');
        $this->check($candidate !== null, 'Select active canonical personnel as the assessor.');
        $scope = $this->choice($input,'scope',['Department','Position','Role Profile','Specific Person']);
        $value = $this->text($input,'scopeValue',255);
        $valid = match ($scope) {
            'Department'=>array_column($people,'department'),'Position'=>array_column($people,'position'),
            'Role Profile'=>array_column($state['roleProfiles'],'id'),'Specific Person'=>array_column($people,'id'),
        };
        $this->check(in_array($value,$valid,true), 'The authorization scope must reference current organizational records.');
        return ['id'=>$input['id'],'assessorId'=>$candidate['id'],'scope'=>$scope,'scopeValue'=>$value,'active'=>(bool)($input['active'] ?? true),'reason'=>$this->text($input,'reason',5000),'authorizedAt'=>$now,'authorizedBy'=>$actor['name']];
    }

    private function assessment(array $input, ?array $old, array $state, array $actor, array $people, string $now): array
    {
        $person = self::find($people, $old['personId'] ?? $input['personId'] ?? '');
        $this->check($person !== null, 'This assessment requires active canonical personnel.');
        $cycle = self::find($state['cycles'], $old['cycleId'] ?? $input['cycleId'] ?? '');
        $profile = self::find($state['roleProfiles'], $old['roleProfileId'] ?? $input['roleProfileId'] ?? '');
        $this->check($cycle !== null && $profile !== null, 'Choose a valid assessment cycle and role profile.');
        $status = $this->choice($input,'status',['Pending','In Progress','Submitted','Pending Validation','Returned for Revision','Finalized','Cancelled']);
        if (!$old) {
            $this->check(self::governor($actor), 'Only Admin or HR can assign official assessments.', 403);
            $this->check(in_array($cycle['status'],['Scheduled','Active'],true), 'Assignments require a Scheduled or Active cycle.');
            $resolved = self::resolveProfile($state,$person,substr($now,0,10));
            $this->check($resolved !== null && $resolved['id'] === $profile['id'], 'The assignment must use the person’s applicable active role profile.');
            $this->check(in_array($profile['id'],$cycle['roleProfileIds'],true), 'The role profile is outside this cycle.');
            $this->check($cycle['appliesTo'] === 'Both' || self::personType($cycle['appliesTo']) === self::personType($person['personType']), 'This person type is outside the cycle.');
            foreach (['departments'=>'department','positions'=>'position'] as $field=>$personField) $this->check(!$cycle[$field] || in_array($person[$personField],$cycle[$field],true), 'This person is outside the cycle population.');
            $this->check($status === 'Pending', 'A new official assignment starts as Pending.');
            foreach ($state['assessments'] as $a) $this->check($a['status'] === 'Cancelled' || $a['personId'] !== $person['id'] || $a['cycleId'] !== $cycle['id'], 'An official assignment already exists for this person and cycle.');
            $assessor = $this->text($input,'assessorId',160);
            $this->check(self::authorized($state,$people,$assessor,$person,$profile), 'The selected assessor has no authority for this person.', 403);
            if ($cycle['assignmentMethod'] === 'Reporting Relationship') $this->check(($person['managerPersonnelKey'] ?? null) === $assessor, 'Use the recorded reporting manager for this cycle.');
            if ($cycle['assignmentMethod'] === 'Role-based Assessor') {
                $candidate = self::find($people,$assessor);
                $this->check(in_array($candidate['position'],$cycle['roleBasedAssessorPositions'],true), 'The assessor position is outside the cycle’s allowed roles.');
                $scoped = array_filter($state['assessorAuthorizations'], fn ($a) => $a['active'] && $a['assessorId'] === $assessor && $a['scope'] === $cycle['roleBasedAssessorScope'] && match ($a['scope']) { 'Department'=>$a['scopeValue'] === $person['department'],'Position'=>$a['scopeValue'] === $person['position'],'Role Profile'=>$a['scopeValue'] === $profile['id'],default=>false });
                $this->check((bool)$scoped, 'The assessor needs the exact authority scope configured by this cycle.');
            }
            $scope = $this->choice($input,'scope',['Full Role Profile','Targeted Competencies']);
            $targetCompetencyIds = $scope === 'Targeted Competencies' ? $this->stringList($input,'targetCompetencyIds') : array_column($profile['requirements'],'competencyId');
            $this->check((bool)$targetCompetencyIds,'Targeted reassessment requires at least one competency.');
            $profileRequirementIds = array_column($profile['requirements'],'competencyId');
            foreach ($targetCompetencyIds as $competencyId) $this->check(in_array($competencyId,$profileRequirementIds,true),'Targeted competency is outside the current Role Profile.');
            if ($scope === 'Targeted Competencies') $this->check(in_array($cycle['type'],['Post-Training Reassessment','Certification Renewal','Ad Hoc Assessment'],true),'Targeted scope is limited to reassessment, renewal, or governed ad hoc cycles.');
            $sourceRecommendationIds = $this->stringList($input,'sourceRecommendationIds');
            foreach ($sourceRecommendationIds as $recommendationId) {
                $recommendation = self::find($state['recommendations'],$recommendationId);
                $this->check($recommendation && $recommendation['personId'] === $person['id'] && in_array($recommendation['competencyId'],$targetCompetencyIds,true),'Reassessment source must match this person and targeted competency.');
            }
            $snapshot = self::profileSnapshot($profile,$state,$targetCompetencyIds);
            $record = ['id'=>$input['id'],'personId'=>$person['id'],'personType'=>$person['personType'],'roleProfileId'=>$profile['id'],'roleProfileSnapshot'=>$snapshot,'cycleId'=>$cycle['id'],'cycleSnapshot'=>self::cycleSnapshot($cycle,$state),'assessorId'=>$assessor,'assignedAt'=>$now,'dueDate'=>$this->date($input,'dueDate'),'status'=>'Pending','ratings'=>array_map(fn ($r)=>['competencyId'=>$r['competencyId'],'selectedLevel'=>null,'selfLevel'=>null,'evidence'=>[],'assessorComments'=>'','selfComments'=>'','assessedAt'=>null],$snapshot['requirements']),'hrValidationNotes'=>'','employeeAcknowledgedAt'=>null,'submittedAt'=>null,'finalizedAt'=>null,'finalizedSnapshot'=>null,'finalizedSnapshots'=>[],'revisionSourceAssessmentId'=>null,'scope'=>$scope,'targetCompetencyIds'=>$targetCompetencyIds,'sourceRecommendationIds'=>$sourceRecommendationIds,'revisionHistory'=>[],'reassignmentHistory'=>[],'auditHistory'=>[],'lastUpdated'=>$now];
            $this->check($record['dueDate'] >= max($cycle['startDate'],substr($now,0,10)) && $record['dueDate'] <= $cycle['endDate'], 'The assignment due date must fall inside the remaining cycle window.');
            if (!empty($input['revisionSourceAssessmentId'])) {
                $source = self::find($state['assessments'],$input['revisionSourceAssessmentId']);
                $this->check($source && $source['personId'] === $person['id'] && $source['finalizedSnapshots'], 'Reassessment must reference this person’s finalized assessment.');
                $record['revisionSourceAssessmentId'] = $source['id'];
            }
            return $this->assessmentAudit($record,$actor,$now,'Assessment assigned');
        }
        foreach (['personId','cycleId','roleProfileId','assignedAt','dueDate','revisionSourceAssessmentId','scope','targetCompetencyIds','sourceRecommendationIds'] as $field) $this->check(($input[$field] ?? null) === ($old[$field] ?? null), 'Assignment identity and dates cannot be overwritten.');
        $record = $old;
        $isSubject = $actor['personnelKey'] === $person['id'];
        $canRate = $actor['personnelKey'] === $old['assessorId'] && self::authorized($state,$people,$old['assessorId'],$person,$profile);
        $isGovernor = self::governor($actor);
        $editing = in_array($old['status'],['Pending','In Progress','Returned for Revision'],true);
        $cycleOpen = $cycle['status'] === 'Active' && $cycle['startDate'] <= substr($now,0,10) && $cycle['endDate'] >= substr($now,0,10);
        $currentProfile = self::resolveProfile($state,$person,substr($now,0,10));
        $contextChanged = !$currentProfile || $currentProfile['id'] !== $old['roleProfileId'] || self::key($person['position']) !== self::key($old['roleProfileSnapshot']['position']) || self::key($person['department']) !== self::key($old['roleProfileSnapshot']['department']);
        $ratings = $input['ratings'] ?? [];
        $this->check(is_array($ratings) && count($ratings) === count($old['ratings']), 'Ratings must exactly match the assigned requirement snapshot.');
        $seen = [];
        foreach ($ratings as $r) {
            $id = $this->text($r,'competencyId',160);
            $this->check(!isset($seen[$id]), 'Duplicate competency ratings are not allowed.'); $seen[$id] = true;
            $previous = null;
            foreach ($old['ratings'] as $v) if ($v['competencyId'] === $id) $previous = $v;
            $this->check($previous !== null, 'A rating is outside the assigned requirements.');
            $selfChanged = ($r['selfLevel'] ?? null) !== $previous['selfLevel'] || ($r['selfComments'] ?? '') !== $previous['selfComments'];
            $officialChanged = ($r['selectedLevel'] ?? null) !== $previous['selectedLevel'] || ($r['assessorComments'] ?? '') !== $previous['assessorComments'] || ($r['evidence'] ?? []) != $previous['evidence'];
            if (!$selfChanged && !$officialChanged) continue;
            $this->check(!$contextChanged,'Organizational context changed. Cancel and reissue this assessment using the current Role Profile before editing or submission.');
            $this->check($editing && $cycleOpen, 'Ratings are editable only in an open cycle before submission.');
            if ($selfChanged) $this->check($isSubject && $old['cycleSnapshot']['requireSelfAssessment'], 'Only the assessment subject can provide required self-assessment.',403);
            if ($officialChanged) $this->check($canRate, 'Official ratings and evidence require the assigned authorized assessor.',403);
            $evidence = [];
            $this->check(is_array($r['evidence'] ?? null) && count($r['evidence']) <= 100, 'Provide a valid evidence list.');
            $requirement = current(array_filter($old['roleProfileSnapshot']['requirements'], fn ($q)=>$q['competencyId'] === $id));
            foreach ($r['evidence'] as $e) {
                $evidence[] = ['id'=>$this->text($e,'id',160),'type'=>$this->choice($e,'type',$requirement['competency']['requiredEvidenceTypes']),'title'=>$this->text($e,'title',255),'reference'=>$this->text($e,'reference',2000,false),'description'=>$this->text($e,'description',10000,false),'addedAt'=>$now,'addedBy'=>$actor['personnelKey'],'verificationState'=>$this->choice($e,'verificationState',['Unverified','Reviewed','Verified']),'sourceContext'=>'Metadata or link reference'];
            }
            foreach ($record['ratings'] as &$target) if ($target['competencyId'] === $id) {
                if ($officialChanged) $target = array_merge($target,['selectedLevel'=>$this->level($r['selectedLevel'] ?? null,true),'assessorComments'=>$this->text($r,'assessorComments',10000,false),'evidence'=>$evidence,'assessedAt'=>$now]);
                if ($selfChanged) $target = array_merge($target,['selfLevel'=>$this->level($r['selfLevel'] ?? null,true),'selfComments'=>$this->text($r,'selfComments',10000,false)]);
            }
            unset($target);
        }
        if (($input['assessorId'] ?? '') !== $old['assessorId']) {
            $this->check($isGovernor && $editing && $cycleOpen,'Reassignment requires governance and an editable active-cycle record.',403);
            $this->check(self::authorized($state,$people,$input['assessorId'],$person,$profile),'The new assessor needs authority for this person.',403);
            $history = $this->lastEntry($input, 'reassignmentHistory');
            $reason = $this->text(is_array($history) ? $history : [],'reason',5000);
            $record['reassignmentHistory'][] = ['fromAssessorId'=>$old['assessorId'],'toAssessorId'=>$input['assessorId'],'reason'=>$reason,'actorId'=>$actor['personnelKey'],'actorName'=>$actor['name'],'createdAt'=>$now];
            $record['assessorId'] = $input['assessorId'];
        }
        if ($status !== $old['status']) {
            if ($status === 'In Progress') $this->check($canRate && $editing && $cycleOpen,'Only the assigned assessor can start this record.',403);
            elseif (in_array($status,['Submitted','Pending Validation'],true) || ($status === 'Finalized' && $editing)) {
                $this->check(!$contextChanged,'Organizational context changed. Cancel and reissue this assessment using the current Role Profile before submission.');
                $this->check($canRate && $editing && $cycleOpen,'Submission requires the assigned authorized assessor and an open cycle.',403);
                $this->validateRatings($record);
                $record['submittedAt'] = $now;
                $requiresGovernance = $old['cycleSnapshot']['requireHrValidation'] || count(array_filter($old['roleProfileSnapshot']['requirements'],fn ($requirement)=>!empty($requirement['critical']))) > 0;
                if ($requiresGovernance) $this->check($status !== 'Finalized','This assessment requires governance validation before finalization.');
                else $status = 'Finalized';
            } elseif ($status === 'Finalized') {
                $this->check($isGovernor && !$isSubject && in_array($old['status'],['Submitted','Pending Validation'],true) && $cycleOpen,'Finalization requires governance, a submitted record, and an open cycle.',403);
                $this->validateRatings($record);
                $record['hrValidationNotes'] = $this->text($input,'hrValidationNotes',10000);
            } elseif ($status === 'Returned for Revision') {
                $this->check($isGovernor && !$isSubject && in_array($old['status'],['Submitted','Pending Validation','Finalized'],true) && $cycleOpen,'Return or reopen requires governance and an open cycle.',403);
                $revision = $this->lastEntry($input, 'revisionHistory');
                $reason = $this->text(is_array($revision) ? $revision : [],'reason',5000);
                $record['revisionHistory'][] = ['version'=>count($old['revisionHistory'])+1,'action'=>$old['status'] === 'Finalized' ? 'Reopened' : 'Returned for Revision','reason'=>$reason,'notes'=>$this->text($input,'hrValidationNotes',10000,false),'actorId'=>$actor['personnelKey'],'actorName'=>$actor['name'],'createdAt'=>$now,'previousStatus'=>$old['status'],'previousRatings'=>$old['ratings'],'previousHrValidationNotes'=>$old['hrValidationNotes']];
            } elseif ($status === 'Cancelled') {
                $this->check($isGovernor && !$old['finalizedSnapshots'],'Only non-finalized assignments may be cancelled by governance.',403);
                $audit = $this->lastEntry($input, 'auditHistory');
                $this->text(is_array($audit) ? $audit : [],'detail',10000);
            } else $this->check(false,'Invalid assessment lifecycle transition.');
        } else {
            $this->check($canRate || $isSubject || $isGovernor,'This assessment is outside your visibility and authority.',403);
        }
        $record['status'] = $status;
        if ($status === 'Finalized' && $old['status'] !== 'Finalized') {
            $this->check(!$isSubject,'Self-assessment cannot become official validation.',403);
            $snapshot = ['version'=>count($old['finalizedSnapshots'])+1,'profile'=>$old['roleProfileSnapshot'],'cycle'=>$old['cycleSnapshot'],'ratings'=>$record['ratings'],'assessorId'=>$record['assessorId'],'hrValidationNotes'=>$record['hrValidationNotes'],'submittedAt'=>$record['submittedAt'],'employeeAcknowledgedAt'=>null,'finalizedAt'=>$now,'finalizedBy'=>$actor['name']];
            $record['finalizedSnapshots'][] = $snapshot;
            $record['finalizedSnapshot'] = $snapshot;
            $record['finalizedAt'] = $now;
            $record['employeeAcknowledgedAt'] = null;
        }
        return $this->assessmentAudit($record,$actor,$now,$status === $old['status'] ? 'Assessment updated' : 'Assessment '.$status);
    }

    private function validateRatings(array $assessment): void
    {
        foreach ($assessment['roleProfileSnapshot']['requirements'] as $requirement) {
            $rating = current(array_filter($assessment['ratings'],fn ($r)=>$r['competencyId'] === $requirement['competencyId']));
            $this->level($rating['selectedLevel'] ?? null);
            if ($assessment['cycleSnapshot']['requireSelfAssessment']) $this->level($rating['selfLevel'] ?? null);
            if ($requirement['critical'] || $requirement['evidenceRequirement'] === 'Required' || $assessment['cycleSnapshot']['requireSupportingEvidence']) {
                $this->check(count($rating['evidence']) > 0,'Supporting evidence is required for '.$requirement['competency']['name'].'.');
                foreach ($rating['evidence'] as $e) {
                    if ($requirement['critical']) $this->check($e['verificationState'] === 'Verified','Critical competency evidence must be Verified before submission.');
                    else $this->check(in_array($e['verificationState'],['Reviewed','Verified'],true),'Required evidence must be reviewed before submission.');
                }
            }
        }
    }

    private function recommendation(array $input, ?array $old, array $state, array $people, array $actor, string $now): array
    {
        $person = self::find($people,$old['personId'] ?? $input['personId'] ?? '');
        $this->check($person !== null,'Development requires active canonical personnel.');
        $competencyId = $old['competencyId'] ?? $input['competencyId'] ?? '';
        $source = CompetencyProjection::latest($state,$person['id'],$competencyId);
        $profile = self::resolveProfile($state,$person,substr($now,0,10));
        $requirement = $profile ? current(array_filter($profile['requirements'],fn ($r)=>$r['competencyId'] === $competencyId)) : null;
        if (!$old) {
            $this->check($source && $requirement && $source['level'] < $requirement['requiredLevel'],'Development recommendations require an actual finalized competency gap.');
            $this->check($input['sourceAssessmentId'] === $source['assessment']['id'],'The recommendation must use the current finalized source assessment.');
            $this->check(($input['status'] ?? '') === 'Recommended','A new recommendation starts as Recommended.');
        }
        $status = $this->choice($input,'status',['Recommended','Reviewed','Reassessment Requested','Reassessed']);
        if ($old) {
            foreach (['personId','competencyId','sourceAssessmentId','type','title','note'] as $field) $this->check(($input[$field] ?? null) === ($old[$field] ?? null),'Sent recommendation identity and content are immutable. Create a new recommendation for a material change.');
            $allowed = ['Recommended'=>['Recommended','Reviewed','Reassessment Requested'],'Reviewed'=>['Reviewed','Reassessment Requested'],'Reassessment Requested'=>['Reassessment Requested','Reassessed'],'Reassessed'=>['Reassessed']];
            $this->check(in_array($status,$allowed[$old['status']],true),'Invalid development transition.');
            if ($status === 'Reassessed' && $old['status'] !== 'Reassessed') $status = $old['status'];
        }
        $reassessmentAssessmentId = $old['reassessmentAssessmentId'] ?? null;
        if ($status === 'Reassessment Requested' && !empty($input['reassessmentAssessmentId'])) {
            $target = self::find($state['assessments'],$input['reassessmentAssessmentId']);
            $this->check($target && $target['personId'] === $person['id'] && in_array($competencyId,$target['targetCompetencyIds'] ?? array_column($target['roleProfileSnapshot']['requirements'],'competencyId'),true),'Reassessment link must target this person and competency.');
            $reassessmentAssessmentId = $target['id'];
        }
        return array_merge($old ?? [], ['id'=>$input['id'],'personId'=>$person['id'],'competencyId'=>$competencyId,'sourceAssessmentId'=>$old['sourceAssessmentId'] ?? $source['assessment']['id'],'sourceAssessmentVersion'=>$old['sourceAssessmentVersion'] ?? $source['snapshot']['version'],'sourceRequiredLevel'=>$old['sourceRequiredLevel'] ?? $requirement['requiredLevel'],'sourceValidatedLevel'=>$old['sourceValidatedLevel'] ?? $source['level'],'type'=>$this->choice($input,'type',['Learning','Training']),'title'=>$this->text($input,'title',255),'note'=>$this->text($input,'note',10000),'status'=>$status,'createdAt'=>$old['createdAt'] ?? $now,'createdBy'=>$old['createdBy'] ?? $actor['name'],'reviewedAt'=>$status === 'Reviewed' ? ($old['reviewedAt'] ?? $now) : ($old['reviewedAt'] ?? null),'reassessmentDue'=>$old['reassessmentDue'] ?? null,'reassessedAt'=>$old['reassessedAt'] ?? null,'reassessmentAssessmentId'=>$reassessmentAssessmentId]);
    }

    private function acknowledgment(array $input, ?array $old, array $state, array $actor, string $now): array
    {
        if ($old) return $old;
        $a = self::find($state['assessments'],$input['assessmentId'] ?? '');
        $this->check($a && $a['personId'] === $actor['personnelKey'],'Only the assessed employee can acknowledge their result.',403);
        $version = $input['finalizedVersion'] ?? null;
        $snapshot = current(array_filter($a['finalizedSnapshots'],fn ($s)=>$s['version'] === $version));
        $this->check($snapshot && $snapshot['cycle']['requireAcknowledgment'],'Choose a finalized version that requires acknowledgment.');
        foreach ($state['acknowledgmentEvents'] as $event) if ($event['assessmentId'] === $a['id'] && $event['finalizedVersion'] === $version) return $event;
        return ['id'=>$input['id'],'assessmentId'=>$a['id'],'finalizedVersion'=>$version,'personId'=>$a['personId'],'acknowledgedAt'=>$now,'actorId'=>$actor['personnelKey'],'actorName'=>$actor['name'],'sourceContext'=>'Employee acknowledged the exact finalized version','eventType'=>'Assessment Receipt Acknowledged'];
    }

    private function assessmentAudit(array $a, array $actor, string $now, string $action): array
    {
        $a['lastUpdated'] = $now;
        $a['auditHistory'][] = ['id'=>'audit-'.bin2hex(random_bytes(12)),'action'=>$action,'detail'=>$action,'actorId'=>$actor['personnelKey'],'actorName'=>$actor['name'],'createdAt'=>$now];
        return $a;
    }

    private function lastEntry(array $input, string $key): array
    {
        $entries = $input[$key] ?? [];
        $this->check(is_array($entries) && count($entries) <= 1000, 'Provide a valid action history.');
        $last = $entries ? end($entries) : [];
        return is_array($last) ? $last : [];
    }
    private function check(bool $condition, string $message, int $status = 422): void { if (!$condition) throw new CompetencyViolation($message,$status); }
    private function text(array $input, string $key, int $max, bool $required = true): string
    {
        $value = $input[$key] ?? '';
        $this->check(is_string($value) && strlen($value) <= $max && (!$required || trim($value) !== ''), 'Provide a valid '.$key.'.');
        return trim($value);
    }
    private function choice(array $input, string $key, array $choices): string
    {
        $value = $this->text($input,$key,255);
        $this->check(in_array($value,$choices,true),'Choose a supported '.$key.'.'); return $value;
    }
    private function stringList(array $input, string $key): array
    {
        $value = $input[$key] ?? [];
        $this->check(is_array($value) && count($value) <= 200, 'Provide a valid '.$key.' list.');
        foreach ($value as $v) $this->check(is_string($v) && strlen($v) <= 255, 'Invalid '.$key.' entry.');
        return array_values(array_unique($value));
    }
    private function choices(array $input, string $key, array $choices): array
    {
        $value = $this->stringList($input,$key);
        foreach ($value as $v) $this->check(in_array($v,$choices,true),'Unsupported '.$key.' entry.'); return $value;
    }
    private function level(mixed $value, bool $nullable = false): ?int
    {
        if ($nullable && $value === null) return null;
        $this->check(is_int($value) && $value >= 1 && $value <= 5,'Validated proficiency must be an integer from 1 to 5; missing results are Not Assessed.'); return $value;
    }
    private function interval(mixed $value): ?int
    {
        if ($value === null) return null;
        $this->check(is_int($value) && $value >= 1 && $value <= 120, 'Reassessment interval must be between one and 120 months.'); return $value;
    }
    private function date(array $input, string $key): string
    {
        $value = $this->text($input,$key,10);
        $d = \DateTimeImmutable::createFromFormat('!Y-m-d',$value);
        $this->check($d && $d->format('Y-m-d') === $value,'Provide a valid '.$key.' date.'); return $value;
    }
}
