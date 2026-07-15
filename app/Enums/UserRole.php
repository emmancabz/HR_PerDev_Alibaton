<?php

namespace App\Enums;

enum UserRole: string
{
    case Employee = 'employee';
    case Manager = 'manager';
    case Admin = 'admin';

    public function dashboardRouteName(): string
    {
        return match ($this) {
            self::Admin => 'admin.dashboard',
            self::Manager => 'manager.dashboard',
            self::Employee => 'employee.dashboard',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrator',
            self::Manager => 'Manager',
            self::Employee => 'Employee',
        };
    }
}
