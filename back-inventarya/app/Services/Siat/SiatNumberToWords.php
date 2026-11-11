<?php

namespace App\Services\Siat;

/**
 * Conversor numérico a texto literal para facturación fiscal en Bolivia.
 *
 * Formato normativo oficial:
 *   "Son: CIENTO CINCUENTA Y TRES 50/100 BOLIVIANOS"
 *   "Son: UN MIL 00/100 BOLIVIANOS"
 *   "Son: CERO 00/100 BOLIVIANOS"
 */
class SiatNumberToWords
{
    private static array $unidades = [
        0 => 'CERO',
        1 => 'UN',
        2 => 'DOS',
        3 => 'TRES',
        4 => 'CUATRO',
        5 => 'CINCO',
        6 => 'SEIS',
        7 => 'SIETE',
        8 => 'OCHO',
        9 => 'NUEVE',
    ];

    private static array $especiales = [
        11 => 'ONCE',
        12 => 'DOCE',
        13 => 'TRECE',
        14 => 'CATORCE',
        15 => 'QUINCE',
        16 => 'DIECISEIS',
        17 => 'DIECISIETE',
        18 => 'DIECIOCHO',
        19 => 'DIECINUEVE',
        20 => 'VEINTE',
        21 => 'VEINTIUN',
        22 => 'VEINTIDOS',
        23 => 'VEINTITRES',
        24 => 'VEINTICUATRO',
        25 => 'VEINTICINCO',
        26 => 'VEINTISEIS',
        27 => 'VEINTISIETE',
        28 => 'VEINTIOCHO',
        29 => 'VEINTINUEVE',
    ];

    private static array $decenas = [
        10 => 'DIEZ',
        20 => 'VEINTE',
        30 => 'TREINTA',
        40 => 'CUARENTA',
        50 => 'CINCUENTA',
        60 => 'SESENTA',
        70 => 'SETENTA',
        80 => 'OCHENTA',
        90 => 'NOVENTA',
    ];

    private static array $centenas = [
        100 => 'CIENTO',
        200 => 'DOSCIENTOS',
        300 => 'TRESCIENTOS',
        400 => 'CUATROCIENTOS',
        500 => 'QUINIENTOS',
        600 => 'SEISCIENTOS',
        700 => 'SETECIENTOS',
        800 => 'OCHOCIENTOS',
        900 => 'NOVECIENTOS',
    ];

    /**
     * Convierte un monto numérico a su representación literal fiscal.
     *
     * @param  string|float|int  $amount
     * @param  string            $currencyName  Por defecto "BOLIVIANOS"
     * @return string  Ej: "Son: CIENTO CINCUENTA 00/100 BOLIVIANOS"
     */
    public static function toLiteral(string|float|int $amount, string $currencyName = 'BOLIVIANOS'): string
    {
        $amountStr = is_string($amount) ? trim($amount) : number_format((float) $amount, 2, '.', '');

        if (!str_contains($amountStr, '.')) {
            $amountStr .= '.00';
        }

        [$enteroStr, $decimalStr] = explode('.', $amountStr, 2);
        $decimalStr = str_pad(substr($decimalStr, 0, 2), 2, '0');

        $entero = (int) $enteroStr;

        if ($entero === 0) {
            $literalEntero = 'CERO';
        } else {
            $literalEntero = self::convertNumber($entero);
        }

        $currency = strtoupper(trim($currencyName));
        if ($entero === 1 && $currency === 'BOLIVIANOS') {
            $currency = 'BOLIVIANO';
        }

        return "Son: {$literalEntero} {$decimalStr}/100 {$currency}";
    }

    private static function convertNumber(int $num): string
    {
        if ($num < 0) {
            return 'MENOS ' . self::convertNumber(abs($num));
        }

        if ($num < 10) {
            return self::$unidades[$num];
        }

        if ($num < 30) {
            return self::$especiales[$num] ?? self::$decenas[$num];
        }

        if ($num < 100) {
            $dec = (int) floor($num / 10) * 10;
            $uni = $num % 10;
            return $uni > 0 ? self::$decenas[$dec] . ' Y ' . self::$unidades[$uni] : self::$decenas[$dec];
        }

        if ($num === 100) {
            return 'CIEN';
        }

        if ($num < 1000) {
            $cen = (int) floor($num / 100) * 100;
            $resto = $num % 100;
            return $resto > 0 ? self::$centenas[$cen] . ' ' . self::convertNumber($resto) : self::$centenas[$cen];
        }

        if ($num < 1000000) {
            $miles = (int) floor($num / 1000);
            $resto = $num % 1000;
            $milesStr = ($miles === 1) ? 'UN MIL' : self::convertNumber($miles) . ' MIL';
            return $resto > 0 ? $milesStr . ' ' . self::convertNumber($resto) : $milesStr;
        }

        if ($num < 1000000000) {
            $millones = (int) floor($num / 1000000);
            $resto = $num % 1000000;
            $millonesStr = ($millones === 1) ? 'UN MILLON' : self::convertNumber($millones) . ' MILLONES';
            return $resto > 0 ? $millonesStr . ' ' . self::convertNumber($resto) : $millonesStr;
        }

        $milMillones = (int) floor($num / 1000000000);
        $resto = $num % 1000000000;
        $milMillonesStr = ($milMillones === 1) ? 'UN MIL MILLONES' : self::convertNumber($milMillones) . ' MIL MILLONES';
        return $resto > 0 ? $milMillonesStr . ' ' . self::convertNumber($resto) : $milMillonesStr;
    }
}
