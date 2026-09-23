<?php

namespace Tests\Feature\Microservices;

use App\Support\SchemaPresence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SchemaSearchPathCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_gateway_can_detect_tables_across_domain_schemas(): void
    {
        $this->assertTrue(SchemaPresence::hasTable('users'));
        $this->assertTrue(SchemaPresence::hasTable('performance_cycles'));
        $this->assertTrue(SchemaPresence::hasTable('competency_definitions'));
        $this->assertTrue(SchemaPresence::hasTable('learning_courses'));
        $this->assertTrue(SchemaPresence::hasTable('training_programs'));
        $this->assertTrue(SchemaPresence::hasTable('succession_critical_positions'));
        $this->assertTrue(SchemaPresence::hasTable('recognition_records'));
    }
}
