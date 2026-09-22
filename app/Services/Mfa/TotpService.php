<?php

namespace App\Services\Mfa;

use InvalidArgumentException;

class TotpService
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public function generateSecret(int $bytes = 20): string
    {
        return $this->base32Encode(random_bytes($bytes));
    }

    public function verify(
        string $secret,
        string $code,
        ?int $timestamp = null,
        int $window = 1,
        int $digits = 6,
    ): ?int {
        $normalized = preg_replace('/\D/', '', $code) ?? '';

        if (strlen($normalized) !== $digits) {
            return null;
        }

        $timestamp ??= time();
        $counter = intdiv($timestamp, 30);

        for ($offset = -$window; $offset <= $window; $offset++) {
            $candidateCounter = $counter + $offset;

            if ($candidateCounter < 0) {
                continue;
            }

            if (hash_equals(
                $this->codeForCounter($secret, $candidateCounter, $digits),
                $normalized,
            )) {
                return $candidateCounter;
            }
        }

        return null;
    }

    public function codeAt(
        string $secret,
        int $timestamp,
        int $digits = 6,
    ): string {
        return $this->codeForCounter($secret, intdiv($timestamp, 30), $digits);
    }

    public function provisioningUri(string $secret, string $account, string $issuer): string
    {
        $label = rawurlencode($issuer.':'.$account);

        return sprintf(
            'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            $label,
            rawurlencode($secret),
            rawurlencode($issuer),
        );
    }

    public function base32Encode(string $bytes): string
    {
        $bits = '';

        foreach (unpack('C*', $bytes) as $byte) {
            $bits .= str_pad(decbin($byte), 8, '0', STR_PAD_LEFT);
        }

        if (strlen($bits) % 5 !== 0) {
            $bits = str_pad($bits, strlen($bits) + (5 - (strlen($bits) % 5)), '0', STR_PAD_RIGHT);
        }

        $output = '';

        foreach (str_split($bits, 5) as $chunk) {
            $output .= self::ALPHABET[bindec($chunk)];
        }

        return $output;
    }

    public function base32Decode(string $encoded): string
    {
        $normalized = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $encoded) ?? '');

        if ($normalized === '') {
            throw new InvalidArgumentException('The TOTP secret is empty.');
        }

        $bits = '';

        foreach (str_split($normalized) as $character) {
            $value = strpos(self::ALPHABET, $character);

            if ($value === false) {
                throw new InvalidArgumentException('The TOTP secret contains invalid Base32 characters.');
            }

            $bits .= str_pad(decbin($value), 5, '0', STR_PAD_LEFT);
        }

        $output = '';

        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $output .= chr(bindec($chunk));
            }
        }

        return $output;
    }

    private function codeForCounter(string $secret, int $counter, int $digits): string
    {
        $binarySecret = $this->base32Decode($secret);
        $counterBytes = pack('N2', ($counter >> 32) & 0xffffffff, $counter & 0xffffffff);
        $hash = hash_hmac('sha1', $counterBytes, $binarySecret, true);
        $offset = ord($hash[19]) & 0x0f;
        $binary = (
            ((ord($hash[$offset]) & 0x7f) << 24)
            | ((ord($hash[$offset + 1]) & 0xff) << 16)
            | ((ord($hash[$offset + 2]) & 0xff) << 8)
            | (ord($hash[$offset + 3]) & 0xff)
        );
        $modulo = 10 ** $digits;

        return str_pad((string) ($binary % $modulo), $digits, '0', STR_PAD_LEFT);
    }
}
