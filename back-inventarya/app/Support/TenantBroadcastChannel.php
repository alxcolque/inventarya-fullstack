<?php

namespace App\Support;

use LogicException;

final class TenantBroadcastChannel
{
    public static function user(int|string $userId, ?string $tenantId = null): string
    {
        $tenantId ??= tenant('id');

        if (! is_string($tenantId) || $tenantId === '') {
            throw new LogicException('A tenant id is required for a tenant broadcast channel.');
        }

        return "tenants.{$tenantId}.users.{$userId}";
    }

    public static function admins(?string $tenantId = null): string
    {
        $tenantId ??= tenant('id');

        if (! is_string($tenantId) || $tenantId === '') {
            throw new LogicException('A tenant id is required for a tenant broadcast channel.');
        }

        return "tenants.{$tenantId}.admins";
    }
}
