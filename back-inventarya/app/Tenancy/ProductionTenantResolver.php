<?php

namespace App\Tenancy;

use App\Support\DomainNormalizer;
use InvalidArgumentException;

class ProductionTenantResolver
{
    /**
     * @param  array<int, string>|null  $centralDomains
     */
    public function __construct(
        private readonly TenantDomainRegistry $registry,
        private readonly TenantDomainAccessPolicy $policy,
        private readonly ?array $centralDomains = null,
    ) {}

    public function resolve(
        string $host,
        ?string $xTenant = null,
        ?string $xTenantDomain = null,
        ?string $origin = null,
    ): TenantResolution {
        try {
            $host = DomainNormalizer::normalize($host);
        } catch (InvalidArgumentException) {
            return TenantResolution::denied('HOST_INVALID', 400, 'El hostname de la solicitud no es válido.');
        }

        if ($this->isCentralHost($host)) {
            return $this->resolveCentralApiBridge($origin, $xTenant, $xTenantDomain);
        }

        $context = $this->registry->find($host);
        if (! $context) {
            return TenantResolution::denied('TENANT_DOMAIN_NOT_FOUND', 404, 'El dominio no pertenece a un tenant registrado.');
        }

        if ($denial = $this->policy->denialFor($context)) {
            return TenantResolution::denied($denial['code'], $denial['status'], $denial['message']);
        }

        if (! $this->selectorsMatch($context, $xTenant, $xTenantDomain)) {
            return TenantResolution::denied('TENANT_CONTEXT_CONFLICT', 409, 'El contexto tenant contradice al hostname.');
        }

        if ($origin && ($conflict = $this->originConflict($origin, $context))) {
            return $conflict;
        }

        return TenantResolution::tenant($context);
    }

    private function resolveCentralApiBridge(?string $origin, ?string $xTenant, ?string $xTenantDomain): TenantResolution
    {
        if (! $origin) {
            return TenantResolution::central();
        }

        // Native clients cannot use a browser tenant hostname. This opt-in
        // bridge only accepts an exact configured origin and a registered domain.
        if (in_array($origin, config('tenant_domains.native_origins', []), true)) {
            if (! $xTenantDomain) {
                return TenantResolution::central();
            }
            try {
                $domain = DomainNormalizer::normalize($xTenantDomain);
            } catch (InvalidArgumentException) {
                return TenantResolution::denied('NATIVE_TENANT_INVALID', 400, 'El dominio del negocio no es válido.');
            }
            $context = $this->registry->find($domain);
            if (! $context && ! str_contains($domain, '.')) {
                $context = $this->registry->find($domain . '.' . config('tenant_domains.root_domain', 'inventarya.com'));
            }
            if (! $context) {
                return TenantResolution::denied('TENANT_DOMAIN_NOT_FOUND', 404, 'El dominio no pertenece a un tenant registrado.');
            }
            if ($denial = $this->policy->denialFor($context)) {
                return TenantResolution::denied($denial['code'], $denial['status'], $denial['message']);
            }
            if (! $this->selectorsMatch($context, $xTenant, $xTenantDomain)) {
                return TenantResolution::denied('TENANT_CONTEXT_CONFLICT', 409, 'El contexto tenant contradice al dominio.');
            }
            return TenantResolution::tenant($context);
        }

        try {
            $originHost = DomainNormalizer::normalizeOrigin($origin)['host'];
        } catch (InvalidArgumentException) {
            return TenantResolution::denied('ORIGIN_INVALID', 400, 'El Origin de la solicitud no es válido.');
        }

        if ($this->isCentralHost($originHost)) {
            return TenantResolution::central();
        }

        // The centralized API bridge is the only production case where Origin
        // contributes tenant context. It must still match an exact domains row;
        // X-Tenant alone is never sufficient.
        $context = $this->registry->find($originHost);
        if (! $context) {
            return TenantResolution::central();
        }

        if ($denial = $this->policy->denialFor($context)) {
            return TenantResolution::denied($denial['code'], $denial['status'], $denial['message']);
        }

        if (! $this->selectorsMatch($context, $xTenant, $xTenantDomain)) {
            return TenantResolution::denied('TENANT_CONTEXT_CONFLICT', 409, 'El contexto tenant contradice al dominio de origen.');
        }

        return TenantResolution::tenant($context);
    }

    private function originConflict(string $origin, TenantDomainContext $hostContext): ?TenantResolution
    {
        try {
            $originHost = DomainNormalizer::normalizeOrigin($origin)['host'];
        } catch (InvalidArgumentException) {
            return TenantResolution::denied('ORIGIN_INVALID', 400, 'El Origin de la solicitud no es válido.');
        }

        if ($originHost === $hostContext->domain || $this->isCentralHost($originHost)) {
            return null;
        }

        $originContext = $this->registry->find($originHost);
        if ($originContext && $originContext->tenantId !== $hostContext->tenantId) {
            return TenantResolution::denied('TENANT_ORIGIN_CONFLICT', 409, 'El Origin pertenece a otro tenant.');
        }

        return null;
    }

    private function selectorsMatch(TenantDomainContext $context, ?string ...$selectors): bool
    {
        foreach ($selectors as $selector) {
            if ($selector === null || trim($selector) === '') {
                continue;
            }

            $selector = strtolower(trim($selector));
            if ($selector === strtolower($context->tenantId) || $selector === strtolower((string) $context->tenantSlug)) {
                continue;
            }

            try {
                if (DomainNormalizer::normalize($selector) === $context->domain) {
                    continue;
                }
            } catch (InvalidArgumentException) {
                // A selector that is neither this tenant id/slug nor a valid
                // matching domain is a conflict.
            }

            return false;
        }

        return true;
    }

    private function isCentralHost(string $host): bool
    {
        $domains = $this->centralDomains ?? config('tenancy.central_domains', []);

        foreach ($domains as $domain) {
            try {
                if (DomainNormalizer::normalize((string) $domain) === $host) {
                    return true;
                }
            } catch (InvalidArgumentException) {
                // Invalid configuration cannot authorize a host.
            }
        }

        return false;
    }
}
