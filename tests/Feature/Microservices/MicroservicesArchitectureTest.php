<?php

namespace Tests\Feature\Microservices;

use Tests\TestCase;

class MicroservicesArchitectureTest extends TestCase
{
    public function test_manuscript_defined_domain_services_are_registered(): void
    {
        $services = array_keys((array) config('microservices.services'));

        $this->assertSame([
            'performance',
            'competency',
            'learning',
            'training',
            'succession',
            'recognition',
        ], $services);
    }

    public function test_each_domain_has_an_independent_route_file(): void
    {
        foreach ((array) config('microservices.services') as $name => $definition) {
            $this->assertFileExists(
                $definition['route_file'],
                "Missing route file for {$name} service.",
            );
        }
    }

    public function test_gateway_is_the_default_runtime_role(): void
    {
        $this->assertSame('gateway', config('microservices.role'));
        $this->assertFalse((bool) config('microservices.enabled'));
    }
}
