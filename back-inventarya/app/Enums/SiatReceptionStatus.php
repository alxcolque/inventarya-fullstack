<?php

namespace App\Enums;

/**
 * Catálogo Oficial y Política Centralizada de Códigos de Recepción y Verificación SIAT (SIN Bolivia).
 *
 * Mapeo oficial:
 *  901: RECEPCIÓN PENDIENTE
 *  902: RECEPCIÓN RECHAZADA
 *  903: RECEPCIÓN PROCESADA
 *  904: RECEPCIÓN OBSERVADA
 *  908: RECEPCIÓN VALIDADA
 *  924: NO EXISTE EN LA BASE DE DATOS DEL SIN
 *
 * Códigos específicos de rechazo/error tributario:
 *  913: CUIS INVÁLIDO
 *  914: CUFD INVÁLIDO
 *  920: ARCHIVO XML INVÁLIDO
 *  921: FIRMA DIGITAL INCORRECTA
 *  922: FIRMA NO CORRESPONDE AL CONTRIBUYENTE
 *  927: CERTIFICADO DIGITAL INVÁLIDO
 *  928: CERTIFICADO DIGITAL REVOCADO
 *  929: CUIS NO VIGENTE
 *  930: CUIS NO CORRESPONDE A LA SUCURSAL / PUNTO DE VENTA
 */
enum SiatReceptionStatus: int
{
    case PENDING                     = 901;
    case REJECTED                    = 902;
    case PROCESSED                   = 903;
    case OBSERVED                    = 904;
    case VALIDATED                   = 908;
    case CUIS_INVALID                = 913;
    case CUFD_INVALID                = 914;
    case INVALID_FILE                = 920;
    case INCORRECT_SIGNATURE         = 921;
    case SIGNATURE_NOT_MATCH_TAX_ID  = 922;
    case NOT_FOUND                   = 924;
    case INVALID_CERTIFICATE         = 927;
    case REVOKED_CERTIFICATE         = 928;
    case CUIS_NOT_VALID              = 929;
    case CUIS_MISMATCH               = 930;

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
            self::PENDING                    => 'RECEPCIÓN PENDIENTE',
            self::REJECTED                   => 'RECEPCIÓN RECHAZADA',
            self::PROCESSED                  => 'RECEPCIÓN PROCESADA',
            self::OBSERVED                   => 'RECEPCIÓN OBSERVADA',
            self::VALIDATED                  => 'RECEPCIÓN VALIDADA',
            self::CUIS_INVALID               => 'CUIS INVÁLIDO',
            self::CUFD_INVALID               => 'CUFD INVÁLIDO',
            self::INVALID_FILE               => 'ARCHIVO XML INVÁLIDO',
            self::INCORRECT_SIGNATURE        => 'FIRMA DIGITAL INCORRECTA',
            self::SIGNATURE_NOT_MATCH_TAX_ID => 'FIRMA NO CORRESPONDE AL CONTRIBUYENTE',
            self::NOT_FOUND                  => 'FACTURA O NOTA NO EXISTE EN LA BASE DE DATOS DEL SIN',
            self::INVALID_CERTIFICATE        => 'CERTIFICADO DIGITAL INVÁLIDO',
            self::REVOKED_CERTIFICATE        => 'CERTIFICADO DIGITAL REVOCADO',
            self::CUIS_NOT_VALID             => 'CUIS NO VIGENTE',
            self::CUIS_MISMATCH              => 'CUIS NO CORRESPONDE A LA SUCURSAL/POS',
        };
    }

    /**
     * Indica si el código representa aceptación fiscal inequívoca.
     */
    public function isValidated(): bool
    {
        return $this === self::VALIDATED;
    }

    /**
     * Indica si el documento fiscal fue observado por el SIN.
     */
    public function isObserved(): bool
    {
        return $this === self::OBSERVED;
    }

    /**
     * Indica si el documento fiscal fue explícitamente rechazado por el SIN.
     */
    public function isRejected(): bool
    {
        return match ($this) {
            self::REJECTED,
            self::CUIS_INVALID,
            self::CUFD_INVALID,
            self::INVALID_FILE,
            self::INCORRECT_SIGNATURE,
            self::SIGNATURE_NOT_MATCH_TAX_ID,
            self::INVALID_CERTIFICATE,
            self::REVOKED_CERTIFICATE,
            self::CUIS_NOT_VALID,
            self::CUIS_MISMATCH => true,
            default => false,
        };
    }

    /**
     * Indica si el estado es transitorio o pendiente de procesamiento en el SIN.
     */
    public function isPending(): bool
    {
        return in_array($this, [self::PENDING, self::PROCESSED], true);
    }

    /**
     * Indica si la factura no fue encontrada en la base de datos del SIN (Código 924).
     */
    public function isNotFound(): bool
    {
        return $this === self::NOT_FOUND;
    }

    /**
     * Resuelve el estado de negocio interno (ElectronicInvoiceStatus) correspondiente.
     *
     * REGLAS DE NEGOCIO:
     * - 908 (VALIDATED)  → ACCEPTED
     * - 902 / Errores    → REJECTED
     * - 904 (OBSERVED)   → PROCESSING (Resultado fiscal observado: NO aceptada, NO rechazada ciegamente)
     * - 901 / 903 / 924  → PROCESSING (Resultado pendiente o no encontrado: requiere decisión controlada)
     */
    public function resolveElectronicInvoiceStatus(): ElectronicInvoiceStatus
    {
        if ($this->isValidated()) {
            return ElectronicInvoiceStatus::ACCEPTED;
        }

        if ($this->isRejected()) {
            return ElectronicInvoiceStatus::REJECTED;
        }

        // PENDING, PROCESSED, OBSERVED, NOT_FOUND permanecen como PROCESSING
        return ElectronicInvoiceStatus::PROCESSING;
    }
}
