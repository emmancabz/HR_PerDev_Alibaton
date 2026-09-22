<?php

namespace App\Support;

use Illuminate\Support\Arr;

class CanonicalWorkforceReference
{
    private ?array $payload = null;

    public function payload(): array
    {
        if ($this->payload !== null) {
            return $this->payload;
        }

        $path = base_path('database/seeders/data/DEFENSE_WORKFORCE_PERSONAS_V1.json');
        if (! is_file($path)) {
            return $this->payload = [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        return $this->payload = is_array($decoded) ? $decoded : [];
    }

    public function person(?string $personnelKey): ?array
    {
        $key = trim((string) $personnelKey);
        if ($key === '') return null;

        foreach (Arr::wrap($this->payload()['people'] ?? []) as $person) {
            if (is_array($person) && (string) ($person['personnel_key'] ?? '') === $key) {
                return $person;
            }
        }

        return null;
    }

    public function allPeople(): array
    {
        return array_values(array_filter(
            Arr::wrap($this->payload()['people'] ?? []),
            fn ($person): bool => is_array($person) && trim((string) ($person['personnel_key'] ?? '')) !== '',
        ));
    }
}
