<?php

namespace Tests\Unit\Tenancy;

use App\Support\TenantBroadcastChannel;
use PHPUnit\Framework\TestCase;

class TenantBroadcastChannelTest extends TestCase
{
    public function test_same_user_id_in_different_tenants_has_different_channel(): void
    {
        $tenantA = TenantBroadcastChannel::user(1, 'tenant-a');
        $tenantB = TenantBroadcastChannel::user(1, 'tenant-b');

        $this->assertSame('tenants.tenant-a.users.1', $tenantA);
        $this->assertSame('tenants.tenant-b.users.1', $tenantB);
        $this->assertNotSame($tenantA, $tenantB);
    }
}
