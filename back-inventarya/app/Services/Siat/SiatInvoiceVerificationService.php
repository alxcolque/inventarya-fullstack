<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;
use App\Enums\ElectronicInvoiceStatus;
use App\Enums\SiatReceptionStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\Setting;
use App\Models\SiatCuis;
use App\Models\SiatInvoiceOperation;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Servicio de Verificación de Estado y Reconciliación Fiscal (Fase 4F).
 *
 * Responsabilidad exclusiva:
 *  1. Validar elegibilidad de la factura para verificación.
 *  2. Concurrencia e idempotencia: nunca degradar una factura ACCEPTED confirmada.
 *  3. Construir SolicitudServicioVerificacionEstadoFactura exacta según contrato WSDL oficial.
 *  4. Ejecutar verificacionEstadoFactura ante el cliente SOAP (sin reenvío ciego).
 *  5. Interpretar código de estado mediante SiatReceptionStatus (908, 904, 901, 902, 903, 924, etc.).
 *  6. Registrar cada intento en el historial inmutable siat_invoice_operations.
 *  7. Reconciliar el estado local en ElectronicInvoice con política de backoff.
 */
class SiatInvoiceVerificationService
{
    /**
     * Intervalos de backoff gradual en minutos según número de intentos.
     */
    private const BACKOFF_MINUTES = [
        1 => 1,
        2 => 5,
        3 => 15,
        4 => 30,
    ];

    /**
     * Máximo de intentos automáticos antes de requerir intervención administrativa.
     */
    public const MAX_AUTOMATIC_VERIFICATION_ATTEMPTS = 5;

    public function __construct(
        private readonly SiatServiceFactory $factory,
    ) {}

    /**
     * Verifica el estado oficial de una factura ante el SIN y reconcilia el estado local.
     *
     * @param  ElectronicInvoice           $invoice
     * @param  SiatSoapClientInterface|null $soapClientOverride Inyección de fake para pruebas
     * @param  bool                         $isManualExecution   Si fue invocada explícitamente por un usuario/admin
     * @return array{
     *     success: bool,
     *     status: string,
     *     codigo_estado: int|null,
     *     codigo_recepcion: string|null,
     *     error_message: string|null,
     *     cuf: string,
     *     sin_response: array|null
     * }
     *
     * @throws SiatFiscalException|RuntimeException
     */
    public function verify(
        ElectronicInvoice $invoice,
        ?SiatSoapClientInterface $soapClientOverride = null,
        bool $isManualExecution = false
    ): array {
        $startedAt = now();

        // 1. Validar elegibilidad y consistencia de datos
        $this->validateVerificationPrerequisites($invoice);

        // Si ya está ACCEPTED localmente y no es verificación manual administrativa, retornar de forma segura e idempotente
        if ($invoice->status === ElectronicInvoiceStatus::ACCEPTED && !$isManualExecution) {
            $msg = 'Verificación omitida: la factura ya se encuentra confirmada como ACCEPTED localmente.';
            $this->recordOperation($invoice, 'verify', $startedAt, 'success', 908, $invoice->reception_code, null, $msg);

            return [
                'success'          => true,
                'status'           => ElectronicInvoiceStatus::ACCEPTED->value,
                'codigo_estado'    => 908,
                'codigo_recepcion' => $invoice->reception_code,
                'not_found_at_sin' => false,
                'error_message'    => null,
                'cuf'              => $invoice->cuf,
                'sin_response'     => $invoice->sin_response,
            ];
        }

        // 2. Control de concurrencia y registro de intento
        $this->claimVerificationAttempt($invoice, $isManualExecution);

        try {
            // 3. Construir request oficial
            $solicitud = $this->buildSolicitudVerificacion($invoice);

            // 4. Resolver cliente SOAP
            $soapClient = $soapClientOverride ?? $this->resolveSoapClient();

            // 5. Ejecutar verificacionEstadoFactura (CERO reenvío)
            $response = $soapClient->verificacionEstadoFactura($solicitud);

            // 6. Interpretar respuesta y reconciliar estado local
            return $this->processVerificationResponse($invoice, $response, $startedAt);

        } catch (Throwable $e) {
            // Manejo de fallo de transporte o timeout durante verificación
            $this->handleVerificationTransportFailure($invoice, $e, $startedAt);

            // Regla: si ya estaba ACCEPTED localmente, nunca se degrada su estado
            if ($invoice->status === ElectronicInvoiceStatus::ACCEPTED) {
                return [
                    'success'          => true,
                    'status'           => ElectronicInvoiceStatus::ACCEPTED->value,
                    'codigo_estado'    => null,
                    'codigo_recepcion' => $invoice->reception_code,
                    'not_found_at_sin' => false,
                    'error_message'    => "Fallo de transporte en verificación posterior ({$e->getMessage()}), pero el estado ACCEPTED se preserva inmutable.",
                    'cuf'              => $invoice->cuf,
                    'sin_response'     => null,
                ];
            }

            throw $e;
        }
    }

