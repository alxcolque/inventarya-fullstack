<?php

namespace Tests\Unit;

use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Services\Siat\SiatCertificateService;
use App\Services\Siat\SiatInvoiceXmlBuilder;
use App\Services\Siat\SiatInvoiceXmlValidator;
use App\Services\Siat\SiatXmlSignatureValidator;
use App\Services\Siat\SiatXmlSigner;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * SiatXmlSignerTest — Fase 4D
 *
 * Pruebas unitarias para la firma digital XMLDSig, carga/validación de certificados
 * PKCS#12, verificación criptográfica y pruebas de manipulación (tampering).
 */
class SiatXmlSignerTest extends TestCase
{
    private SiatCertificateService $certService;
    private SiatXmlSigner $signer;
    private SiatXmlSignatureValidator $sigValidator;
    private SiatInvoiceXmlValidator $xmlValidator;
    private SiatInvoiceXmlBuilder $builder;

    private string $p12Password = 'TestPassSecret123!';
    private string $p12Binary;
    private array $certData;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureOpenSslConfig();

        $this->certService  = new SiatCertificateService();
        $this->signer       = new SiatXmlSigner();
        $this->sigValidator = new SiatXmlSignatureValidator();
        $this->xmlValidator = new SiatInvoiceXmlValidator();
        $this->builder      = new SiatInvoiceXmlBuilder(
            $this->xmlValidator,
            $this->signer,
            $this->sigValidator,
            $this->certService
        );

        // Generar un certificado PKCS#12 "TEST ONLY" válido en memoria
        $this->p12Binary = $this->generateTestPkcs12(
            cn: 'TEST ONLY - EMPRESA PRUEBA S.R.L.',
            password: $this->p12Password,
            daysValid: 365
        );

