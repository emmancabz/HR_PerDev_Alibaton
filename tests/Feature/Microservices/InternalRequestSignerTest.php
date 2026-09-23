<?php

namespace Tests\Feature\Microservices;

use App\Services\Microservices\InternalRequestSigner;
use Illuminate\Http\Request;
use Tests\TestCase;

class InternalRequestSignerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('microservices.shared_secret', str_repeat('a', 64));
        config()->set('microservices.signature_ttl_seconds', 60);
    }

    public function test_transport_stable_token_round_trips_for_expected_service(): void
    {
        $outbound = Request::create('/performance/api/state', 'GET');
        $headers = app(InternalRequestSigner::class)->headers('performance', $outbound, 42);

        $inbound = Request::create('/performance/api/state', 'GET');
        foreach ($headers as $name => $value) {
            $inbound->headers->set($name, $value);
        }

        $identity = app(InternalRequestSigner::class)->identity($inbound, 'performance');

        $this->assertNotNull($identity);
        $this->assertSame('performance', $identity['service']);
        $this->assertSame(42, $identity['user_id']);
        $this->assertNotSame('', $identity['request_id']);
    }

    public function test_token_is_rejected_for_a_different_target_service(): void
    {
        $outbound = Request::create('/performance/api/state', 'GET');
        $headers = app(InternalRequestSigner::class)->headers('performance', $outbound, 42);

        $inbound = Request::create('/performance/api/state', 'GET');
        foreach ($headers as $name => $value) {
            $inbound->headers->set($name, $value);
        }

        $this->assertNull(
            app(InternalRequestSigner::class)->identity($inbound, 'competency'),
        );
    }

    public function test_token_is_rejected_when_the_signed_token_is_tampered(): void
    {
        $outbound = Request::create('/performance/api/state', 'GET');
        $headers = app(InternalRequestSigner::class)->headers('performance', $outbound, 42);
        $headers['X-PND-Internal-Token'] .= 'tampered';

        $inbound = Request::create('/performance/api/state', 'GET');
        foreach ($headers as $name => $value) {
            $inbound->headers->set($name, $value);
        }

        $this->assertNull(
            app(InternalRequestSigner::class)->identity($inbound, 'performance'),
        );
    }

    public function test_token_is_rejected_when_request_id_does_not_match_transport_header(): void
    {
        $outbound = Request::create('/performance/api/state', 'GET');
        $headers = app(InternalRequestSigner::class)->headers('performance', $outbound, 42);
        $headers['X-Request-ID'] = 'different-request-id';

        $inbound = Request::create('/performance/api/state', 'GET');
        foreach ($headers as $name => $value) {
            $inbound->headers->set($name, $value);
        }

        $this->assertNull(
            app(InternalRequestSigner::class)->identity($inbound, 'performance'),
        );
    }
}
