<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;
use App\Enums\ElectronicInvoiceStatus;
use App\Enums\SiatCancellationReversalStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\Setting;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatInvoiceOperation;
use App\Models\Store;
use App\Notifications\Tenant\SiatInvoiceCancellationReversedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use RuntimeException;
use Throwable;

/**
 * Servicio de Reversión de Anulación Fiscal de Facturas Compra-Venta (Fase 4I).
 *
 * Responsabilidad exclusiva:
 *  1. Cargar y validar que la factura esté en estado CANCELLED.
 *  2. Verificar evidencia fehaciente de anulación fiscal previa (Código 905).
 *  3. Comprobar que nunca antes fue revertida (regla de única vez: cancellation_reversed_at === null).
 *  4. Validar plazo normativo legal (hasta el día 9 del mes siguiente a la emisión).
 *  5. Control de concurrencia mediante claim atómico (cancellation_reversal_pending_at).
 *  6. Construir SolicitudServicioReversionAnulacionFactura según WSDL oficial.
 *  7. Ejecutar reversionAnulacionFactura fuera de transacción de base de datos.
 *  8. Interpretar respuesta oficial (907 CONFIRMED vs 906/981/3011/3012 REJECTED).
 *  9. Reconciliar estado: únicamente ante 907 transiciona CANCELLED → ACCEPTED.
 * 10. Despachar notificación de restitución al comprador (si dispone de correo).
 * 11. Invalidar representación gráfica previa para que refleje documento válido.
 * 12. Registrar auditoría inmutable en siat_invoice_operations.
 *
 * RESTRICCIÓN: CERO llamadas reales al SIN en tests. CERO modificación de CUF, totales o XML.
 */
class SiatInvoiceCancellationReversalService
{
    public function __construct(
        private readonly SiatCancellationDeadlineService $deadlineService,
    ) {}

    /**
     * Revierte por única vez la anulación de una factura electrónica ante el SIN.
     *
     * @param  ElectronicInvoice           $invoice
     * @param  Store|null                  $operatingStore     Sucursal/POS que ejecuta la reversión (por defecto la de la factura)
     * @param  SiatSoapClientInterface|null $soapClientOverride Inyección de fake para pruebas
     * @return array{
     *     success: bool,
     *     status: string,
     *     codigo_estado: int|null,
     *     codigo_recepcion: string|null,
     *     reversal_pending: bool,
     *     error_message: string|null,
     *     cuf: string,
     *     sin_response: array|null,
     *     buyer_notification_status: string
     * }
     *
     * @throws SiatFiscalException|RuntimeException
     */
    public function reverse(
        ElectronicInvoice $invoice,
        ?Store $operatingStore = null,
        ?SiatSoapClientInterface $soapClientOverride = null,
    ): array {
        $startedAt = now();

        // 1. Validaciones previas
        $this->validatePrerequisites($invoice);

        // 2. Control de concurrencia y Claim atómico
        $this->claimReversalAttempt($invoice);

        $operatingStore = $operatingStore ?? $invoice->store;
        if (!$operatingStore) {
            $operatingStore = Store::findOrFail($invoice->store_id);
        }

        try {
            // 3. Construir request oficial
            $solicitud = $this->buildSolicitudReversion($invoice, $operatingStore);

            // 4. Resolver cliente SOAP
            $soapClient = $soapClientOverride ?? $this->resolveSoapClient();

            // 5. Invocar reversionAnulacionFactura (fuera de transacción DB)
            $response = $soapClient->reversionAnulacionFactura($solicitud);

            // 6. Interpretar respuesta y persistir resultado
            return $this->processReversalResponse($invoice, $response, $startedAt);

        } catch (Throwable $e) {
            return $this->handleReversalFailure($invoice, $e, $startedAt);
        }
    }

    /**
     * Valida las precondiciones normativas y de integridad antes de iniciar el proceso de reversión.
     */
    private function validatePrerequisites(ElectronicInvoice $invoice): void
    {
        // 1. Estado fiscal debe ser CANCELLED
        if ($invoice->status !== ElectronicInvoiceStatus::CANCELLED) {
            throw new SiatFiscalException("Solo es posible revertir la anulación de facturas en estado CANCELLED. El estado actual es '{$invoice->status->value}'.");
        }

        // 2. Regla normativa de única vez: Nunca debe haber sido revertida antes
        if ($invoice->isCancellationReversed()) {
            throw new SiatFiscalException("La anulación de la factura ID '{$invoice->id}' ya fue revertida previamente. La normativa permite revertir la anulación una sola vez.");
        }

        // 3. Evidencia fehaciente de anulación fiscal 905
        $hasConfirmedCancellation = ($invoice->cancellation_status_code === 905)
            || SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)
                ->where('operation', 'cancel')
                ->where('siat_status_code', 905)
                ->exists();

