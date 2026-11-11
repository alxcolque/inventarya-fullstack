<?php

namespace App\Services\Siat;

use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Servicio de Cálculo y Validación de Plazo Normativo de Anulación Fiscal.
 *
 * Conforme a la normativa tributaria vigente del SIN (RND 102100000011 Art. 74),
 * la anulación de una Factura Compra-Venta en línea puede realizarse hasta el
 * día 9 del mes siguiente al de su emisión, en la zona horaria fiscal oficial (America/La_Paz).
 *
 * Ejemplo:
 *  - Factura emitida: 2026-10-01  → Plazo límite: 2026-11-09 23:59:59
 *  - Factura emitida: 2026-10-31  → Plazo límite: 2026-11-09 23:59:59
 *  - Factura emitida: 2025-12-20  → Plazo límite: 2026-01-09 23:59:59
 */
class SiatCancellationDeadlineService
{
    public const FISCAL_TIMEZONE = 'America/La_Paz';
    public const DEADLINE_DAY_OF_MONTH = 9;

    /**
     * Calcula la fecha y hora exacta de vencimiento del plazo de anulación.
     *
     * @param  CarbonInterface|string  $issuedAt
     * @return Carbon
     */
    public function getDeadline(CarbonInterface|string $issuedAt): Carbon
    {
        $issued = ($issuedAt instanceof CarbonInterface)
            ? Carbon::instance($issuedAt)->setTimezone(self::FISCAL_TIMEZONE)
            : Carbon::parse($issuedAt, self::FISCAL_TIMEZONE)->setTimezone(self::FISCAL_TIMEZONE);

        return $issued->copy()
            ->startOfMonth()
            ->addMonth()
            ->day(self::DEADLINE_DAY_OF_MONTH)
            ->setTime(23, 59, 59);
    }

    /**
     * Verifica si el momento indicado (por defecto ahora) se encuentra dentro del plazo legal.
     *
     * @param  CarbonInterface|string       $issuedAt
     * @param  CarbonInterface|string|null  $now
     * @return bool
     */
    public function isWithinDeadline(CarbonInterface|string $issuedAt, CarbonInterface|string|null $now = null): bool
    {
        $current = ($now === null)
            ? Carbon::now(self::FISCAL_TIMEZONE)
            : (($now instanceof CarbonInterface)
                ? Carbon::instance($now)->setTimezone(self::FISCAL_TIMEZONE)
                : Carbon::parse($now, self::FISCAL_TIMEZONE)->setTimezone(self::FISCAL_TIMEZONE));

        $deadline = $this->getDeadline($issuedAt);

        return $current->lte($deadline);
    }
}
