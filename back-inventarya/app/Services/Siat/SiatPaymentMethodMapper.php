<?php

namespace App\Services\Siat;

use App\Exceptions\SiatFiscalException;
use App\Models\SiatPaymentMapping;
use App\Models\SiatPaymentMethod;

class SiatPaymentMethodMapper
{
    /**
     * Resuelve el código fiscal oficial del SIN a partir del método de pago comercial
     * de la venta, consultando la tabla de homologaciones configuradas por tenant (`siat_payment_mappings`).
     *
     * No realiza suposiciones automáticas ni utiliza mapas hardcodeados.
     * Si no existe homologación configurada o el código no existe en el catálogo sincronizado,
     * la preparación fiscal se rechaza de inmediato.
     *
     * @param string|null $commercialMethod
     * @return int
     * @throws SiatFiscalException
     */
    public function resolve(?string $commercialMethod): int
    {
        if (empty($commercialMethod)) {
            throw new SiatFiscalException("No se especificó un método de pago en la venta comercial.");
        }

        $rawMethod = trim($commercialMethod);
        $normalized = strtolower($rawMethod);

        // Búsqueda en la configuración de homologaciones del tenant
        $mapping = SiatPaymentMapping::where('commercial_method', $rawMethod)
            ->orWhere('commercial_method', $normalized)
            ->first();

        if (! $mapping) {
            throw new SiatFiscalException(
                "El método de pago comercial '{$commercialMethod}' no tiene una homologación fiscal configurada en SIAT (siat_payment_mappings)."
            );
        }

        $siatCode = (int) $mapping->siat_payment_method_code;

        // Validación estricta contra el catálogo sincronizado local
        $existsInCatalog = SiatPaymentMethod::where('code', $siatCode)->exists();
        if (! $existsInCatalog) {
            throw new SiatFiscalException(
                "El método de pago fiscal SIAT ({$siatCode}) mapeado para '{$commercialMethod}' no existe en el catálogo sincronizado del SIN (siat_payment_methods)."
            );
        }

        return $siatCode;
    }
}
