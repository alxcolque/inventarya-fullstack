<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;
use App\Models\Setting;
use SoapClient;
use SoapFault;
use RuntimeException;
use Illuminate\Support\Facades\Log;

/**
 * Cliente SOAP real que se comunica con el SIN/SIAT en nombre de un tenant.
 *
 * Cada instancia encapsula las credenciales (NIT, token de autenticación) y
 * los parámetros de configuración (ambiente, modalidad) de UN ÚNICO tenant.
 * Nunca comparte estado entre tenants.
 *
 * Autenticación Oficial SIAT (SIN Bolivia):
 *  - Se transmite como HTTP Request Header: 'apikey: TokenApi <token>'.
 *  - No utiliza SoapHeader XML (no existe TokenUsua en los WSDLs oficiales v2).
 *
 * Política de Reintentos:
 *  - Operaciones idempotentes (verificarComunicacion, sincronizarFechaHora, catálogos):
 *    Reintento limitado (hasta 2 intentos) ante errores transitorios de red/timeout.
 *  - Operaciones de autorización (obtenerCuis, obtenerCufd):
 *    SIN reintento ciego. Un timeout o error ambiguo no debe solicitar múltiples códigos
 *    de autorización al SIN.
 *
 * Timeouts:
 *  - connection_timeout (apertura de conexión socket).
 *  - timeout de lectura configurado en stream_context (http.timeout).
 *
 * Seguridad:
 *  - Trazas y mensajes sanitizan tokens, certificados y credenciales.
 */
class SiatSoapClient implements SiatSoapClientInterface
{
    private readonly string  $nit;
    private readonly string  $token;
    private readonly int     $environment;
    private readonly int     $modality;
    private readonly string  $systemCode;
    private readonly array   $endpoints;
    private readonly array   $soapOptions;

    /** @var array<string, SoapClient> */
    private array $clients = [];

    public function __construct(Setting $setting)
    {
        $token = $setting->siat_api_token;
        if (empty($token)) {
            throw new RuntimeException('SIAT: API token no configurado para este tenant.');
        }

        $this->nit         = (string) $setting->tax_nit;
        $this->token       = (string) $token;
        $this->environment = (int) $setting->siat_environment;
        $this->modality    = (int) $setting->siat_modality;
        $this->systemCode  = (string) ($setting->siat_system_code ?? '');

        // GUARD ESTRICTO FASE 5B: BLOQUEO TEMPORAL DE PRODUCCIÓN DURANTE PILOTO
        if ($this->environment === 1 || $this->environment !== 2) {
            throw new \App\Exceptions\SiatFiscalException('PRODUCTION_SIAT_BLOCKED_DURING_PILOT');
        }

        $allEndpoints      = config('siat.endpoints', []);
        $this->endpoints   = $allEndpoints[$this->environment] ?? [];
        $this->soapOptions = [
            'connection_timeout' => (int) config('siat.soap.connection_timeout', 10),
            'cache_wsdl'         => config('siat.soap.cache_wsdl', defined('WSDL_CACHE_BOTH') ? \WSDL_CACHE_BOTH : 3),
            'exceptions'         => true,
            'trace'              => (bool) config('siat.soap.trace', false),
        ];

        if (empty($this->endpoints)) {
            throw new RuntimeException("SIAT: ambiente '{$this->environment}' no tiene endpoints configurados.");
        }
    }

    // -------------------------------------------------------------------------
    // SiatSoapClientInterface
    // -------------------------------------------------------------------------

    /**
     * Operación idempotente: admite reintento limitado.
     */
    public function verificarComunicacion(): array
    {
        return $this->retryIdempotent(fn () => $this->callCodigos('verificarComunicacion', [
            'SolicitudVerificarComunicacion' => $this->buildBaseRequest(),
        ]));
    }

    /**
     * Operación idempotente: admite reintento limitado.
     */
    public function sincronizarFechaHora(): array
    {
        return $this->retryIdempotent(fn () => $this->callCodigos('sincronizarFechaHora', [
            'SolicitudSincronizarFechaHora' => $this->buildBaseRequest(),
        ]));
    }

    /**
     * Operación de autorización: SIN reintento ciego.
     */
    public function obtenerCuis(int $codigoSucursal, int $codigoPuntoVenta): array
    {
        return $this->callCodigos('obtenerCuis', [
            'SolicitudObtenerCuis' => array_merge($this->buildBaseRequest(), [
                'codigoSucursal'   => $codigoSucursal,
                'codigoPuntoVenta' => $codigoPuntoVenta,
            ]),
        ]);
    }

