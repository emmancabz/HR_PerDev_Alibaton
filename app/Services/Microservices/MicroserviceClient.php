<?php

namespace App\Services\Microservices;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

class MicroserviceClient
{
    public function __construct(private readonly InternalRequestSigner $signer)
    {
    }

    public function forward(string $service, Request $request): Response
    {
        $definition = config("microservices.services.{$service}");
        if (! is_array($definition) || empty($definition['url'])) {
            throw new InvalidArgumentException("Unknown microservice [{$service}].");
        }

        $baseUrl = rtrim((string) $definition['url'], '/');
        $path = '/'.ltrim($request->path(), '/');
        $url = $baseUrl.$path;

        $client = Http::connectTimeout((int) config('microservices.connect_timeout', 3))
            ->timeout((int) config('microservices.timeout', 30))
            ->withoutRedirecting()
            ->withHeaders($this->signer->headers($service, $request, (int) $request->user()->id));

        $client = $this->copyForwardableHeaders($client, $request);

        if ($request->isMethod('GET') || $request->isMethod('HEAD')) {
            return $client->send($request->method(), $url, [
                'query' => $request->query(),
            ]);
        }

        if ($request->files->count() > 0) {
            $multipart = [];

            foreach ($request->except(array_keys($request->allFiles())) as $name => $value) {
                $multipart[] = [
                    'name' => $name,
                    'contents' => is_scalar($value) ? (string) $value : json_encode($value, JSON_THROW_ON_ERROR),
                ];
            }

            foreach ($request->allFiles() as $name => $file) {
                if (is_array($file)) {
                    foreach ($file as $index => $item) {
                        $multipart[] = [
                            'name' => "{$name}[{$index}]",
                            'contents' => fopen($item->getRealPath(), 'r'),
                            'filename' => $item->getClientOriginalName(),
                        ];
                    }
                    continue;
                }

                $multipart[] = [
                    'name' => $name,
                    'contents' => fopen($file->getRealPath(), 'r'),
                    'filename' => $file->getClientOriginalName(),
                ];
            }

            return $client->send($request->method(), $url, [
                'query' => $request->query(),
                'multipart' => $multipart,
            ]);
        }

        if ($request->isJson()) {
            return $client->send($request->method(), $url, [
                'query' => $request->query(),
                'json' => $request->json()->all(),
            ]);
        }

        return $client->send($request->method(), $url, [
            'query' => $request->query(),
            'form_params' => $request->request->all(),
        ]);
    }

    private function copyForwardableHeaders(PendingRequest $client, Request $request): PendingRequest
    {
        $headers = collect([
            'Content-Type',
            'Accept-Language',
            'If-Match',
            'If-None-Match',
            'X-CSRF-TOKEN',
        ])->mapWithKeys(function (string $name) use ($request): array {
            $value = $request->header($name);
            return $value === null ? [] : [$name => $value];
        })->all();

        return $client->withHeaders($headers);
    }
}
