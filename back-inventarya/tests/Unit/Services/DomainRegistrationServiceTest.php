<?php

namespace Tests\Unit\Services;

use App\Services\DomainRegistrationService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DomainRegistrationServiceTest extends TestCase
{
    public function test_it_derives_the_production_primary_domain_from_backend_configuration(): void
    {
        $originalEnvironment = app()->environment();
        app()->detectEnvironment(fn (): string => 'production');
        config(['tenant_domains.root_domain' => 'inventarya.com']);

        try {
            $this->assertSame(
                'farmacia-central.inventarya.com',
                (new DomainRegistrationService)->canonicalDomainFor('farmacia-central')
            );
        } finally {
            app()->detectEnvironment(fn (): string => $originalEnvironment);
        }
    }

    public function test_custom_domains_start_pending_unverified_and_not_primary(): void
    {
        $attributes = (new DomainRegistrationService)->attributesForNewDomain(
            'https://Inventario.Empresa.com/',
            'custom',
            true,
        );

        $this->assertSame('inventario.empresa.com', $attributes['domain']);
        $this->assertSame('custom', $attributes['type']);
        $this->assertSame('pending', $attributes['status']);
        $this->assertNull($attributes['verified_at']);
        $this->assertFalse($attributes['is_primary']);
    }

    public function test_client_cannot_classify_an_external_domain_as_internal(): void
    {
        $this->expectException(ValidationException::class);

        (new DomainRegistrationService)->attributesForNewDomain(
            'inventario.empresa.com',
            'subdomain',
        );
    }
}
