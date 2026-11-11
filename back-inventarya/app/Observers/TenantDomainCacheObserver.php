<?php

namespace App\Observers;

use App\Models\Domain;
use App\Models\Tenant;
use App\Tenancy\TenantDomainRegistry;

class TenantDomainCacheObserver
{
    public function __construct(private readonly TenantDomainRegistry $registry) {}

    public function saved(Tenant $tenant): void
    {
        if ($tenant->wasChanged('status')) {
            $this->forgetTenantDomains((string) $tenant->getKey());
        }
    }

    public function deleting(Tenant $tenant): void
    {
        $this->forgetTenantDomains((string) $tenant->getKey());
    }

    private function forgetTenantDomains(string $tenantId): void
    {
        $this->registry->forgetMany(
            Domain::query()->where('tenant_id', $tenantId)->pluck('domain')
        );
    }
}
