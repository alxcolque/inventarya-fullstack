<?php

namespace App\Services\Siat;

use App\Enums\ElectronicInvoiceStatus;
use App\Models\ElectronicInvoice;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\Store;

/**
 * SiatReadinessService
 *
 * Servicio centralizado para el diagnóstico y evaluación de preparación fiscal
 * en Inventarya (Tenant, Store, Productos y Ventas). Desacopla la lógica comercial
 * de la fiscal.
 */
class SiatReadinessService
{
    /**
     * Evalúa el estado general de preparación fiscal del Tenant.
     *
     * @return array{
     *     enabled: bool,
     *     configured: bool,
     *     operational: bool,
     *     missing_requirements: string[],
     *     modality: int|null,
     *     environment: int|null
     * }
     */
    public function tenantReadiness(?Setting $setting = null): array
    {
        $setting ??= Setting::first();

        if (!$setting) {
            return [
                'enabled'              => false,
                'configured'           => false,
                'operational'          => false,
                'missing_requirements' => ['setting_record'],
                'modality'             => null,
                'environment'          => null,
            ];
        }

        $missing = [];

        if (empty($setting->tax_nit)) {
            $missing[] = 'tax_nit';
        }
        if (empty($setting->tax_business_name)) {
            $missing[] = 'tax_business_name';
        }
        if (!$setting->siat_token_configured) {
            $missing[] = 'siat_api_token';
        }
        if (empty($setting->siat_environment)) {
            $missing[] = 'siat_environment';
        }
        if (empty($setting->siat_modality)) {
            $missing[] = 'siat_modality';
        }
        if (empty($setting->siat_system_code)) {
            $missing[] = 'siat_system_code';
        }
        if ((int) $setting->siat_modality === 1 && empty($setting->siat_certificate_path)) {
            $missing[] = 'siat_certificate';
        }

        $enabled    = (bool) $setting->electronic_invoicing_enabled;
        $configured = empty($missing);

        // Operacional si está configurado y al menos una tienda cuenta con CUIS y CUFD activos
        $operational = false;
        if ($configured && $enabled) {
            $operational = Store::where('enable_electronic_invoicing', true)
                ->whereNotNull('sin_branch_code')
                ->whereNotNull('sin_point_of_sale_code')
                ->get()
                ->contains(fn (Store $st) => $this->hasActiveCuisAndCufd($st));
        }

        return [
            'enabled'              => $enabled,
            'configured'           => $configured,
            'operational'          => $operational,
            'missing_requirements' => $missing,
            'modality'             => $setting->siat_modality ? (int) $setting->siat_modality : null,
            'environment'          => $setting->siat_environment ? (int) $setting->siat_environment : null,
        ];
    }