    /**
     * Operación de autorización: SIN reintento ciego.
     */
    public function obtenerCufd(int $codigoSucursal, int $codigoPuntoVenta, string $cuis): array
    {
        return $this->callCodigos('obtenerCufd', [
            'SolicitudObtenerCufd' => array_merge($this->buildBaseRequest(), [
                'codigoSucursal'   => $codigoSucursal,
                'codigoPuntoVenta' => $codigoPuntoVenta,
                'cuis'             => $cuis,
            ]),
        ]);
    }

    /**
     * Operación idempotente de consulta: admite reintento limitado.
     */
    public function sincronizarParametrica(
        string $catalogName,
        string $cuis,
        int    $codigoSucursal,
        int    $codigoPuntoVenta,
    ): array {
        $operation = 'sincronizarParametrica' . ucfirst($catalogName);

        return $this->retryIdempotent(fn () => $this->callSincronizacion($operation, [
            'SolicitudSincronizarParametrica' . ucfirst($catalogName) => array_merge(
                $this->buildBaseRequest(),
                [
                    'codigoSucursal'   => $codigoSucursal,
                    'codigoPuntoVenta' => $codigoPuntoVenta,
                    'cuis'             => $cuis,
                ]
            ),
        ]));
    }

    /**
     * Operación no-idempotente de emisión: NUNCA reintento automático.
     * Protegida obligatoriamente por kill-switch (live_submission_enabled).
     */
    public function recepcionFactura(array $solicitud): array
    {
        if (!config('siat.live_submission_enabled', false)) {
            throw new RuntimeException('SIAT: La transmisión real al SIN está deshabilitada (kill switch activo: live_submission_enabled = false).');
        }

        return $this->callCompraVenta('recepcionFactura', [
            'SolicitudServicioRecepcionFactura' => $solicitud,
        ]);
    }

    /**
     * Consulta el estado oficial de una factura previamente emitida ante el SIN.
     * Operación de consulta protegida por kill-switch (live_submission_enabled).
     */
    public function verificacionEstadoFactura(array $solicitud): array
    {
        if (!config('siat.live_submission_enabled', false)) {
            throw new RuntimeException('SIAT: La transmisión real al SIN está deshabilitada (kill switch activo: live_submission_enabled = false).');
        }

        return $this->callCompraVenta('verificacionEstadoFactura', [
            'SolicitudServicioVerificacionEstadoFactura' => $solicitud,
        ]);
    }

    /**
     * Anula fiscalmente una Factura Compra-Venta previamente validada ante el SIN.
     * Operación fiscal protegida obligatoriamente por kill-switch (live_submission_enabled).
     */
    public function anulacionFactura(array $solicitud): array
    {
        if (!config('siat.live_submission_enabled', false)) {
            throw new RuntimeException('SIAT: La transmisión real al SIN está deshabilitada (kill switch activo: live_submission_enabled = false).');
        }

        return $this->callCompraVenta('anulacionFactura', [
            'SolicitudServicioAnulacionFactura' => $solicitud,
        ]);
    }

    /**
     * Revierte por única vez la anulación fiscal de una Factura Compra-Venta ante el SIN.
     * Operación fiscal protegida obligatoriamente por kill-switch (live_submission_enabled).
     */
    public function reversionAnulacionFactura(array $solicitud): array
    {
        if (!config('siat.live_submission_enabled', false)) {
            throw new RuntimeException('SIAT: La transmisión real al SIN está deshabilitada (kill switch activo: live_submission_enabled = false).');
        }

        return $this->callCompraVenta('reversionAnulacionFactura', [
            'SolicitudServicioReversionAnulacionFactura' => $solicitud,
        ]);
    }

    // -------------------------------------------------------------------------
    // Inspección de Transporte (Para auditoría y pruebas de configuración)
    // -------------------------------------------------------------------------

    /**
     * Retorna el encabezado HTTP de autenticación oficial ('apikey: TokenApi <token>').
     */
    public function getAuthHeader(): string
    {
        return "apikey: TokenApi {$this->token}";
    }

    /**
     * Retorna las opciones de stream_context aplicadas a las peticiones HTTP del SoapClient.
     */
    public function buildStreamContextOptions(): array
    {
        $timeout = (float) config('siat.soap.timeout', 20);

        return [
            'http' => [
                'header'  => $this->getAuthHeader() . "\r\n",
                'timeout' => $timeout,
            ],
        ];
    }

