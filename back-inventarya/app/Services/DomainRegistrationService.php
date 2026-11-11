<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\Tenant;
use App\Support\DomainConfiguration;
use App\Support\DomainNormalizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DomainRegistrationService
{
    public function canonicalDomainFor(string $tenantSlug): string
    {
        $root = app()->environment('local', 'testing')
            ? 'localhost'
            : (string) config('tenant_domains.root_domain', 'inventarya.com');

        return DomainNormalizer::normalize($tenantSlug.'.'.$root);
    }

    /**
     * Security-owned attributes for a newly requested domain.
     *
     * @return array{domain: string, type: string, status: string, verified_at: mixed, is_primary: bool}
     */
    public function attributesForNewDomain(
        string $domain,
        string $requestedType,
        bool $isPrimary = false,
    ): array {
        $domain = DomainNormalizer::normalize($domain);
        $isInternal = DomainConfiguration::isInternalTenantDomain($domain);
        $expectedType = $isInternal ? 'subdomain' : 'custom';

        if ($requestedType !== $expectedType) {
            throw ValidationException::withMessages([
                'type' => $expectedType === 'custom'
                    ? 'Un dominio externo debe registrarse como custom.'
                    : 'Un subdominio administrado por INVENTARYA no puede registrarse como custom.',
            ]);
        }

        if ($expectedType === 'custom') {
            return [
                'domain' => $domain,
                'type' => 'custom',
                'status' => 'pending',
                'verified_at' => null,
                'is_primary' => false,
            ];
        }

        return [
            'domain' => $domain,
            'type' => 'subdomain',
            'status' => 'active',
            'verified_at' => now(),
            'is_primary' => $isPrimary,
        ];
    }

    public function create(Tenant $tenant, array $input): Domain
    {
        $attributes = $this->attributesForNewDomain(
            (string) $input['domain'],
            (string) $input['type'],
            (bool) ($input['is_primary'] ?? false),
        );

        return DB::transaction(function () use ($tenant, $attributes): Domain {
            if ($attributes['is_primary']) {
                $tenant->domains()->where('is_primary', true)->update(['is_primary' => false]);
            }

            return $tenant->domains()->create($attributes);
        });
    }

    public function update(Domain $domain, array $input): Domain
    {
        $newDomain = (string) ($input['domain'] ?? $domain->domain);
        $newType = (string) ($input['type'] ?? $domain->type);
        $identityChanged = DomainNormalizer::normalize($newDomain) !== $domain->domain
            || $newType !== $domain->type;

        return DB::transaction(function () use ($domain, $input, $newDomain, $newType, $identityChanged): Domain {
            if ($identityChanged) {
                $securityAttributes = $this->attributesForNewDomain($newDomain, $newType, false);
                $domain->fill($securityAttributes);
            }

            if (array_key_exists('is_primary', $input) && $input['is_primary']) {
                if ($domain->type === 'custom' && ($domain->status !== 'active' || $domain->verified_at === null)) {
                    throw ValidationException::withMessages([
                        'is_primary' => 'Un dominio custom debe estar activo y verificado antes de ser principal.',
                    ]);
                }

                Domain::query()
                    ->where('tenant_id', $domain->tenant_id)
                    ->whereKeyNot($domain->getKey())
                    ->where('is_primary', true)
                    ->update(['is_primary' => false]);

                $domain->is_primary = true;
            } elseif (array_key_exists('is_primary', $input)) {
                $domain->is_primary = false;
            }

            $domain->save();

            return $domain->refresh();
        });
    }
}
