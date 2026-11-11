<?php

namespace App\Services\Siat;

use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\SiatCufd;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SiatCufGenerator
{
    /**
     * Genera y persiste atómicamente el Código Único de Factura (CUF)
     * para una factura electrónica existente en estado borrador.
     *
     * Valida correspondencia estricta del CUFD histórico, vigencia en fecha de emisión,
     * e idempotencia ante llamadas concurrentes.
     *
     * @param ElectronicInvoice $invoice
     * @return ElectronicInvoice
     * @throws SiatFiscalException
     */
    public function generateAndPersist(ElectronicInvoice $invoice): ElectronicInvoice
    {
        return DB::transaction(function () use ($invoice) {
            // Bloqueo pesimista exclusivo para evitar carreras concurrentes
            $lockedInvoice = ElectronicInvoice::where('id', $invoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            // 1. Idempotencia: Si ya tiene CUF asignado, retornar sin modificar
            if (! empty($lockedInvoice->cuf)) {
                return $lockedInvoice;
            }

            // 2. Validación de campos fiscales requeridos
            $this->validateInvoiceFields($lockedInvoice);

            // 3. Validación de correspondencia y vigencia histórica del CUFD
            $this->validateCufdMatch($lockedInvoice);

            // 4. Generación del CUF oficial
            $cuf = $this->generate($lockedInvoice);

            // 5. Persistencia del CUF
            $lockedInvoice->cuf = $cuf;
            $lockedInvoice->save();

            return $lockedInvoice;
        });
    }

    /**
     * Calcula el CUF a partir de los datos fiscales persistidos en la factura.
     *
     * @param ElectronicInvoice $invoice
     * @return string
     * @throws SiatFiscalException
     */
    public function generate(ElectronicInvoice $invoice): string
    {
        $this->validateInvoiceFields($invoice);

        $issuedAt = $invoice->issued_at;
        $dateFormatted = $issuedAt instanceof CarbonInterface
            ? $issuedAt->format('YmdHisv')
            : Carbon::parse($issuedAt)->format('YmdHisv');

        return $this->generateFromFields(
            nit: (string) $invoice->issuer_nit,
            issuedAtFormatted: $dateFormatted,
            branchCode: (int) $invoice->branch_code,
            modality: (int) $invoice->siat_modality,
            emissionType: 1, // 1 = Online
            invoiceType: 1,  // 1 = Con derecho a crédito fiscal
            documentSector: (int) ($invoice->document_sector_code ?: 1),
            invoiceNumber: (int) $invoice->invoice_number,
            pointOfSaleCode: (int) $invoice->point_of_sale_code,
            controlCode: (string) $invoice->control_code
        );
    }

    /**
     * Genera el CUF aplicando la concatenación oficial de 53 dígitos,
     * el algoritmo Módulo 11 (dígito 54), conversión Base16 con BCMath
     * y adición del Código de Control del CUFD.
     *
     * @throws SiatFiscalException
     */
    public function generateFromFields(
        string $nit,
        string $issuedAtFormatted,
        int $branchCode,
        int $modality,
        int $emissionType,
        int $invoiceType,
        int $documentSector,
        int $invoiceNumber,
        int $pointOfSaleCode,
        string $controlCode
    ): string {
        // Validaciones de rangos y longitudes sin truncar valores
        $nitClean = preg_replace('/\D/', '', trim($nit));
        if (strlen($nitClean) === 0 || strlen($nitClean) > 13) {
            throw new SiatFiscalException("El NIT emisor debe tener entre 1 y 13 dígitos numéricos ('{$nit}').");
        }
        $nitPadded = str_pad($nitClean, 13, '0', STR_PAD_LEFT);

        $fechaClean = preg_replace('/\D/', '', trim($issuedAtFormatted));
        if (strlen($fechaClean) !== 17) {
            throw new SiatFiscalException("La fecha de emisión debe tener exactamente 17 dígitos (yyyyMMddHHmmssSSS), recibido '{$issuedAtFormatted}'.");
        }

        if ($branchCode < 0 || $branchCode > 9999) {
            throw new SiatFiscalException("El código de sucursal debe estar entre 0 y 9999 ({$branchCode}).");
        }
        $sucursalPadded = str_pad((string) $branchCode, 4, '0', STR_PAD_LEFT);

        if (! in_array($modality, [1, 2], true)) {
            throw new SiatFiscalException("La modalidad SIAT debe ser 1 (Electrónica) o 2 (Computarizada), recibido {$modality}.");
        }
        $modalityStr = (string) $modality;

        if ($emissionType !== 1) {
            throw new SiatFiscalException("El tipo de emisión debe ser 1 (Online), recibido {$emissionType}.");
        }
        $emissionTypeStr = (string) $emissionType;

        if ($invoiceType < 1 || $invoiceType > 9) {
            throw new SiatFiscalException("El tipo de factura debe ser un dígito entre 1 y 9 ({$invoiceType}).");
        }
        $invoiceTypeStr = (string) $invoiceType;

        if ($documentSector < 1 || $documentSector > 99) {
            throw new SiatFiscalException("El documento sector debe estar entre 1 y 99 ({$documentSector}).");
        }
        $documentSectorPadded = str_pad((string) $documentSector, 2, '0', STR_PAD_LEFT);

        if ($invoiceNumber <= 0 || $invoiceNumber > 9999999999) {
            throw new SiatFiscalException("El número de factura debe ser mayor a 0 y hasta 10 dígitos ({$invoiceNumber}).");
        }
        $invoiceNumberPadded = str_pad((string) $invoiceNumber, 10, '0', STR_PAD_LEFT);

        if ($pointOfSaleCode < 0 || $pointOfSaleCode > 9999) {
            throw new SiatFiscalException("El código de punto de venta debe estar entre 0 y 9999 ({$pointOfSaleCode}).");
        }
        $posPadded = str_pad((string) $pointOfSaleCode, 4, '0', STR_PAD_LEFT);

        $controlCodeClean = strtoupper(trim($controlCode));
        if ($controlCodeClean === '') {
            throw new SiatFiscalException("El código de control del CUFD no puede estar vacío.");
        }

        // 1. Concatenación de 53 dígitos
        $cadena53 = $nitPadded
            . $fechaClean
            . $sucursalPadded
            . $modalityStr
            . $emissionTypeStr
            . $invoiceTypeStr
            . $documentSectorPadded
            . $invoiceNumberPadded
            . $posPadded;

        if (strlen($cadena53) !== 53) {
            throw new SiatFiscalException("Longitud incorrecta en concatenación previa a Módulo 11 (esperado 53, obtenido " . strlen($cadena53) . ").");
        }

        // 2. Cálculo oficial de Módulo 11 (dígito 54)
        $digitoVerificador = self::modulo11($cadena53);
        $cadena54 = $cadena53 . (string) $digitoVerificador;

        // 3. Conversión de cadena decimal de 54 dígitos a Base16 (Hexadecimal en mayúsculas) con BCMath
        $hexBase16 = self::bcdechex($cadena54);

        // 4. Concatenación final del Código de Control
        return $hexBase16 . $controlCodeClean;
    }

    /**
     * Algoritmo oficial Módulo 11 del SIN (facturación en línea Bolivia).
     *
     * @param string $cadena 53 dígitos numéricos
     * @param int $limite Factor multiplicador máximo (por defecto 9)
     * @return int Dígito autoverificador (0-9)
     */
    public static function modulo11(string $cadena, int $limite = 9): int
    {
        $punto = 2;
        $suma  = 0;

        for ($i = strlen($cadena) - 1; $i >= 0; $i--) {
            $suma += (int) $cadena[$i] * $punto;
            $punto++;
            if ($punto > $limite) {
                $punto = 2;
            }
        }

        $modulo = $suma % 11;

        if ($modulo === 0) {
            return 0;
        }

        $digito = 11 - $modulo;
        if ($digito === 10) {
            return 1;
        }
        if ($digito === 11) {
            return 0;
        }

        return $digito;
    }

    /**
     * Convierte una cadena decimal arbitrariamente grande a Hexadecimal
     * en mayúsculas utilizando BCMath sin pérdida de precisión.
     */
    public static function bcdechex(string $dec): string
    {
        $hex = '';
        $num = trim($dec);

        while (bccomp($num, '0') > 0) {
            $rem = (int) bcmod($num, '16');
            $hex = dechex($rem) . $hex;
            $num = bcdiv($num, '16', 0);
        }

        return strtoupper($hex !== '' ? $hex : '0');
    }

    /**
     * Valida que la factura cuente con todos los campos indispensables para generar el CUF.
     *
     * @throws SiatFiscalException
     */
    private function validateInvoiceFields(ElectronicInvoice $invoice): void
    {
        if (empty($invoice->invoice_number)) {
            throw new SiatFiscalException("La factura no tiene asignado un número fiscal correlativo.");
        }
        if (empty($invoice->issued_at)) {
            throw new SiatFiscalException("La factura no tiene asignada una fecha de emisión.");
        }
        if (empty($invoice->issuer_nit)) {
            throw new SiatFiscalException("La factura no tiene registrado el NIT del emisor.");
        }
        if ($invoice->branch_code === null) {
            throw new SiatFiscalException("La factura no tiene código de sucursal.");
        }
        if ($invoice->point_of_sale_code === null) {
            throw new SiatFiscalException("La factura no tiene código de punto de venta.");
        }
        if (empty($invoice->siat_modality)) {
            throw new SiatFiscalException("La factura no tiene modalidad SIAT asignada.");
        }
        if (empty($invoice->control_code)) {
            throw new SiatFiscalException("La factura no tiene código de control del CUFD.");
        }
        if (empty($invoice->siat_cufd_id)) {
            throw new SiatFiscalException("La factura no tiene referencia histórica del CUFD (siat_cufd_id).");
        }
    }

    /**
     * Valida la correspondencia exacta y la vigencia histórica del CUFD respecto a issued_at.
     *
     * @throws SiatFiscalException
     */
    private function validateCufdMatch(ElectronicInvoice $invoice): void
    {
        $cufd = SiatCufd::find($invoice->siat_cufd_id);
        if (! $cufd) {
            throw new SiatFiscalException("El CUFD histórico referenciado ({$invoice->siat_cufd_id}) no existe en la base de datos.");
        }

        if ($cufd->store_id !== $invoice->store_id) {
            throw new SiatFiscalException("El CUFD histórico no pertenece a la misma tienda que la factura.");
        }
        if ($cufd->branch_code !== $invoice->branch_code) {
            throw new SiatFiscalException("El CUFD histórico no coincide con la sucursal de la factura ({$cufd->branch_code} vs {$invoice->branch_code}).");
        }
        if ($cufd->point_of_sale_code !== $invoice->point_of_sale_code) {
            throw new SiatFiscalException("El CUFD histórico no coincide con el punto de venta de la factura ({$cufd->point_of_sale_code} vs {$invoice->point_of_sale_code}).");
        }
        if (strtoupper(trim((string) $cufd->control_code)) !== strtoupper(trim((string) $invoice->control_code))) {
            throw new SiatFiscalException("El código de control del CUFD histórico no coincide con el snapshot de la factura.");
        }

        // Validación de ventana de vigencia: issued_at debe estar dentro del período válido del CUFD
        $issued = Carbon::parse($invoice->issued_at);
        if ($issued->lt($cufd->valid_from) || $issued->gt($cufd->valid_until)) {
            throw new SiatFiscalException(
                "La fecha de emisión de la factura ({$issued->toIso8601String()}) se encuentra fuera del período de vigencia del CUFD histórico " .
                "({$cufd->valid_from->toIso8601String()} a {$cufd->valid_until->toIso8601String()})."
            );
        }
    }
}