        $this->certData = $this->certService->parseAndValidate($this->p12Binary, $this->p12Password);
    }

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

        foreach ($candidates as $cand) {
            if (file_exists($cand)) {
                putenv("OPENSSL_CONF={$cand}");
                break;
            }
        }
    }

    private function generateTestPkcs12(
        string $cn = 'TEST ONLY',
        string $password = 'secret',
        int $daysValid = 365,
        int $validOffsetDays = 0,
        bool $corruptKey = false
    ): string {
        $cnf = getenv('OPENSSL_CONF') ?: null;
        $args = $cnf ? ['config' => $cnf] : [];

        $pkey = openssl_pkey_new(array_merge($args, [
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]));

        $dn = [
            'countryName'            => 'BO',
            'stateOrProvinceName'    => 'La Paz',
            'localityName'           => 'La Paz',
            'organizationName'       => 'Empresa de Prueba S.R.L.',
            'organizationalUnitName' => 'Facturacion Electronica',
            'commonName'             => $cn,
        ];

        $csr = openssl_csr_new($dn, $pkey, $args);
        $cert = openssl_csr_sign($csr, null, $pkey, $daysValid, array_merge($args, [
            'digest_alg' => 'sha256',
        ]));

        openssl_pkcs12_export($cert, $p12Out, $pkey, $password);
        return $p12Out;
    }

    private function createSampleInvoice(array $overrides = []): ElectronicInvoice
    {
        $defaults = [
            'id'                        => '22222222-2222-2222-2222-222222222222',
            'issuer_nit'                => '1003579028',
            'issuer_business_name'      => 'Empresa de Prueba S.R.L.',
            'issuer_municipality'       => 'La Paz',
            'issuer_phone'              => '2846005',
            'invoice_number'            => 10,
            'cuf'                       => '44AAEC00DBD34C819B4D7AFD5F91900D3A059E06A467A75AC82F24C74',
            'cufd_snapshot'             => 'BQUE+QytqQUDBKVUFOSVRPQkxVRFZNVFVJBMDAwMDAwM',
            'control_code'              => 'A19E23EF34124CD',
            'branch_code'               => 0,
            'issuer_address'            => 'AV. JORGE LOPEZ #123',
            'point_of_sale_code'        => 0,
            'issued_at'                 => now()->toDateTimeString(),
            'buyer_name'                => 'Juan Pérez & Cía',
            'buyer_document_type'       => 1,
            'buyer_document_number'     => '5115889',
            'buyer_document_complement' => null,
            'buyer_customer_code'       => '51158891',
            'payment_method_code'       => 1,
            'card_number'               => null,
            'subtotal'                  => '100.00',
            'discount'                  => '0.00',
            'additional_discount'       => '0.00',
            'gift_card_amount'          => '0.00',
            'total'                     => '100.00',
            'total_subject_to_vat'      => '100.00',
            'currency_code'             => 1,
            'exchange_rate'             => '1.00',
            'total_in_currency'         => '100.00',
            'exception_code'            => null,
            'cafc'                      => null,
            'legend'                    => 'Ley N° 453: El proveedor debe suministrar producto en las condiciones ofertadas.',
            'issued_by'                 => 'cajero1',
            'document_sector_code'      => 1,
            'siat_modality'             => 1,
            'status'                    => ElectronicInvoiceStatus::DRAFT,
        ];

        $invoice = new ElectronicInvoice(array_merge($defaults, $overrides));

        $detail = new ElectronicInvoiceDetail([
            'sin_activity_code' => '451010',
            'sin_product_code'  => '49111',
            'product_code'      => 'JN-131231',
            'description'       => 'JUGO DE NARANJA CON & <PULPA>',
            'quantity'          => '1.00',
            'sin_unit_code'     => 1,
            'unit_price'        => '100.00',
            'discount'          => '0.00',
            'subtotal'          => '100.00',
            'serial_number'     => null,
            'imei_number'       => null,
        ]);

        $invoice->setRelation('details', collect([$detail]));

        return $invoice;
    }

    public function test_modalidad_1_firma_correctamente_y_pasa_xsd(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 1]);
        $rawXml = $this->builder->build($invoice);

        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        $this->assertStringContainsString('<ds:Signature', $signedXml);
        $this->assertStringContainsString('<ds:SignedInfo', $signedXml);
        $this->assertStringContainsString('<ds:SignatureValue', $signedXml);
        $this->assertStringContainsString('<ds:KeyInfo', $signedXml);
        $this->assertStringContainsString('<ds:X509Certificate>' . $this->certData['clean_cert'] . '</ds:X509Certificate>', $signedXml);

        // Validar XSD oficial post-firma
        $isValidXsd = $this->xmlValidator->validate($signedXml);
        $this->assertTrue($isValidXsd);

        // Validar criptográficamente
        $verifyOk = $this->sigValidator->verify($signedXml, $this->certData['cert']);
        $this->assertTrue($verifyOk);
    }

    public function test_modalidad_2_no_debe_firmarse(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 2]);
        $rawXml = $this->builder->build($invoice);

        $this->assertStringNotContainsString('ds:Signature', $rawXml);

        // Intentar firmar un XML de Modalidad 2 debe ser rechazado
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("raíz esperada: 'facturaElectronicaCompraVenta'");

        $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);
    }

    public function test_tampering_monto_total_falla_verificacion_digest(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 1, 'total' => '100.00']);
        $rawXml = $this->builder->build($invoice);
        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        $this->assertTrue($this->sigValidator->verify($signedXml));

        // Alterar montoTotal
        $tampered = str_replace('<montoTotal>100.00</montoTotal>', '<montoTotal>999.00</montoTotal>', $signedXml);

        $details = $this->sigValidator->validateDetails($tampered);
        $this->assertFalse($details['is_valid']);
        $this->assertStringContainsString('Digest mismatch', $details['error']);
    }

    public function test_tampering_numero_factura_falla_verificacion_digest(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 1, 'invoice_number' => 10]);
        $rawXml = $this->builder->build($invoice);
        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        // Alterar numeroFactura
        $tampered = str_replace('<numeroFactura>10</numeroFactura>', '<numeroFactura>99</numeroFactura>', $signedXml);

        $details = $this->sigValidator->validateDetails($tampered);
        $this->assertFalse($details['is_valid']);
        $this->assertStringContainsString('Digest mismatch', $details['error']);
    }

    public function test_tampering_detalle_descripcion_falla_verificacion_digest(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 1]);
        $rawXml = $this->builder->build($invoice);
        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        // Alterar descripción del producto en detalle
        $tampered = str_replace('JUGO DE NARANJA', 'BEBIDA ALCOHOLICA', $signedXml);

        $details = $this->sigValidator->validateDetails($tampered);
        $this->assertFalse($details['is_valid']);
        $this->assertStringContainsString('Digest mismatch', $details['error']);
    }

    public function test_tampering_signature_value_falla_verificacion_criptografica(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 1]);
        $rawXml = $this->builder->build($invoice);
        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        // Corromper el SignatureValue
        $tampered = preg_replace('/<ds:SignatureValue>.*?<\/ds:SignatureValue>/', '<ds:SignatureValue>' . base64_encode('fake-signature-bytes') . '</ds:SignatureValue>', $signedXml);

        $details = $this->sigValidator->validateDetails($tampered);
        $this->assertFalse($details['is_valid']);
        $this->assertStringContainsString('Firma digital criptográfica inválida', $details['error']);
    }

    public function test_verificacion_con_certificado_diferente_falla(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 1]);
        $rawXml = $this->builder->build($invoice);
        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        // Otro certificado
        $otherP12 = $this->generateTestPkcs12(cn: 'OTRO CERTIFICADO DIFERENTE', password: 'other');
        $otherCertData = $this->certService->parseAndValidate($otherP12, 'other');

        $details = $this->sigValidator->validateDetails($signedXml, $otherCertData['cert']);
        $this->assertFalse($details['is_valid']);
        $this->assertStringContainsString('no coincide con el certificado oficial del tenant', $details['error']);
    }

    public function test_password_incorrecto_en_pkcs12_lanza_excepcion_controlada(): void
    {
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('No se pudo abrir el certificado digital PKCS#12');

        $this->certService->parseAndValidate($this->p12Binary, 'password_incorrecto_xyz');
    }

    public function test_pkcs12_corrupto_lanza_excepcion_controlada(): void
    {
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('No se pudo abrir el certificado digital PKCS#12');

        $this->certService->parseAndValidate('contenido_aleatorio_corrupto_no_es_pkcs12', $this->p12Password);
    }

    public function test_clave_privada_no_coincide_con_certificado_lanza_excepcion(): void
    {
        $cnf = getenv('OPENSSL_CONF') ?: null;
        $args = $cnf ? ['config' => $cnf] : [];

        $wrongKey = openssl_pkey_new(array_merge($args, [
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]));
        openssl_pkey_export($wrongKey, $wrongKeyPem, null, $args);

        $matches = openssl_x509_check_private_key($this->certData['cert'], $wrongKeyPem);
        $this->assertFalse($matches);

        // Firmar con clave que no corresponde al certificado público en ds:X509Certificate falla la validación
        $invoice = $this->createSampleInvoice(['siat_modality' => 1]);
        $rawXml = $this->builder->build($invoice);
        $signedWithWrongKey = $this->signer->sign($rawXml, $wrongKey, $this->certData['cert']);

        $details = $this->sigValidator->validateDetails($signedWithWrongKey);
        $this->assertFalse($details['is_valid']);
        $this->assertStringContainsString('Firma digital criptográfica inválida', $details['error']);
    }

    public function test_certificado_expirado_lanza_excepcion_controlada(): void
    {
        // Certificado que ya expiró (fecha de referencia futura más allá del año de validez)
        $futureDate = now()->addYears(2);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('se encuentra expirado para la fecha de emisión requerida');

        $this->certService->parseAndValidate($this->p12Binary, $this->p12Password, $futureDate);
    }

    public function test_certificado_no_vigente_lanza_excepcion_controlada(): void
    {
        // Certificado con fecha de referencia anterior a la fecha de creación
        $pastDate = now()->subYears(2);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('aún no es válido para la fecha de emisión requerida');

        $this->certService->parseAndValidate($this->p12Binary, $this->p12Password, $pastDate);
    }

    public function test_documento_ya_firmado_no_permite_doble_firma(): void
    {
        $invoice = $this->createSampleInvoice(['siat_modality' => 1]);
        $rawXml = $this->builder->build($invoice);

        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('ya contiene un nodo de firma digital (ds:Signature)');

        $this->signer->sign($signedXml, $this->certData['pkey'], $this->certData['cert']);
    }

    public function test_caracteres_utf8_complejos_permanecen_validos_post_firma(): void
    {
        $invoice = $this->createSampleInvoice([
            'siat_modality'        => 1,
            'issuer_business_name' => 'FARMACIA & ÓPTICA "SAN JOSÉ" S.R.L.',
            'buyer_name'           => 'SEÑOR PEÑA-NÚÑEZ & ASOCIADOS',
        ]);

        $rawXml = $this->builder->build($invoice);
        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        $this->assertTrue($this->xmlValidator->validate($signedXml));
        $this->assertTrue($this->sigValidator->verify($signedXml, $this->certData['cert']));
    }

    public function test_sucursal_cero_y_pos_cero_se_firman_y_validan_correctamente(): void
    {
        $invoice = $this->createSampleInvoice([
            'siat_modality'      => 1,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
        ]);

        $rawXml = $this->builder->build($invoice);
        $signedXml = $this->signer->sign($rawXml, $this->certData['pkey'], $this->certData['cert']);

        $this->assertStringContainsString('<codigoSucursal>0</codigoSucursal>', $signedXml);
        $this->assertStringContainsString('<codigoPuntoVenta>0</codigoPuntoVenta>', $signedXml);

        $this->assertTrue($this->xmlValidator->validate($signedXml));
        $this->assertTrue($this->sigValidator->verify($signedXml));
    }
}
