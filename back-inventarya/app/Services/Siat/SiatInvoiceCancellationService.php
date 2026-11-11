<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;
use App\Enums\ElectronicInvoiceStatus;
use App\Enums\SiatCancellationStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\Setting;
use App\Models\SiatCancellationReason;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatInvoiceOperation;
use App\Models\Store;
use App\Notifications\Tenant\SiatInvoiceCancelledNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use RuntimeException;
use Throwable;

/**
 * Servicio de Anulación Fiscal de Facturas Compra-Venta (Fase 4H).
 *
 * Flujo normativo y seguro:
 *  1. Cargar y verificar que la factura esté ACCEPTED (previamente validada por el SIN).
 *  2. Validar CUF inmutable.
 *  3. Validar que el motivo de anulación exista en el catálogo sincronizado.
 *  4. Validar plazo normativo local (hasta el día 9 del mes siguiente a la emisión).
 *  5. Control de concurrencia mediante claim atómico (cancellation_pending_at).
 *  6. Construir SolicitudServicioAnulacionFactura conforme al WSDL oficial.
 *  7. Invocar anulacionFactura fuera de transacción de base de datos.
 *  8. Interpretar respuesta oficial (905 CONFIRMED vs 906 REJECTED, 924, 925, 934).
 *  9. Transicionar a CANCELLED únicamente ante confirmación inequívoca (905).
 * 10. Registrar auditoría completa en siat_invoice_operations.
 * 11. Despachar notificación al comprador post-confirmación (si dispone de correo).
 * 12. Invalidar representación gráfica previa para que refleje el sello FACTURA ANULADA.
 *
 * RESTRICCIÓN: CERO reversión comercial automática (Sale/stock/caja intactos).
 */
class SiatInvoiceCancellationService
{
    public function __construct(
        private readonly SiatServiceFactory $factory,
        private readonly SiatCancellationDeadlineService $deadlineService,
    ) {}

    /**
     * Anula fiscalmente una factura electrónica validada ante el SIN.
     *
     * @param  ElectronicInvoice           $invoice
     * @param  int                         $reasonCode
     * @param  Store|null                  $operatingStore     Sucursal/POS que ejecuta la anulación (por defecto la de la factura)
     * @param  SiatSoapClientInterface|null $soapClientOverride Inyección de fake para pruebas
     * @return array{
     *     success: bool,
     *     status: string,
     *     codigo_estado: int|null,
     *     codigo_recepcion: string|null,
     *     cancellation_pending: bool,
     *     error_message: string|null,
     *     cuf: string,
     *     sin_response: array|null,
     *     buyer_notification_status: string
     * }
     *
     * @throws SiatFiscalException|RuntimeException
     */
    public function cancel(
        ElectronicInvoice $invoice,
        int $reasonCode,
        ?Store $operatingStore = null,
        ?SiatSoapClientInterface $soapClientOverride = null,
    ): array {
        $startedAt = now();

        // 1. Validaciones previas
        $this->validatePrerequisites($invoice, $reasonCode);

        // 2. Resolver motivo descriptivo desde catálogo
        $reason = SiatCancellationReason::where('code', $reasonCode)->firstOrFail();

        // 3. Control de concurrencia y Claim atómico
        $this->claimCancellationAttempt($invoice);

        $operatingStore = $operatingStore ?? $invoice->store;
        if (!$operatingStore) {
            $operatingStore = Store::findOrFail($invoice->store_id);
        }

        try {
            // 4. Construir request oficial
            $solicitud = $this->buildSolicitudAnulacion($invoice, $reasonCode, $operatingStore);

            // 5. Resolver cliente SOAP
            $soapClient = $soapClientOverride ?? $this->resolveSoapClient();

            // 6. Invocar anulacionFactura (fuera de transacción DB)
            $response = $soapClient->anulacionFactura($solicitud);

            // 7. Interpretar respuesta y persistir resultado
            return $this->processCancellationResponse($invoice, $reasonCode, $reason->description, $response, $startedAt);

        } catch (Throwable $e) {
            return $this->handleCancellationFailure($invoice, $reasonCode, $e, $startedAt);
        }
    }

