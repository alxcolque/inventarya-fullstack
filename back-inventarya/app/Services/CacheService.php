<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use App\Services\TenantContextService;

class CacheService
{
    public function __construct(
        protected TenantContextService $tenantContext
    ) {}

    /**
     * Get a tenant-isolated cache key.
     */
    protected function getTenantKey(string $key): string
    {
        return $this->tenantContext->getCacheKey($key);
    }

    /**
     * Remember a value in cache with tenant isolation.
     */
    public function remember(string $key, $ttl, \Closure $callback)
    {
        return Cache::remember($this->getTenantKey($key), $ttl, $callback);
    }

    /**
     * Put a value in cache with tenant isolation.
     */
    public function put(string $key, $value, $ttl = null): bool
    {
        return Cache::put($this->getTenantKey($key), $value, $ttl);
    }

    /**
     * Get a value from cache with tenant isolation.
     */
    public function get(string $key, $default = null)
    {
        return Cache::get($this->getTenantKey($key), $default);
    }

    /**
     * Forget a value from cache with tenant isolation.
     */
    public function forget(string $key): bool
    {
        return Cache::forget($this->getTenantKey($key));
    }

    /**
     * Clear all cache for the current tenant (requires tagging support).
     */
    public function clearTenantCache(): void
    {
        $tenantId = $this->tenantContext->getTenantId();
        if ($tenantId) {
            Cache::tags(["tenant_{$tenantId}"])->flush();
        }
    }
}
