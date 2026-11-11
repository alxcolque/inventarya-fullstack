<?php

namespace App\Services;

use App\Contracts\DomainOwnershipVerifier;
use App\Models\Domain;
use App\ValueObjects\DomainOwnershipVerificationResult;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class DomainVerificationService
{
    public function __construct(private readonly DomainOwnershipVerifier $verifier) {}

    public function verify(Domain $domain): DomainOwnershipVerificationResult
    {
        if ($domain->type !== 'custom') {
            throw new InvalidArgumentException('Sólo los dominios custom requieren verificación de propiedad.');
        }

        $result = $this->verifier->verify($domain);
        if (! $result->verified) {
            return $result;
        }

        DB::transaction(function () use ($domain): void {
            $domain->update([
                'verified_at' => now(),
                'status' => 'active',
            ]);
        });

        return $result;
    }
}
