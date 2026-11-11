<?php

namespace Tests\Unit\Tenancy;

use App\Tenancy\ProductionTenantResolver;
use App\Tenancy\TenantDomainAccessPolicy;
use App\Tenancy\TenantDomainContext;
use App\Tenancy\TenantDomainRegistry;
use App\Tenancy\TenantDomainRepository;
use Illuminate\Support\Facades\Cache;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProductionTenantResolverTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cache.default' => 'array',
            'tenant_domains.cache_ttl_seconds' => 300,
            'tenant_domains.authorized_tenant_statuses' => ['active', 'trial'],
        ]);
        Cache::flush();
    }

    public function test_native_bridge_requires_explicit_origin_and_registered_active_domain(): void
    {
        config(['tenant_domains.native_origins' => ['https://localhost']]);
        $resolver = $this->resolver([$this->context()]);
        $this->assertTrue($resolver->resolve('api.inventarya.com', null, 'empresa.inventarya.com', 'https://localhost')->isTenant());
        $this->assertTrue($resolver->resolve('api.inventarya.com', null, null, 'https://localhost')->isCentral());
        $this->assertSame('TENANT_DOMAIN_NOT_FOUND', $resolver->resolve('api.inventarya.com', null, 'unknown.example.com', 'https://localhost')->code);
        $this->assertSame('TENANT_CONTEXT_CONFLICT', $resolver->resolve('api.inventarya.com', 'other', 'empresa.inventarya.com', 'https://localhost')->code);
        $this->assertFalse($resolver->resolve('api.inventarya.com', null, 'empresa.inventarya.com', 'https://evil.example')->isTenant());
        $this->assertFalse($resolver->resolve('api.inventarya.com', null, 'empresa.inventarya.com')->isTenant());
        $blocked = $this->resolver([$this->context(domain: 'blocked.inventarya.com', tenantStatus: 'suspended')]);
        $this->assertSame('TENANT_SUSPENDED', $blocked->resolve('api.inventarya.com', null, 'blocked.inventarya.com', 'https://localhost')->code);
    }

    public function test_it_resolves_an_exact_inventarya_domain(): void
    {
        $result = $this->resolver([$this->context()])->resolve('empresa.inventarya.com');

        $this->assertTrue($result->isTenant());
        $this->assertSame('tenant-a', $result->context?->tenantId);
    }

    public function test_it_rejects_an_unknown_domain(): void
    {
        $result = $this->resolver([])->resolve('inexistente.inventarya.com');

        $this->assertSame('TENANT_DOMAIN_NOT_FOUND', $result->code);
        $this->assertSame(404, $result->httpStatus);
    }

    public function test_it_rejects_a_suspended_tenant(): void
    {
        $result = $this->resolver([$this->context(tenantStatus: 'suspended')])
            ->resolve('empresa.inventarya.com');

        $this->assertSame('TENANT_SUSPENDED', $result->code);
        $this->assertSame(403, $result->httpStatus);
    }

    #[DataProvider('blockedTenantStatuses')]
    public function test_it_rejects_every_blocked_tenant_status(string $status, string $code): void
    {
        $result = $this->resolver([$this->context(tenantStatus: $status)])
            ->resolve('empresa.inventarya.com');

        $this->assertSame($code, $result->code);
        $this->assertSame(403, $result->httpStatus);
    }

    public static function blockedTenantStatuses(): array
    {
        return [
            'pending' => ['pending', 'TENANT_PENDING'],
            'unpaid' => ['unpaid', 'TENANT_UNPAID'],
            'expired' => ['expired', 'TENANT_EXPIRED'],
        ];
    }

    public function test_it_rejects_a_suspended_domain(): void
    {
        $result = $this->resolver([$this->context(domainStatus: 'suspended')])
            ->resolve('empresa.inventarya.com');

        $this->assertSame('DOMAIN_SUSPENDED', $result->code);
    }

    public function test_it_rejects_a_pending_custom_domain(): void
    {
        $custom = $this->context(
            domain: 'inventario.empresa.com',
            type: 'custom',
            domainStatus: 'pending',
            verified: false,
        );

        $result = $this->resolver([$custom])->resolve('inventario.empresa.com');

        $this->assertSame('DOMAIN_PENDING', $result->code);
    }

    public function test_it_accepts_an_active_verified_custom_domain(): void
    {
        $custom = $this->context(
            domain: 'inventario.empresa.com',
            type: 'custom',
            verified: true,
        );

        $result = $this->resolver([$custom])->resolve('inventario.empresa.com');

        $this->assertTrue($result->isTenant());
    }

    public function test_x_tenant_cannot_switch_the_host_tenant(): void
    {
        $result = $this->resolver([$this->context()])->resolve(
            host: 'empresa.inventarya.com',
            xTenant: 'tenant-b',
        );

        $this->assertSame('TENANT_CONTEXT_CONFLICT', $result->code);
        $this->assertSame(409, $result->httpStatus);
    }

    public function test_origin_from_another_registered_tenant_conflicts_with_host(): void
    {
        $tenantA = $this->context();
        $tenantB = $this->context(
            domain: 'otra.inventarya.com',
            tenantId: 'tenant-b',
            slug: 'otra',
        );

        $result = $this->resolver([$tenantA, $tenantB])->resolve(
            host: 'empresa.inventarya.com',
            origin: 'https://otra.inventarya.com',
        );

        $this->assertSame('TENANT_ORIGIN_CONFLICT', $result->code);
    }

    public function test_it_normalizes_uppercase_host_port_and_final_dot(): void
    {
        $resolver = $this->resolver([$this->context()]);

        $this->assertTrue($resolver->resolve('EMPRESA.INVENTARYA.COM')->isTenant());
        $this->assertTrue($resolver->resolve('empresa.inventarya.com:443')->isTenant());
        $this->assertTrue($resolver->resolve('empresa.inventarya.com.')->isTenant());
    }

    public function test_localhost_can_remain_a_configured_central_host_in_testing(): void
    {
        $result = $this->resolver([], ['api.inventarya.com', 'localhost'])->resolve('localhost:8000');

        $this->assertTrue($result->isCentral());
    }

    public function test_it_rejects_an_orphan_domain_without_a_tenant(): void
    {
        $result = $this->resolver([$this->context(tenantStatus: null)])
            ->resolve('empresa.inventarya.com');

        $this->assertSame('TENANT_NOT_FOUND', $result->code);
        $this->assertSame(404, $result->httpStatus);
    }

    public function test_central_api_bridge_requires_an_exact_origin_domain(): void
    {
        $context = $this->context();
        $resolver = $this->resolver([$context]);

        $accepted = $resolver->resolve(
            host: 'api.inventarya.com',
            xTenantDomain: 'empresa.inventarya.com',
            origin: 'https://empresa.inventarya.com',
        );
        $headerOnly = $resolver->resolve(
            host: 'api.inventarya.com',
            xTenant: 'empresa',
        );

        $this->assertTrue($accepted->isTenant());
        $this->assertTrue($headerOnly->isCentral());
    }

    /**
     * @param  array<int, TenantDomainContext>  $contexts
     * @param  array<int, string>  $centralDomains
     */
    private function resolver(array $contexts, array $centralDomains = ['api.inventarya.com']): ProductionTenantResolver
    {
        $repository = new class($contexts) implements TenantDomainRepository
        {
            /** @var array<string, TenantDomainContext> */
            private array $contexts = [];

            public function __construct(array $contexts)
            {
                foreach ($contexts as $context) {
                    $this->contexts[$context->domain] = $context;
                }
            }

            public function findByDomain(string $domain): ?TenantDomainContext
            {
                return $this->contexts[$domain] ?? null;
            }
        };

        return new ProductionTenantResolver(
            new TenantDomainRegistry($repository),
            new TenantDomainAccessPolicy,
            $centralDomains,
        );
    }

    private function context(
        string $domain = 'empresa.inventarya.com',
        string $type = 'subdomain',
        string $domainStatus = 'active',
        bool $verified = true,
        string $tenantId = 'tenant-a',
        string $slug = 'empresa',
        ?string $tenantStatus = 'active',
    ): TenantDomainContext {
        return new TenantDomainContext(
            domain: $domain,
            domainType: $type,
            domainStatus: $domainStatus,
            domainVerified: $verified,
            tenantId: $tenantId,
            tenantSlug: $slug,
            tenantStatus: $tenantStatus,
        );
    }
}
