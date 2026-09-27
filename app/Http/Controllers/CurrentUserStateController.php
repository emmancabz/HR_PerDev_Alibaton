<?php

namespace App\Http\Controllers;

use App\Services\UserWorkspace\UserPersonaResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CurrentUserStateController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $persona = app(UserPersonaResolver::class)->resolve($user);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'profile_photo_url' => $user->profile_photo_path
                    ? route('account.profile-photo', ['v' => optional($user->profile_photo_updated_at)->timestamp ?? 0])
                    : null,
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
            ],
        ]);
    }
}
