<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;
use App\Models\Setting;
use RuntimeException;

/**
 * SiatServiceFactory
 *
 * Construye un SiatService correctamente inicializado para el tenant activo.
 * Separa la resolución de credenciales de la lógica de negocio, permitiendo
 * inyectar un FakeSiatSoapClient en tests sin cambiar SiatService.
 */
final class SiatServiceFactory
{
    /**
     * Construye un SiatService para el tenant activo usando el cliente SOAP real.
     *
     * @throws RuntimeException Si las credenciales SIAT no están configuradas.
     */
    public function makeForCurrentTenant(): SiatService
    {
        $setting = Setting::first();

        if (!$setting) {
            throw new RuntimeException('[SIAT] No hay configuración disponible para este tenant.');
        }

        if ($setting->electronic_invoicing_status === 'disabled') {
            throw new RuntimeException('[SIAT] La facturación electrónica no está habilitada en este tenant.');
        }

        $tenantId = (string) (tenancy()->initialized ? tenant()->id : 'unknown');
        $client   = new SiatSoapClient($setting);

        return new SiatService($client, $tenantId);
    }

    /**
     * Construye un SiatService con un cliente personalizado (para tests).
     *
     * @param  SiatSoapClientInterface  $client
     * @param  string                   $tenantId
     */
    public function makeWithClient(SiatSoapClientInterface $client, string $tenantId): SiatService
    {
        return new SiatService($client, $tenantId);
    }
}
