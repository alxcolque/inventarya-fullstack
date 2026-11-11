<?php

namespace App\Tenancy;

final class TenantDomainAccessPolicy
{
    /**
     * @return array{code: string, status: int, message: string}|null
     */
    public function denialFor(TenantDomainContext $context): ?array
    {
        if ($context->domainStatus !== 'active') {
            return [
                'code' => 'DOMAIN_'.strtoupper($context->domainStatus),
                'status' => 403,
                'message' => 'El dominio no está habilitado.',
            ];
        }

        if ($context->domainType === 'custom' && ! $context->domainVerified) {
            return [
                'code' => 'DOMAIN_NOT_VERIFIED',
                'status' => 403,
                'message' => 'El dominio personalizado todavía no fue verificado.',
            ];
        }

        if (! in_array($context->domainType, ['subdomain', 'custom'], true)) {
            return [
                'code' => 'DOMAIN_TYPE_INVALID',
                'status' => 403,
                'message' => 'El tipo de dominio no está autorizado.',
            ];
        }

        return $this->denialForTenantStatus($context->tenantStatus);
    }

    /**
     * @return array{code: string, status: int, message: string}|null
     */
    public function denialForTenantStatus(?string $status): ?array
    {
        if ($status === null) {
            return [
                'code' => 'TENANT_NOT_FOUND',
                'status' => 404,
                'message' => 'El tenant asociado al dominio no existe.',
            ];
        }

        if (in_array($status, config('tenant_domains.authorized_tenant_statuses', ['active', 'trial']), true)) {
            return null;
        }

        $messages = [
            'pending' => 'El tenant todavía no está habilitado.',
            'suspended' => 'El tenant está suspendido.',
            'unpaid' => 'El tenant está bloqueado por pagos pendientes.',
            'expired' => 'El tenant está expirado.',
        ];

        return [
            'code' => 'TENANT_'.strtoupper($status),
            'status' => 403,
            'message' => $messages[$status] ?? 'El tenant no está autorizado.',
        ];
    }
}
