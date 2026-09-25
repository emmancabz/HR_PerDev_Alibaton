<?php

namespace Tests\Unit;

use App\Enums\UserPersona;
use App\Models\User;
use App\Services\UserWorkspace\UserPersonaResolver;
use PHPUnit\Framework\TestCase;

class UserPersonaResolverTest extends TestCase
{
    public function test_resolves_trainee_from_person_type(): void
    {
        $user = new User(['person_type' => 'Trainee', 'position' => 'Operator Trainee']);
        $this->assertSame(UserPersona::Trainee, (new UserPersonaResolver())->resolve($user));
    }

    public function test_resolves_manager_before_supervisor_like_authority(): void
    {
        $user = new User(['person_type' => 'Employee', 'position' => 'Operations Manager', 'evaluator_capable' => true]);
        $this->assertSame(UserPersona::Manager, (new UserPersonaResolver())->resolve($user));
    }

    public function test_resolves_supervisor_from_position(): void
    {
        $user = new User(['person_type' => 'Employee', 'position' => 'Site Supervisor']);
        $this->assertSame(UserPersona::Supervisor, (new UserPersonaResolver())->resolve($user));
    }

    public function test_evaluator_capable_employee_remains_employee_when_position_is_not_supervisory(): void
    {
        $user = new User(['person_type' => 'Employee', 'position' => 'Training Officer', 'evaluator_capable' => true]);
        $this->assertSame(UserPersona::Employee, (new UserPersonaResolver())->resolve($user));
    }
}
