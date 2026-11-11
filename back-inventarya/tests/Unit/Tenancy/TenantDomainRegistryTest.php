<?php

namespace Tests\Unit\Tenancy;

use App\Tenancy\TenantDomainContext;
use App\Tenancy\TenantDomainRegistry;
use App\Tenancy\TenantDomainRepository;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class TenantDomainRegistryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cache.default' => 'array',
            'tenant_domains.cache_ttl_seconds' => 300,
        ]);
        Cache::flush();
    }

    public function test_it_caches_misses_and_forget_invalidates_them(): void
    {
        $repository = new MutableTenantDomainRepository;
        $registry = new TenantDomainRegistry($repository);

        $this->assertNull($registry->find('empresa.inventarya.com'));
        $this->assertNull($registry->find('empresa.inventarya.com'));
        $this->assertSame(1, $repository->lookups);

        $repository->context = new TenantDomainContext(
            domain: 'empresa.inventarya.com',
            domainType: 'subdomain',
            domainStatus: 'active',
            domainVerified: true,
            tenantId: 'tenant-a',
            tenantSlug: 'empresa',
            tenantStatus: 'active',
        );

        $this->assertNull($registry->find('empresa.inventarya.com'));
        $registry->forget('empresa.inventarya.com');
        $this->assertSame('tenant-a', $registry->find('empresa.inventarya.com')?->tenantId);
        $this->assertSame(2, $repository->lookups);
    }
}

class MutableTenantDomainRepository implements TenantDomainRepository
{
    public int $lookups = 0;

    public ?TenantDomainContext $context = null;

    public function findByDomain(string $domain): ?TenantDomainContext
    {
        $this->lookups++;

        return $this->context;
    }
}
