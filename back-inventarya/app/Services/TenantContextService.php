<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\Cache;

class TenantContextService
{
    protected ?Tenant $currentTenant = null;

    /**
     * Resolve the current tenant.
     */
    public function getTenant(): ?Tenant
    {
        if ($this->currentTenant) {
            return $this->currentTenant;
        }

        // Logic to resolve tenant (from auth, subdomain, etc.)
        if (auth()->check()) {
            $this->currentTenant = auth()->user()->tenant;
        }

        return $this->currentTenant;
    }

    /**
     * Get current tenant ID.
     */
    public function getTenantId(): ?int
    {
        return $this->getTenant()?->id;
    }

    /**
     * Get tenant cache key.
     */
    public function getCacheKey(string $key): string
    {
        $tenantId = $this->getTenantId() ?? 'central';
        return "tenant_{$tenantId}_{$key}";
    }

    /**
     * Check if tenant has an active subscription.
     */
    public function hasActiveSubscription(): bool
    {
        $tenant = $this->getTenant();
        if (!$tenant) return false;

        // Implementation depends on Subscription model
        return true; 
    }
}
