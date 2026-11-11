<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;
use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\Setting;
use App\Models\SiatCuis;
use Carbon\Carbon;
use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Servicio de Emisión Fiscal: Envío y Recepción de Facturas Compra-Venta ante el SIN.
 *
 * Responsabilidades:
 *  1. Cargar y verificar estado de ElectronicInvoice.
 *  2. Verificar CUF y coherencia con CUFD histórico.
 *  3. Cargar / generar XML fiscal.
 *  4. Verificar firma digital XMLDSig (en Modalidad 1) o ausencia de firma (en Modalidad 2).
 *  5. Validar contra el esquema XSD oficial correspondiente.
 *  6. Construir paquete binario GZIP y calcular SHA-256 (hashArchivo).
 *  7. Construir SolicitudServicioRecepcionFactura exacta.
 *  8. Control de concurrencia: Claim atómico previo al I/O.
 *  9. Ejecutar llamada SOAP recepcionFactura (sin reintento ciego).
 * 10. Interpretar respuesta oficial (908 = Aceptada, 902 = Rechazada, ambiguo = Processing).
 * 11. Persistir resultado sanitizado sin exponer secretos ni payloads completos.
 */
class SiatInvoiceSubmissionService
{
    public function __construct(
        private readonly SiatInvoicePackageBuilder $packageBuilder,
        private readonly SiatInvoiceXmlBuilder $xmlBuilder,
        private readonly SiatInvoiceXmlValidator $xmlValidator,
        private readonly SiatXmlSignatureValidator $sigValidator,
        private readonly SiatServiceFactory $factory,
    ) {}

    /**
     * Procesa la preparación, validación y envío simulado/real de una Factura Compra-Venta.
     *
     * @param  ElectronicInvoice         $invoice
     * @param  SiatSoapClientInterface|null $soapClientOverride Cliente para inyección en tests
     * @return array{
     *     success: bool,
     *     status: string,
     *     codigo_estado: int|null,
     *     codigo_recepcion: string|null,
     *     error_message: string|null,
     *     hash_archivo: string,
     *     compressed_size: int,
     *     sin_response: array|null
     * }
     *
     * @throws RuntimeException|SiatFiscalException
     */
    public function submit(ElectronicInvoice $invoice, ?SiatSoapClientInterface $soapClientOverride = null): array
    {
        $startedAt = now();

        // 1. Cargar y verificar pre-condiciones del modelo
        $this->validateInvoicePrerequisites($invoice);

        // 2. Control de Concurrencia: Claim atómico fuera del I/O lento
        $this->atomicClaim($invoice);

        // A partir de aquí, el estado es PROCESSING.
        // Si ocurre un fallo antes del envío o durante el transporte, se maneja de forma controlada.
        try {
            // 3. Obtener el XML fiscal definitivo
            $xmlContent = $this->resolveAndValidateXml($invoice);

            // 4. Construir paquete fiscal GZIP y hash SHA-256
            $package = $this->packageBuilder->buildPackage($xmlContent);

            // 5. Construir SolicitudServicioRecepcionFactura oficial
            $solicitud = $this->buildSolicitudRecepcionFactura($invoice, $package);

            // 6. Resolver cliente SOAP
            $soapClient = $soapClientOverride ?? $this->resolveSoapClient();

            // 7. Ejecutar llamada SOAP (SIN reintento ciego)
            $response = $soapClient->recepcionFactura($solicitud);

            // 8. Procesar e interpretar respuesta del SIN
            return $this->processSinResponse($invoice, $response, $package, $startedAt);

        } catch (Throwable $e) {
            // REGLA CRÍTICA: TIMEOUT ≠ REJECTED
            // Ante cualquier falla de red, timeout o excepción posterior al claim:
            // La factura PERMANECE en PROCESSING (resultado fiscal ambiguo / desconocido).
            // NUNCA marcar como rejected ni reenviar automáticamente.
            $this->handleAmbiguousOrTransportFailure($invoice, $e, $package ?? null, $startedAt);

            throw $e;
        }
    }

