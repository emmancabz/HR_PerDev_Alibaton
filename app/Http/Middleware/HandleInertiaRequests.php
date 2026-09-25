<?php

namespace App\Http\Middleware;

use App\Services\UserWorkspace\UserPersonaResolver;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Illuminate\Support\Facades\Storage;

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
        $persona = $user ? app(UserPersonaResolver::class)->resolve($user) : null;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'profile_photo_url' => $user->profile_photo_path ? Storage::disk('public')->url($user->profile_photo_path) : null,
                    'role' => $user->role->value,
                    'personnel_key' => $user->personnel_key,
                    'core_person_id' => $user->core_person_id,
                    'employee_or_trainee_id' => $user->employee_or_trainee_id,
                    'position' => $user->position,
                    'department' => $user->department,
                    'person_type' => $user->person_type,
                    'employment_status' => $user->employment_status,
                    'evaluator_capable' => $user->evaluator_capable,
                    'manager_id' => $user->manager_id,
                    'persona' => $persona?->value,
                    'persona_label' => $persona?->label(),
                    'email_verified_at' => $user->email_verified_at,
                ] : null,
            ],
            'securitySessionTimeoutMinutes' => (int) config('governance.security.session_timeout_minutes', 5),
        ];
    }
}
