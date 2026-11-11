<?php

namespace App\Services\Siat;

use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\Customer;
use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatLegend;
use App\Models\Store;
use Illuminate\Support\Facades\DB;

class SiatInvoicePreparationService
{
    public function __construct(
        private readonly SiatInvoiceNumberService $numberService,
        private readonly SiatPaymentMethodMapper $paymentMethodMapper,
    ) {}

    /**
     * Prepara el documento fiscal y su snapshot inmutable a partir de una venta comercial confirmada.
     *
     * Validaciones estrictas:
     *  - Idempotencia: si ya existe factura para la venta, la retorna sin reasignar número.
     *  - Tienda habilitada para facturación electrónica con sucursal y POS configurados (no nulos).
     *  - Configuración fiscal del tenant completa (NIT, razón social, ambiente, modalidad).
     *  - Datos obligatorios de ubicación (municipio y dirección) presentes (sin datos inventados).
     *  - Readiness fiscal: CUIS y CUFD activos y válidos que coincidan exactamente con store_id, branch_code y point_of_sale_code.
     *  - Validación de comprador: umbral normativo de Bs. 1.000 exige identificación obligatoria (RND 102100000011 Art. 39).
     *  - Homologación fiscal de todos los productos (código SIN, actividad económica, unidad).
     *  - Precisión matemática estricta sin floats (bcmath): subtotales y total coinciden con la venta.
     *  - Homologación del método de pago contra la tabla configurable `siat_payment_mappings`.
     *  - Selección determinista de leyenda fiscal.
     *  - Preservación de timestamp con precisión de milisegundos.
     *
     * @param Sale|string $sale
     * @return ElectronicInvoice
     * @throws SiatFiscalException
     */
    public function prepare(Sale|string $sale): ElectronicInvoice
    {
        if (is_string($sale)) {
            $sale = Sale::findOrFail($sale);
        }

        $sale->loadMissing(['saleDetails.product', 'store', 'customer', 'user']);

        // 1. Idempotencia: Si ya existe factura electrónica para esta venta, retornarla intacta
        $existing = ElectronicInvoice::where('sale_id', $sale->id)->first();
        if ($existing) {
            return $existing->load('details');
        }

        // 2. Verificar Store y códigos fiscales asignados
        $store = $sale->store;
        if (! $store) {
            throw new SiatFiscalException("La venta no tiene una tienda asociada.");
        }
        if (! $store->enable_electronic_invoicing) {
            throw new SiatFiscalException("La tienda '{$store->name}' no tiene habilitada la facturación electrónica.");
        }

        if ($store->sin_branch_code === null || $store->sin_point_of_sale_code === null) {
            throw new SiatFiscalException(
                "La tienda '{$store->name}' no tiene configurados los códigos fiscales de sucursal o punto de venta del SIN."
            );
        }

        $branchCode      = (int) $store->sin_branch_code;
        $pointOfSaleCode = (int) $store->sin_point_of_sale_code;

        // 3. Verificar Configuración Fiscal del Tenant
        $setting = Setting::first();
        if (! $setting || empty($setting->tax_nit) || empty($setting->tax_business_name)) {
            throw new SiatFiscalException("La configuración fiscal del emisor está incompleta (NIT o Razón Social faltantes).");
        }

        // 4. Validar datos obligatorios de ubicación fiscal (sin inventar ubicaciones)
        $municipality = trim((string) ($store->location ?: $setting->address ?: ''));
        if ($municipality === '') {
            throw new SiatFiscalException("La tienda '{$store->name}' no tiene configurado el municipio fiscal (location).");
        }

        $address = trim((string) ($store->address ?: $setting->address ?: ''));
        if ($address === '') {
            throw new SiatFiscalException("La tienda '{$store->name}' no tiene configurada la dirección fiscal (address).");
        }

        // 5. Verificar Readiness Fiscal (CUIS y CUFD coincidentes con branch_code y point_of_sale_code, activos y no vencidos)
        $cuis = SiatCuis::where('store_id', $store->id)
            ->where('branch_code', $branchCode)
            ->where('point_of_sale_code', $pointOfSaleCode)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->first();

        if (! $cuis) {
            throw new SiatFiscalException(
                "No existe un CUIS activo y vigente para la tienda '{$store->name}' (Sucursal {$branchCode}, Punto de Venta {$pointOfSaleCode})."
            );
        }

        $cufd = SiatCufd::where('store_id', $store->id)
            ->where('branch_code', $branchCode)
            ->where('point_of_sale_code', $pointOfSaleCode)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->first();

        if (! $cufd) {
            throw new SiatFiscalException(
                "No existe un CUFD activo y vigente para la tienda '{$store->name}' (Sucursal {$branchCode}, Punto de Venta {$pointOfSaleCode})."
            );
        }

        // 6. Verificar y construir Snapshot del Comprador (con regla oficial de umbral Bs. 1.000)
        $buyerSnapshot = $this->buildBuyerSnapshot($sale);

        // 7. Verificar y construir Snapshot de Productos con homologación fiscal y precisión decimal
        $detailsSnapshotData = $this->buildDetailsSnapshot($sale);

        // 8. Homologación del Método de Pago contra configuración persistida
        $paymentMethodCode = $this->paymentMethodMapper->resolve($sale->payment_method);

        // 9. Selección determinista de Leyenda Fiscal
        $selectedLegend = $this->resolveLegend($detailsSnapshotData['activity_codes']);

        // 10. Fecha de emisión única con precisión de milisegundos
        $now = now();
        $issuedAt = $now->copy()->micro((int) (floor($now->micro / 1000) * 1000));

        // 11. Persistencia atómica y asignación del correlativo fiscal
        return DB::transaction(function () use (
            $sale,
            $store,
            $setting,
            $cufd,
            $branchCode,
            $pointOfSaleCode,
            $municipality,
            $address,
            $buyerSnapshot,
            $detailsSnapshotData,
            $paymentMethodCode,
            $selectedLegend,
            $issuedAt
        ) {
            // Re-verificación de idempotencia dentro del lock de transacción
            $existing = ElectronicInvoice::where('sale_id', $sale->id)->first();
            if ($existing) {
                return $existing->load('details');
            }

            // Asignación atómica de número fiscal independiente por punto de venta
            $invoiceNumber = $this->numberService->getNextInvoiceNumber($store, $branchCode, $pointOfSaleCode);

            $totals = $detailsSnapshotData['totals'];

            $invoice = ElectronicInvoice::create([
                'sale_id'                   => $sale->id,
                'store_id'                  => $store->id,
                'siat_cufd_id'              => $cufd->id,
                'issuer_nit'                => (string) $setting->tax_nit,
                'issuer_business_name'      => (string) $setting->tax_business_name,
                'issuer_municipality'       => $municipality,
                'issuer_address'            => $address,
                'issuer_phone'              => $store->phone ?: $setting->phone,
                'branch_code'               => $branchCode,
                'point_of_sale_code'        => $pointOfSaleCode,
                'siat_environment'          => (int) $setting->siat_environment,
                'siat_modality'             => (int) $setting->siat_modality,
                'buyer_document_type'       => $buyerSnapshot['document_type'],
                'buyer_document_number'     => $buyerSnapshot['document_number'],
                'buyer_document_complement' => $buyerSnapshot['document_complement'],
                'buyer_name'                => $buyerSnapshot['name'],
                'buyer_customer_code'       => $buyerSnapshot['customer_code'],
                'invoice_number'            => $invoiceNumber,
                'cuf'                       => null, // Asignado posteriormente por SiatCufGenerator
                'cufd_snapshot'             => (string) $cufd->cufd,
                'control_code'              => (string) $cufd->control_code,
                'issued_at'                 => $issuedAt,
                'document_sector_code'      => 1, // Compra-Venta
                'subtotal'                  => $totals['subtotal'],
                'discount'                  => '0.00',
                'additional_discount'       => $totals['additional_discount'],
                'gift_card_amount'          => '0.00',
                'total'                     => $totals['total'],
                'total_subject_to_vat'      => $totals['total'],
                'currency_code'             => 1, // Boliviano
                'exchange_rate'             => '1.00000',
                'total_in_currency'         => $totals['total'],
                'payment_method_code'       => $paymentMethodCode,
                'card_number'               => null,
                'exception_code'            => null,
                'cafc'                      => null,
                'legend'                    => $selectedLegend,
                'issued_by'                 => $sale->user?->name ?: 'Sistema Inventarya',
                'status'                    => ElectronicInvoiceStatus::DRAFT,
            ]);

            foreach ($detailsSnapshotData['details'] as $detailItem) {
                $detailItem['electronic_invoice_id'] = $invoice->id;
                ElectronicInvoiceDetail::create($detailItem);
            }

            return $invoice->load('details');
        });
    }

