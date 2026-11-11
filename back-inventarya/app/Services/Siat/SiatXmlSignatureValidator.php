<?php

namespace App\Services\Siat;

use App\Exceptions\SiatFiscalException;
use Carbon\Carbon;
use DOMDocument;
use DOMXPath;
use Throwable;

/**
 * SiatXmlSignatureValidator — Fase 4D
 *
 * Responsable de la verificación criptográfica local de firmas XMLDSig
 * en facturas de Modalidad 1 (Electrónica en Línea).
 *
 * Valida de forma exhaustiva:
 *  1. Existencia y unicidad del nodo <ds:Signature>.
 *  2. Presencia del certificado público <ds:X509Certificate>.
 *  3. Coincidencia con certificado esperado del tenant (si se proporciona).
 *  4. Extracción de clave pública y validez de vigencia temporal.
 *  5. Integridad de SignedInfo y verificación criptográfica de SignatureValue con RSA-SHA256.
 *  6. Integridad del documento referenciado (DigestValue contra C14N del documento limpio).
 */
class SiatXmlSignatureValidator
{
    public const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

    /**
     * Valida criptográficamente el XML firmado. Lanza SiatFiscalException si la firma es inválida.
     *
     * @param  string       $signedXml
     * @param  string|null  $expectedCertPemOrB64
     * @param  Carbon|null  $referenceDate
     * @return bool Retorna true si es 100% válido
     *
     * @throws SiatFiscalException
     */
    public function verify(
        string $signedXml,
        ?string $expectedCertPemOrB64 = null,
        ?Carbon $referenceDate = null
    ): bool {
        $result = $this->validateDetails($signedXml, $expectedCertPemOrB64, $referenceDate);

        if (! $result['is_valid']) {
            throw new SiatFiscalException($result['error']);
        }

        return true;
    }

