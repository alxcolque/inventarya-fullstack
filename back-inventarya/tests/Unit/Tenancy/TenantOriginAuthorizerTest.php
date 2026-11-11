<?php

namespace Tests\Unit\Tenancy;

use App\Tenancy\TenantDomainAccessPolicy;
use App\Tenancy\TenantDomainContext;
use App\Tenancy\TenantDomainRegistry;
use App\Tenancy\TenantDomainRepository;
use App\Tenancy\TenantOriginAuthorizer;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class TenantOriginAuthorizerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cache.default' => 'array',
            'cors.allowed_origins' => ['https://inventarya.com'],
            'tenant_domains.cache_ttl_seconds' => 300,
            'tenant_domains.authorized_tenant_statuses' => ['active', 'trial'],
        ]);
        Cache::flush();
    }

    public function test_it_allows_configured_central_and_registered_tenant_origins_only(): void
    {
        $context = new TenantDomainContext(
            domain: 'inventario.empresa.com',
            domainType: 'custom',
            domainStatus: 'active',
            domainVerified: true,
            tenantId: 'tenant-a',
            tenantSlug: 'empresa',
            tenantStatus: 'active',
        );

        $repository = new class($context) implements TenantDomainRepository
        {
            public function __construct(private readonly TenantDomainContext $context) {}

            public function findByDomain(string $domain): ?TenantDomainContext
            {
                return $domain === $this->context->domain ? $this->context : null;
            }
        };

        $authorizer = new TenantOriginAuthorizer(
            new TenantDomainRegistry($repository),
            new TenantDomainAccessPolicy,
        );

        $this->assertTrue($authorizer->authorize('https://inventarya.com')['allowed']);
        $this->assertTrue($authorizer->authorize('https://inventario.empresa.com')['allowed']);
        $this->assertFalse($authorizer->authorize('https://fantasma.inventarya.com')['allowed']);
        $this->assertFalse($authorizer->authorize('http://inventario.empresa.com')['allowed']);
    }
}
