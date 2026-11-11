<?php

namespace App\Enums;

/**
 * Catálogo Oficial y Política Centralizada de Códigos de Anulación SIAT (SIN Bolivia).
 *
 * Mapeo oficial ServicioFacturacionCompraVenta:
 *  905: ANULACIÓN CONFIRMADA
 *  906: ANULACIÓN RECHAZADA
 *  924: FACTURA O NOTA NO EXISTE EN LA BASE DE DATOS DEL SIN
 *  925: MOTIVO DE ANULACIÓN INVÁLIDO
 *  934: SOLICITUD DE ANULACIÓN FUERA DE PLAZO
 *  913: CUIS INVÁLIDO
 *  914: CUFD INVÁLIDO
 *  929: CUIS NO VIGENTE
 *  930: CUIS NO CORRESPONDE A LA SUCURSAL / PUNTO DE VENTA
 */
enum SiatCancellationStatus: int
{
    case CONFIRMED           = 905;
    case REJECTED            = 906;
    case CUIS_INVALID        = 913;
    case CUFD_INVALID        = 914;
    case NOT_FOUND           = 924;
    case INVALID_REASON      = 925;
    case CUIS_NOT_VALID      = 929;
    case CUIS_MISMATCH       = 930;
    case DEADLINE_EXCEEDED   = 934;

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
            self::CONFIRMED         => 'ANULACIÓN CONFIRMADA',
            self::REJECTED          => 'ANULACIÓN RECHAZADA',
            self::CUIS_INVALID      => 'CUIS INVÁLIDO',
            self::CUFD_INVALID      => 'CUFD INVÁLIDO',
            self::NOT_FOUND         => 'FACTURA O NOTA NO EXISTE EN LA BASE DE DATOS DEL SIN',
            self::INVALID_REASON    => 'MOTIVO DE ANULACIÓN INVÁLIDO',
            self::CUIS_NOT_VALID    => 'CUIS NO VIGENTE',
            self::CUIS_MISMATCH     => 'CUIS NO CORRESPONDE A LA SUCURSAL/POS',
            self::DEADLINE_EXCEEDED => 'SOLICITUD DE ANULACIÓN FUERA DE PLAZO',
        };
    }

    /**
     * Indica si el código representa confirmación inequívoca de anulación fiscal.
     */
    public function isConfirmed(): bool
    {
        return $this === self::CONFIRMED;
    }

    /**
     * Indica si la anulación fue rechazada por el SIN.
     */
    public function isRejected(): bool
    {
        return $this === self::REJECTED;
    }

    /**
     * Indica si el motivo de anulación es inválido según el SIN.
     */
    public function isInvalidReason(): bool
    {
        return $this === self::INVALID_REASON;
    }

    /**
     * Indica si la solicitud fue rechazada por haber expirado el plazo normativo.
     */
    public function isDeadlineExceeded(): bool
    {
        return $this === self::DEADLINE_EXCEEDED;
    }

    /**
     * Indica si el documento no fue encontrado en la base de datos del SIN.
     */
    public function isNotFound(): bool
    {
        return $this === self::NOT_FOUND;
    }
}
