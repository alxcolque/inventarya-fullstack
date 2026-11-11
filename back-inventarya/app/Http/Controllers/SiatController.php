<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\Store;
use App\Services\Siat\SiatServiceFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * SiatController
 *
 * Endpoints de administración SIAT para uso exclusivo del owner.
 * Permiten diagnosticar la integración y gestionar CUIS/CUFD manualmente.
 *
 * NOTA: Esta fase (3B.1) NO emite facturas.
 */
class SiatController extends Controller
{
    public function __construct(
        private readonly SiatServiceFactory $factory,
    ) {}

    // =========================================================================
    // GET /siat/status
    // =========================================================================

    /**
     * Estado consolidado de la configuración SIAT del tenant.
     * Devuelve configuración global (Setting) + estado de cada Store.
     */
    public function status(): JsonResponse
    {
        $setting = Setting::first();

        $stores = Store::where('enable_electronic_invoicing', true)
            ->get()
            ->map(function (Store $store) {
                $cufd = SiatCufd::where('store_id', $store->id)
                    ->where('is_active', true)
                    ->latest('valid_from')
                    ->first();

                $cuis = SiatCuis::where('store_id', $store->id)
                    ->where('is_active', true)
                    ->latest('created_at')
                    ->first();

                return [
                    'id'                     => $store->id,
                    'name'                   => $store->name,
                    'sin_branch_code'        => $store->sin_branch_code,
                    'sin_point_of_sale_code' => $store->sin_point_of_sale_code,
                    'cuis_active'            => (bool) ($cuis && $cuis->isValid()),
                    'cuis_valid_until'       => $cuis?->valid_until?->toIso8601String(),
                    'cufd_active'            => (bool) ($cufd && $cufd->isValid()),
                    'cufd_valid_until'       => $cufd?->valid_until?->toIso8601String(),
                    'cufd_id'                => $cufd?->id,
                ];
            });

        return response()->json([
            'electronic_invoicing_status' => $setting?->electronic_invoicing_status ?? 'disabled',
            'tax_nit'                     => $setting?->tax_nit,
            'tax_business_name'           => $setting?->tax_business_name,
            'siat_environment'            => $setting?->siat_environment,
            'siat_modality'               => $setting?->siat_modality,
            'siat_token_configured'       => (bool) $setting?->siat_token_configured,
            'stores'                      => $stores,
        ]);
    }

    // =========================================================================
    // POST /siat/verify-communication
    // =========================================================================