    /**
     * Valida las precondiciones normativas y de integridad antes de iniciar el proceso.
     */
    private function validatePrerequisites(ElectronicInvoice $invoice, int $reasonCode): void
    {
        // 0. Prohibición normativa permanente: Una factura cuya anulación fue revertida NO puede volver a anularse
        if ($invoice->cancellation_reversed_at !== null) {
            throw new SiatFiscalException("CANCELLATION_AFTER_REVERSAL_NOT_ALLOWED: La factura ID '{$invoice->id}' tuvo una reversión de anulación previa y normativamente no puede volver a anularse.");
        }

        // 1. Estado fiscal debe ser ACCEPTED
        if ($invoice->status === ElectronicInvoiceStatus::CANCELLED) {
            throw new SiatFiscalException("La factura ID '{$invoice->id}' ya se encuentra anulada fiscalmente.");
        }

        if ($invoice->status !== ElectronicInvoiceStatus::ACCEPTED) {
            throw new SiatFiscalException("Solo es posible anular facturas en estado ACCEPTED. El estado actual es '{$invoice->status->value}'.");
        }

        // 2. CUF debe existir
        if (empty($invoice->cuf)) {
            throw new SiatFiscalException("La factura ID '{$invoice->id}' no posee un CUF asignado para anulación.");
        }

        // 3. Motivo debe existir en el catálogo sincronizado
        $reasonExists = SiatCancellationReason::where('code', $reasonCode)->exists();
        if (!$reasonExists) {
            throw new SiatFiscalException("El código de motivo de anulación '{$reasonCode}' no existe en el catálogo oficial sincronizado.");
        }

        // 4. Plazo normativo local
        if (!empty($invoice->issued_at) && !$this->deadlineService->isWithinDeadline($invoice->issued_at)) {
            $deadline = $this->deadlineService->getDeadline($invoice->issued_at)->format('d/m/Y H:i:s');
            throw new SiatFiscalException("La factura ID '{$invoice->id}' ha excedido el plazo legal de anulación (límite: {$deadline}).");
        }
    }

