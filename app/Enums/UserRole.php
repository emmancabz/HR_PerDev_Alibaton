<?php

namespace App\Enums;

enum UserRole: string
{
    case User = 'user';
    case HR = 'hr';
    case Admin = 'admin';

    public function dashboardRouteName(): string
    {
        return match ($this) {
            self::Admin => 'admin.dashboard',
            self::HR => 'hr.dashboard',
            self::User => 'user.dashboard',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Admin',
            self::HR => 'HR',
            self::User => 'User',
        };
    }
}