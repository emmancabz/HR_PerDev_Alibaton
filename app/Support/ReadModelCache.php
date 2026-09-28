<?php

namespace App\Support;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

final class ReadModelCache
{
    private const TTL_SECONDS = 60;

    /** @var list<string> */
    public const LIVE_DOMAINS = [
        'dashboard',
        'users',
        'performance',
        'competency',
        'learning',
        'training',
        'succession',
        'recognition',
        'reports',
    ];

    /**
     * Cache expensive read-only state in production. Keys are per domain,
     * generation, user, role and optional variant so pages and JSON state
     * endpoints can safely reuse the same payload without sharing users.
     *
     * @template T
     * @param  Closure(): T  $build
     * @param  array<string, mixed>  $vary
     * @return T
     */
    public static function remember(string $domain, User $actor, Closure $build, array $vary = []): mixed
    {
        if (! app()->environment('production')) {
            return $build();
        }

        $generation = self::generation($domain);
        $role = strtolower((string) ($actor->role?->value ?? $actor->role ?? 'user'));
        $variant = $vary === [] ? 'base' : sha1(json_encode($vary, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $key = sprintf(
            'read-model:v3:%s:g%d:user:%s:role:%s:v:%s',
            $domain,
            max(1, $generation),
            (string) $actor->id,
            $role,
            $variant,
        );

        return Cache::remember($key, now()->addSeconds(self::TTL_SECONDS), $build);
    }

    /**
     * State controllers are also called internally by mutation methods. Only
     * cache true GET/HEAD reads so a mutation can return freshly-built state.
     *
     * @template T
     * @param  Closure(): T  $build
     * @param  array<string, mixed>  $vary
     * @return T
     */
    public static function rememberRequest(string $domain, User $actor, Request $request, Closure $build, array $vary = []): mixed
    {
        if (! in_array($request->method(), ['GET', 'HEAD'], true)) {
            return $build();
        }

        return self::remember($domain, $actor, $build, $vary);
    }

    public static function put(string $domain, User $actor, mixed $value, array $vary = []): void
    {
        if (! app()->environment('production')) return;

        $generation = self::generation($domain);
        $role = strtolower((string) ($actor->role?->value ?? $actor->role ?? 'user'));
        $variant = $vary === [] ? 'base' : sha1(json_encode($vary, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $key = sprintf(
            'read-model:v3:%s:g%d:user:%s:role:%s:v:%s',
            $domain,
            max(1, $generation),
            (string) $actor->id,
            $role,
            $variant,
        );

        Cache::put($key, $value, now()->addSeconds(self::TTL_SECONDS));
    }

    public static function peek(string $domain, User $actor, array $vary = []): mixed
    {
        if (! app()->environment('production')) return null;

        $generation = self::generation($domain);
        $role = strtolower((string) ($actor->role?->value ?? $actor->role ?? 'user'));
        $variant = $vary === [] ? 'base' : sha1(json_encode($vary, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $key = sprintf(
            'read-model:v3:%s:g%d:user:%s:role:%s:v:%s',
            $domain,
            max(1, $generation),
            (string) $actor->id,
            $role,
            $variant,
        );

        return Cache::get($key);
    }

    public static function bump(string $domain): void
    {
        if (! app()->environment('production')) {
            return;
        }

        $key = self::generationKey($domain);
        Cache::add($key, 1, now()->addDays(30));
        Cache::increment($key);
    }

    public static function generation(string $domain): int
    {
        return max(1, (int) Cache::get(self::generationKey($domain), 1));
    }

    /** @return array<string, int> */
    public static function revisions(?array $domains = null): array
    {
        $domains ??= self::LIVE_DOMAINS;

        $keys = collect($domains)
            ->mapWithKeys(fn (string $domain): array => [$domain => self::generationKey($domain)]);
        $values = Cache::many($keys->values()->all());

        return $keys
            ->mapWithKeys(fn (string $key, string $domain): array => [
                $domain => max(1, (int) ($values[$key] ?? 1)),
            ])
            ->all();
    }

    private static function generationKey(string $domain): string
    {
        return 'read-model:v3:'.$domain.':generation';
    }
}
