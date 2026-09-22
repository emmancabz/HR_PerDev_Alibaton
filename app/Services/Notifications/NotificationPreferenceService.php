<?php

namespace App\Services\Notifications;

use App\Enums\UserRole;
use App\Models\User;

class NotificationPreferenceService
{
    /** @return array<string, bool> */
    public function defaults(User $user): array
    {
        $operator = in_array($user->role, [UserRole::Admin, UserRole::HR], true);

        return [
            'performance_actions' => $operator,
            'competency_actions' => $operator,
            'learning_actions' => true,
            'training_actions' => true,
            'succession_actions' => $operator,
            'recognition_actions' => true,
            'security_alerts' => $user->role === UserRole::Admin,
        ];
    }

    /** @return array<string, bool> */
    public function for(User $user): array
    {
        $defaults = $this->defaults($user);
        $stored = is_array($user->notification_preferences) ? $user->notification_preferences : [];
        $normalized = $defaults;

        foreach ($defaults as $key => $default) {
            if (array_key_exists($key, $stored)) {
                $normalized[$key] = (bool) $stored[$key];
            }
        }

        if ($user->role === UserRole::Admin) {
            $normalized['security_alerts'] = true;
        }

        return $normalized;
    }

    public function allows(User $user, string $key): bool
    {
        return (bool) ($this->for($user)[$key] ?? false);
    }

    /** @param array<string, mixed> $input
     *  @return array<string, bool>
     */
    public function normalize(User $user, array $input): array
    {
        $preferences = $this->defaults($user);

        foreach ($preferences as $key => $default) {
            if (array_key_exists($key, $input)) {
                $preferences[$key] = (bool) $input[$key];
            }
        }

        if ($user->role === UserRole::Admin) {
            $preferences['security_alerts'] = true;
        }

        return $preferences;
    }
}
