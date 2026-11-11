<?php

namespace App\Tenancy;

final readonly class TenantResolution
{
    private function __construct(
        public string $kind,
        public ?TenantDomainContext $context = null,
        public ?string $code = null,
        public int $httpStatus = 200,
        public ?string $message = null,
    ) {}

    public static function tenant(TenantDomainContext $context): self
    {
        return new self('tenant', $context);
    }

    public static function central(): self
    {
        return new self('central');
    }

    public static function denied(string $code, int $status, string $message): self
    {
        return new self('denied', code: $code, httpStatus: $status, message: $message);
    }

    public function isTenant(): bool
    {
        return $this->kind === 'tenant';
    }

    public function isCentral(): bool
    {
        return $this->kind === 'central';
    }
}
