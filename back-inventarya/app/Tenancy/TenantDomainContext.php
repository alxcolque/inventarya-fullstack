<?php

namespace App\Tenancy;

final readonly class TenantDomainContext
{
    public function __construct(
        public string $domain,
        public string $domainType,
        public string $domainStatus,
        public bool $domainVerified,
        public string $tenantId,
        public ?string $tenantSlug,
        public ?string $tenantStatus,
    ) {}

    /**
     * @return array<string, bool|string|null>
     */
    public function toArray(): array
    {
        return [
            'domain' => $this->domain,
            'domain_type' => $this->domainType,
            'domain_status' => $this->domainStatus,
            'domain_verified' => $this->domainVerified,
            'tenant_id' => $this->tenantId,
            'tenant_slug' => $this->tenantSlug,
            'tenant_status' => $this->tenantStatus,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            domain: (string) $data['domain'],
            domainType: (string) $data['domain_type'],
            domainStatus: (string) $data['domain_status'],
            domainVerified: (bool) $data['domain_verified'],
            tenantId: (string) $data['tenant_id'],
            tenantSlug: isset($data['tenant_slug']) ? (string) $data['tenant_slug'] : null,
            tenantStatus: isset($data['tenant_status']) ? (string) $data['tenant_status'] : null,
        );
    }
}