    /**
     * Realiza el claim atómico de la factura pasando de draft/pending a processing.
     * La transacción DB se abre y se cierra inmediatamente para NO retener bloqueos
     * durante la llamada SOAP.
     */
    private function atomicClaim(ElectronicInvoice $invoice): void
    {
        DB::transaction(function () use ($invoice) {
            /** @var ElectronicInvoice $locked */
            $locked = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === ElectronicInvoiceStatus::ACCEPTED) {
                throw new RuntimeException("La factura fiscal ID '{$invoice->id}' ya fue aceptada previamente por el SIN (reception_code: {$locked->reception_code}).");
            }

            if ($locked->status === ElectronicInvoiceStatus::PROCESSING) {
                throw new RuntimeException("La factura fiscal ID '{$invoice->id}' ya se encuentra en procesamiento o con resultado pendiente. No se permite reintento ciego.");
            }

            if ($locked->status === ElectronicInvoiceStatus::REJECTED) {
                throw new RuntimeException("La factura fiscal ID '{$invoice->id}' fue rechazada por el SIN. No se puede reenviar ciegamente.");
            }

            if ($locked->status === ElectronicInvoiceStatus::CANCELLED) {
                throw new RuntimeException("La factura fiscal ID '{$invoice->id}' fue anulada.");
            }

            if ($locked->status !== ElectronicInvoiceStatus::DRAFT && $locked->status !== ElectronicInvoiceStatus::PENDING) {
                throw new RuntimeException("La factura fiscal ID '{$invoice->id}' no está en estado válido para emisión (estado: {$locked->status->value}).");
            }

            $locked->status = ElectronicInvoiceStatus::PROCESSING;
            $locked->save();

            $invoice->status = ElectronicInvoiceStatus::PROCESSING;
        });
    }

    /**
     * Valida pre-requisitos de datos de ElectronicInvoice antes del empaquetado.
     */
    private function validateInvoicePrerequisites(ElectronicInvoice $invoice): void
    {
        if (empty($invoice->cuf)) {
            throw new SiatFiscalException("La factura ID '{$invoice->id}' no cuenta con CUF asignado.");
        }

        if (empty($invoice->cufd_snapshot)) {
            throw new SiatFiscalException("La factura ID '{$invoice->id}' no cuenta con CUFD snapshot asociado.");
        }

        // Validación de correspondencia de CUFD histórico
        if (!empty($invoice->siat_cufd_id)) {
            $cufdRecord = $invoice->siatCufd;
            if ($cufdRecord) {
                if ($cufdRecord->cufd !== $invoice->cufd_snapshot) {
                    throw new SiatFiscalException("Inconsistencia en CUFD: el código en siat_cufds no coincide con cufd_snapshot de la factura.");
                }
                if ($cufdRecord->control_code !== $invoice->control_code) {
                    throw new SiatFiscalException("Inconsistencia en código de control: el control_code en siat_cufds no coincide con la factura.");
                }
            }
        }
    }

    /**
     * Resuelve el XML fiscal definitivo y aplica las validaciones oficiales de Fase 4C y 4D.
     */
    private function resolveAndValidateXml(ElectronicInvoice $invoice): string
    {
        $disk = Storage::disk(config('filesystems.default', 'local'));
        $xmlContent = null;

        if (!empty($invoice->xml_path) && $disk->exists($invoice->xml_path)) {
            $xmlContent = (string) $disk->get($invoice->xml_path);
        } else {
            // Construir y persistir XML si no existe aún
            $result = $this->xmlBuilder->buildAndPersist($invoice);
            $xmlContent = $result['xml_content'];
        }

        if (empty($xmlContent)) {
            throw new SiatFiscalException("No se pudo obtener el contenido XML fiscal de la factura ID '{$invoice->id}'.");
        }

        $modality = (int) $invoice->siat_modality;

        // Auditoría Fase 4D:
        // Modalidad 1 (Electrónica en Línea): XML DEBE contener ds:Signature criptográficamente válida.
        // Modalidad 2 (Computarizada en Línea): XML NO DEBE contener ds:Signature.
        $hasSignature = $this->containsXmlSignature($xmlContent);

        if ($modality === 1) {
            if (!$hasSignature) {
                throw new SiatFiscalException("La factura en Modalidad 1 (Electrónica en Línea) no contiene firma digital XMLDSig.");
            }

            $sigResult = $this->sigValidator->validateDetails($xmlContent);
            if (!$sigResult['is_valid']) {
                $err = $sigResult['error'] ?? 'Firma digital inválida';
                throw new SiatFiscalException("Falla de validación criptográfica en firma digital: {$err}");
            }

            $this->xmlValidator->validate($xmlContent);

        } elseif ($modality === 2) {
            if ($hasSignature) {
                throw new SiatFiscalException("La factura en Modalidad 2 (Computarizada en Línea) NO debe contener firma digital XMLDSig.");
            }

            $this->xmlValidator->validate($xmlContent);
        } else {
            throw new SiatFiscalException("Modalidad SIAT '{$modality}' no soportada.");
        }

        return $xmlContent;
    }

    /**
     * Construye el DTO / array del request oficial SolicitudServicioRecepcionFactura.
     *
     * @param  ElectronicInvoice $invoice
     * @param  array             $package
     * @return array
     */
    private function buildSolicitudRecepcionFactura(ElectronicInvoice $invoice, array $package): array
    {
        $setting = Setting::first();
        if (!$setting) {
            throw new RuntimeException('No hay configuración (Setting) disponible para este tenant.');
        }

        // Obtener CUIS vigente para la sucursal y punto de venta del documento
        $cuis = $this->resolveActiveCuis($invoice, $setting);

        $systemCode = (string) ($setting->siat_system_code ?? '');
        if (empty($systemCode)) {
            throw new RuntimeException('Código de sistema SIAT no configurado en Settings.');
        }

        // fechaEnvio: Marca de tiempo de la transmisión en timezone de Bolivia (UTC-4)
        $fechaEnvio = now()->setTimezone('America/La_Paz')->format('Y-m-d\TH:i:s.v');

        return [
            'codigoAmbiente'        => (int) $invoice->siat_environment,
            'codigoDocumentoSector' => (int) $invoice->document_sector_code, // 1: Compra-Venta
            'codigoEmision'         => 1, // 1: Online normal
            'codigoModalidad'       => (int) $invoice->siat_modality,
            'codigoPuntoVenta'      => (int) $invoice->point_of_sale_code,
            'codigoSistema'         => $systemCode,
            'codigoSucursal'        => (int) $invoice->branch_code,
            'cufd'                  => (string) $invoice->cufd_snapshot,
            'cuis'                  => $cuis,
            'nit'                   => (int) $invoice->issuer_nit,
            'tipoFacturaDocumento'  => 1, // 1: Con derecho a crédito fiscal
            'archivo'               => $package['rawGzip'], // Bytes binarios GZIP (SoapClient serializa a base64Binary)
            'fechaEnvio'            => $fechaEnvio,
            'hashArchivo'           => $package['hashArchivo'], // SHA-256 en minúsculas
        ];
    }

    /**
     * Resuelve el CUIS correspondiente a la sucursal y punto de venta.
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
     * Procesa la respuesta oficial del SIN y actualiza el estado de la factura.
     */
    private function processSinResponse(
        ElectronicInvoice $invoice,
        array $response,
        array $package,
        \Carbon\CarbonInterface $startedAt
    ): array {
        $res = $response['RespuestaServicioFacturacion'] ?? $response;

        $codigoEstado      = isset($res['codigoEstado']) ? (int) $res['codigoEstado'] : null;
        $codigoRecepcion   = $res['codigoRecepcion'] ?? null;
        $codigoDescripcion = $res['codigoDescripcion'] ?? null;
        $transaccion       = (bool) ($res['transaccion'] ?? false);
        $mensajes          = $res['mensajesList'] ?? [];

        // Sanitizar respuesta para almacenamiento seguro (sin tokens ni secretos)
        $sanitizedResponse = $this->sanitizeSinResponse($res);

        $statusEnum = \App\Enums\SiatReceptionStatus::fromCode($codigoEstado);

        // EVALUACIÓN OFICIAL CENTRALIZADA DEL ESTADO:

        // 1. VALIDADA (Código 908)
        if ($statusEnum?->isValidated()) {
            $invoice->status               = ElectronicInvoiceStatus::ACCEPTED;
            $invoice->reception_code       = (string) $codigoRecepcion;
            $invoice->sin_response         = $sanitizedResponse;
            $invoice->error_message        = null;
            $invoice->next_verification_at = null;
            $invoice->save();

            $this->recordOperation($invoice, 'submit', $startedAt, 'success', $codigoEstado, (string) $codigoRecepcion, $sanitizedResponse, null);
            $this->logFiscalSubmission($invoice, $package, $codigoEstado, 'ACCEPTED');

            return [
                'success'          => true,
                'status'           => ElectronicInvoiceStatus::ACCEPTED->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => (string) $codigoRecepcion,
                'error_message'    => null,
                'hash_archivo'     => $package['hashArchivo'],
                'compressed_size'  => $package['compressedSize'],
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // 2. RECHAZADA (Código 902 o errores específicos de validación tributaria)
        if ($statusEnum?->isRejected()) {
            $formattedError = $this->formatSinErrors($mensajes, $codigoDescripcion ?? 'Factura rechazada por el SIN');

            $invoice->status               = ElectronicInvoiceStatus::REJECTED;
            $invoice->reception_code       = $codigoRecepcion ? (string) $codigoRecepcion : null;
            $invoice->sin_response         = $sanitizedResponse;
            $invoice->error_message        = $formattedError;
            $invoice->next_verification_at = null;
            $invoice->save();

            $this->recordOperation($invoice, 'submit', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, $formattedError);
            $this->logFiscalSubmission($invoice, $package, $codigoEstado, 'REJECTED');

            return [
                'success'          => false,
                'status'           => ElectronicInvoiceStatus::REJECTED->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => $invoice->reception_code,
                'error_message'    => $formattedError,
                'hash_archivo'     => $package['hashArchivo'],
                'compressed_size'  => $package['compressedSize'],
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // 3. OBSERVADA (Código 904: NO aceptada, NO rechazada ciegamente)
        if ($statusEnum?->isObserved()) {
            $formattedObs = $this->formatSinErrors($mensajes, $codigoDescripcion ?? 'Factura observada por el SIN');
            $obsErrorMsg  = "[904] Factura observada por el SIN: {$formattedObs}";

            $invoice->status               = ElectronicInvoiceStatus::PROCESSING;
            $invoice->reception_code       = $codigoRecepcion ? (string) $codigoRecepcion : null;
            $invoice->sin_response         = $sanitizedResponse;
            $invoice->error_message        = $obsErrorMsg;
            $invoice->next_verification_at = now()->addMinutes(2);
            $invoice->save();

            $this->recordOperation($invoice, 'submit', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, $obsErrorMsg);
            $this->logFiscalSubmission($invoice, $package, $codigoEstado, 'OBSERVED');

            return [
                'success'          => false,
                'status'           => ElectronicInvoiceStatus::PROCESSING->value,
                'codigo_estado'    => $codigoEstado,
                'codigo_recepcion' => $invoice->reception_code,
                'error_message'    => $obsErrorMsg,
                'hash_archivo'     => $package['hashArchivo'],
                'compressed_size'  => $package['compressedSize'],
                'sin_response'     => $sanitizedResponse,
            ];
        }

        // 4. Otros estados transitorios (901 PENDIENTE, 903 PROCESADA, 924 NO ENCONTRADA, desconocido)
        $ambiguousMsg = $this->formatSinErrors($mensajes, $codigoDescripcion ?? "Respuesta no definitiva del SIN (código: {$codigoEstado})");
        $pendingErrorMsg = "Resultado fiscal pendiente de verificación: {$ambiguousMsg}";

        $invoice->status               = ElectronicInvoiceStatus::PROCESSING;
        $invoice->sin_response         = $sanitizedResponse;
        $invoice->error_message        = $pendingErrorMsg;
        if ($codigoRecepcion) {
            $invoice->reception_code = (string) $codigoRecepcion;
        }
        $invoice->next_verification_at = now()->addMinute();
        $invoice->save();

        $this->recordOperation($invoice, 'submit', $startedAt, 'success', $codigoEstado, $invoice->reception_code, $sanitizedResponse, $pendingErrorMsg);
        $this->logFiscalSubmission($invoice, $package, $codigoEstado, 'PROCESSING');

        return [
            'success'          => false,
            'status'           => ElectronicInvoiceStatus::PROCESSING->value,
            'codigo_estado'    => $codigoEstado,
            'codigo_recepcion' => $invoice->reception_code,
            'error_message'    => $pendingErrorMsg,
            'hash_archivo'     => $package['hashArchivo'],
            'compressed_size'  => $package['compressedSize'],
            'sin_response'     => $sanitizedResponse,
        ];
    }

    /**
     * Maneja errores de transporte o timeouts preservando el estado PROCESSING (resultado ambiguo).
     */
    private function handleAmbiguousOrTransportFailure(
        ElectronicInvoice $invoice,
        Throwable $exception,
        ?array $package,
        \Carbon\CarbonInterface $startedAt
    ): void {
        $isTimeout = str_contains(strtolower($exception->getMessage()), 'timed out');
        $transportStatus = $isTimeout ? 'timeout' : 'error';
        $errorMessage = "Error de transporte / resultado fiscal ambiguo: " . $exception->getMessage();

        $invoice->status               = ElectronicInvoiceStatus::PROCESSING;
        $invoice->error_message        = $errorMessage;
        $invoice->sin_response         = [
            'transport_error' => true,
            'exception_class' => get_class($exception),
            'message'         => $exception->getMessage(),
            'attempted_at'    => now()->toIso8601String(),
        ];
        $invoice->next_verification_at = now()->addMinute();
        $invoice->save();

        $this->recordOperation($invoice, 'submit', $startedAt, $transportStatus, null, null, null, $errorMessage);

        Log::warning('SIAT: Error de transporte en envío fiscal (estado marcado como PROCESSING por ambigüedad)', [
            'invoice_id'   => $invoice->id,
            'hash_archivo' => $package['hashArchivo'] ?? null,
            'error'        => $exception->getMessage(),
        ]);
    }

    /**
     * Registra una operación fiscal en el historial de auditoría siat_invoice_operations.
     */
    private function recordOperation(
        ElectronicInvoice $invoice,
        string $operation,
        \Carbon\CarbonInterface $startedAt,
        string $transportStatus,
        ?int $siatStatusCode,
        ?string $receptionCode,
        ?array $response,
        ?string $errorMessage
    ): void {
        try {
            \App\Models\SiatInvoiceOperation::create([
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
        } catch (\Throwable $e) {
            Log::warning('SIAT: No se pudo registrar la operación en siat_invoice_operations: ' . $e->getMessage());
        }
    }

    /**
     * Sanitiza la respuesta del SIN para persistencia segura en base de datos.
     */
    private function sanitizeSinResponse(array $response): array
    {
        unset($response['token'], $response['apikey'], $response['password'], $response['private_key']);

        return $response;
    }

    /**
     * Formatea la lista de observaciones o errores retornados por el SIN.
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
     * Determina si el XML contiene una etiqueta de firma ds:Signature.
     */
    private function containsXmlSignature(string $xmlContent): bool
    {
        $dom = new DOMDocument();
        if (!@$dom->loadXML($xmlContent)) {
            return false;
        }

        $xp = new DOMXPath($dom);
        $xp->registerNamespace('ds', SiatXmlSigner::XMLDSIG_NS);
        $nodes = $xp->query('//ds:Signature');

        return ($nodes && $nodes->length > 0);
    }

    /**
     * Resuelve el cliente SOAP real configurado para el tenant activo.
     */
    private function resolveSoapClient(): SiatSoapClientInterface
    {
        $setting = Setting::first();
        if (!$setting) {
            throw new RuntimeException('No hay configuración (Setting) disponible para este tenant.');
        }

        return new SiatSoapClient($setting);
    }

    /**
     * Registro seguro de auditoría en los logs de la aplicación.
     */
    private function logFiscalSubmission(
        ElectronicInvoice $invoice,
        array $package,
        ?int $codigoEstado,
        string $resultLabel
    ): void {
        $cuf = (string) $invoice->cuf;
        $cufMasked = strlen($cuf) > 16
            ? substr($cuf, 0, 8) . '...' . substr($cuf, -8)
            : '***';

        Log::info("SIAT: Envío de factura Compra-Venta finalizado [{$resultLabel}]", [
            'tenant_id'       => tenancy()->initialized ? tenant()->id : 'central',
            'invoice_id'      => $invoice->id,
            'cuf_masked'      => $cufMasked,
            'hash_archivo'    => $package['hashArchivo'],
            'compressed_size' => $package['compressedSize'],
            'environment'     => $invoice->siat_environment,
            'branch'          => $invoice->branch_code,
            'pos'             => $invoice->point_of_sale_code,
            'status'          => $invoice->status->value,
            'codigo_estado'   => $codigoEstado,
        ]);
    }
}
