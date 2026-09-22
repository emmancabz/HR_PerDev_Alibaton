<?php

namespace App\Models;

use App\Services\Mfa\MfaService;
use App\Services\Security\SecurityAuditService;
use Laravel\Passkeys\Passkey as BasePasskey;

class Passkey extends BasePasskey
{
    protected static function booted(): void
    {
        static::created(function (self $passkey): void {
            $user = $passkey->user;

            if (! $user instanceof User || ! app()->bound('request')) {
                return;
            }

            $request = request();

            app(MfaService::class)->event($request, $user, 'passkey.registered', 'success', [
                'passkey_id' => $passkey->getKey(),
                'name' => $passkey->name,
            ]);

            app(SecurityAuditService::class)->record(
                $request,
                'PASSKEY_REGISTERED',
                'Success',
                $user,
                ['passkey_id' => $passkey->getKey(), 'name' => $passkey->name],
            );
        });

        static::deleted(function (self $passkey): void {
            $user = $passkey->user;

            if (! $user instanceof User || ! app()->bound('request')) {
                return;
            }

            $request = request();

            app(MfaService::class)->event($request, $user, 'passkey.deleted', 'success', [
                'passkey_id' => $passkey->getKey(),
                'name' => $passkey->name,
            ]);

            app(SecurityAuditService::class)->record(
                $request,
                'PASSKEY_DELETED',
                'Success',
                $user,
                ['passkey_id' => $passkey->getKey(), 'name' => $passkey->name],
            );
        });
    }
}
