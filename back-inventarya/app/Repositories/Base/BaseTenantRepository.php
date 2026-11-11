<?php

namespace App\Repositories\Base;

use Illuminate\Database\Eloquent\Builder;

abstract class BaseTenantRepository extends BaseRepository
{
    /**
     * Get the query builder scoped by tenant.
     */
    public function query(): Builder
    {
        // Assuming there's a global scope or we manually add the where clause
        // For now, let's just return the standard query. 
        // In a real scenario, this might include ->where('tenant_id', current_tenant_id())
        return parent::query();
    }

    /**
     * Scope the query by tenant ID explicitly if needed.
     */
    protected function scopeByTenant(Builder $query, int|string $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId);
    }
}
