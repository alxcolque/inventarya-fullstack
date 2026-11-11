<?php

namespace App\Services\Siat;

use App\Exceptions\SiatFiscalException;
use DOMDocument;
use DOMXPath;
use Throwable;

/**
 * SiatXmlSigner — Fase 4D
 *
 * Servicio responsable exclusivo de la firma digital XMLDSig sobre el XML de
 * Factura Compra-Venta (Sector 1) para Modalidad 1 (Electrónica en Línea).
 *
 * Especificaciones confirmadas:
 * - Namespace: http://www.w3.org/2000/09/xmldsig# (prefijo ds)
 * - CanonicalizationMethod: http://www.w3.org/TR/2001/REC-xml-c14n-20010315 (C14N 1.0)
 * - SignatureMethod: http://www.w3.org/2001/04/xmldsig-more#rsa-sha256 (RSA-SHA256)
 * - Reference URI: "" (documento contenedor completo)
 * - Transforms:
 *     1. http://www.w3.org/2000/09/xmldsig#enveloped-signature
 *     2. http://www.w3.org/TR/2001/REC-xml-c14n-20010315
 * - DigestMethod: http://www.w3.org/2001/04/xmlenc#sha256 (SHA-256)
 * - Ubicación: Último hijo del elemento raíz <facturaElectronicaCompraVenta>, tras <detalle>.
 */
class SiatXmlSigner
{
    public const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
    public const C14N_ALGO  = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    public const SIG_ALGO   = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    public const DIGEST_ALGO = 'http://www.w3.org/2001/04/xmlenc#sha256';
    public const ENVELOPED_TRANSFORM = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

    /**
     * Firma digitalmente el XML de Factura Electrónica en Línea.
     *
     * @param  string  $xmlContent   Contenido XML sin firmar
     * @param  mixed   $privateKey   Clave privada OpenSSL (recurso o string PEM)
     * @param  string  $certPemOrB64 Certificado X.509 público (PEM o Base64 limpio)
     * @return string  Contenido XML firmado
     *
     * @throws SiatFiscalException
     */
    public function sign(string $xmlContent, mixed $privateKey, string $certPemOrB64): string
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = false;

        if (! @$dom->loadXML($xmlContent)) {
            throw new SiatFiscalException('No se pudo cargar el documento XML para la operación de firma digital.');
        }

        $root = $dom->documentElement;
        if (! $root || $root->localName !== 'facturaElectronicaCompraVenta') {
            throw new SiatFiscalException(
                "El documento XML no corresponde a Factura Electrónica en Línea (raíz esperada: 'facturaElectronicaCompraVenta')."
            );
        }

        // Verificar si ya cuenta con firma digital
        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('ds', self::XMLDSIG_NS);
        if ($xpath->query('//ds:Signature')->length > 0) {
            throw new SiatFiscalException('El documento XML ya contiene un nodo de firma digital (ds:Signature).');
        }

        try {
            // 1. Calcular Digest del documento original (enveloped signature: excluyendo Signature)
            $c14nDoc = $dom->C14N(false, false);
            $digestValue = base64_encode(hash('sha256', $c14nDoc, true));

            // 2. Construir la estructura exacta de ds:Signature
            $sigElem = $dom->createElementNS(self::XMLDSIG_NS, 'ds:Signature');
            $signedInfo = $dom->createElementNS(self::XMLDSIG_NS, 'ds:SignedInfo');

            // 2.1 CanonicalizationMethod
            $c14nMethod = $dom->createElementNS(self::XMLDSIG_NS, 'ds:CanonicalizationMethod');
            $c14nMethod->setAttribute('Algorithm', self::C14N_ALGO);
            $signedInfo->appendChild($c14nMethod);

            // 2.2 SignatureMethod
            $sigMethod = $dom->createElementNS(self::XMLDSIG_NS, 'ds:SignatureMethod');
            $sigMethod->setAttribute('Algorithm', self::SIG_ALGO);
            $signedInfo->appendChild($sigMethod);

            // 2.3 Reference URI=""
            $reference = $dom->createElementNS(self::XMLDSIG_NS, 'ds:Reference');
            $reference->setAttribute('URI', '');

            // Transforms
            $transforms = $dom->createElementNS(self::XMLDSIG_NS, 'ds:Transforms');

            $t1 = $dom->createElementNS(self::XMLDSIG_NS, 'ds:Transform');
            $t1->setAttribute('Algorithm', self::ENVELOPED_TRANSFORM);
            $transforms->appendChild($t1);

            $t2 = $dom->createElementNS(self::XMLDSIG_NS, 'ds:Transform');
            $t2->setAttribute('Algorithm', self::C14N_ALGO);
            $transforms->appendChild($t2);

            $reference->appendChild($transforms);

            // DigestMethod
            $digestMethod = $dom->createElementNS(self::XMLDSIG_NS, 'ds:DigestMethod');
            $digestMethod->setAttribute('Algorithm', self::DIGEST_ALGO);
            $reference->appendChild($digestMethod);

            // DigestValue
            $digestValElem = $dom->createElementNS(self::XMLDSIG_NS, 'ds:DigestValue', $digestValue);
            $reference->appendChild($digestValElem);

            $signedInfo->appendChild($reference);
            $sigElem->appendChild($signedInfo);

            // 3. Adjuntar ds:Signature a la raíz ANTES de canonicalizar SignedInfo
            // para que herede las declaraciones de namespace in-scope de forma idéntica a la verificación
            $root->appendChild($sigElem);

            // 4. Canonicalizar SignedInfo
            $c14nSignedInfo = $signedInfo->C14N(false, false);

            // 5. Firmar SignedInfo con RSA-SHA256
            $binarySig = '';
            $signOk = openssl_sign($c14nSignedInfo, $binarySig, $privateKey, OPENSSL_ALGO_SHA256);
            if (! $signOk || empty($binarySig)) {
                throw new SiatFiscalException('Fallo al ejecutar la firma criptográfica RSA-SHA256 sobre SignedInfo.');
            }

            $signatureValue = base64_encode($binarySig);
            $sigValElem = $dom->createElementNS(self::XMLDSIG_NS, 'ds:SignatureValue', $signatureValue);
            $sigElem->appendChild($sigValElem);

            // 6. Construir KeyInfo / X509Data / X509Certificate
            $cleanCert = preg_replace('/-----.*?-----|\s+/', '', $certPemOrB64);
            $keyInfo   = $dom->createElementNS(self::XMLDSIG_NS, 'ds:KeyInfo');
            $x509Data  = $dom->createElementNS(self::XMLDSIG_NS, 'ds:X509Data');
            $x509Cert  = $dom->createElementNS(self::XMLDSIG_NS, 'ds:X509Certificate', $cleanCert);

            $x509Data->appendChild($x509Cert);
            $keyInfo->appendChild($x509Data);
            $sigElem->appendChild($keyInfo);

            return $dom->saveXML();
        } catch (SiatFiscalException $e) {
            throw $e;
        } catch (Throwable $e) {
            throw new SiatFiscalException('Error inesperado durante el proceso de firma XMLDSig: ' . $e->getMessage());
        }
    }
}
