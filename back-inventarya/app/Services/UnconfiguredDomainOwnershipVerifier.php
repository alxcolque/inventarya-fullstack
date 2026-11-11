<?php

namespace App\Services;

use App\Contracts\DomainOwnershipVerifier;
use App\Models\Domain;
use App\ValueObjects\DomainOwnershipVerificationResult;

class UnconfiguredDomainOwnershipVerifier implements DomainOwnershipVerifier
{
    public function verify(Domain $domain): DomainOwnershipVerificationResult
    {
        return new DomainOwnershipVerificationResult(
            verified: false,
            method: 'unconfigured',
            message: 'La verificación de propiedad DNS todavía no está configurada.',
        );
    }
}
