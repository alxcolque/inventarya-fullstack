<?php

namespace App\Contracts;

use App\Models\Domain;
use App\ValueObjects\DomainOwnershipVerificationResult;

interface DomainOwnershipVerifier
{
    public function verify(Domain $domain): DomainOwnershipVerificationResult;
}
