<?php

namespace App\Services\Siat;

use App\Models\ElectronicInvoice;
use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use InvalidArgumentException;
use RuntimeException;

/**
 * Servicio encargado exclusivamente de la construcción y renderizado del Código QR fiscal
 * según la especificación del SIN (RND 102100000011).
 *
 * Estructura de la URL:
 *   {baseUrl}?nit={nitEmisor}&cuf={cuf}&numero={numeroFactura}&t={formato}
 *
 * Formatos normativos (parámetro t):
 *   t=1: Formato Rollo / Tiras térmicas
 *   t=2: Formato Media Hoja / Página completa
 *
 * Ambientes:
 *   1 (Producción): Parametrizable vía configuración/credenciales de homologación.
 *                   (La URL oficial definitiva es comunicada por el SIN al finalizar la autorización).
 *   2 (Piloto):     https://pilotosiat.impuestos.gob.bo/consulta/QR
 *
 * Generación 100% local en memoria (sin llamadas a APIs externas ni servicios de terceros).
 */
class SiatInvoiceQrService
{
    /** Formato rollo / tiras térmicas (58mm - 80mm) (t=1) */
    public const FORMAT_ROLLO = 1;

    /** Formato media hoja / página completa (Carta / A4 / Oficio) (t=2) */
    public const FORMAT_PAGINA = 2;

    /**
     * Construye la URL de consulta QR del SIN a partir de una factura electrónica.
     *
     * @param  ElectronicInvoice  $invoice
     * @param  int                $formatType  1: rollo, 2: media hoja / página
     * @param  string|null        $customBaseUrl URL base opcional para sobrescribir por configuración
     * @return string
     */
    public function buildUrlFromInvoice(ElectronicInvoice $invoice, int $formatType = self::FORMAT_ROLLO, ?string $customBaseUrl = null): string
    {
        $nit = trim((string) ($invoice->issuer_nit ?? ''));
        $cuf = trim((string) ($invoice->cuf ?? ''));
        $numero = (int) ($invoice->invoice_number ?? 0);
        $ambiente = (int) ($invoice->siat_environment ?? 2);

        if (empty($nit)) {
            throw new InvalidArgumentException("La factura ID '{$invoice->id}' no tiene NIT emisor para generar el QR.");
        }

        if (empty($cuf)) {
            throw new InvalidArgumentException("La factura ID '{$invoice->id}' no tiene CUF para generar el QR.");
        }

        if ($numero <= 0) {
            throw new InvalidArgumentException("La factura ID '{$invoice->id}' no tiene un número correlativo válido.");
        }

        return $this->buildUrl($nit, $cuf, $numero, $ambiente, $formatType, $customBaseUrl);
    }

    /**
     * Construye la URL de consulta QR del SIN con parámetros explícitos.
     *
     * @param  string       $nit
     * @param  string       $cuf
     * @param  int          $numeroFactura
     * @param  int          $ambiente       1: Producción, 2: Piloto
     * @param  int          $formatType     1: Rollo, 2: Media Hoja / Página
     * @param  string|null  $customBaseUrl  URL base opcional para homologación/configuración
     * @return string
     */
    public function buildUrl(string $nit, string $cuf, int $numeroFactura, int $ambiente = 2, int $formatType = self::FORMAT_ROLLO, ?string $customBaseUrl = null): string
    {
        $baseUrl = $customBaseUrl ?: config("siat.qr_urls.{$ambiente}");

        if (empty($baseUrl)) {
            $baseUrl = ($ambiente === 1)
                ? 'https://siat.impuestos.gob.bo/consulta/QR'
                : 'https://pilotosiat.impuestos.gob.bo/consulta/QR';
        }

        $params = [
            'nit'    => trim($nit),
            'cuf'    => trim($cuf),
            'numero' => $numeroFactura,
            't'      => $formatType,
        ];

        return $baseUrl . '?' . http_build_query($params);
    }

    /**
     * Genera la imagen vectorial SVG del código QR en memoria.
     *
     * @param  string  $content  URL o payload a codificar
     * @param  int     $size     Tamaño en píxeles (default 200)
     * @param  int     $margin   Margen en módulos (default 1)
     * @return string  Código XML/SVG puro
     */
    public function generateSvg(string $content, int $size = 200, int $margin = 1): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle($size, $margin),
            new SvgImageBackEnd()
        );

        $writer = new Writer($renderer);

        return $writer->writeString($content);
    }

    /**
     * Genera un Data URI base64 en formato SVG apto para ser incrustado en <img> o PDFs.
     *
     * @param  string  $content
     * @param  int     $size
     * @param  int     $margin
     * @return string  "data:image/svg+xml;base64,..."
     */
    public function generateSvgDataUri(string $content, int $size = 200, int $margin = 1): string
    {
        $svg = $this->generateSvg($content, $size, $margin);

        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }
}