    /**
     * Retorna las opciones base de configuración para el SoapClient.
     */
    public function getSoapOptions(): array
    {
        return $this->soapOptions;
    }

    /**
     * Sanitiza mensajes de error para no exponer tokens, credenciales ni headers.
     */
    public function sanitizeErrorMessage(string $message): string
    {
        if (!empty($this->token)) {
            $message = str_replace($this->token, '***TOKEN***', $message);
        }

        return preg_replace('/(apikey|token|password):\s*[^\s,]+/i', '$1: ***', $message) ?? $message;
    }

    // -------------------------------------------------------------------------
    // Privados: construcción de requests y llamadas SOAP
    // -------------------------------------------------------------------------

    private function buildBaseRequest(): array
    {
        return [
            'codigoAmbiente' => $this->environment,
            'codigoModalidad'=> $this->modality,
            'codigoSistema'  => $this->systemCode,
            'nit'            => (int) $this->nit,
        ];
    }

    /**
     * Ejecuta reintentos exclusivamente en operaciones declaradas idempotentes.
     */
    public function retryIdempotent(callable $operation, int $maxAttempts = 2): mixed
    {
        $attempts = 0;
        $lastException = null;

        while ($attempts < $maxAttempts) {
            $attempts++;
            try {
                return $operation();
            } catch (\Throwable $e) {
                $lastException = $e;
                if ($attempts >= $maxAttempts) {
                    break;
                }
                usleep(500000); // 500 ms backoff
            }
        }

        throw $lastException;
    }

    /**
     * Llama al servicio FacturacionCodigos.
     */
    private function callCodigos(string $operation, array $params): array
    {
        $client = $this->getClient('facturacion_codigos');

        try {
            $response = $client->$operation($params);
            return $this->normalize($response);
        } catch (SoapFault $e) {
            $sanitized = $this->sanitizeErrorMessage($e->getMessage());
            throw new RuntimeException("SIAT SOAP [{$operation}] Error: {$sanitized}", 0, $e);
        }
    }

    /**
     * Llama al servicio FacturacionSincronizacion.
     */
    private function callSincronizacion(string $operation, array $params): array
    {
        $client = $this->getClient('facturacion_sincronizacion');

        try {
            $response = $client->$operation($params);
            return $this->normalize($response);
        } catch (SoapFault $e) {
            $sanitized = $this->sanitizeErrorMessage($e->getMessage());
            throw new RuntimeException("SIAT SOAP [{$operation}] Error: {$sanitized}", 0, $e);
        }
    }

    /**
     * Llama al servicio FacturacionCompraVenta (sin reintento automático).
     */
    private function callCompraVenta(string $operation, array $params): array
    {
        $client = $this->getClient('facturacion_compra_venta');

        try {
            $response = $client->$operation($params);
            return $this->normalize($response);
        } catch (SoapFault $e) {
            $sanitized = $this->sanitizeErrorMessage($e->getMessage());
            throw new RuntimeException("SIAT SOAP [{$operation}] Error: {$sanitized}", 0, $e);
        }
    }

    /**
     * Obtiene (o crea y almacena en caché) el SoapClient para el WSDL indicado.
     * Aplica exclusivamente el encabezado HTTP 'apikey: TokenApi <token>' y el timeout de lectura.
     */
    protected function getClient(string $wsdlKey): SoapClient
    {
        if (!isset($this->clients[$wsdlKey])) {
            $wsdl = $this->endpoints[$wsdlKey] ?? null;

            if (empty($wsdl)) {
                throw new RuntimeException("SIAT: WSDL '{$wsdlKey}' no configurado para el ambiente {$this->environment}.");
            }

            // GUARD ADICIONAL DE SEGURIDAD WSDL / ENDPOINT CONTRA PRODUCCIÓN
            if (str_contains($wsdl, 'siatservicios.impuestos.gob.bo') && !str_contains($wsdl, 'pilotosiat')) {
                throw new \App\Exceptions\SiatFiscalException('PRODUCTION_SIAT_BLOCKED_DURING_PILOT');
            }

            $context = stream_context_create($this->buildStreamContextOptions());

            $options = array_merge($this->soapOptions, [
                'stream_context' => $context,
            ]);

            $this->clients[$wsdlKey] = new SoapClient($wsdl, $options);
        }

        return $this->clients[$wsdlKey];
    }

    /**
     * Convierte stdClass/objetos SOAP a array recursivamente.
     */
    private function normalize(mixed $data): array
    {
        return json_decode(json_encode($data), true) ?? [];
    }
}
