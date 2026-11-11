<?php

namespace App\Observers;

use App\Models\Domain;
use App\Tenancy\TenantDomainRegistry;

class DomainObserver
{
    public function __construct(private readonly TenantDomainRegistry $registry) {}

    public function saved(Domain $domain): void
    {
        $this->registry->forget((string) $domain->domain);

        $originalDomain = (string) $domain->getOriginal('domain');
        if ($originalDomain !== '' && $originalDomain !== $domain->domain) {
            $this->registry->forget($originalDomain);
        }
    }

    public function deleted(Domain $domain): void
    {
        $this->registry->forget((string) $domain->domain);
    }
}
