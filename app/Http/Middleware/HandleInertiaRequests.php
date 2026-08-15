<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role->value,
                    'personnel_key' => $user->personnel_key,
                    'core_person_id' => $user->core_person_id,
                    'employee_or_trainee_id' => $user->employee_or_trainee_id,
                    'position' => $user->position,
                    'department' => $user->department,
                    'person_type' => $user->person_type,
                    'employment_status' => $user->employment_status,
                    'evaluator_capable' => $user->evaluator_capable,
                    'email_verified_at' => $user->email_verified_at,
                ] : null,
            ],
        ];
    }
}