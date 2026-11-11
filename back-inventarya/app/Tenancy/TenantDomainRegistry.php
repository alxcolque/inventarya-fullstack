<?php

namespace App\Tenancy;

use App\Support\DomainNormalizer;
use Illuminate\Support\Facades\Cache;

class TenantDomainRegistry
{
    public function __construct(private readonly TenantDomainRepository $repository) {}

    public function find(string $domain): ?TenantDomainContext
    {
        $domain = DomainNormalizer::normalize($domain);
        $ttl = max(0, (int) config('tenant_domains.cache_ttl_seconds', 300));

        $payload = Cache::remember(
            $this->cacheKey($domain),
            $ttl,
            function () use ($domain): array {
                $context = $this->repository->findByDomain($domain);

                return $context
                    ? ['found' => true, 'context' => $context->toArray()]
                    : ['found' => false];
            }
        );

        return ($payload['found'] ?? false)
            ? TenantDomainContext::fromArray($payload['context'])
            : null;
    }

    public function forget(string $domain): void
    {
        try {
            Cache::forget($this->cacheKey(DomainNormalizer::normalize($domain)));
        } catch (\InvalidArgumentException) {
            // An invalid historical value cannot have a valid cache key.
        }
    }

    /**
     * @param  iterable<int, string>  $domains
     */
    public function forgetMany(iterable $domains): void
    {
        foreach ($domains as $domain) {
            $this->forget($domain);
        }
    }

    private function cacheKey(string $domain): string
    {
        return 'central:tenant-domain:'.hash('sha256', $domain);
    }
}