    /**
     * Realiza un claim atómico para evitar anulación simultánea (doble clic / concurrencia).
     */
    private function claimCancellationAttempt(ElectronicInvoice $invoice): void
    {
        DB::transaction(function () use ($invoice) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

            if ($locked->cancellation_reversed_at !== null) {
                throw new SiatFiscalException("CANCELLATION_AFTER_REVERSAL_NOT_ALLOWED: La factura ID '{$invoice->id}' tuvo una reversión de anulación previa y normativamente no puede volver a anularse.");
            }

            if ($locked->status === ElectronicInvoiceStatus::CANCELLED) {
                throw new SiatFiscalException("La factura ID '{$invoice->id}' ya se encuentra anulada fiscalmente.");
            }

            if ($locked->status !== ElectronicInvoiceStatus::ACCEPTED) {
                throw new SiatFiscalException("La factura ID '{$invoice->id}' se encuentra en estado '{$locked->status->value}' y no puede anularse.");
            }

            if ($locked->cancellation_pending_at !== null) {
                // Si la marca de concurrencia es reciente (menos de 2 minutos), bloquear
                if ($locked->cancellation_pending_at->gt(now()->subMinutes(2))) {
                    throw new SiatFiscalException("Ya existe una solicitud de anulación en curso para la factura ID '{$invoice->id}'.");
                }
            }

            $locked->cancellation_pending_at = now();
            $locked->save();
        });
    }

    /**
     * Construye la estructura oficial SolicitudServicioAnulacionFactura.
     */
    public function buildSolicitudAnulacion(ElectronicInvoice $invoice, int $reasonCode, Store $operatingStore): array
    {
        $setting = Setting::first();
        if (!$setting) {
            throw new RuntimeException('No hay configuración (Setting) disponible para este tenant.');
        }

        $systemCode = (string) ($setting->siat_system_code ?? '');
        if (empty($systemCode)) {
            throw new RuntimeException('Código de sistema SIAT no configurado en Settings.');
        }

        // Obtener CUIS operativo vigente para la sucursal/POS de anulación
        $cuisRecord = SiatCuis::where('branch_code', (int) $operatingStore->sin_branch_code)
            ->where('point_of_sale_code', (int) $operatingStore->sin_point_of_sale_code)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->latest('id')
            ->first();

        if (!$cuisRecord || empty($cuisRecord->cuis)) {
            throw new RuntimeException("No existe un CUIS activo y vigente para la sucursal {$operatingStore->sin_branch_code} y punto de venta {$operatingStore->sin_point_of_sale_code}.");
        }

        // Obtener CUFD operativo vigente para la sucursal/POS de anulación
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
            'codigoMotivo'          => (int) $reasonCode,
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
     * Procesa e interpreta la respuesta de anulacionFactura del SIN.
     */
    private function processCancellationResponse(
        ElectronicInvoice $invoice,
        int $reasonCode,
        string $reasonDescription,
        array $response,
        \DateTimeInterface $startedAt,
    ): array {
        $inner = $response['RespuestaServicioFacturacion'] ?? $response;
        $codigoEstado = isset($inner['codigoEstado']) ? (int) $inner['codigoEstado'] : 0;
        $cancellationStatus = SiatCancellationStatus::fromCode($codigoEstado);
        $codigoRecepcion = $inner['codigoRecepcion'] ?? null;
        $codigoDescripcion = $inner['codigoDescripcion'] ?? $cancellationStatus?->label() ?? 'DESCONOCIDO';

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

        // Caso 905: ANULACIÓN CONFIRMADA
        if ($cancellationStatus?->isConfirmed()) {
            DB::transaction(function () use ($invoice, $reasonCode, $codigoEstado, $inner) {
                /** @var ElectronicInvoice $locked */
                $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

                $locked->status                   = ElectronicInvoiceStatus::CANCELLED;
                $locked->cancelled_at             = now();
                $locked->cancellation_reason_code = $reasonCode;
                $locked->cancellation_status_code = $codigoEstado;
                $locked->cancellation_pending_at  = null;
                $locked->sin_response             = $inner;
                $locked->error_message            = null;
                // Invalida la ruta del PDF para que el próximo acceso genere el documento con sello ANULADA
                $locked->pdf_path                 = null;
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

            // Despachar notificación al comprador
            $buyerNotificationStatus = $this->notifyBuyer($invoice, $reasonCode, $reasonDescription);

            Log::info("[SIAT] Factura {$invoice->id} (CUF: {$invoice->cuf}) anulada fiscalmente con éxito (Código 905).", [
                'reason_code' => $reasonCode,
                'buyer_notification' => $buyerNotificationStatus,
            ]);

            return [
                'success'                   => true,
                'status'                    => ElectronicInvoiceStatus::CANCELLED->value,
                'codigo_estado'             => $codigoEstado,
                'codigo_recepcion'          => $codigoRecepcion,
                'cancellation_pending'      => false,
                'error_message'             => null,
                'cuf'                       => $invoice->cuf,
                'sin_response'              => $inner,
                'buyer_notification_status' => $buyerNotificationStatus,
            ];
        }

        // Caso 906 / 924 / 925 / 934 u otros rechazos: permanece ACCEPTED
        DB::transaction(function () use ($invoice, $codigoEstado, $errorMsg, $codigoDescripcion) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

            // Permanece ACCEPTED pues fiscalmente continúa válida
            $locked->cancellation_status_code = $codigoEstado;
            $locked->cancellation_pending_at  = null;
            $locked->error_message            = $errorMsg ?? "Anulación rechazada por SIN: [{$codigoEstado}] {$codigoDescripcion}";
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

        Log::warning("[SIAT] Solicitud de anulación para factura {$invoice->id} rechazada por el SIN.", [
            'codigo_estado' => $codigoEstado,
            'descripcion'   => $codigoDescripcion,
            'mensajes'      => $errorMsg,
        ]);

        return [
            'success'                   => false,
            'status'                    => ElectronicInvoiceStatus::ACCEPTED->value,
            'codigo_estado'             => $codigoEstado,
            'codigo_recepcion'          => $codigoRecepcion,
            'cancellation_pending'      => false,
            'error_message'             => $errorMsg ?? $codigoDescripcion,
            'cuf'                       => $invoice->cuf,
            'sin_response'              => $inner,
            'buyer_notification_status' => 'not_sent',
        ];
    }

    /**
     * Maneja fallos de transporte, timeout o excepciones del cliente SOAP.
     */
    private function handleCancellationFailure(
        ElectronicInvoice $invoice,
        int $reasonCode,
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

        // La factura permanece ACCEPTED pero con señal de anulación pendiente/ambigua
        DB::transaction(function () use ($invoice, $errorMsg) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();
            $locked->error_message = "Fallo de transporte en anulación: {$errorMsg}";
            $locked->save();
        });

        Log::error("[SIAT] Excepción durante anulacionFactura para factura {$invoice->id}: {$errorMsg}", [
            'invoice_id' => $invoice->id,
            'cuf'        => $invoice->cuf,
            'exception'  => get_class($e),
        ]);

        return [
            'success'                   => false,
            'status'                    => ElectronicInvoiceStatus::ACCEPTED->value,
            'codigo_estado'             => null,
            'codigo_recepcion'          => null,
            'cancellation_pending'      => true,
            'error_message'             => $errorMsg,
            'cuf'                       => $invoice->cuf,
            'sin_response'              => null,
            'buyer_notification_status' => 'not_sent',
        ];
    }

    /**
     * Envía la notificación al comprador exclusivamente tras confirmación (905).
     */
    private function notifyBuyer(ElectronicInvoice $invoice, int $reasonCode, string $reasonDescription): string
    {
        try {
            $invoice->loadMissing('sale.customer');
            $buyerEmail = $invoice->sale?->customer?->email;

            if (empty($buyerEmail)) {
                return 'unavailable';
            }

            $notification = SiatInvoiceCancelledNotification::fromInvoiceAndReason($invoice, $reasonCode, $reasonDescription);
            Notification::route('mail', $buyerEmail)->notify($notification);

            return 'sent';
        } catch (Throwable $e) {
            Log::warning("[SIAT] No se pudo enviar notificación de anulación al comprador: {$e->getMessage()}", [
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
                'operation'             => 'cancel',
                'started_at'            => $startedAt,
                'finished_at'           => now(),
                'transport_status'      => $transportStatus,
                'siat_status_code'      => $siatStatusCode,
                'reception_code'        => $receptionCode,
                'response'              => $response,
                'error_message'         => $errorMessage,
            ]);
        } catch (Throwable $e) {
            Log::error("[SIAT] Fallo al registrar operación de anulación en siat_invoice_operations: {$e->getMessage()}");
        }
    }

    private function resolveSoapClient(): SiatSoapClientInterface
    {
        return app(SiatSoapClientInterface::class);
    }
}
