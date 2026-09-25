<?php

namespace App\Enums;

enum UserPersona: string
{
    case Trainee = 'trainee';
    case Employee = 'employee';
    case Supervisor = 'supervisor';
    case Manager = 'manager';

    public function label(): string
    {
        return match ($this) {
            self::Trainee => 'Trainee',
            self::Employee => 'Employee',
            self::Supervisor => 'Supervisor',
            self::Manager => 'Manager',
        };
    }
}
