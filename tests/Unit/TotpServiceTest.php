<?php

namespace Tests\Unit;

use App\Services\Mfa\TotpService;
use PHPUnit\Framework\TestCase;

class TotpServiceTest extends TestCase
{
    public function test_rfc_6238_sha1_vectors(): void
    {
        $service = new TotpService();
        $secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

        $vectors = [
            59 => '94287082',
            1111111109 => '07081804',
            1111111111 => '14050471',
            1234567890 => '89005924',
            2000000000 => '69279037',
            20000000000 => '65353130',
        ];

        foreach ($vectors as $timestamp => $expected) {
            $this->assertSame($expected, $service->codeAt($secret, $timestamp, 8));
        }
    }

    public function test_verify_accepts_current_window_and_rejects_invalid_code(): void
    {
        $service = new TotpService();
        $secret = $service->generateSecret();
        $timestamp = 1_700_000_000;
        $code = $service->codeAt($secret, $timestamp);

        $this->assertNotNull($service->verify($secret, $code, $timestamp));
        $this->assertNull($service->verify($secret, '000000', $timestamp, 0));
    }
}
