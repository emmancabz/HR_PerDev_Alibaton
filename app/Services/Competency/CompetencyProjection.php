<?php

namespace App\Services\Competency;

class CompetencyProjection
{
    public static function latest(array $state, string $personId, string $competencyId): ?array
    {
        $latest = null;
        $definition = CompetencyDomain::find($state['competencies'],$competencyId);
        $lineage = $definition['lineageId'] ?? $competencyId;
        foreach ($state['assessments'] as $a) {
            if ($a['personId'] !== $personId) continue;
            foreach ($a['finalizedSnapshots'] as $s) foreach ($s['ratings'] as $rating) {
                $sourceDefinition = CompetencyDomain::find($state['competencies'],$rating['competencyId']);
                if (($sourceDefinition['lineageId'] ?? $rating['competencyId']) !== $lineage) continue;
                $level = $rating['selectedLevel'];
                if (!is_int($level) || $level < 1 || $level > 5) continue;
                $rank = [$s['finalizedAt'],$s['version'],$a['id']];
                if ($latest === null || $rank > $latest['rank']) $latest = ['assessment'=>$a,'snapshot'=>$s,'rating'=>$rating,'level'=>$level,'rank'=>$rank];
            }
        }
        return $latest;
    }

    public function people(array $state, array $people, string $today): array
    {
        $rows = [];
        foreach ($people as $person) {
            $profile = CompetencyDomain::resolveProfile($state,$person,$today);
            $details = [];
            foreach ($profile['requirements'] ?? [] as $requirement) {
                $competency = CompetencyDomain::find($state['competencies'],$requirement['competencyId']);
                $source = self::latest($state,$person['id'],$requirement['competencyId']);
                $level = $source['level'] ?? null;
                $required = $requirement['requiredLevel'];
                $assessedAt = $source['snapshot']['finalizedAt'] ?? null;
                $interval = $requirement['reassessmentIntervalMonths'] ?? $competency['reassessmentIntervalMonths'] ?? null;
                $validUntil = $assessedAt && $interval ? $this->addMonths(substr($assessedAt,0,10),$interval) : null;
                $recommendations = array_values(array_filter($state['recommendations'],fn ($r)=>$r['personId'] === $person['id'] && $r['competencyId'] === $requirement['competencyId']));
                usort($recommendations,fn ($a,$b)=>$b['createdAt'] <=> $a['createdAt']);
                $targets = array_values(array_filter(array_map(fn ($r)=>$r['status'] !== 'Reassessed' ? ($r['reassessmentDue'] ?? null) : null,$recommendations)));
                if ($validUntil) $targets[] = $validUntil;
                sort($targets);
                $nextReassessment = $targets[0] ?? null;
                $details[] = ['requirement'=>$requirement,'competency'=>$competency,'currentLevel'=>$level,'result'=>$level === null ? 'Not Assessed' : ($level < $required ? 'Below Requirement' : ($level === $required ? 'Meets Requirement' : 'Exceeds Requirement')),'gap'=>$level === null ? null : max($required-$level,0),'sourceAssessment'=>$source['assessment'] ?? null,'sourceFinalizedSnapshot'=>$source['snapshot'] ?? null,'evidenceCount'=>count($source['rating']['evidence'] ?? []),'lastAssessed'=>$assessedAt,'validUntil'=>$validUntil,'nextReassessment'=>$nextReassessment,'reassessmentDue'=>$nextReassessment !== null && $nextReassessment <= $today,'recommendations'=>$recommendations];
            }
            $gaps = count(array_filter($details,fn ($d)=>$d['gap'] !== null && $d['gap'] > 0));
            $unassessed = count(array_filter($details,fn ($d)=>$d['currentLevel'] === null));
            $met = count(array_filter($details,fn ($d)=>$d['gap'] === 0));
            $due = count(array_filter($details,fn ($d)=>$d['reassessmentDue']));
            $last = array_values(array_filter(array_column($details,'lastAssessed'))); rsort($last);
            $next = array_values(array_filter(array_column($details,'nextReassessment'))); sort($next);
            $rows[] = ['person'=>$person,'profile'=>$profile,'resolutionReason'=>$profile ? 'Active '.$profile['name'].' v'.$profile['version'].' matches '.$person['position'].' / '.$person['department'].' / '.$person['personType'].'.' : 'No effective active profile matches the current position, department and person type.','requirements'=>$details,'coverage'=>$details ? (int)round((count($details)-$unassessed)/count($details)*100) : 0,'meetsOrExceeds'=>$met,'openGaps'=>$gaps,'notAssessed'=>$unassessed,'lastAssessed'=>$last[0] ?? null,'nextReassessment'=>$next[0] ?? null,'status'=>!$profile ? 'Profile Not Assigned' : ($due ? 'Reassessment Due' : ($unassessed ? 'Assessment Incomplete' : ($gaps ? 'Has Competency Gaps' : 'Requirements Met')))];
        }
        return $rows;
    }

    public function metrics(array $state, array $rows, string $today): array
    {
        $covered = array_filter($rows,fn ($r)=>$r['profile'] !== null);
        $assessed = array_filter($rows,fn ($r)=>$r['lastAssessed'] !== null);
        $pending = array_filter($state['assessments'],fn ($a)=>!in_array($a['status'],['Finalized','Cancelled'],true));
        return ['canonicalActivePersonnel'=>count($rows),'eligibleCompetencyPersonnel'=>count($rows),'roleProfileCoverage'=>count($covered),'assessedPersonnel'=>count($assessed),'notAssessedPersonnel'=>count($rows)-count($assessed),'assessmentIncompletePersonnel'=>count(array_filter($covered,fn ($r)=>$r['notAssessed'] > 0)),'activeValidatedGaps'=>array_sum(array_column($rows,'openGaps')),'peopleWithGaps'=>count(array_filter($rows,fn ($r)=>$r['openGaps'] > 0)),'requirementsMetPersonnel'=>count(array_filter($covered,fn ($r)=>$r['notAssessed'] === 0 && $r['openGaps'] === 0)),'finalizedAssessments'=>count(array_filter($state['assessments'],fn ($a)=>$a['status'] === 'Finalized')),'finalizedVersions'=>array_sum(array_map(fn ($a)=>count($a['finalizedSnapshots']),$state['assessments'])),'pendingAssessments'=>count($pending),'reassessmentsDue'=>count(array_filter($rows,fn ($r)=>count(array_filter($r['requirements'],fn ($d)=>$d['reassessmentDue'])) > 0)),'learningDevelopmentRecords'=>count(array_filter($state['recommendations'],fn ($r)=>$r['type'] === 'Learning' && $r['status'] !== 'Reassessed')),'trainingDevelopmentRecords'=>count(array_filter($state['recommendations'],fn ($r)=>$r['type'] === 'Training' && $r['status'] !== 'Reassessed')),'asOf'=>$today];
    }

    private function addMonths(string $date, int $months): string
    {
        $d = new \DateTimeImmutable($date);
        $target = $d->modify('first day of this month')->modify('+'.$months.' months');
        return $target->setDate((int)$target->format('Y'),(int)$target->format('m'),min((int)$d->format('d'),(int)$target->format('t')))->format('Y-m-d');
    }
}
