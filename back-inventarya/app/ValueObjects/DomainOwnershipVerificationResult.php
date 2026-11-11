<?php

namespace App\ValueObjects;

final readonly class DomainOwnershipVerificationResult
{
    public function __construct(
        public bool $verified,
        public string $method,
        public string $message,
    ) {}
}