    /**
     * Valida los requisitos mínimos para consultar el estado fiscal de la factura.
     */
    private function validateVerificationPrerequisites(ElectronicInvoice $invoice): void
    {
        if (empty($invoice->cuf)) {
            throw new SiatFiscalException("La factura ID '{$invoice->id}' no cuenta con CUF asignado para verificación.");
        }

        if (empty($invoice->cufd_snapshot)) {
            throw new SiatFiscalException("La factura ID '{$invoice->id}' no cuenta con CUFD snapshot asociado.");
        }
    }

    /**
     * Registra el inicio del intento de verificación e incrementa contadores atómicamente.
     */
    private function claimVerificationAttempt(ElectronicInvoice $invoice, bool $isManual): void
    {
        DB::transaction(function () use ($invoice) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

            $locked->verification_attempts = (int) $locked->verification_attempts + 1;
            $locked->last_verified_at = now();
            $locked->save();

            $invoice->verification_attempts = $locked->verification_attempts;
            $invoice->last_verified_at = $locked->last_verified_at;
        });
    }

    /**
     * Construye la SolicitudServicioVerificacionEstadoFactura oficial.
     */
    public function buildSolicitudVerificacion(ElectronicInvoice $invoice): array
    {
        $setting = Setting::first();
        if (!$setting) {
            throw new RuntimeException('No hay configuración (Setting) disponible para este tenant.');
        }

        $cuis = $this->resolveActiveCuis($invoice, $setting);
        $systemCode = (string) ($setting->siat_system_code ?? '');
        if (empty($systemCode)) {
            throw new RuntimeException('Código de sistema SIAT no configurado en Settings.');
        }

        return [
            'codigoAmbiente'        => (int) $invoice->siat_environment,
            'codigoDocumentoSector' => (int) $invoice->document_sector_code, // 1: Compra-Venta
            'codigoEmision'         => 1, // 1: Online
            'codigoModalidad'       => (int) $invoice->siat_modality,
            'codigoPuntoVenta'      => (int) $invoice->point_of_sale_code,
            'codigoSistema'         => $systemCode,
            'codigoSucursal'        => (int) $invoice->branch_code,
            'cufd'                  => (string) $invoice->cufd_snapshot,
            'cuis'                  => $cuis,
            'nit'                   => (int) $invoice->issuer_nit,
            'tipoFacturaDocumento'  => 1, // Con derecho a crédito fiscal
            'cuf'                   => (string) $invoice->cuf,
        ];
    }

    /**
     * Procesa la respuesta oficial del SIN y actualiza ElectronicInvoice sin degradar estados confirmados.
     */
    private function processVerificationResponse(
        ElectronicInvoice $invoice,
        array $response,
        CarbonInterface $startedAt
    ): array {
        $res = $response['RespuestaServicioFacturacion'] ?? $response;

        $codigoEstado      = isset($res['codigoEstado']) ? (int) $res['codigoEstado'] : null;
        $codigoRecepcion   = $res['codigoRecepcion'] ?? null;
        $codigoDescripcion = $res['codigoDescripcion'] ?? null;
        $transaccion       = (bool) ($res['transaccion'] ?? false);
        $mensajes          = $res['mensajesList'] ?? [];

        $sanitizedResponse = $this->sanitizeSinResponse($res);
        $statusEnum        = SiatReceptionStatus::fromCode($codigoEstado);

        // REGLA CRÍTICA: NO DEGRADAR UNA FACTURA LOCAL PREVIAMENTE ACCEPTED
        $isCurrentlyAccepted = ($invoice->status === ElectronicInvoiceStatus::ACCEPTED);

        // CASO 1: VALIDADA / ACEPTADA (Código 908)
        if ($statusEnum?->isValidated()) {
            $invoice->status               = ElectronicInvoiceStatus::ACCEPTED;
            $invoice->reception_code       = $codigoRecepcion ? (string) $codigoRecepcion : $invoice->reception_code;
            $invoice->sin_response         = $sanitizedResponse;
            $invoice->error_message        = null;
            $invoice->next_verification_at = null;
            $invoice->save();

            $this->recordOperation($invoice, 'verify', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, null);
            $this->logVerificationResult($invoice, $codigoEstado, 'ACCEPTED');

            return [
                'success'          => true,
                'status'           => ElectronicInvoiceStatus::ACCEPTED->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => $invoice->reception_code,
                'not_found_at_sin' => false,
                'error_message'    => null,
                'cuf'              => $invoice->cuf,
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // Si ya estaba ACCEPTED localmente, conservamos su estado
        if ($isCurrentlyAccepted) {
            $warningMsg = "Verificación posterior reportó código {$codigoEstado}, pero el estado ACCEPTED se preserva inmutable.";
            $this->recordOperation($invoice, 'verify', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, $warningMsg);
            Log::warning("SIAT: {$warningMsg}", ['invoice_id' => $invoice->id]);

            return [
                'success'          => true,
                'status'           => ElectronicInvoiceStatus::ACCEPTED->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => $invoice->reception_code,
                'not_found_at_sin' => false,
                'error_message'    => $warningMsg,
                'cuf'              => $invoice->cuf,
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // CASO 2: RECHAZADA (Código 902 o errores tributarios terminantes)
        if ($statusEnum?->isRejected()) {
            $formattedError = $this->formatSinErrors($mensajes, $codigoDescripcion ?? 'Factura rechazada por el SIN');

            $invoice->status               = ElectronicInvoiceStatus::REJECTED;
            $invoice->reception_code       = $codigoRecepcion ? (string) $codigoRecepcion : $invoice->reception_code;
            $invoice->sin_response         = $sanitizedResponse;
            $invoice->error_message        = $formattedError;
            $invoice->next_verification_at = null;
            $invoice->save();

            $this->recordOperation($invoice, 'verify', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, $formattedError);
            $this->logVerificationResult($invoice, $codigoEstado, 'REJECTED');

            return [
                'success'          => false,
                'status'           => ElectronicInvoiceStatus::REJECTED->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => $invoice->reception_code,
                'not_found_at_sin' => false,
                'error_message'    => $formattedError,
                'cuf'              => $invoice->cuf,
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // CASO 3: OBSERVADA (Código 904: documento recibido pero con observaciones, NO aceptado)
        if ($statusEnum?->isObserved()) {
            $formattedObs = $this->formatSinErrors($mensajes, $codigoDescripcion ?? 'Factura observada por el SIN');
            $obsMsg       = "[904] Factura observada por el SIN: {$formattedObs}";

            $invoice->status               = ElectronicInvoiceStatus::PROCESSING;
            $invoice->reception_code       = $codigoRecepcion ? (string) $codigoRecepcion : $invoice->reception_code;
            $invoice->sin_response         = $sanitizedResponse;
            $invoice->error_message        = $obsMsg;
            $invoice->next_verification_at = $this->calculateNextBackoff($invoice->verification_attempts);
            $invoice->save();

            $this->recordOperation($invoice, 'verify', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, $obsMsg);
            $this->logVerificationResult($invoice, $codigoEstado, 'OBSERVED');

            return [
                'success'          => false,
                'status'           => ElectronicInvoiceStatus::PROCESSING->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => $invoice->reception_code,
                'not_found_at_sin' => false,
                'error_message'    => $obsMsg,
                'cuf'              => $invoice->cuf,
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // CASO 4: NO ENCONTRADA EN BASE DE DATOS DEL SIN (Código 924)
        if ($statusEnum?->isNotFound()) {
            $notFoundMsg = '[924] Factura o Nota no existe en la base de datos del SIN (NOT_FOUND_AT_SIN). Requiere decisión administrativa explícita; no se permite reenvío ciego.';

            $invoice->status               = ElectronicInvoiceStatus::PROCESSING;
            $invoice->sin_response         = array_merge($sanitizedResponse, ['not_found_at_sin' => true]);
            $invoice->error_message        = $notFoundMsg;
            $invoice->next_verification_at = null; // No seguir polleando automáticamente
            $invoice->save();

            $this->recordOperation($invoice, 'verify', $startedAt, 'success', $codigoEstado, null, $sanitizedResponse, $notFoundMsg);
            $this->logVerificationResult($invoice, $codigoEstado, 'NOT_FOUND_AT_SIN');

            return [
                'success'          => false,
                'status'           => ElectronicInvoiceStatus::PROCESSING->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => null,
                'not_found_at_sin' => true,
                'error_message'    => $notFoundMsg,
                'cuf'              => $invoice->cuf,
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // CASO 5: PENDIENTE / PROCESADA (Códigos 901, 903) O CÓDIGO DESCONOCIDO
        $ambiguousMsg = $this->formatSinErrors($mensajes, $codigoDescripcion ?? "Respuesta no definitiva del SIN (código: {$codigoEstado})");
        $pendingMsg   = "Resultado fiscal en procesamiento / pendiente (código {$codigoEstado}): {$ambiguousMsg}";

        $invoice->status               = ElectronicInvoiceStatus::PROCESSING;
        $invoice->sin_response         = $sanitizedResponse;
        $invoice->error_message        = $pendingMsg;
        if ($codigoRecepcion) {
            $invoice->reception_code = (string) $codigoRecepcion;
        }
        $invoice->next_verification_at = $this->calculateNextBackoff($invoice->verification_attempts);
        $invoice->save();

        $this->recordOperation($invoice, 'verify', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, $pendingMsg);
        $this->logVerificationResult($invoice, $codigoEstado, 'PROCESSING');

        return [
            'success'          => false,
            'status'           => ElectronicInvoiceStatus::PROCESSING->value,
            'codigo_estado'    => $codigoEstado,
            'codigo_recepcion' => $invoice->reception_code,
            'not_found_at_sin' => false,
            'error_message'    => $pendingMsg,
            'cuf'              => $invoice->cuf,
            'sin_response'     => $sanitizedResponse,
        ];
    }

    /**
     * Maneja errores de transporte o timeouts ocurridos durante la verificación.
     */
    private function handleVerificationTransportFailure(
        ElectronicInvoice $invoice,
        Throwable $exception,
        CarbonInterface $startedAt
    ): void {
        $isTimeout       = str_contains(strtolower($exception->getMessage()), 'timed out');
        $transportStatus = $isTimeout ? 'timeout' : 'error';
        $errorMessage    = "Error de transporte durante verificación: " . $exception->getMessage();

        // Si ya está ACCEPTED, nunca se degrada su estado
        if ($invoice->status !== ElectronicInvoiceStatus::ACCEPTED) {
            $invoice->status               = ElectronicInvoiceStatus::PROCESSING;
            $invoice->error_message        = $errorMessage;
            $invoice->next_verification_at = $this->calculateNextBackoff($invoice->verification_attempts);
            $invoice->save();
        }

        $this->recordOperation($invoice, 'verify', $startedAt, $transportStatus, null, null, null, $errorMessage);

        Log::warning('SIAT: Fallo de transporte en verificación de estado', [
            'invoice_id' => $invoice->id,
            'attempts'   => $invoice->verification_attempts,
            'error'      => $exception->getMessage(),
        ]);
    }

    /**
     * Calcula la fecha de la próxima verificación automática aplicando backoff gradual.
     */
    public function calculateNextBackoff(int $attempts): ?Carbon
    {
        if ($attempts >= self::MAX_AUTOMATIC_VERIFICATION_ATTEMPTS) {
            // Máximo de reintentos alcanzado: se suspende polling y requiere revisión manual
            return null;
        }

        $minutes = self::BACKOFF_MINUTES[$attempts] ?? 30;

        return now()->addMinutes($minutes);
    }

    /**
     * Resuelve el CUIS activo correspondiente a la sucursal y POS de la factura.
     */
    private function resolveActiveCuis(ElectronicInvoice $invoice, Setting $setting): string
    {
        $cuisRecord = SiatCuis::where('branch_code', (int) $invoice->branch_code)
            ->where('point_of_sale_code', (int) $invoice->point_of_sale_code)
            ->where('is_active', true)
            ->where('valid_until', '>', now())
            ->latest('id')
            ->first();

        if ($cuisRecord && !empty($cuisRecord->cuis)) {
            return (string) $cuisRecord->cuis;
        }

        if (!empty($setting->siat_cuis)) {
            return (string) $setting->siat_cuis;
        }

        throw new RuntimeException("No existe un CUIS activo y vigente para la sucursal {$invoice->branch_code} y punto de venta {$invoice->point_of_sale_code}.");
    }

    /**
     * Registra la operación en la tabla de historial inmutable siat_invoice_operations.
     */
    private function recordOperation(
        ElectronicInvoice $invoice,
        string $operation,
        CarbonInterface $startedAt,
        string $transportStatus,
        ?int $siatStatusCode,
        ?string $receptionCode,
        ?array $response,
        ?string $errorMessage
    ): void {
        try {
            SiatInvoiceOperation::create([
                'electronic_invoice_id' => $invoice->id,
                'operation'             => $operation,
                'started_at'            => $startedAt,
                'finished_at'           => now(),
                'transport_status'      => $transportStatus,
                'siat_status_code'      => $siatStatusCode,
                'reception_code'        => $receptionCode,
                'response'              => $response,
                'error_message'         => $errorMessage,
            ]);
        } catch (Throwable $e) {
            Log::warning('SIAT: No se pudo registrar la operación en siat_invoice_operations: ' . $e->getMessage());
        }
    }

    /**
     * Sanitiza la respuesta eliminando tokens, passwords o claves privadas.
     */
    private function sanitizeSinResponse(array $response): array
    {
        unset($response['token'], $response['apikey'], $response['password'], $response['private_key']);

        return $response;
    }

    /**
     * Formatea errores y observaciones de la respuesta del SIN.
     */
    private function formatSinErrors(mixed $mensajesList, string $fallback): string
    {
        if (empty($mensajesList)) {
            return $fallback;
        }

        if (isset($mensajesList['codigo'])) {
            $mensajesList = [$mensajesList];
        }

        $lines = [];
        if (is_array($mensajesList)) {
            foreach ($mensajesList as $m) {
                if (is_array($m)) {
                    $cod = $m['codigo'] ?? '';
                    $dsc = $m['descripcion'] ?? '';
                    $adv = !empty($m['advertencia']) ? ' (Advertencia)' : '';
                    $lines[] = "[$cod] {$dsc}{$adv}";
                }
            }
        }

        return !empty($lines) ? implode(' | ', $lines) : $fallback;
    }

    /**
     * Resuelve el cliente SOAP para el tenant actual, respetando enlaces en el contenedor (IoC).
     */
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

    /**
     * Log seguro de auditoría de la verificación.
     */
    private function logVerificationResult(ElectronicInvoice $invoice, ?int $codigoEstado, string $label): void
    {
        $cuf = (string) $invoice->cuf;
        $cufMasked = strlen($cuf) > 16
            ? substr($cuf, 0, 8) . '...' . substr($cuf, -8)
            : '***';

        Log::info("SIAT: Verificación de estado de factura finalizada [{$label}]", [
            'tenant_id'       => tenancy()->initialized ? tenant()->id : 'central',
            'invoice_id'      => $invoice->id,
            'cuf_masked'      => $cufMasked,
            'codigo_estado'   => $codigoEstado,
            'status'          => $invoice->status->value,
            'attempts'        => $invoice->verification_attempts,
        ]);
    }
}
