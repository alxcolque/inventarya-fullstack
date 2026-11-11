<?php

namespace App\Services\Siat;

use App\Exceptions\SiatFiscalException;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * SiatCertificateService — Fase 4D
 *
 * Responsable de la carga segura, análisis criptográfico y validación
 * de certificados digitales en formato PKCS#12 (.p12 / .pfx) para la
 * Modalidad 1 (Electrónica en Línea).
 *
 * Reglas de seguridad:
 * - La clave privada se mantiene 100% en memoria; nunca se persiste en disco.
 * - La contraseña nunca se serializa ni se incluye en trazas de log o excepciones.
 * - Se valida la correspondencia criptográfica entre certificado y clave privada.
 * - Se comprueba la vigencia temporal contra la fecha de emisión fiscal y la fecha actual.
 */
class SiatCertificateService
{
    public function __construct()
    {
        $this->ensureOpenSslConfig();
    }

    /**
     * Carga y valida el certificado del tenant desde la configuración de Settings.
     *
     * @param  Setting      $setting
     * @param  Carbon|null  $referenceDate Fecha fiscal de referencia (ej. issued_at de la factura)
     * @return array{
     *     cert: string,
     *     pkey: mixed,
     *     clean_cert: string,
     *     fingerprint: string,
     *     valid_from: Carbon,
     *     valid_to: Carbon,
     *     subject: array,
     *     issuer: array
     * }
     *
     * @throws SiatFiscalException
     */
    public function loadFromSetting(Setting $setting, ?Carbon $referenceDate = null): array
    {
        if (empty($setting->siat_certificate_path)) {
            throw new SiatFiscalException(
                'No se ha configurado la ruta del certificado digital para el tenant (siat_certificate_path).'
            );
        }

        $password = $setting->siat_certificate_password;
        if (empty($password)) {
            throw new SiatFiscalException(
                'No se ha configurado la contraseña del certificado digital para el tenant (siat_certificate_password).'
            );
        }

        $p12Binary = $this->readCertificateBinary($setting->siat_certificate_path);

        return $this->parseAndValidate($p12Binary, $password, $referenceDate);
    }

    /**
     * Carga y valida un certificado PKCS#12 directamente desde su contenido binario y contraseña.
     *
     * @param  string       $p12Binary
     * @param  string       $password
     * @param  Carbon|null  $referenceDate
     * @return array
     *
     * @throws SiatFiscalException
     */
    public function parseAndValidate(string $p12Binary, string $password, ?Carbon $referenceDate = null): array
    {
        if (empty($p12Binary)) {
            throw new SiatFiscalException('El archivo de certificado digital proporcionado está vacío.');
        }

        $certs = [];
        // Intentar leer el almacén PKCS#12
        $readOk = @openssl_pkcs12_read($p12Binary, $certs, $password);

        if (! $readOk) {
            // Limpiar errores internos de OpenSSL para evitar fugas
            while (openssl_error_string()) {
                // discard
            }

            throw new SiatFiscalException(
                'No se pudo abrir el certificado digital PKCS#12. Verifique que la contraseña sea correcta y el archivo no esté corrupto.'
            );
        }

        if (empty($certs['cert'])) {
            throw new SiatFiscalException('El archivo PKCS#12 no contiene un certificado X.509 público válido.');
        }

        if (empty($certs['pkey'])) {
            throw new SiatFiscalException('El archivo PKCS#12 no contiene una clave privada asociada.');
        }

        $certPem = $certs['cert'];
        $pkey    = $certs['pkey'];

        // 1. Validar coincidencia de clave privada con certificado
        if (! @openssl_x509_check_private_key($certPem, $pkey)) {
            throw new SiatFiscalException(
                'La clave privada extraída del archivo PKCS#12 no corresponde criptográficamente al certificado público.'
            );
        }

        // 2. Extraer metadatos del certificado X.509
        $parsed = @openssl_x509_parse($certPem);
        if (! is_array($parsed)) {
            throw new SiatFiscalException('No se pudieron extraer los metadatos del certificado X.509.');
        }

        $validFromTime = $parsed['validFrom_time_t'] ?? null;
        $validToTime   = $parsed['validTo_time_t'] ?? null;

        if ($validFromTime === null || $validToTime === null) {
            throw new SiatFiscalException('El certificado digital no contiene fechas de vigencia válidas.');
        }

        $validFrom = Carbon::createFromTimestamp($validFromTime);
        $validTo   = Carbon::createFromTimestamp($validToTime);

        // 3. Validar vigencia temporal contra fecha de emisión fiscal y fecha actual
        $checkDate = $referenceDate ?? now();

        if ($checkDate->lt($validFrom)) {
            throw new SiatFiscalException(
                "El certificado digital aún no es válido para la fecha de emisión requerida (válido a partir de: {$validFrom->toDateTimeString()})."
            );
        }

        if ($checkDate->gt($validTo)) {
            throw new SiatFiscalException(
                "El certificado digital se encuentra expirado para la fecha de emisión requerida (expiró el: {$validTo->toDateTimeString()})."
            );
        }

        // 4. Limpieza del certificado para nodo XMLDSig (DER en Base64 sin cabeceras PEM ni saltos)
        $cleanCert = preg_replace('/-----.*?-----|\s+/', '', $certPem);
        $fingerprint = openssl_x509_fingerprint($certPem, 'sha256');

        return [
            'cert'        => $certPem,
            'pkey'        => $pkey,
            'clean_cert'  => $cleanCert,
            'fingerprint' => strtoupper($fingerprint ?: ''),
            'valid_from'  => $validFrom,
            'valid_to'    => $validTo,
            'subject'     => $parsed['subject'] ?? [],
            'issuer'      => $parsed['issuer'] ?? [],
        ];
    }

    /**
     * Lee el binario del certificado buscando en el disco por defecto de storage,
     * en disco local o como ruta absoluta segura.
     *
     * @throws SiatFiscalException
     */
    private function readCertificateBinary(string $path): string
    {
        // 1. Buscar en Storage disk local
        if (Storage::disk('local')->exists($path)) {
            $content = Storage::disk('local')->get($path);
            if ($content !== null) {
                return $content;
            }
        }

        // 2. Buscar en storage_path()
        $storageFullPath = storage_path('app/' . ltrim($path, '/\\'));
        if (file_exists($storageFullPath)) {
            $content = @file_get_contents($storageFullPath);
            if ($content !== false) {
                return $content;
            }
        }

        // 3. Buscar como ruta absoluta del sistema de archivos si existe
        if (file_exists($path)) {
            $content = @file_get_contents($path);
            if ($content !== false) {
                return $content;
            }
        }

        throw new SiatFiscalException("El archivo de certificado digital no existe o no pudo ser leído.");
    }

    /**
     * Asegura la disponibilidad de un archivo openssl.cnf en entornos Windows / XAMPP.
     */
    private function ensureOpenSslConfig(): void
    {
        if (getenv('OPENSSL_CONF') && file_exists(getenv('OPENSSL_CONF'))) {
            return;
        }

        $candidates = [
            'C:/xampp/php/extras/ssl/openssl.cnf',
            'C:/xampp/apache/conf/openssl.cnf',
            'C:/laragon/bin/php/php-8.2/extras/ssl/openssl.cnf',
            dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf',
        ];

        foreach ($candidates as $candidate) {
            if (file_exists($candidate)) {
                putenv("OPENSSL_CONF={$candidate}");
                break;
            }
        }
    }
}
