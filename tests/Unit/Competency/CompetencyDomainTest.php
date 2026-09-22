<?php

namespace Tests\Unit\Competency;

use PHPUnit\Framework\TestCase;

class CompetencyDomainTest extends TestCase
{
    public function test_governed_end_to_end_domain_scenarios(): void
    {
        require_once dirname(__DIR__,2).'/Support/CompetencyDomainScenarios.php';
        $result = \runCompetencyDomainScenarios(dirname(__DIR__,3));
        $this->assertGreaterThanOrEqual(25,$result['passed']);
    }
}
