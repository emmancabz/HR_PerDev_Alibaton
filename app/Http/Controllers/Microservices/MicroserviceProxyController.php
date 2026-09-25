<?php

namespace App\Http\Controllers\Microservices;

use App\Http\Controllers\Controller;
use App\Services\Microservices\MicroserviceClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MicroserviceProxyController extends Controller
{
    public function __construct(private readonly MicroserviceClient $client)
    {
    }

    public function __invoke(Request $request): Response
    {
        $service = (string) $request->route('service');

        abort_unless(config('microservices.enabled'), 404);
        abort_unless(array_key_exists($service, (array) config('microservices.services', [])), 404);

        try {
            $response = $this->client->forward($service, $request);
        } catch (ConnectionException) {
            return response()->json([
                'message' => ucfirst($service).' service is temporarily unavailable.',
                'service' => $service,
            ], 503);
        }

        $headers = collect($response->headers())
            ->except(['transfer-encoding', 'connection', 'content-encoding', 'set-cookie'])
            ->map(fn ($value) => is_array($value) ? implode(', ', $value) : $value)
            ->all();

        return response($response->body(), $response->status(), $headers);
    }
}