    /**
     * Evalúa el estado de preparación fiscal de una Sucursal/Tienda (Store) específica.
     *
     * @return array{
     *     ready: bool,
     *     enabled: bool,
     *     configured: bool,
     *     operational: bool,
     *     issues: string[],
     *     missing_requirements: string[],
     *     has_cuis: bool,
     *     has_cufd: bool
     * }
     */
    public function storeReadiness(Store $store, ?Setting $setting = null): array
    {
        $setting ??= Setting::first();
        $issues  = [];
        $missing = [];

        if (!$setting) {
            return [
                'ready'                => false,
                'enabled'              => false,
                'configured'           => false,
                'operational'          => false,
                'issues'               => ['No hay configuración de tenant disponible.'],
                'missing_requirements' => ['setting_record'],
                'has_cuis'             => false,
                'has_cufd'             => false,
            ];
        }

        // 1. Facturación global habilitada en tenant
        if (!$setting->electronic_invoicing_enabled) {
            $issues[]  = 'La facturación electrónica no está habilitada en Configuración.';
            $missing[] = 'electronic_invoicing_enabled';
        }

        // 2. Parámetros fiscales del tenant
        if (empty($setting->tax_nit)) {
            $issues[]  = 'Falta el NIT fiscal en Configuración.';
            $missing[] = 'tax_nit';
        }
        if (empty($setting->tax_business_name)) {
            $issues[]  = 'Falta la razón social fiscal en Configuración.';
            $missing[] = 'tax_business_name';
        }
        if (!$setting->siat_token_configured) {
            $issues[]  = 'Falta el token API SIAT en Configuración.';
            $missing[] = 'siat_api_token';
        }
        if (empty($setting->siat_environment)) {
            $issues[]  = 'Falta el ambiente SIAT en Configuración.';
            $missing[] = 'siat_environment';
        }
        if (empty($setting->siat_modality)) {
            $issues[]  = 'Falta la modalidad SIAT en Configuración.';
            $missing[] = 'siat_modality';
        }
        if (empty($setting->siat_system_code)) {
            $issues[]  = 'Falta el código de sistema SIAT en Configuración.';
            $missing[] = 'siat_system_code';
        }
        if ((int) $setting->siat_modality === 1 && empty($setting->siat_certificate_path)) {
            $issues[]  = 'La modalidad Electrónica en Línea requiere certificado digital.';
            $missing[] = 'siat_certificate';
        }

        // 3. Store habilitada
        if (!$store->enable_electronic_invoicing) {
            $issues[]  = "La tienda '{$store->name}' no tiene facturación electrónica habilitada.";
            $missing[] = 'store_enable_electronic_invoicing';
        }

        // 4. Códigos SIN de sucursal y punto de venta (0 es código válido para Casa Matriz y POS Base)
        if (is_null($store->sin_branch_code)) {
            $issues[]  = "La tienda '{$store->name}' no tiene Código de Sucursal SIN configurado.";
            $missing[] = 'sin_branch_code';
        }
        if (is_null($store->sin_point_of_sale_code)) {
            $issues[]  = "La tienda '{$store->name}' no tiene Código de Punto de Venta SIN configurado.";
            $missing[] = 'sin_point_of_sale_code';
        }

        $configured = empty($missing);
        $hasCuis    = false;
        $hasCufd    = false;

        // 5. Verificación de códigos de autorización vigentes
        if (!is_null($store->sin_branch_code) && !is_null($store->sin_point_of_sale_code)) {
            $hasCuis = SiatCuis::where('store_id', $store->id)
                ->where('branch_code', (int) $store->sin_branch_code)
                ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
                ->where('is_active', true)
                ->where('valid_until', '>', now())
                ->exists();

            if (!$hasCuis) {
                $issues[]  = "La tienda '{$store->name}' no tiene CUIS activo y vigente.";
                $missing[] = 'active_cuis';
            }

            $hasCufd = SiatCufd::where('store_id', $store->id)
                ->where('branch_code', (int) $store->sin_branch_code)
                ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
                ->where('is_active', true)
                ->where('valid_until', '>', now())
                ->exists();

            if (!$hasCufd) {
                $issues[]  = "La tienda '{$store->name}' no tiene CUFD activo y vigente.";
                $missing[] = 'active_cufd';
            }
        }

        $isReady = empty($issues);

        return [
            'ready'                => $isReady,
            'enabled'              => (bool) ($setting->electronic_invoicing_enabled && $store->enable_electronic_invoicing),
            'configured'           => $configured,
            'operational'          => $isReady,
            'issues'               => $issues,
            'missing_requirements' => array_values(array_unique($missing)),
            'has_cuis'             => $hasCuis,
            'has_cufd'             => $hasCufd,
        ];
    }

    /**
     * Diagnóstico de productos: diferencia productos listos de productos sin mapeo fiscal.
     *
     * @return array{
     *     total_products: int,
     *     products_ready: int,
     *     products_missing_fiscal_mapping: int,
     *     sample_missing: array
     * }
     */
    public function productFiscalReadiness(): array
    {
        $total = Product::count();

        $ready = Product::whereNotNull('sin_product_code')
            ->whereNotNull('sin_activity_code')
            ->where('sin_product_code', '!=', '')
            ->where('sin_activity_code', '!=', '')
            ->count();

        $missingCount = $total - $ready;

        $sampleMissing = Product::where(function ($q) {
            $q->whereNull('sin_product_code')
                ->orWhereNull('sin_activity_code')
                ->orWhere('sin_product_code', '')
                ->orWhere('sin_activity_code', '');
        })
            ->select(['id', 'name', 'sku', 'barcode', 'sin_product_code', 'sin_activity_code'])
            ->limit(10)
            ->get()
            ->toArray();

        return [
            'total_products'                  => $total,
            'products_ready'                  => $ready,
            'products_missing_fiscal_mapping' => $missingCount,
            'sample_missing'                  => $sampleMissing,
        ];
    }