    /**
     * Verifica la conectividad con el servidor SIN.
     */
    public function verifyCommunication(): JsonResponse
    {
        try {
            $service  = $this->factory->makeForCurrentTenant();
            $result   = $service->verificarComunicacion();
            $httpCode = $result['success'] ? 200 : 502;

            return response()->json($result, $httpCode);
        } catch (\Throwable $e) {
            Log::warning('[SIAT] verifyCommunication controller error', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'message' => 'No fue posible establecer comunicación con SIAT.',
            ], 502);
        }
    }

    // =========================================================================
    // GET /siat/datetime
    // =========================================================================

    /**
     * Compara la hora local con la hora oficial del SIN.
     */
    public function getDatetime(): JsonResponse
    {
        try {
            $service = $this->factory->makeForCurrentTenant();
            $result  = $service->sincronizarFechaHora();

            return response()->json($result);
        } catch (\Throwable $e) {
            Log::warning('[SIAT] getDatetime controller error', ['error' => $e->getMessage()]);

            return response()->json([
                'error' => 'No fue posible sincronizar fecha/hora con SIAT.',
            ], 502);
        }
    }

    // =========================================================================
    // POST /siat/stores/{store}/refresh-cuis
    // =========================================================================

    /**
     * Fuerza la renovación del CUIS para una Store específica.
     */
    public function refreshCuis(Store $store): JsonResponse
    {
        try {
            $service = $this->factory->makeForCurrentTenant();
            $result  = $service->refreshCuis($store);

            return response()->json([
                'message'     => 'CUIS renovado correctamente.',
                'cuis'        => substr($result['cuis'], 0, 8) . '***',
                'valid_until' => $result['valid_until'],
                'from_cache'  => $result['from_cache'],
            ]);
        } catch (\Throwable $e) {
            Log::warning('[SIAT] refreshCuis controller error', [
                'store' => $store->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'No fue posible obtener o renovar el CUIS en SIAT.',
            ], 502);
        }
    }

    // =========================================================================
    // POST /siat/stores/{store}/refresh-cufd
    // =========================================================================

    /**
     * Fuerza la obtención de un nuevo CUFD para una Store específica.
     */
    public function refreshCufd(Store $store): JsonResponse
    {
        try {
            $service = $this->factory->makeForCurrentTenant();
            $cufd    = $service->refreshCufd($store);

            return response()->json([
                'message'     => 'CUFD renovado correctamente.',
                'cufd_id'     => $cufd->id,
                'valid_until' => $cufd->valid_until?->toIso8601String(),
                'is_active'   => $cufd->is_active,
            ]);
        } catch (\Throwable $e) {
            Log::warning('[SIAT] refreshCufd controller error', [
                'store' => $store->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'No fue posible obtener o renovar el CUFD en SIAT.',
            ], 502);
        }
    }

    // =========================================================================
    // POST /siat/stores/{store}/sync-catalog/{catalog}
    // =========================================================================

    /**
     * Sincroniza un catálogo paramétrico SIAT para una Store.
     * El resultado se persiste en la BD y queda disponible en caché.
     */
    public function syncCatalog(Request $request, Store $store, string $catalog): JsonResponse
    {
        $allowed = [
            'Actividades', 'actividades',
            'ProductosServicios', 'productos_servicios',
            'LeyendasFactura', 'leyendas',
            'TipoMetodoPago', 'tipo_metodo_pago',
            'TipoDocumentoIdentidad', 'TipoDocumentoSector',
            'ActividadesDocumentoSector', 'UnidadMedida',
            'TipoMoneda', 'Paises',
        ];

        if (!in_array($catalog, $allowed, true)) {
            return response()->json([
                'error'   => 'Catálogo no permitido.',
                'allowed' => $allowed,
            ], 422);
        }

        try {
            $service = $this->factory->makeForCurrentTenant();
            $items   = $service->getCatalog($catalog, $store, forceRefresh: true);

            return response()->json([
                'message'   => "Catálogo '{$catalog}' sincronizado correctamente.",
                'catalog'   => $catalog,
                'total'     => count($items),
                'items'     => $items,
            ]);
        } catch (\Throwable $e) {
            Log::warning('[SIAT] syncCatalog controller error', [
                'catalog' => $catalog,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'error' => "No fue posible sincronizar el catálogo '{$catalog}' con SIAT.",
            ], 502);
        }
    }

    // =========================================================================
    // GET /siat/stores/{store}/readiness
    // =========================================================================

    /**
     * Diagnóstico de preparación fiscal general del Tenant.
     */
    public function tenantReadiness(): JsonResponse
    {
        $readiness = app(\App\Services\Siat\SiatReadinessService::class)->tenantReadiness();

        return response()->json($readiness, 200);
    }

    /**
     * Diagnóstico de preparación fiscal de productos (homologación SIN).
     */
    public function productReadiness(): JsonResponse
    {
        $diagnostics = app(\App\Services\Siat\SiatReadinessService::class)->productFiscalReadiness();

        return response()->json($diagnostics, 200);
    }

    /**
     * Verifica si una Store está fiscalmente preparada para emitir facturas.
     */
    public function storeReadiness(Store $store): JsonResponse
    {
        $setting = Setting::first();

        if (!$setting) {
            return response()->json([
                'ready'  => false,
                'issues' => ['No hay configuración de tenant disponible.'],
            ], 422);
        }

        try {
            $readinessService = app(\App\Services\Siat\SiatReadinessService::class);
            $result = $readinessService->storeReadiness($store, $setting);

            return response()->json($result, $result['ready'] ? 200 : 422);
        } catch (\Throwable $e) {
            Log::warning('[SIAT] storeReadiness controller error', ['error' => $e->getMessage()]);

            return response()->json([
                'ready'  => false,
                'issues' => ['Error al evaluar estado de preparación de la tienda.'],
            ], 422);
        }
    }

    /**
     * Consulta el estado fiscal derivado y elegibilidad de facturación de una venta.
     */
    public function saleFiscalStatus(Sale $sale): JsonResponse
    {
        $readinessService = app(\App\Services\Siat\SiatReadinessService::class);
        $status = $readinessService->getSaleFiscalStatus($sale);
        $validation = $readinessService->validateSaleForInvoicing($sale);

        return response()->json([
            'sale_id'       => $sale->id,
            'fiscal_status' => $status,
            'eligible'      => $validation['eligible'],
            'issues'        => $validation['issues'],
        ], 200);
    }

    // =========================================================================
    // POST /siat/invoices/prepare/{sale}
    // =========================================================================

    /**
     * Prepara el snapshot fiscal e inicializa el documento ElectronicInvoice (draft)
     * para una venta confirmada existente con correlativo fiscal atómico.
     */
    public function prepareInvoice(
        Request $request,
        \App\Models\Sale $sale,
        \App\Services\Siat\SiatInvoicePreparationService $preparationService
    ): JsonResponse {
        try {
            $invoice = $preparationService->prepare($sale);

            return response()->json([
                'success' => true,
                'message' => 'Factura electrónica preparada exitosamente en estado borrador.',
                'invoice' => $invoice,
            ], 200);
        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error al preparar factura electrónica', [
                'sale_id' => $sale->id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Ocurrió un error inesperado al preparar la factura fiscal.',
            ], 500);
        }
    }

    // =========================================================================
    // POST /siat/invoices/{invoice}/cuf
    // =========================================================================

    /**
     * Genera y persiste atómicamente el Código Único de Factura (CUF) para una factura borrador.
     */
    public function generateCuf(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatCufGenerator $cufGenerator
    ): JsonResponse {
        try {
            $updatedInvoice = $cufGenerator->generateAndPersist($invoice);

            return response()->json([
                'success' => true,
                'message' => 'Código Único de Factura (CUF) generado y persistido exitosamente.',
                'invoice' => $updatedInvoice,
            ], 200);
        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error al generar CUF', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Ocurrió un error inesperado al generar el CUF fiscal.',
            ], 500);
        }
    }

    // =========================================================================
    // POST /siat/invoices/{invoice}/xml
    // =========================================================================

    /**
     * Construye, valida contra el XSD oficial del SIN y persiste el archivo XML fiscal.
     */
    public function generateXml(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceXmlBuilder $xmlBuilder
    ): JsonResponse {
        try {
            $result = $xmlBuilder->buildAndPersist($invoice);

            return response()->json([
                'success' => true,
                'message' => $result['already_existed']
                    ? 'El XML de la factura ya existía en el almacenamiento.'
                    : 'XML fiscal generado, validado contra XSD oficial y persistido exitosamente.',
                'data' => [
                    'invoice_id'      => $invoice->id,
                    'invoice_number'  => $invoice->invoice_number,
                    'cuf'             => $invoice->cuf,
                    'xml_path'        => $result['xml_path'],
                    'already_existed' => $result['already_existed'],
                ],
            ], 200);
        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error al generar XML', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Ocurrió un error inesperado al generar el XML fiscal.',
            ], 500);
        }
    }

    /**
     * Firma digitalmente el XML fiscal de una factura en Modalidad 1 (Electrónica en Línea).
     */
    public function signInvoice(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceXmlBuilder $xmlBuilder
    ): JsonResponse {
        if ((int) $invoice->siat_modality !== 1) {
            return response()->json([
                'success' => false,
                'message' => 'La Modalidad 2 (Computarizada en Línea) no requiere firma digital.',
            ], 422);
        }

        try {
            $result = $xmlBuilder->signInvoice($invoice);

            return response()->json([
                'success' => true,
                'message' => ($result['already_signed'] ?? false)
                    ? 'El XML de la factura ya se encontraba válidamente firmado.'
                    : 'XML fiscal firmado digitalmente, verificado criptográficamente y validado contra XSD oficial.',
                'data' => [
                    'invoice_id'              => $invoice->id,
                    'invoice_number'          => $invoice->invoice_number,
                    'cuf'                     => $invoice->cuf,
                    'xml_path'                => $result['xml_path'],
                    'is_signed'               => true,
                    'already_signed'          => $result['already_signed'] ?? false,
                    'certificate_fingerprint' => $result['certificate_fingerprint'] ?? null,
                ],
            ], 200);
        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error al firmar XML de factura', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Ocurrió un error inesperado al firmar el XML fiscal.',
            ], 500);
        }
    }

    /**
     * Empaqueta y transmite (simulado o real según configuración) una factura fiscal al SIN.
     * POST /siat/invoices/{invoice}/submit
     */
    public function submitInvoice(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceSubmissionService $submissionService
    ): JsonResponse {
        try {
            $result = $submissionService->submit($invoice);

            $httpStatus = $result['success'] ? 200 : ($result['status'] === 'processing' ? 202 : 422);

            return response()->json([
                'success' => $result['success'],
                'message' => $result['success']
                    ? 'Factura fiscal transmitida y aceptada exitosamente por el SIN.'
                    : ($result['status'] === 'processing'
                        ? 'La transmisión produjo un estado ambiguo o pendiente de verificación.'
                        : 'La factura fiscal fue rechazada por el SIN.'),
                'data' => [
                    'invoice_id'       => $invoice->id,
                    'status'           => $result['status'],
                    'codigo_estado'    => $result['codigo_estado'],
                    'codigo_recepcion' => $result['codigo_recepcion'],
                    'error_message'    => $result['error_message'],
                    'hash_archivo'     => $result['hash_archivo'],
                    'compressed_size'  => $result['compressed_size'],
                ],
            ], $httpStatus);
        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error al procesar envío de factura fiscal', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Consulta y reconcilia el estado oficial de una factura ante el SIN.
     * POST /siat/invoices/{invoice}/verify
     */
    public function verifyInvoice(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceVerificationService $verificationService
    ): JsonResponse {
        try {
            $result = $verificationService->verify($invoice, null, true);

            $httpStatus = $result['success'] ? 200 : ($result['status'] === 'processing' ? 202 : 422);

            return response()->json([
                'success' => $result['success'],
                'message' => $result['success']
                    ? 'Estado de la factura fiscal verificado y confirmado como ACEPTADA.'
                    : ($result['status'] === 'processing'
                        ? 'La verificación reportó estado ambiguo, observado o pendiente en el SIN.'
                        : 'La factura fiscal fue rechazada por el SIN.'),
                'data' => [
                    'invoice_id'       => $invoice->id,
                    'status'           => $result['status'],
                    'codigo_estado'    => $result['codigo_estado'],
                    'codigo_recepcion' => $result['codigo_recepcion'],
                    'error_message'    => $result['error_message'],
                    'cuf'              => $result['cuf'],
                ],
            ], $httpStatus);
        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error al verificar estado de factura fiscal', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Genera o retorna el archivo PDF oficial de la representación gráfica de la factura.
     * GET /siat/invoices/{invoice}/pdf
     */
    public function downloadPdf(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceRepresentationService $representationService
    ): \Symfony\Component\HttpFoundation\Response {
        try {
            $format = (string) $request->query('format', 'thermal');
            if (!in_array($format, ['thermal', 'a4', 'rollo', 'letter'], true)) {
                $format = 'thermal';
            }
            if ($format === 'rollo') {
                $format = 'thermal';
            }
            if ($format === 'letter') {
                $format = 'a4';
            }

            $force = $request->boolean('force', false);
            $result = $representationService->generatePdf($invoice, $format, $force);

            $disposition = $request->boolean('download') ? 'attachment' : 'inline';
            $filename    = "Factura_{$invoice->invoice_number}.pdf";

            return response($result['content'], 200, [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => "{$disposition}; filename=\"{$filename}\"",
                'Cache-Control'       => 'private, max-age=3600',
            ]);
        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error al generar PDF de factura fiscal', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al generar la representación gráfica en PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Retorna la representación gráfica en HTML para visualización o impresión directa.
     * GET /siat/invoices/{invoice}/representation
     */
    public function showRepresentation(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceRepresentationService $representationService
    ): \Symfony\Component\HttpFoundation\Response {
        try {
            $format = (string) $request->query('format', 'thermal');
            if (!in_array($format, ['thermal', 'a4', 'rollo', 'letter'], true)) {
                $format = 'thermal';
            }
            if ($format === 'rollo') {
                $format = 'thermal';
            }
            if ($format === 'letter') {
                $format = 'a4';
            }

            $html = $representationService->renderHtml($invoice, $format);

            return response($html, 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Retorna el catálogo oficial de motivos de anulación del SIN sincronizado en el tenant.
     * GET /siat/cancellation-reasons
     */
    public function cancellationReasons(): JsonResponse
    {
        $reasons = \App\Models\SiatCancellationReason::orderBy('code')
            ->get(['code', 'description']);

        return response()->json([
            'success' => true,
            'data'    => $reasons,
        ]);
    }

    /**
     * Anula fiscalmente una Factura Compra-Venta validada ante el SIN.
     * POST /siat/invoices/{invoice}/cancel
     */
    public function cancelInvoice(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceCancellationService $cancellationService
    ): JsonResponse {
        $validated = $request->validate([
            'reason_code' => 'required|integer',
        ]);

        try {
            $result = $cancellationService->cancel($invoice, (int) $validated['reason_code']);

            $invoice->refresh();

            // Status HTTP conforme al resultado
            $httpStatus = 200;
            if (!$result['success']) {
                $httpStatus = $result['cancellation_pending'] ? 202 : 422;
            }

            return response()->json([
                'success' => $result['success'],
                'data'    => [
                    'id'                        => $invoice->id,
                    'invoice_number'            => $invoice->invoice_number,
                    'status'                    => $invoice->status->value,
                    'codigo_estado'             => $result['codigo_estado'],
                    'codigo_recepcion'          => $result['codigo_recepcion'],
                    'cancellation_pending'      => $result['cancellation_pending'],
                    'cancellation_reason_code'  => $invoice->cancellation_reason_code,
                    'cancelled_at'              => $invoice->cancelled_at?->toIso8601String(),
                    'error_message'             => $result['error_message'],
                    'buyer_notification_status' => $result['buyer_notification_status'],
                ],
            ], $httpStatus);

        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error inesperado al anular factura fiscal', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Revierte por única vez la anulación fiscal de una Factura Compra-Venta ante el SIN.
     * POST /siat/invoices/{invoice}/reverse-cancellation
     */
    public function reverseCancellation(
        Request $request,
        \App\Models\ElectronicInvoice $invoice,
        \App\Services\Siat\SiatInvoiceCancellationReversalService $reversalService
    ): JsonResponse {
        try {
            $result = $reversalService->reverse($invoice);

            $invoice->refresh();

            // Status HTTP conforme al resultado
            $httpStatus = 200;
            if (!$result['success']) {
                $httpStatus = $result['reversal_pending'] ? 202 : 422;
            }

            return response()->json([
                'success' => $result['success'],
                'data'    => [
                    'id'                        => $invoice->id,
                    'invoice_number'            => $invoice->invoice_number,
                    'status'                    => $invoice->status->value,
                    'codigo_estado'             => $result['codigo_estado'],
                    'codigo_recepcion'          => $result['codigo_recepcion'],
                    'cancellation_reversed'     => $invoice->isCancellationReversed(),
                    'cancellation_reversed_at'  => $invoice->cancellation_reversed_at?->toIso8601String(),
                    'reversal_pending'          => $result['reversal_pending'],
                    'error_message'             => $result['error_message'],
                    'buyer_notification_status' => $result['buyer_notification_status'],
                ],
            ], $httpStatus);

        } catch (\App\Exceptions\SiatFiscalException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[SIAT] Error inesperado al revertir anulación de factura fiscal', [
                'invoice_id' => $invoice->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}