        if (!$hasConfirmedCancellation) {
            throw new SiatFiscalException("No existe evidencia fiscal de anulación confirmada (Código 905) para la factura ID '{$invoice->id}'. No es posible revertir.");
        }

        // 4. CUF debe existir
        if (empty($invoice->cuf)) {
            throw new SiatFiscalException("La factura ID '{$invoice->id}' no posee un CUF asignado para reversión.");
        }

        // 5. Plazo normativo legal
        if (!empty($invoice->issued_at) && !$this->deadlineService->isWithinDeadline($invoice->issued_at)) {
            $deadline = $this->deadlineService->getDeadline($invoice->issued_at)->format('d/m/Y H:i:s');
            throw new SiatFiscalException("La factura ID '{$invoice->id}' ha excedido el plazo legal para reversión de anulación (límite: {$deadline}).");
        }
    }

    /**
     * Realiza un claim atómico para evitar solicitudes simultáneas de reversión (doble clic / concurrencia).
     */
    private function claimReversalAttempt(ElectronicInvoice $invoice): void
    {
        DB::transaction(function () use ($invoice) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== ElectronicInvoiceStatus::CANCELLED) {
                throw new SiatFiscalException("La factura ID '{$invoice->id}' se encuentra en estado '{$locked->status->value}' y no puede revertirse.");
            }

            if ($locked->isCancellationReversed()) {
                throw new SiatFiscalException("La anulación de la factura ID '{$invoice->id}' ya fue revertida previamente.");
            }

            if ($locked->cancellation_reversal_pending_at !== null) {
                // Si la marca de concurrencia es reciente (menos de 2 minutos), bloquear
                if ($locked->cancellation_reversal_pending_at->gt(now()->subMinutes(2))) {
                    throw new SiatFiscalException("Ya existe una solicitud de reversión de anulación en curso para la factura ID '{$invoice->id}'.");
                }
            }

            $locked->cancellation_reversal_pending_at = now();
            $locked->save();
        });
    }

    /**
     * Construye la estructura oficial SolicitudServicioReversionAnulacionFactura.
     */
    public function buildSolicitudReversion(ElectronicInvoice $invoice, Store $operatingStore): array
    {
        $setting = Setting::first();
        if (!$setting) {
            throw new RuntimeException('No hay configuración (Setting) disponible para este tenant.');
        }

        $systemCode = (string) ($setting->siat_system_code ?? '');
        if (empty($systemCode)) {
            throw new RuntimeException('Código de sistema SIAT no configurado en Settings.');
        }

        // Obtener CUIS operativo vigente para la sucursal/POS de reversión
        $cuisRecord = SiatCuis::where('branch_code', (int) $operatingStore->sin_branch_code)
            ->where('point_of_sale_code', (int) $operatingStore->sin_point_of_sale_code)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->latest('id')
            ->first();

        if (!$cuisRecord || empty($cuisRecord->cuis)) {
            throw new RuntimeException("No existe un CUIS activo y vigente para la sucursal {$operatingStore->sin_branch_code} y punto de venta {$operatingStore->sin_point_of_sale_code}.");
        }

        // Obtener CUFD operativo vigente para la sucursal/POS de reversión
        $cufdRecord = SiatCufd::where('branch_code', (int) $operatingStore->sin_branch_code)
            ->where('point_of_sale_code', (int) $operatingStore->sin_point_of_sale_code)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->latest('id')
            ->first();

        if (!$cufdRecord || empty($cufdRecord->cufd)) {
            throw new RuntimeException("No existe un CUFD activo y vigente para la sucursal {$operatingStore->sin_branch_code} y punto de venta {$operatingStore->sin_point_of_sale_code}.");
        }

        return [
            'codigoAmbiente'        => (int) ($invoice->siat_environment ?? $setting->siat_environment ?? 2),
            'codigoDocumentoSector' => (int) ($invoice->document_sector_code ?? 1),
            'codigoEmision'         => 1, // 1 = En Línea
            'codigoModalidad'       => (int) ($invoice->siat_modality ?? $setting->siat_modality ?? 1),
            'codigoPuntoVenta'      => (int) ($operatingStore->sin_point_of_sale_code ?? 0),
            'codigoSistema'         => $systemCode,
            'codigoSucursal'        => (int) ($operatingStore->sin_branch_code ?? 0),
            'cufd'                  => (string) $cufdRecord->cufd,
            'cuis'                  => (string) $cuisRecord->cuis,
            'nit'                   => (int) ($invoice->issuer_nit ?? $setting->nit ?? 0),
            'tipoFacturaDocumento'  => 1, // 1 = Con Derecho a Crédito Fiscal
            'cuf'                   => (string) $invoice->cuf,
        ];
    }

    /**
     * Procesa e interpreta la respuesta de reversionAnulacionFactura del SIN.
     */
    private function processReversalResponse(
        ElectronicInvoice $invoice,
        array $response,
        \DateTimeInterface $startedAt,
    ): array {
        $inner = $response['RespuestaServicioFacturacion'] ?? $response;
        $codigoEstado = isset($inner['codigoEstado']) ? (int) $inner['codigoEstado'] : 0;
        $reversalStatus = SiatCancellationReversalStatus::fromCode($codigoEstado);
        $codigoRecepcion = $inner['codigoRecepcion'] ?? null;
        $codigoDescripcion = $inner['codigoDescripcion'] ?? $reversalStatus?->label() ?? 'DESCONOCIDO';

        $messages = $inner['mensajesList'] ?? [];
        if (isset($messages['codigo']) || isset($messages['descripcion'])) {
            $messages = [$messages];
        }

        $errorMsg = null;
        if (!empty($messages)) {
            $formattedMsgs = array_map(function ($m) {
                $code = $m['codigo'] ?? '';
                $desc = $m['descripcion'] ?? '';
                return "[{$code}] {$desc}";
            }, $messages);
            $errorMsg = implode('; ', $formattedMsgs);
        }

        // Caso 907: REVERSIÓN DE ANULACIÓN CONFIRMADA
        if ($reversalStatus?->isConfirmed()) {
            DB::transaction(function () use ($invoice, $codigoEstado, $inner) {
                /** @var ElectronicInvoice $locked */
                $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

                $locked->status                            = ElectronicInvoiceStatus::ACCEPTED;
                $locked->cancellation_reversed_at          = now();
                $locked->cancellation_reversal_status_code = $codigoEstado;
                $locked->cancellation_reversal_pending_at  = null;
                $locked->cancellation_pending_at           = null;
                $locked->sin_response                      = $inner;
                $locked->error_message                     = null;
                // Invalida la ruta del PDF para que el próximo acceso genere el documento restituido
                $locked->pdf_path                          = null;
                $locked->save();
            });

            // Registrar auditoría inmutable
            $this->recordOperation(
                $invoice,
                $startedAt,
                'success',
                $codigoEstado,
                $codigoRecepcion,
                $response,
                null
            );

            // Despachar notificación de restitución al comprador
            $buyerNotificationStatus = $this->notifyBuyer($invoice);

            Log::info("[SIAT] Factura {$invoice->id} (CUF: {$invoice->cuf}) reversión de anulación confirmada con éxito (Código 907).", [
                'buyer_notification' => $buyerNotificationStatus,
            ]);

            return [
                'success'                   => true,
                'status'                    => ElectronicInvoiceStatus::ACCEPTED->value,
                'codigo_estado'             => $codigoEstado,
                'codigo_recepcion'          => $codigoRecepcion,
                'reversal_pending'          => false,
                'error_message'             => null,
                'cuf'                       => $invoice->cuf,
                'sin_response'              => $inner,
                'buyer_notification_status' => $buyerNotificationStatus,
            ];
        }

        // Caso 906 / 981 / 3011 / 3012 u otros rechazos: permanece CANCELLED
        DB::transaction(function () use ($invoice, $codigoEstado, $errorMsg, $codigoDescripcion) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

            $locked->cancellation_reversal_status_code = $codigoEstado;
            $locked->cancellation_reversal_pending_at  = null;
            $locked->error_message                     = $errorMsg ?? "Reversión rechazada por SIN: [{$codigoEstado}] {$codigoDescripcion}";
            $locked->save();
        });

        // Registrar auditoría de rechazo
        $this->recordOperation(
            $invoice,
            $startedAt,
            'rejected',
            $codigoEstado,
            $codigoRecepcion,
            $response,
            $errorMsg ?? $codigoDescripcion
        );

        Log::warning("[SIAT] Solicitud de reversión de anulación para factura {$invoice->id} rechazada por el SIN.", [
            'codigo_estado' => $codigoEstado,
            'descripcion'   => $codigoDescripcion,
            'mensajes'      => $errorMsg,
        ]);

        return [
            'success'                   => false,
            'status'                    => ElectronicInvoiceStatus::CANCELLED->value,
            'codigo_estado'             => $codigoEstado,
            'codigo_recepcion'          => $codigoRecepcion,
            'reversal_pending'          => false,
            'error_message'             => $errorMsg ?? $codigoDescripcion,
            'cuf'                       => $invoice->cuf,
            'sin_response'              => $inner,
            'buyer_notification_status' => 'not_sent',
        ];
    }

    /**
     * Maneja fallos de transporte, timeout o excepciones del cliente SOAP durante la reversión.
     */
    private function handleReversalFailure(
        ElectronicInvoice $invoice,
        Throwable $e,
        \DateTimeInterface $startedAt,
    ): array {
        $errorMsg = $e->getMessage();
        $isTimeout = str_contains(strtolower($errorMsg), 'timeout')
            || str_contains(strtolower($errorMsg), 'timed out')
            || str_contains(strtolower($errorMsg), 'could not connect');

        $transportStatus = $isTimeout ? 'timeout' : 'error';

        // Registrar operación fallida o ambigua en auditoría
        $this->recordOperation(
            $invoice,
            $startedAt,
            $transportStatus,
            null,
            null,
            null,
            $errorMsg
        );

        // La factura permanece CANCELLED pero con marca de reversión pendiente/ambigua
        DB::transaction(function () use ($invoice, $errorMsg) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();
            $locked->error_message = "Fallo de transporte en reversión de anulación: {$errorMsg}";
            $locked->save();
        });

        Log::error("[SIAT] Excepción durante reversionAnulacionFactura para factura {$invoice->id}: {$errorMsg}", [
            'invoice_id' => $invoice->id,
            'cuf'        => $invoice->cuf,
            'exception'  => get_class($e),
        ]);

        return [
            'success'                   => false,
            'status'                    => ElectronicInvoiceStatus::CANCELLED->value,
            'codigo_estado'             => null,
            'codigo_recepcion'          => null,
            'reversal_pending'          => true,
            'error_message'             => $errorMsg,
            'cuf'                       => $invoice->cuf,
            'sin_response'              => null,
            'buyer_notification_status' => 'not_sent',
        ];
    }

    /**
     * Envía la notificación de restitución al comprador tras confirmación exitosa (907).
     */
    private function notifyBuyer(ElectronicInvoice $invoice): string
    {
        try {
            $invoice->loadMissing('sale.customer');
            $buyerEmail = $invoice->sale?->customer?->email;

            if (empty($buyerEmail)) {
                return 'unavailable';
            }

            $notification = SiatInvoiceCancellationReversedNotification::fromInvoice($invoice);
            Notification::route('mail', $buyerEmail)->notify($notification);

            return 'sent';
        } catch (Throwable $e) {
            Log::warning("[SIAT] No se pudo enviar notificación de reversión de anulación al comprador: {$e->getMessage()}", [
                'invoice_id' => $invoice->id,
            ]);
            return 'failed';
        }
    }

    /**
     * Registra el intento en la tabla inmutable siat_invoice_operations.
     */
    private function recordOperation(
        ElectronicInvoice $invoice,
        \DateTimeInterface $startedAt,
        string $transportStatus,
        ?int $siatStatusCode,
        ?string $receptionCode,
        ?array $response,
        ?string $errorMessage,
    ): void {
        try {
            SiatInvoiceOperation::create([
                'electronic_invoice_id' => $invoice->id,
                'operation'             => 'reverse_cancel',
                'started_at'            => $startedAt,
                'finished_at'           => now(),
                'transport_status'      => $transportStatus,
                'siat_status_code'      => $siatStatusCode,
                'reception_code'        => $receptionCode,
                'response'              => $response,
                'error_message'         => $errorMessage,
            ]);
        } catch (Throwable $e) {
            Log::error("[SIAT] Fallo al registrar operación de reversión en siat_invoice_operations: {$e->getMessage()}");
        }
    }

    private function resolveSoapClient(): SiatSoapClientInterface
    {
        if (app()->bound(SiatSoapClientInterface::class)) {
            return app(SiatSoapClientInterface::class);
        }

        $setting = Setting::first();
        if (!$setting) {
            throw new RuntimeException('No hay configuración (Setting) disponible para este tenant.');
        }

        return new SiatSoapClient($setting);
    }
}