    /**
     * Determina el estado fiscal derivado de una venta comercial.
     *
     * Estados posibles:
     * - not_applicable : El tenant o la tienda no usan facturación electrónica.
     * - not_configured : El tenant o la tienda tienen configuración fiscal incompleta.
     * - ready          : La tienda y tenant están listos para emitir factura si el usuario lo desea.
     * - draft          : Se generó el borrador de factura electrónica.
     * - processing     : La factura está en cola o transmitiéndose ante el SIN.
     * - accepted       : Factura validada exitosamente ante el SIN.
     * - rejected       : Factura rechazada por el SIN.
     * - cancelled      : Factura anulada fiscalmente ante el SIN.
     */
    public function getSaleFiscalStatus(Sale $sale): string
    {
        $invoice = $sale->relationLoaded('electronicInvoice')
            ? $sale->electronicInvoice
            : $sale->electronicInvoice()->first();

        if ($invoice) {
            return match ($invoice->status) {
                ElectronicInvoiceStatus::ACCEPTED  => 'accepted',
                ElectronicInvoiceStatus::REJECTED  => 'rejected',
                ElectronicInvoiceStatus::CANCELLED => 'cancelled',
                ElectronicInvoiceStatus::PROCESSING,
                ElectronicInvoiceStatus::PENDING   => 'processing',
                ElectronicInvoiceStatus::DRAFT     => 'draft',
                default                            => 'draft',
            };
        }

        $setting = Setting::first();
        if (!$setting || !$setting->electronic_invoicing_enabled) {
            return 'not_applicable';
        }

        $store = $sale->relationLoaded('store') ? $sale->store : $sale->store()->first();
        if (!$store || !$store->enable_electronic_invoicing) {
            return 'not_applicable';
        }

        $storeReadiness = $this->storeReadiness($store, $setting);
        if (!$storeReadiness['configured']) {
            return 'not_configured';
        }

        return 'ready';
    }

    /**
     * Valida si una venta puede proceder a emisión fiscal sin errores de homologación.
     *
     * @return array{eligible: bool, issues: string[]}
     */
    public function validateSaleForInvoicing(Sale $sale): array
    {
        $issues = [];

        $store = $sale->store;
        if (!$store) {
            $issues[] = 'La venta no tiene una tienda asociada.';
            return ['eligible' => false, 'issues' => $issues];
        }

        $setting = Setting::first();
        $storeState = $this->storeReadiness($store, $setting);
        if (!$storeState['ready']) {
            $issues = array_merge($issues, $storeState['issues']);
        }

        // Validar productos de la venta
        $sale->loadMissing('saleDetails.product');
        foreach ($sale->saleDetails as $detail) {
            $product = $detail->product;
            if (!$product) {
                $issues[] = "Detalle de venta #{$detail->id} no tiene producto registrado.";
                continue;
            }

            if (empty($product->sin_product_code) || empty($product->sin_activity_code)) {
                $issues[] = "El producto '{$product->name}' no cuenta con homologación fiscal (código de producto o actividad SIN no asignado).";
            }
        }

        return [
            'eligible' => empty($issues),
            'issues'   => $issues,
        ];
    }

    private function hasActiveCuisAndCufd(Store $store): bool
    {
        if (is_null($store->sin_branch_code) || is_null($store->sin_point_of_sale_code)) {
            return false;
        }

        $hasCuis = SiatCuis::where('store_id', $store->id)
            ->where('branch_code', (int) $store->sin_branch_code)
            ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->exists();

        if (!$hasCuis) {
            return false;
        }

        return SiatCufd::where('store_id', $store->id)
            ->where('branch_code', (int) $store->sin_branch_code)
            ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->exists();
    }
}
