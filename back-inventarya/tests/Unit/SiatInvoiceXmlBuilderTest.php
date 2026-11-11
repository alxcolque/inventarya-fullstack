<?php

namespace Tests\Unit;

use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Services\Siat\SiatCufGenerator;
use App\Services\Siat\SiatInvoiceXmlBuilder;
use App\Services\Siat\SiatInvoiceXmlValidator;
use Carbon\Carbon;
use Tests\TestCase;

class SiatInvoiceXmlBuilderTest extends TestCase
{
    private SiatInvoiceXmlValidator $validator;
    private SiatInvoiceXmlBuilder $builder;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new SiatInvoiceXmlValidator();
        $this->builder = new SiatInvoiceXmlBuilder($this->validator);
    }

    /**
     * 1. Verifica la integridad criptográfica (SHA-256) de los esquemas XSD oficiales locales.
     */
    public function test_xsd_files_integrity_sha256(): void
    {
        $compPath = resource_path('siat/xsd/facturaComputarizadaCompraVenta.xsd');
        $elecPath = resource_path('siat/xsd/facturaElectronicaCompraVenta.xsd');
        $sigPath  = resource_path('siat/xsd/SignatureSchema.xsd');

        $this->assertFileExists($compPath);
        $this->assertFileExists($elecPath);
        $this->assertFileExists($sigPath);

        $this->assertSame(
            'B42AE7AB259A8C66C2A87735B6A16DFCDFA1F5FDDAA6CB778426EAB039FDDC90',
            strtoupper(hash_file('sha256', $compPath)),
            'El hash SHA-256 de facturaComputarizadaCompraVenta.xsd ha sido alterado.'
        );

        $this->assertSame(
            '2261C1F66AB219EAA304B827E2FC9041D8DF236CC30CC8B2A107829D9D949742',
            strtoupper(hash_file('sha256', $elecPath)),
            'El hash SHA-256 de facturaElectronicaCompraVenta.xsd ha sido alterado.'
        );

        $this->assertSame(
            'E21132823E60B259C29277FFA957A8F60E1D2FB8033B028ED61BA3787F6F0D4A',
            strtoupper(hash_file('sha256', $sigPath)),
            'El hash SHA-256 de SignatureSchema.xsd ha sido alterado.'
        );
    }

    /**
     * 2. Modalidad 1 (Electrónica en Línea): Valida elemento raíz, atributos y esquema XSD oficial.
     */
    public function test_build_modalidad_1_electronica_valida_contra_xsd(): void
    {
        $invoice = $this->createSampleInvoice([
            'siat_modality' => 1,
        ]);

        $xml = $this->builder->build($invoice);

        $this->assertStringContainsString('<facturaElectronicaCompraVenta', $xml);
        $this->assertStringContainsString('xsi:noNamespaceSchemaLocation="facturaElectronicaCompraVenta.xsd"', $xml);
        $this->assertStringContainsString('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"', $xml);

        $this->assertTrue($this->validator->validate($xml));
    }

    /**
     * 3. Modalidad 2 (Computarizada en Línea): Valida elemento raíz, atributos y esquema XSD oficial.
     */
    public function test_build_modalidad_2_computarizada_valida_contra_xsd(): void
    {
        $invoice = $this->createSampleInvoice([
            'siat_modality' => 2,
        ]);

        $xml = $this->builder->build($invoice);

        $this->assertStringContainsString('<facturaComputarizadaCompraVenta', $xml);
        $this->assertStringContainsString('xsi:noNamespaceSchemaLocation="facturaComputarizadaCompraVenta.xsd"', $xml);
        $this->assertStringContainsString('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"', $xml);

        $this->assertTrue($this->validator->validate($xml));
    }

    /**
     * 4. Valida coincidencia exacta de milisegundos entre CUF y fechaEmision en XML.
     */
    public function test_fecha_emision_milisegundos_coincide_exactamente_con_cuf(): void
    {
        $issuedAt = '2026-10-15 14:35:22.789';
        $invoice = $this->createSampleInvoice([
            'issued_at' => $issuedAt,
        ]);

        // Generar CUF con SiatCufGenerator
        $cufGen = new SiatCufGenerator();
        $dateFormatted = Carbon::parse($issuedAt)->format('YmdHisv');
        $cuf = $cufGen->generateFromFields(
            nit: (string) $invoice->issuer_nit,
            issuedAtFormatted: $dateFormatted,
            branchCode: (int) $invoice->branch_code,
            modality: (int) $invoice->siat_modality,
            emissionType: 1,
            invoiceType: 1,
            documentSector: (int) $invoice->document_sector_code,
            invoiceNumber: (int) $invoice->invoice_number,
            pointOfSaleCode: (int) $invoice->point_of_sale_code,
            controlCode: (string) $invoice->control_code
        );
        $invoice->cuf = $cuf;

        $xml = $this->builder->build($invoice);

        // En XML: YYYY-MM-DDTHH:mm:ss.sss
        $this->assertStringContainsString('<fechaEmision>2026-10-15T14:35:22.789</fechaEmision>', $xml);

        // El CUF contiene la misma fecha y milisegundos (20261015143522789)
        $dateInCuf = Carbon::parse($issuedAt)->format('YmdHisv');
        $this->assertSame('20261015143522789', $dateInCuf);

        $this->assertTrue($this->validator->validate($xml));
    }

    /**
     * 5. Manejo de caracteres UTF-8, entidades escapadas (&, <, >, ", tildes, ñ).
     */
    public function test_utf8_escaped_entities_and_accents(): void
    {
        $invoice = $this->createSampleInvoice([
            'issuer_business_name' => 'Comercializadora & Distribuidora "El Éxito" S.R.L.',
            'buyer_name'           => 'Señor René Peña & Asociados',
            'issuer_address'       => 'Av. Cañoto #123 entre c/ 5 & 6',
        ]);

        $detail = new ElectronicInvoiceDetail([
            'sin_activity_code' => '451010',
            'sin_product_code'  => '49111',
            'product_code'      => 'PROD-Ñ-01',
            'description'       => 'Azúcar Morena 5kg <Especial> & Añejo de Caña',
            'quantity'          => '2.00',
            'sin_unit_code'     => 1,
            'unit_price'        => '50.00',
            'discount'          => '0.00',
            'subtotal'          => '100.00',
            'serial_number'     => null,
            'imei_number'       => null,
        ]);
        $invoice->setRelation('details', collect([$detail]));

        $xml = $this->builder->build($invoice);

        $this->assertStringContainsString('Comercializadora &amp; Distribuidora "El Éxito" S.R.L.', $xml);
        $this->assertStringContainsString('Señor René Peña &amp; Asociados', $xml);
        $this->assertStringContainsString('Azúcar Morena 5kg &lt;Especial&gt; &amp; Añejo de Caña', $xml);

        $this->assertTrue($this->validator->validate($xml));
    }

    /**
     * 6. XML con múltiples líneas de detalle (3 items).
     */
    public function test_multiple_invoice_details_validates_xsd(): void
    {
        $invoice = $this->createSampleInvoice([
            'subtotal'             => '350.00',
            'total'                => '350.00',
            'total_subject_to_vat' => '350.00',
            'total_in_currency'    => '350.00',
        ]);

        $details = collect([
            new ElectronicInvoiceDetail([
                'sin_activity_code' => '451010',
                'sin_product_code'  => '49111',
                'product_code'      => 'ITM-01',
                'description'       => 'Producto Uno',
                'quantity'          => '1.00',
                'sin_unit_code'     => 1,
                'unit_price'        => '100.00',
                'discount'          => '0.00',
                'subtotal'          => '100.00',
                'serial_number'     => null,
                'imei_number'       => null,
            ]),
            new ElectronicInvoiceDetail([
                'sin_activity_code' => '451010',
                'sin_product_code'  => '49111',
                'product_code'      => 'ITM-02',
                'description'       => 'Producto Dos con Serie',
                'quantity'          => '1.00',
                'sin_unit_code'     => 1,
                'unit_price'        => '150.00',
                'discount'          => '0.00',
                'subtotal'          => '150.00',
                'serial_number'     => 'SN-987654321',
                'imei_number'       => null,
            ]),
            new ElectronicInvoiceDetail([
                'sin_activity_code' => '451010',
                'sin_product_code'  => '49111',
                'product_code'      => 'ITM-03',
                'description'       => 'Teléfono Celular con IMEI',
                'quantity'          => '1.00',
                'sin_unit_code'     => 1,
                'unit_price'        => '100.00',
                'discount'          => '0.00',
                'subtotal'          => '100.00',
                'serial_number'     => null,
                'imei_number'       => '358912345678901',
            ]),
        ]);

        $invoice->setRelation('details', $details);

        $xml = $this->builder->build($invoice);

        $this->assertSame(3, substr_count($xml, '<detalle>'));
        $this->assertStringContainsString('<numeroSerie>SN-987654321</numeroSerie>', $xml);
        $this->assertStringContainsString('<numeroImei>358912345678901</numeroImei>', $xml);

        $this->assertTrue($this->validator->validate($xml));
    }

    /**
     * 7. Sucursal 0 y Punto de Venta 0 (Valores numéricos 0 permitidos).
     */
    public function test_sucursal_cero_y_pos_cero_son_emitidos_correctamente(): void
    {
        $invoice = $this->createSampleInvoice([
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
        ]);

        $xml = $this->builder->build($invoice);

        $this->assertStringContainsString('<codigoSucursal>0</codigoSucursal>', $xml);
        $this->assertStringContainsString('<codigoPuntoVenta>0</codigoPuntoVenta>', $xml);

        $this->assertTrue($this->validator->validate($xml));
    }

    /**
     * 8. Campos opcionales nulos con xsi:nil="true".
     */
    public function test_optional_null_fields_use_xsi_nil_attribute(): void
    {
        $invoice = $this->createSampleInvoice([
            'issuer_phone'              => null,
            'point_of_sale_code'        => null,
            'buyer_document_complement' => null,
            'card_number'               => null,
            'gift_card_amount'          => null,
            'additional_discount'       => null,
            'exception_code'            => null,
            'cafc'                      => null,
        ]);

        $xml = $this->builder->build($invoice);

        $this->assertStringContainsString('<telefono xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<codigoPuntoVenta xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<complemento xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<numeroTarjeta xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<montoGiftCard xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<descuentoAdicional xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<codigoExcepcion xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<cafc xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<numeroSerie xsi:nil="true"/>', $xml);
        $this->assertStringContainsString('<numeroImei xsi:nil="true"/>', $xml);

        $this->assertTrue($this->validator->validate($xml));
    }

    /**
     * 9. Consumidor final permitido sin identificación (doc 0, tipo 5, código CF).
     */
    public function test_consumidor_final_sin_identificacion_valida_xsd(): void
    {
        $invoice = $this->createSampleInvoice([
            'buyer_document_type'   => 5,
            'buyer_document_number' => '0',
            'buyer_name'            => 'Sin Nombre',
            'buyer_customer_code'   => 'CF',
            'total'                 => '80.00',
            'subtotal'              => '80.00',
            'total_subject_to_vat'  => '80.00',
            'total_in_currency'     => '80.00',
        ]);

        $detail = new ElectronicInvoiceDetail([
            'sin_activity_code' => '451010',
            'sin_product_code'  => '49111',
            'product_code'      => 'PROD-01',
            'description'       => 'Venta Rápida',
            'quantity'          => '1.00',
            'sin_unit_code'     => 1,
            'unit_price'        => '80.00',
            'discount'          => '0.00',
            'subtotal'          => '80.00',
            'serial_number'     => null,
            'imei_number'       => null,
        ]);
        $invoice->setRelation('details', collect([$detail]));

        $xml = $this->builder->build($invoice);

        $this->assertStringContainsString('<codigoTipoDocumentoIdentidad>5</codigoTipoDocumentoIdentidad>', $xml);
        $this->assertStringContainsString('<numeroDocumento>0</numeroDocumento>', $xml);
        $this->assertStringContainsString('<codigoCliente>CF</codigoCliente>', $xml);

        $this->assertTrue($this->validator->validate($xml));
    }

    // =========================================================================
    // PRUEBAS NEGATIVAS (PRE-CONDICIONES Y VALIDACIONES XSD)
    // =========================================================================

    public function test_fails_when_cuf_is_missing(): void
    {
        $invoice = $this->createSampleInvoice(['cuf' => null]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('La factura no cuenta con CUF generado.');

        $this->builder->build($invoice);
    }

    public function test_fails_when_cufd_snapshot_is_missing(): void
    {
        $invoice = $this->createSampleInvoice(['cufd_snapshot' => null]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('La factura no cuenta con el snapshot del CUFD');

        $this->builder->build($invoice);
    }

    public function test_fails_when_control_code_is_missing(): void
    {
        $invoice = $this->createSampleInvoice(['control_code' => null]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('La factura no cuenta con el código de control del CUFD');

        $this->builder->build($invoice);
    }

    public function test_fails_when_invoice_number_is_missing(): void
    {
        $invoice = $this->createSampleInvoice(['invoice_number' => null]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('La factura no tiene asignado un número de factura correlativo');

        $this->builder->build($invoice);
    }

    public function test_fails_when_status_is_incompatible(): void
    {
        $invoice = $this->createSampleInvoice(['status' => ElectronicInvoiceStatus::CANCELLED]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("El estado actual de la factura ('cancelled') no permite la generación del XML");

        $this->builder->build($invoice);
    }

    public function test_fails_when_legend_is_missing(): void
    {
        $invoice = $this->createSampleInvoice(['legend' => '']);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('La leyenda fiscal oficial es obligatoria.');

        $this->builder->build($invoice);
    }

    public function test_fails_when_details_are_empty(): void
    {
        $invoice = $this->createSampleInvoice();
        $invoice->setRelation('details', collect());

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('no cuenta con líneas de detalle.');

        $this->builder->build($invoice);
    }

    /**
     * Valida que el SiatInvoiceXmlValidator rechace XMLs con esquemas inválidos o etiquetas fuera de orden.
     */
    public function test_validator_rejects_out_of_order_elements(): void
    {
        // XML con nitEmisor después de razonSocialEmisor
        $badXml = '<?xml version="1.0" encoding="UTF-8"?>
<facturaComputarizadaCompraVenta xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="facturaComputarizadaCompraVenta.xsd">
  <cabecera>
    <razonSocialEmisor>Carlos Loza</razonSocialEmisor>
    <nitEmisor>1003579028</nitEmisor>
  </cabecera>
</facturaComputarizadaCompraVenta>';

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('El XML no cumple con el esquema XSD oficial del SIN');

        $this->validator->validate($badXml);
    }

    // =========================================================================
    // HELPER PARA CREAR ELECTRONIC_INVOICE EN MEMORIA
    // =========================================================================

    private function createSampleInvoice(array $overrides = []): ElectronicInvoice
    {
        $defaults = [
            'id'                        => '11111111-1111-1111-1111-111111111111',
            'issuer_nit'                => '1003579028',
            'issuer_business_name'      => 'Empresa de Prueba S.R.L.',
            'issuer_municipality'       => 'La Paz',
            'issuer_phone'              => '2846005',
            'invoice_number'            => 1,
            'cuf'                       => '44AAEC00DBD34C819B4D7AFD5F91900D3A059E06A467A75AC82F24C74',
            'cufd_snapshot'             => 'BQUE+QytqQUDBKVUFOSVRPQkxVRFZNVFVJBMDAwMDAwM',
            'control_code'              => 'A19E23EF34124CD',
            'branch_code'               => 0,
            'issuer_address'            => 'AV. JORGE LOPEZ #123',
            'point_of_sale_code'        => 0,
            'issued_at'                 => '2021-10-07 09:01:24.178',
            'buyer_name'                => 'Juan Pérez',
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
            'issued_by'                 => 'pperez',
            'document_sector_code'      => 1,
            'siat_modality'             => 1,
            'status'                    => ElectronicInvoiceStatus::DRAFT,
        ];

        $invoice = new ElectronicInvoice(array_merge($defaults, $overrides));

        $detail = new ElectronicInvoiceDetail([
            'sin_activity_code' => '451010',
            'sin_product_code'  => '49111',
            'product_code'      => 'JN-131231',
            'description'       => 'JUGO DE NARANJA EN VASO',
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
}