    /**
     * Construye el snapshot del comprador validando las reglas tributarias del SIN
     * y el umbral obligatorio de identificación para importes >= Bs. 1.000.
     *
     * @return array{
     *   document_type: int,
     *   document_number: string,
     *   document_complement: string|null,
     *   name: string,
     *   customer_code: string
     * }
     * @throws SiatFiscalException
     */
    private function buildBuyerSnapshot(Sale $sale): array
    {
        $customer = $sale->customer;
        $saleTotal = $this->formatDecimalString($sale->total, 2);

        // 1. Cliente registrado en la venta
        if ($customer && $sale->customer_id != 0) {
            $docType   = (int) ($customer->document_type ?: 1);
            $docNumber = trim((string) ($customer->document_number ?: $customer->cinit ?: ''));
            $name      = trim((string) ($customer->name ?: ''));
            $code      = (string) $customer->id;

            if (! in_array($docType, [1, 2, 3, 4, 5], true)) {
                throw new SiatFiscalException("El cliente '{$name}' tiene un tipo de documento fiscal inválido ({$docType}).");
            }
            if ($docNumber === '' || $docNumber === '0') {
                throw new SiatFiscalException("El cliente registrado '{$name}' debe contar con un número de documento fiscal válido.");
            }
            if ($name === '') {
                throw new SiatFiscalException("El cliente debe contar con un nombre o razón social válido.");
            }

            return [
                'document_type'       => $docType,
                'document_number'     => $docNumber,
                'document_complement' => $customer->document_complement ? trim($customer->document_complement) : null,
                'name'                => $name,
                'customer_code'       => $code,
            ];
        }

        // 2. Venta sin cliente registrado: Validar umbral de Bs. 1.000 (RND 102100000011 Art. 39)
        if (bccomp($saleTotal, '1000.00', 2) >= 0) {
            throw new SiatFiscalException(
                "Para ventas con importe igual o superior a Bs. 1.000, la normativa del SIN exige la identificación obligatoria del comprador (RND 102100000011 Art. 39). No se permite consumidor final sin identificación."
            );
        }

        // 3. Venta menor a Bs. 1.000: Consumidor final sin identificación permitido
        $buyerName = trim((string) ($sale->name ?: 'Sin Nombre'));

        return [
            'document_type'       => 5, // NIT
            'document_number'     => '0',
            'document_complement' => null,
            'name'                => $buyerName !== '' ? $buyerName : 'Sin Nombre',
            'customer_code'       => 'CF',
        ];
    }

