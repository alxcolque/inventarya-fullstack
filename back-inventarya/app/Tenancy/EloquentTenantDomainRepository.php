<?php

namespace App\Tenancy;

use App\Models\Domain;

class EloquentTenantDomainRepository implements TenantDomainRepository
{
    public function findByDomain(string $domain): ?TenantDomainContext
    {
        $domainModel = Domain::query()
            ->with(['tenant' => fn ($query) => $query->select(['id', 'slug', 'status'])])
            ->where('domain', $domain)
            ->first();

        if (! $domainModel) {
            return null;
        }

        return new TenantDomainContext(
            domain: (string) $domainModel->domain,
            domainType: (string) $domainModel->type,
            domainStatus: (string) $domainModel->status,
            domainVerified: $domainModel->verified_at !== null,
            tenantId: (string) $domainModel->tenant_id,
            tenantSlug: $domainModel->tenant?->slug,
            tenantStatus: $domainModel->tenant?->status,
        );
    }
}
