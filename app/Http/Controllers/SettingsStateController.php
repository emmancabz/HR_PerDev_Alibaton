<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Governance\AccountArchiveService;
use App\Services\Governance\SystemSettingsService;
use App\Services\Security\SecurityAuditService;
use App\Services\Notifications\NotificationPreferenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SettingsStateController extends Controller
{
    public function __construct(
        private readonly SystemSettingsService $settings,
        private readonly AccountArchiveService $archive,
        private readonly SecurityAuditService $audit,
        private readonly NotificationPreferenceService $notificationPreferences,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->settings->state($request->user(), $request)]);
    }

    public function unlock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'section' => ['required', Rule::in(['organization_reporting', 'sign_in_protection', 'security_logs'])],
            'mode' => ['required', Rule::in(['password', 'mfa'])],
            'password' => ['nullable', 'string', 'max:255'],
        ]);

        $actor = $request->user();
        $section = $validated['section'];
        $this->authorizeSensitiveSection($actor, $section);

        $verified = false;
        if ($validated['mode'] === 'password') {
            $verified = filled($validated['password'] ?? null)
                && Hash::check((string) $validated['password'], $actor->password);
        } else {
            $verifiedAt = (int) $request->session()->get('security.last_mfa_verified_at', 0);
            $ttl = (int) config('governance.security.step_up_verification_minutes', 10);
            $verified = $actor->mfa_enabled_at !== null
                && $verifiedAt > 0
                && now()->timestamp - $verifiedAt <= $ttl * 60;
        }

        if (! $verified) {
            $this->audit->record($request, 'SENSITIVE_SETTINGS_UNLOCK_FAILED', 'Failed', $actor, [
                'section' => $section,
                'verification_mode' => $validated['mode'],
            ]);
            throw ValidationException::withMessages([
                'verification' => $validated['mode'] === 'mfa'
                    ? 'Your recent MFA verification has expired. Verify with your password or sign in with MFA again.'
                    : 'The password is incorrect.',
            ]);
        }

        $request->session()->put("settings.sensitive_access.{$section}", now()->timestamp);
        $this->audit->record($request, 'SENSITIVE_SETTINGS_UNLOCKED', 'Success', $actor, [
            'section' => $section,
            'verification_mode' => $validated['mode'],
        ]);

        return response()->json(['data' => $this->settings->state($actor, $request)]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->requireSensitiveAccess($request, 'organization_reporting');
        $validated = $request->validate([
            'values' => ['required', 'array', 'min:1'],
            'values.*' => ['required'],
            'reason' => ['required', 'string', 'min:8', 'max:500'],
        ]);

        return response()->json([
            'data' => $this->settings->update($request->user(), $validated['values'], $validated['reason'], $request),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->merge([
            'name' => trim((string) $request->input('name')),
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'lowercase', 'email:rfc', 'max:160', Rule::unique('users', 'email')->ignore($user->id)],
        ]);

        $before = ['name' => $user->name, 'email' => $user->email];
        if ($before['email'] !== $validated['email']) {
            $user->email_verified_at = null;
        }
        $user->forceFill($validated)->save();
        $changes = collect($validated)->filter(fn ($value, $key) => $before[$key] !== $value)->keys()->values()->all();

        if ($changes !== []) {
            $this->audit->record($request, 'PROFILE_UPDATED', 'Success', $user, ['changed_fields' => $changes]);
        }

        return response()->json(['data' => $this->settings->state($user, $request)]);
    }

    public function profilePhoto(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);
        $user = $request->user();
        $previous = $user->profile_photo_path;
        $path = $validated['photo']->store("profile-photos/{$user->id}", 'public');
        $user->forceFill(['profile_photo_path' => $path, 'profile_photo_updated_at' => now()])->save();

        if ($previous && $previous !== $path) {
            Storage::disk('public')->delete($previous);
        }

        $this->audit->record($request, 'PROFILE_PHOTO_UPDATED', 'Success', $user, [
            'previous_photo_reference' => $previous ? hash('sha256', $previous) : null,
        ]);

        return response()->json(['data' => $this->settings->state($user, $request)]);
    }

    public function removeProfilePhoto(Request $request): JsonResponse
    {
        $user = $request->user();
        $previous = $user->profile_photo_path;
        if ($previous) {
            Storage::disk('public')->delete($previous);
            $user->forceFill(['profile_photo_path' => null, 'profile_photo_updated_at' => now()])->save();
            $this->audit->record($request, 'PROFILE_PHOTO_REMOVED', 'Success', $user, [
                'previous_photo_reference' => hash('sha256', $previous),
            ]);
        }

        return response()->json(['data' => $this->settings->state($user, $request)]);
    }


    public function updateNotifications(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.performance_actions' => ['required', 'boolean'],
            'preferences.competency_actions' => ['required', 'boolean'],
            'preferences.learning_actions' => ['required', 'boolean'],
            'preferences.training_actions' => ['required', 'boolean'],
            'preferences.succession_actions' => ['required', 'boolean'],
            'preferences.recognition_actions' => ['required', 'boolean'],
            'preferences.security_alerts' => ['required', 'boolean'],
        ]);

        $user = $request->user();
        $before = $this->notificationPreferences->for($user);
        $preferences = $this->notificationPreferences->normalize($user, $validated['preferences']);

        $user->forceFill(['notification_preferences' => $preferences])->save();

        if ($before !== $preferences) {
            $this->audit->record($request, 'NOTIFICATION_PREFERENCES_UPDATED', 'Success', $user, [
                'before' => $before,
                'after' => $preferences,
            ]);
        }

        return response()->json(['data' => $this->settings->state($user->fresh(), $request)]);
    }

    public function archive(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:8', 'max:500']]);
        $this->archive->archive($request->user(), $user, $validated['reason'], $request);

        return response()->json(['data' => $this->settings->state($request->user(), $request)]);
    }

    public function restore(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:8', 'max:500']]);
        $this->archive->restore($request->user(), $user, $validated['reason'], $request);

        return response()->json(['data' => $this->settings->state($request->user(), $request)]);
    }

    public function deleteIdentity(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:8', 'max:500']]);
        $this->archive->deleteRetainedIdentity($request->user(), $user, $validated['reason'], $request);

        return response()->json(['data' => $this->settings->state($request->user(), $request)]);
    }

    private function requireSensitiveAccess(Request $request, string $section): void
    {
        $this->authorizeSensitiveSection($request->user(), $section);
        if (! $this->settings->hasSensitiveAccess($request, $section)) {
            abort(423, 'Re-verification is required before this sensitive settings action.');
        }
    }

    private function authorizeSensitiveSection(User $actor, string $section): void
    {
        if ($section === 'security_logs' && $actor->role !== UserRole::Admin) {
            abort(403, 'Only Admin may view global security logs.');
        }
        if ($section === 'organization_reporting' && $actor->role === UserRole::User) {
            abort(403, 'This account cannot access organization and reporting settings.');
        }
    }
}
