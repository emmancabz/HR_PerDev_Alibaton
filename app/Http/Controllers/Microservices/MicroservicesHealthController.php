<?php

namespace App\Http\Controllers\Microservices;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class MicroservicesHealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $enabled = (bool) config('microservices.enabled');
        $services = collect((array) config('microservices.services', []))
            ->map(function (array $definition, string $name) use ($enabled): array {
                if (! $enabled) {
                    return [
                        'service' => $name,
                        'status' => 'compatibility-mode',
                        'url' => $definition['url'] ?? null,
                    ];
                }

                $url = rtrim((string) ($definition['url'] ?? ''), '/').'/up';

                try {
                    $response = Http::connectTimeout(2)->timeout(3)->get($url);

                    return [
                        'service' => $name,
                        'status' => $response->successful() ? 'healthy' : 'unhealthy',
                        'http_status' => $response->status(),
                    ];
                } catch (\Throwable $exception) {
                    return [
                        'service' => $name,
                        'status' => 'unreachable',
                        'error' => class_basename($exception),
                    ];
                }
            })
            ->values();

        return response()->json([
            'mode' => $enabled ? 'microservices' : 'compatibility',
            'role' => config('microservices.role'),
            'services' => $services,
        ]);
    }
}
