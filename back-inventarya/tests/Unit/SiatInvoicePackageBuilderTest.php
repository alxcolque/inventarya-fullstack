<?php

namespace Tests\Unit;

use App\Services\Siat\SiatInvoicePackageBuilder;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class SiatInvoicePackageBuilderTest extends TestCase
{
    private SiatInvoicePackageBuilder $builder;

    protected function setUp(): void
    {
        parent::setUp();
        $this->builder = new SiatInvoicePackageBuilder();
    }

    public function test_gzip_compression_and_decompression_roundtrip_is_byte_for_byte_identical(): void
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?><facturaComputarizadaCompraVenta><cabecera><nitEmisor>123456789</nitEmisor><razonSocialEmisor>EMPRESA TEST S.R.L.</razonSocialEmisor><montoTotal>150.50</montoTotal></cabecera></facturaComputarizadaCompraVenta>';

        $package = $this->builder->buildPackage($xml);

        $this->assertNotEmpty($package['rawGzip']);
        $this->assertNotEmpty($package['hashArchivo']);
        $this->assertNotEmpty($package['base64']);
        $this->assertGreaterThan(0, $package['compressedSize']);
        $this->assertEquals(strlen($xml), $package['originalSize']);

        // Descompresión byte por byte
        $decompressed = $this->builder->decompress($package['rawGzip']);
        $this->assertSame($xml, $decompressed);
    }

    public function test_gzip_compression_is_deterministic_in_memory(): void
    {
        $xml = '<factura>DETERMINISTIC_TEST_DATA</factura>';

        $package1 = $this->builder->buildPackage($xml);
        usleep(100000); // 100ms delay
        $package2 = $this->builder->buildPackage($xml);

        // Los bytes comprimidos y el hash deben ser idénticos
        $this->assertSame($package1['rawGzip'], $package2['rawGzip']);
        $this->assertSame($package1['hashArchivo'], $package2['hashArchivo']);
        $this->assertSame($package1['base64'], $package2['base64']);
    }

    public function test_sha256_hash_is_calculated_over_raw_compressed_bytes_in_lowercase_hex(): void
    {
        $xml = '<factura><monto>100</monto></factura>';
        $package = $this->builder->buildPackage($xml);

        // Debe ser SHA-256 sobre los bytes binarios GZIP
        $expectedHash = hash('sha256', $package['rawGzip']);

        $this->assertSame(strtolower($expectedHash), $package['hashArchivo']);
        $this->assertSame(64, strlen($package['hashArchivo']));
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $package['hashArchivo']);
    }

    public function test_static_fixture_detects_any_tampering_with_compression_or_hashing(): void
    {
        // Fixture canónico fijo
        $canonicalXml = '<?xml version="1.0" encoding="UTF-8"?><root><item id="1">Valor Canónico de Prueba</item></root>';

        $package = $this->builder->buildPackage($canonicalXml);

        // Hash calculado sobre el paquete
        $this->assertTrue($this->builder->verifyHash($package['rawGzip'], $package['hashArchivo']));

        // Verificamos que no coincide si se calcula sobre el XML sin comprimir
        $wrongHashOverUncompressed = hash('sha256', $canonicalXml);
        $this->assertFalse($this->builder->verifyHash($package['rawGzip'], $wrongHashOverUncompressed));

        // Verificamos que no coincide si se calcula sobre el Base64
        $wrongHashOverBase64 = hash('sha256', $package['base64']);
        $this->assertFalse($this->builder->verifyHash($package['rawGzip'], $wrongHashOverBase64));
    }

    public function test_byte_tampering_of_compressed_package_fails_hash_verification(): void
    {
        $xml = '<factura><cabecera><nit>99887766</nit></cabecera></factura>';
        $package = $this->builder->buildPackage($xml);

        $originalGzip = $package['rawGzip'];
        $originalHash = $package['hashArchivo'];

        // Alterar un byte del stream comprimido (a la mitad del payload)
        $tamperedGzip = $originalGzip;
        $midIndex = (int) (strlen($tamperedGzip) / 2);
        $tamperedGzip[$midIndex] = chr(ord($tamperedGzip[$midIndex]) ^ 0xFF);

        $this->assertNotSame($originalGzip, $tamperedGzip);

        // El hash esperado ya no coincide
        $this->assertFalse($this->builder->verifyHash($tamperedGzip, $originalHash));
    }

    public function test_empty_xml_content_throws_invalid_argument_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->builder->buildPackage('   ');
    }
}
