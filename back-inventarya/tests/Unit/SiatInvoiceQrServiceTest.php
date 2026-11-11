<?php

namespace Tests\Unit;

use App\Models\ElectronicInvoice;
use App\Services\Siat\SiatInvoiceQrService;
use InvalidArgumentException;
use Tests\TestCase;

class SiatInvoiceQrServiceTest extends TestCase
{
    private SiatInvoiceQrService $qrService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->qrService = new SiatInvoiceQrService();

        config([
            'siat.qr_urls.1' => 'https://siat.impuestos.gob.bo/consulta/QR',
            'siat.qr_urls.2' => 'https://pilotosiat.impuestos.gob.bo/consulta/QR',
        ]);
    }

    public function test_builds_official_qr_url_for_piloto_environment(): void
    {
        $nit = '1003579028';
        $cuf = 'A1B2C3D4E5F67890123456789012345678901234567890123456789012345678';
        $numero = 45;
        $ambiente = 2; // Piloto
        $formato = SiatInvoiceQrService::FORMAT_ROLLO; // 1

        $url = $this->qrService->buildUrl($nit, $cuf, $numero, $ambiente, $formato);

        $expected = "https://pilotosiat.impuestos.gob.bo/consulta/QR?nit=1003579028&cuf={$cuf}&numero=45&t=1";
        $this->assertSame($expected, $url);
    }

    public function test_builds_official_qr_url_for_production_environment(): void
    {
        $nit = '5489123011';
        $cuf = 'B2C3D4E5F678901234567890123456789012345678901234567890123456789A';
        $numero = 1002;
        $ambiente = 1; // Producción
        $formato = SiatInvoiceQrService::FORMAT_PAGINA; // 2

        $url = $this->qrService->buildUrl($nit, $cuf, $numero, $ambiente, $formato);

        $expected = "https://siat.impuestos.gob.bo/consulta/QR?nit=5489123011&cuf={$cuf}&numero=1002&t=2";
        $this->assertSame($expected, $url);
    }

    public function test_builds_url_from_electronic_invoice_model(): void
    {
        $invoice = new ElectronicInvoice([
            'issuer_nit'       => '1003579028',
            'cuf'              => 'C3D4E5F678901234567890123456789012345678901234567890123456789AB1',
            'invoice_number'   => 123,
            'siat_environment' => 2,
        ]);

        $url = $this->qrService->buildUrlFromInvoice($invoice, SiatInvoiceQrService::FORMAT_ROLLO);

        $this->assertStringStartsWith('https://pilotosiat.impuestos.gob.bo/consulta/QR?', $url);
        $this->assertStringContainsString('nit=1003579028', $url);
        $this->assertStringContainsString('numero=123', $url);
        $this->assertStringContainsString('t=1', $url);
    }

    public function test_throws_exception_if_cuf_or_nit_is_missing(): void
    {
        $invoiceWithoutCuf = new ElectronicInvoice([
            'issuer_nit'     => '1003579028',
            'invoice_number' => 123,
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->qrService->buildUrlFromInvoice($invoiceWithoutCuf);
    }

    public function test_generates_valid_svg_qr_code_locally(): void
    {
        $content = 'https://pilotosiat.impuestos.gob.bo/consulta/QR?nit=1003579028&cuf=ABC&numero=1&t=1';
        $svg = $this->qrService->generateSvg($content, 180);

        $this->assertStringContainsString('<svg', $svg);
        $this->assertStringContainsString('</svg>', $svg);
        $this->assertStringContainsString('width="180"', $svg);
        $this->assertStringContainsString('height="180"', $svg);
    }

    public function test_generates_valid_svg_data_uri(): void
    {
        $content = 'https://pilotosiat.impuestos.gob.bo/consulta/QR?nit=1003579028&cuf=ABC&numero=1&t=1';
        $dataUri = $this->qrService->generateSvgDataUri($content, 150);

        $this->assertStringStartsWith('data:image/svg+xml;base64,', $dataUri);
        $base64Data = substr($dataUri, strlen('data:image/svg+xml;base64,'));
        $decoded = base64_decode($base64Data, true);

        $this->assertNotFalse($decoded);
        $this->assertStringContainsString('<svg', $decoded);
    }
}