    /**
     * Valida homologación fiscal e importes de cada producto y construye el snapshot.
     *
     * @throws SiatFiscalException
     */
    private function buildDetailsSnapshot(Sale $sale): array
    {
        $saleDetails = $sale->saleDetails;

        if ($saleDetails->isEmpty()) {
            throw new SiatFiscalException("La venta no contiene ningún producto en su detalle.");
        }

        $calculatedSubtotal = '0.00';
        $details = [];
        $activityCodes = [];

        foreach ($saleDetails as $item) {
            $product = $item->product;
            if (! $product) {
                throw new SiatFiscalException("El producto con ID '{$item->product_id}' no existe en el catálogo.");
            }

            // Validar homologación fiscal completa
            if (empty($product->sin_product_code) || empty($product->sin_activity_code) || empty($product->sin_unit_code)) {
                throw new SiatFiscalException(
                    "El producto '{$product->name}' no cuenta con homologación fiscal completa en SIAT " .
                    "(código producto SIN, actividad económica o unidad de medida sin asignar)."
                );
            }

            $activityCodes[] = (string) $product->sin_activity_code;

            // Precisión monetaria controlada con bcmath sin conversión float
            $qty   = $this->formatDecimalString($item->quantity, 3);
            $price = $this->formatDecimalString($item->price, 2);
            $itemSubtotal = bcmul($qty, $price, 2);

            $calculatedSubtotal = bcadd($calculatedSubtotal, $itemSubtotal, 2);

            $details[] = [
                'product_id'        => $product->id,
                'product_code'      => $product->sku ?: (string) $product->id,
                'sin_product_code'  => (string) $product->sin_product_code,
                'sin_activity_code' => (string) $product->sin_activity_code,
                'sin_unit_code'     => (int) $product->sin_unit_code,
                'description'       => (string) $product->name,
                'quantity'          => $qty,
                'unit_price'        => $price,
                'discount'          => '0.00',
                'subtotal'          => $itemSubtotal,
                'serial_number'     => null,
                'imei_number'       => null,
            ];
        }

        $additionalDiscount = $this->formatDecimalString($sale->discount ?? '0.00', 2);
        $calculatedTotal    = bcsub($calculatedSubtotal, $additionalDiscount, 2);
        $saleTotalFormatted = $this->formatDecimalString($sale->total, 2);

        if (bccomp($calculatedTotal, $saleTotalFormatted, 2) !== 0) {
            throw new SiatFiscalException(
                "Inconsistencia en importes: total calculado ({$calculatedTotal}) no coincide con el total de la venta ({$saleTotalFormatted})."
            );
        }

        return [
            'details'        => $details,
            'activity_codes' => array_unique($activityCodes),
            'totals'         => [
                'subtotal'            => $calculatedSubtotal,
                'additional_discount' => $additionalDiscount,
                'total'               => $calculatedTotal,
            ],
        ];
    }

    /**
     * Resuelve de forma determinista la leyenda fiscal oficial para la actividad económica.
     *
     * @param array<string> $activityCodes
     * @throws SiatFiscalException
     */
    private function resolveLegend(array $activityCodes): string
    {
        $legend = SiatLegend::whereIn('activity_code', $activityCodes)->first();

        if (! $legend || empty($legend->description)) {
            throw new SiatFiscalException(
                "No se encontró ninguna leyenda fiscal en el catálogo local de SIAT (siat_legends) para las actividades económicas de la venta."
            );
        }

        return $legend->description;
    }

    /**
     * Normaliza un valor numérico/cadena a string decimal con escala fija usando BCMath.
     */
    private function formatDecimalString(string|int $value, int $scale = 2): string
    {
        $str = trim((string) $value);
        if ($str === '') {
            $str = '0';
        }
        return bcadd($str, '0', $scale);
    }
}
