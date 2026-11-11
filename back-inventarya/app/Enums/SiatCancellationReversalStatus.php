<?php

namespace App\Enums;

/**
 * Catálogo Oficial y Política Centralizada de Códigos de Reversión de Anulación SIAT (SIN Bolivia).
 *
 * Mapeo oficial ServicioFacturacionCompraVenta:
 *  907: REVERSIÓN DE ANULACIÓN CONFIRMADA (Devuelve el documento fiscal al estado VÁLIDO)
 *  909: REVERSIÓN RECHAZADA
 *  906: REVERSIÓN RECHAZADA (Código complementario/legado)
 *  924: FACTURA O NOTA NO EXISTE EN LA BASE DE DATOS DEL SIN
 *  981: FACTURA NO DISPONIBLE PARA REVERSIÓN (Ya fue revertida o no cumple condiciones)
 *  3011: SISTEMA NO SUPERÓ PRUEBAS DE AUTORIZACIÓN PARA REVERSIÓN
 *  3012: SOLICITUD DE REVERSIÓN FUERA DE PLAZO
 *  934: SOLICITUD FUERA DE PLAZO
 */
enum SiatCancellationReversalStatus: int
{
    case CONFIRMED           = 907;
    case REJECTED            = 909;
    case REJECTED_LEGACY     = 906;
    case NOT_FOUND           = 924;
    case NOT_AVAILABLE       = 981;
    case SYSTEM_UNAUTHORIZED = 3011;
    case DEADLINE_EXCEEDED   = 3012;
    case DEADLINE_EXCEEDED_ALT = 934;

    /**
     * Resuelve de forma segura una instancia a partir del código numérico o cadena.
     */
    public static function fromCode(int|string|null $code): ?self
    {
        if ($code === null || $code === '') {
            return null;
        }

        return self::tryFrom((int) $code);
    }

    /**
     * Retorna la descripción textual oficial de cada estado o código de error.
     */
    public function label(): string
    {
        return match ($this) {
            self::CONFIRMED           => 'REVERSIÓN DE ANULACIÓN CONFIRMADA',
            self::REJECTED,
            self::REJECTED_LEGACY     => 'REVERSIÓN RECHAZADA',
            self::NOT_FOUND           => 'FACTURA O NOTA NO EXISTE EN LA BASE DE DATOS DEL SIN',
            self::NOT_AVAILABLE       => 'FACTURA NO DISPONIBLE PARA REVERSIÓN',
            self::SYSTEM_UNAUTHORIZED => 'SISTEMA NO SUPERÓ PRUEBAS DE AUTORIZACIÓN PARA REVERSIÓN',
            self::DEADLINE_EXCEEDED,
            self::DEADLINE_EXCEEDED_ALT => 'SOLICITUD DE REVERSIÓN FUERA DE PLAZO',
        };
    }

    /**
     * Indica si el código representa confirmación inequívoca de reversión fiscal (907).
     */
    public function isConfirmed(): bool
    {
        return $this === self::CONFIRMED;
    }

    /**
     * Indica si la reversión fue rechazada por el SIN.
     */
    public function isRejected(): bool
    {
        return $this !== self::CONFIRMED;
    }

    /**
     * Indica si la factura ya no está disponible para reversión (ej. ya fue revertida).
     */
    public function isNotAvailable(): bool
    {
        return $this === self::NOT_AVAILABLE;
    }

    /**
     * Indica si la solicitud fue rechazada por haber expirado el plazo normativo.
     */
    public function isDeadlineExceeded(): bool
    {
        return $this === self::DEADLINE_EXCEEDED || $this === self::DEADLINE_EXCEEDED_ALT;
    }

    /**
     * Indica si el documento no fue encontrado en la base de datos del SIN.
     */
    public function isNotFound(): bool
    {
        return $this === self::NOT_FOUND;
    }
}
