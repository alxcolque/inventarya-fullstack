<?php

namespace App\Tenancy;

use App\Support\DomainNormalizer;
use InvalidArgumentException;

class TenantOriginAuthorizer
{
    public function __construct(
        private readonly TenantDomainRegistry $registry,
        private readonly TenantDomainAccessPolicy $policy,
    ) {}

    /**
     * @return array{allowed: bool, origin?: string, code?: string}
     */
    public function authorize(string $origin): array
    {
        try {
            $normalized = DomainNormalizer::normalizeOrigin($origin);
        } catch (InvalidArgumentException) {
            return ['allowed' => false, 'code' => 'CORS_ORIGIN_INVALID'];
        }

        if ($this->isConfiguredOrigin($normalized['origin'])) {
            return ['allowed' => true, 'origin' => $normalized['origin']];
        }

        if ($normalized['scheme'] !== 'https') {
            return ['allowed' => false, 'code' => 'CORS_HTTPS_REQUIRED'];
        }

        $context = $this->registry->find($normalized['host']);
        if (! $context || $this->policy->denialFor($context)) {
            return ['allowed' => false, 'code' => 'CORS_ORIGIN_NOT_AUTHORIZED'];
        }

        return ['allowed' => true, 'origin' => $normalized['origin']];
    }

    private function isConfiguredOrigin(string $origin): bool
    {
        foreach (array_merge(config('cors.allowed_origins', []), config('tenant_domains.native_origins', [])) as $configuredOrigin) {
            try {
                if (DomainNormalizer::normalizeOrigin((string) $configuredOrigin)['origin'] === $origin) {
                    return true;
                }
            } catch (InvalidArgumentException) {
                // Invalid configuration does not grant access.
            }
        }

        return false;
    }
}
