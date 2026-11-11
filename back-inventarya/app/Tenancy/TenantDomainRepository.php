<?php

namespace App\Tenancy;

interface TenantDomainRepository
{
    public function findByDomain(string $domain): ?TenantDomainContext;
}