    /**
     * Ejecuta la verificación criptográfica y retorna un array detallado con los resultados y metadatos.
     *
     * @param  string       $signedXml
     * @param  string|null  $expectedCertPemOrB64
     * @param  Carbon|null  $referenceDate
     * @return array{
     *     is_valid: bool,
     *     error: string|null,
     *     certificate_fingerprint: string|null,
     *     valid_from: Carbon|null,
     *     valid_to: Carbon|null,
     *     subject: array|null,
     *     issuer: array|null
     * }
     */
    public function validateDetails(
        string $signedXml,
        ?string $expectedCertPemOrB64 = null,
        ?Carbon $referenceDate = null
    ): array {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = false;

        if (! @$dom->loadXML($signedXml)) {
            return $this->failure('El contenido proporcionado no es un XML válido.');
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('ds', self::XMLDSIG_NS);

        // 1. Existencia del elemento Signature
        $sigNodes = $xpath->query('//ds:Signature');
        if ($sigNodes->length === 0) {
            return $this->failure('El documento no contiene el nodo de firma digital (ds:Signature).');
        }
        if ($sigNodes->length > 1) {
            return $this->failure('El documento contiene múltiples nodos de firma digital (ds:Signature).');
        }
        $sigNode = $sigNodes->item(0);

        // 2. Extraer certificado
        $certNodes = $xpath->query('.//ds:KeyInfo/ds:X509Data/ds:X509Certificate', $sigNode);
        if ($certNodes->length !== 1) {
            return $this->failure('El nodo ds:X509Certificate está ausente o no es único en KeyInfo.');
        }
        $certB64 = trim($certNodes->item(0)->textContent);
        if (empty($certB64)) {
            return $this->failure('El nodo ds:X509Certificate no contiene datos de certificado.');
        }

        // Si se especificó un certificado esperado del tenant, contrastar
        if ($expectedCertPemOrB64 !== null) {
            $expectedClean = preg_replace('/-----.*?-----|\s+/', '', $expectedCertPemOrB64);
            if ($certB64 !== $expectedClean) {
                return $this->failure('El certificado del XML no coincide con el certificado oficial del tenant.');
            }
        }

        $certPem = "-----BEGIN CERTIFICATE-----\n" . chunk_split($certB64, 64, "\n") . "-----END CERTIFICATE-----\n";

        // 3. Extraer clave pública y parsear metadatos del certificado
        $pubKey = @openssl_pkey_get_public($certPem);
        if (! $pubKey) {
            return $this->failure('No se pudo extraer una clave pública RSA válida del certificado X.509.');
        }

        $certParsed = @openssl_x509_parse($certPem);
        if (! is_array($certParsed)) {
            return $this->failure('No se pudieron interpretar los metadatos del certificado X.509.');
        }

        $validFrom = isset($certParsed['validFrom_time_t'])
            ? Carbon::createFromTimestamp($certParsed['validFrom_time_t'])
            : null;
        $validTo = isset($certParsed['validTo_time_t'])
            ? Carbon::createFromTimestamp($certParsed['validTo_time_t'])
            : null;

        if ($validFrom && $validTo) {
            $checkTime = $referenceDate ?? now();
            if ($checkTime->lt($validFrom)) {
                return $this->failure(
                    "El certificado utilizado no estaba vigente en la fecha requerida (válido desde: {$validFrom->toDateTimeString()})."
                );
            }
            if ($checkTime->gt($validTo)) {
                return $this->failure(
                    "El certificado utilizado se encontraba expirado en la fecha requerida (expiró: {$validTo->toDateTimeString()})."
                );
            }
        }

        $fingerprint = openssl_x509_fingerprint($certPem, 'sha256');

        // 4. Extraer y verificar SignedInfo y SignatureValue
        $signedInfoNodes = $xpath->query('.//ds:SignedInfo', $sigNode);
        if ($signedInfoNodes->length !== 1) {
            return $this->failure('El nodo ds:SignedInfo está ausente en la firma.');
        }
        $signedInfoNode = $signedInfoNodes->item(0);
        $c14nSignedInfo = $signedInfoNode->C14N(false, false);

        $sigValNodes = $xpath->query('.//ds:SignatureValue', $sigNode);
        if ($sigValNodes->length !== 1) {
            return $this->failure('El nodo ds:SignatureValue está ausente en la firma.');
        }
        $sigValB64 = trim($sigValNodes->item(0)->textContent);
        $binarySig = base64_decode($sigValB64, true);

        if ($binarySig === false || empty($binarySig)) {
            return $this->failure('El valor de ds:SignatureValue no es una cadena Base64 válida.');
        }

        // 5. Verificar firma criptográfica RSA-SHA256 sobre SignedInfo
        $verifyResult = @openssl_verify($c14nSignedInfo, $binarySig, $pubKey, OPENSSL_ALGO_SHA256);
        if ($verifyResult !== 1) {
            return $this->failure('Firma digital criptográfica inválida (SignedInfo alterado o clave incorrecta).');
        }

        // 6. Verificar DigestValue sobre el documento original
        $digestValNodes = $xpath->query('.//ds:Reference/ds:DigestValue', $sigNode);
        if ($digestValNodes->length !== 1) {
            return $this->failure('El nodo ds:DigestValue está ausente en ds:Reference.');
        }
        $expectedDigest = trim($digestValNodes->item(0)->textContent);

        // Remover ds:Signature para aplicar la transformación enveloped-signature
        $sigNode->parentNode->removeChild($sigNode);

        $c14nCleanDoc = $dom->C14N(false, false);
        $actualDigest = base64_encode(hash('sha256', $c14nCleanDoc, true));

        if (! hash_equals($expectedDigest, $actualDigest)) {
            return $this->failure(
                'Fallo de integridad (Digest mismatch): El contenido del XML fiscal fue alterado después de haberse firmado.'
            );
        }

        return [
            'is_valid'                => true,
            'error'                   => null,
            'certificate_fingerprint' => strtoupper($fingerprint ?: ''),
            'valid_from'              => $validFrom,
            'valid_to'                => $validTo,
            'subject'                 => $certParsed['subject'] ?? null,
            'issuer'                  => $certParsed['issuer'] ?? null,
        ];
    }

    /**
     * Genera la estructura de respuesta de error.
     */
    private function failure(string $message): array
    {
        return [
            'is_valid'                => false,
            'error'                   => $message,
            'certificate_fingerprint' => null,
            'valid_from'              => null,
            'valid_to'                => null,
            'subject'                 => null,
            'issuer'                  => null,
        ];
    }
}
