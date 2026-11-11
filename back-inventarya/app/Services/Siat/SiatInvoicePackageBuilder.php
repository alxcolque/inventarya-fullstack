<?php

namespace App\Services\Siat;

use InvalidArgumentException;
use RuntimeException;

/**
 * Servicio encargado exclusivamente del empaquetado fiscal de facturas:
 *
 * XML definitivo (string)
 *   → Compresión en memoria GZIP (RFC 1952)
 *   → Cálculo criptográfico SHA-256 sobre los bytes binarios comprimidos (hashArchivo)
 *   → Verificación de integridad por descompresión en memoria
 *   → Preparación de estructura binaria / base64 para SOAP
 *
 * NO realiza llamadas de red ni interactúa con la capa SOAP.
 */
class SiatInvoicePackageBuilder
{
    /**
     * Nivel de compresión GZIP (1-9). Se utiliza nivel 9 para máxima compresión.
     */
    private const GZIP_COMPRESSION_LEVEL = 9;

    /**
     * Construye el paquete fiscal a partir del XML definitivo en memoria.
     *
     * @param  string  $xmlContent  XML fiscal definitivo (firmado si M1, sin firmar si M2)
     * @return array{
     *     rawGzip: string,
     *     hashArchivo: string,
     *     base64: string,
     *     compressedSize: int,
     *     originalSize: int
     * }
     *
     * @throws InvalidArgumentException Si el XML está vacío o malformado
     * @throws RuntimeException Si la compresión o verificación de integridad falla
     */
    public function buildPackage(string $xmlContent): array
    {
        $trimmedXml = trim($xmlContent);

        if (empty($trimmedXml)) {
            throw new InvalidArgumentException('El contenido XML para empaquetado fiscal no puede estar vacío.');
        }

        // 1. Compresión GZIP en memoria (RFC 1952)
        $compressed = gzencode($trimmedXml, self::GZIP_COMPRESSION_LEVEL, FORCE_GZIP);

        if ($compressed === false) {
            throw new RuntimeException('Error durante la compresión GZIP del XML fiscal.');
        }

        // 2. Verificación de integridad simétrica: decompressed === originalXml
        $decompressed = @gzdecode($compressed);
        if ($decompressed !== $trimmedXml) {
            throw new RuntimeException('Falla de integridad: el XML descomprimido no coincide byte a byte con el XML original.');
        }

        // 3. Cálculo de hashArchivo: SHA-256 sobre los bytes binarios exactos comprimidos
        // Formato oficial: cadena hexadecimal en minúsculas (64 caracteres)
        $hashArchivo = strtolower(hash('sha256', $compressed));

        return [
            'rawGzip'        => $compressed,
            'hashArchivo'    => $hashArchivo,
            'base64'         => base64_encode($compressed),
            'compressedSize' => strlen($compressed),
            'originalSize'   => strlen($trimmedXml),
        ];
    }

    /**
     * Descomprime un paquete GZIP y retorna el contenido original.
     *
     * @param  string  $gzipBytes  Bytes binarios comprimidos en GZIP
     * @return string  Contenido original en texto
     *
     * @throws RuntimeException Si los bytes no corresponden a un flujo GZIP válido
     */
    public function decompress(string $gzipBytes): string
    {
        $decompressed = @gzdecode($gzipBytes);

        if ($decompressed === false) {
            throw new RuntimeException('No se pudo descomprimir el paquete GZIP: formato inválido o datos corruptos.');
        }

        return $decompressed;
    }

    /**
     * Verifica la correspondencia de integridad entre bytes comprimidos y un hashArchivo esperado.
     */
    public function verifyHash(string $gzipBytes, string $expectedHash): bool
    {
        $actualHash = strtolower(hash('sha256', $gzipBytes));

        return hash_equals(strtolower($expectedHash), $actualHash);
    }
}
