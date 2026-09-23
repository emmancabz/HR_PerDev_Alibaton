<?php

namespace App\Services\Microservices;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;

class InternalRequestSigner
{
    public function headers(string $service, Request $request, int $userId): array
    {
        $timestamp = (string) now()->timestamp;
        $requestId = (string) $request->header('X-Request-ID', (string) Str::uuid());

        return [
            'X-PND-Internal-Token' => $this->token($service, $userId, $timestamp, $requestId),
            'X-PND-Service' => $service,
            'X-PND-User' => (string) $userId,
            'X-PND-Timestamp' => $timestamp,
            'X-Request-ID' => $requestId,
            'Accept' => $request->header('Accept', 'application/json'),
        ];
    }

    /**
     * Validate a signed internal request and return the trusted identity payload.
     *
     * The V2 token intentionally signs only values transported verbatim in
     * headers. It does not depend on the receiver reconstructing the request
     * path or HTTP method, which may differ across proxies / runtime servers.
     *
     * @return array{service:string,user_id:int,timestamp:int,request_id:string}|null
     */
    public function identity(Request $request, ?string $expectedService = null): ?array
    {
        $token = trim((string) $request->header('X-PND-Internal-Token', ''));

        if ($token !== '') {
            return $this->verifyToken($token, $request, $expectedService);
        }

        return $this->verifyLegacyHeaders($request, $expectedService);
    }

    public function verify(Request $request, ?string $expectedService = null): bool
    {
        return $this->identity($request, $expectedService) !== null;
    }

    private function verifyToken(
        string $token,
        Request $request,
        ?string $expectedService,
    ): ?array {
        [$encoded, $provided] = array_pad(explode('.', $token, 2), 2, null);

        if (! is_string($encoded) || $encoded === '' || ! is_string($provided) || $provided === '') {
            return null;
        }

        $secret = $this->secret();
        $expected = hash_hmac('sha256', $encoded, $secret);

        if (! hash_equals($expected, $provided)) {
            return null;
        }

        $decoded = $this->base64UrlDecode($encoded);
        if ($decoded === null) {
            return null;
        }

        $parts = explode('|', $decoded, 4);
        if (count($parts) !== 4) {
            return null;
        }

        [$service, $userId, $timestamp, $requestId] = $parts;

        if ($service === '' || ! ctype_digit($userId) || (int) $userId < 1) {
            return null;
        }

        if (! ctype_digit($timestamp) || $requestId === '') {
            return null;
        }

        $target = $expectedService ?: (string) config('microservices.role');
        if ($target === '' || ! hash_equals($target, $service)) {
            return null;
        }

        if (! $this->timestampIsFresh((int) $timestamp)) {
            return null;
        }

        $transportRequestId = trim((string) $request->header('X-Request-ID', ''));
        if ($transportRequestId !== '' && ! hash_equals($requestId, $transportRequestId)) {
            return null;
        }

        return [
            'service' => $service,
            'user_id' => (int) $userId,
            'timestamp' => (int) $timestamp,
            'request_id' => $requestId,
        ];
    }

    /**
     * Legacy verifier kept temporarily so a rolling deployment can accept
     * requests from an older gateway while the new gateway is being started.
     *
     * @return array{service:string,user_id:int,timestamp:int,request_id:string}|null
     */
    private function verifyLegacyHeaders(Request $request, ?string $expectedService): ?array
    {
        $service = (string) $request->header('X-PND-Service', '');
        $userId = (int) $request->header('X-PND-User', 0);
        $timestamp = (string) $request->header('X-PND-Timestamp', '');
        $provided = (string) $request->header('X-PND-Signature', '');

        if ($service === '' || $userId < 1 || $timestamp === '' || $provided === '') {
            return null;
        }

        $target = $expectedService ?: (string) config('microservices.role');
        if ($target === '' || ! hash_equals($target, $service)) {
            return null;
        }

        if (! ctype_digit($timestamp) || ! $this->timestampIsFresh((int) $timestamp)) {
            return null;
        }

        $path = '/'.ltrim($request->path(), '/');
        $expected = hash_hmac(
            'sha256',
            implode('|', [
                $service,
                strtoupper($request->method()),
                $path,
                $timestamp,
                (string) $userId,
            ]),
            $this->secret(),
        );

        if (! hash_equals($expected, $provided)) {
            return null;
        }

        return [
            'service' => $service,
            'user_id' => $userId,
            'timestamp' => (int) $timestamp,
            'request_id' => (string) $request->header('X-Request-ID', ''),
        ];
    }

    private function token(string $service, int $userId, string $timestamp, string $requestId): string
    {
        $payload = implode('|', [
            $service,
            (string) $userId,
            $timestamp,
            $requestId,
        ]);

        $encoded = $this->base64UrlEncode($payload);
        $signature = hash_hmac('sha256', $encoded, $this->secret());

        return $encoded.'.'.$signature;
    }

    private function timestampIsFresh(int $timestamp): bool
    {
        $ttl = max(10, (int) config('microservices.signature_ttl_seconds', 60));

        return abs(now()->timestamp - $timestamp) <= $ttl;
    }

    private function secret(): string
    {
        $secret = (string) config('microservices.shared_secret');

        if ($secret === '') {
            throw new RuntimeException('MICROSERVICES_SHARED_SECRET is not configured.');
        }

        return $secret;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $value): ?string
    {
        $remainder = strlen($value) % 4;
        if ($remainder !== 0) {
            $value .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);

        return $decoded === false ? null : $decoded;
    }
}
