<?php

namespace Tests\Unit;

use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\Sale;
use App\Models\SiatCufd;
use App\Models\Store;
use App\Services\Siat\SiatCufGenerator;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class SiatCufGeneratorTest extends TestCase
{
    private SiatCufGenerator $generator;
    private Store $store;
    private SiatCufd $cufd;

    protected function setUp(): void
    {
        parent::setUp();
        $this->generator = new SiatCufGenerator();

        config([
            'database.connections.cuf_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'cuf_test',
        ]);
        DB::purge('cuf_test');

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->timestamps();
        });

        (require database_path('migrations/tenant/2026_10_12_000001_create_siat_cufds_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000002_create_electronic_invoices_table.php'))->up();

        $this->store = Store::create([
            'id'   => (string) Str::uuid(),
            'name' => 'Tienda Matriz Test',
        ]);

        $this->cufd = SiatCufd::create([
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-TEST-KEY-ABC123456789',
            'control_code'       => 'CTRL-CODE-999',
            'valid_from'         => now()->subHour(),
            'valid_until'        => now()->addHours(23),
            'is_active'          => true,
        ]);
    }

    public function test_vector_oficial_impuestos_nacionales(): void
    {
        // Vector oficial SIN Bolivia:
        // https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/algoritmos-utilizados/generacion-cuf
        $nit              = '123456789';
        $fecha            = '20190113163721231';
        $sucursal         = 0;
        $modalidad        = 1;
        $tipoEmision      = 1;
        $tipoFactura      = 1;
        $documentoSector  = 1;
        $numeroFactura    = 1;
        $puntoVenta       = 0;
        $codigoControl    = 'A19E23EF34124CD';

        $cufEsperado = '8727F63A15F8976591FDDE5B387C5D015A29E06A1A19E23EF34124CD';

        $cufGenerado = $this->generator->generateFromFields(
            nit: $nit,
            issuedAtFormatted: $fecha,
            branchCode: $sucursal,
            modality: $modalidad,
            emissionType: $tipoEmision,
            invoiceType: $tipoFactura,
            documentSector: $documentoSector,
            invoiceNumber: $numeroFactura,
            pointOfSaleCode: $puntoVenta,
            controlCode: $codigoControl
        );

        $this->assertSame($cufEsperado, $cufGenerado);
    }

    public function test_modulo11_con_vector_oficial(): void
    {
        $cadena53 = '00001234567892019011316372123100001110100000000010000';
        $this->assertSame(53, strlen($cadena53));

        $digitoVerificador = SiatCufGenerator::modulo11($cadena53);
        $this->assertSame(1, $digitoVerificador);
    }

    public function test_base16_con_vector_oficial(): void
    {
        $cadena54 = '000012345678920190113163721231000011101000000000100001';
        $this->assertSame(54, strlen($cadena54));

        $hex = SiatCufGenerator::bcdechex($cadena54);
        $this->assertSame('8727F63A15F8976591FDDE5B387C5D015A29E06A1', $hex);
    }

    public function test_nit_con_ceros_a_la_izquierda_mantiene_relleno_correcto(): void
    {
        $cuf = $this->generator->generateFromFields(
            nit: '001234567',
            issuedAtFormatted: '20261013093000123',
            branchCode: 0,
            modality: 1,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 1,
            pointOfSaleCode: 0,
            controlCode: 'AABBCC112233'
        );

        $this->assertStringEndsWith('AABBCC112233', $cuf);
    }

    public function test_soporte_sucursal_cero_y_pos_cero(): void
    {
        $cuf = $this->generator->generateFromFields(
            nit: '456789012',
            issuedAtFormatted: '20261013093000123',
            branchCode: 0,
            modality: 2,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 15,
            pointOfSaleCode: 0,
            controlCode: 'CTRL9988AABBCC'
        );

        $this->assertStringEndsWith('CTRL9988AABBCC', $cuf);
        $this->assertGreaterThan(strlen('CTRL9988AABBCC'), strlen($cuf));
    }

    public function test_soporte_modalidad_1_y_modalidad_2(): void
    {
        $cufMod1 = $this->generator->generateFromFields(
            nit: '1020304050',
            issuedAtFormatted: '20261013120000456',
            branchCode: 1,
            modality: 1,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 5,
            pointOfSaleCode: 1,
            controlCode: 'CTRL1'
        );

        $cufMod2 = $this->generator->generateFromFields(
            nit: '1020304050',
            issuedAtFormatted: '20261013120000456',
            branchCode: 1,
            modality: 2,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 5,
            pointOfSaleCode: 1,
            controlCode: 'CTRL1'
        );

        $this->assertNotEquals($cufMod1, $cufMod2);
    }

    public function test_rechaza_nit_invalido_o_excedido(): void
    {
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('NIT emisor');

        $this->generator->generateFromFields(
            nit: '123456789012345', // 15 dígitos excede 13
            issuedAtFormatted: '20261013120000456',
            branchCode: 0,
            modality: 1,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 1,
            pointOfSaleCode: 0,
            controlCode: 'CTRL'
        );
    }

    public function test_rechaza_fecha_invalida_no_17_digitos(): void
    {
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('exactamente 17 dígitos');

        $this->generator->generateFromFields(
            nit: '123456789',
            issuedAtFormatted: '20261013120000', // 14 dígitos (faltan milisegundos)
            branchCode: 0,
            modality: 1,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 1,
            pointOfSaleCode: 0,
            controlCode: 'CTRL'
        );
    }

    public function test_rechaza_codigo_control_vacio(): void
    {
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('código de control');

        $this->generator->generateFromFields(
            nit: '123456789',
            issuedAtFormatted: '20261013120000123',
            branchCode: 0,
            modality: 1,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 1,
            pointOfSaleCode: 0,
            controlCode: '   '
        );
    }

    public function test_rechaza_numero_factura_menor_o_igual_a_cero(): void
    {
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('número de factura');

        $this->generator->generateFromFields(
            nit: '123456789',
            issuedAtFormatted: '20261013120000123',
            branchCode: 0,
            modality: 1,
            emissionType: 1,
            invoiceType: 1,
            documentSector: 1,
            invoiceNumber: 0,
            pointOfSaleCode: 0,
            controlCode: 'CTRL'
        );
    }

    private function createDraftInvoice(int $number = 1, ?Carbon $issuedAt = null): ElectronicInvoice
    {
        $sale = Sale::create(['id' => (string) Str::uuid()]);

        return ElectronicInvoice::create([
            'id'                   => (string) Str::uuid(),
            'sale_id'              => $sale->id,
            'store_id'             => $this->store->id,
            'siat_cufd_id'         => $this->cufd->id,
            'issuer_nit'           => '1020304050',
            'issuer_business_name' => 'EMPRESA TEST',
            'branch_code'          => 0,
            'point_of_sale_code'   => 0,
            'siat_environment'     => 2,
            'siat_modality'        => 2,
            'buyer_document_type'  => 1,
            'buyer_document_number'=> '1234567',
            'buyer_name'           => 'Cliente Test',
            'invoice_number'       => $number,
            'control_code'         => $this->cufd->control_code,
            'issued_at'            => $issuedAt ?? now(),
            'subtotal'             => '100.00',
            'total'                => '100.00',
            'status'               => 'draft',
        ]);
    }

    public function test_persistencia_del_cuf_en_factura(): void
    {
        $invoice = $this->createDraftInvoice(1);
        $this->assertNull($invoice->cuf);

        $persisted = $this->generator->generateAndPersist($invoice);

        $this->assertNotNull($persisted->cuf);
        $this->assertStringEndsWith($this->cufd->control_code, $persisted->cuf);

        $fresh = ElectronicInvoice::find($invoice->id);
        $this->assertSame($persisted->cuf, $fresh->cuf);
    }

    public function test_idempotencia_no_altera_cuf_en_segunda_llamada(): void
    {
        $invoice = $this->createDraftInvoice(2);

        $firstCall = $this->generator->generateAndPersist($invoice);
        $cuf1 = $firstCall->cuf;

        $secondCall = $this->generator->generateAndPersist($invoice);
        $cuf2 = $secondCall->cuf;

        $this->assertSame($cuf1, $cuf2);
    }

    public function test_rechaza_si_cufd_no_coincide_con_tienda_o_punto(): void
    {
        $otherStore = Store::create([
            'id'   => (string) Str::uuid(),
            'name' => 'Otra Tienda',
        ]);

        $invalidCufd = SiatCufd::create([
            'store_id'           => $otherStore->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-OTHER-STORE',
            'control_code'       => 'CTRL-OTHER',
            'valid_from'         => now()->subHour(),
            'valid_until'        => now()->addHours(24),
            'is_active'          => true,
        ]);

        $sale = Sale::create(['id' => (string) Str::uuid()]);
        $invoice = ElectronicInvoice::create([
            'id'                   => (string) Str::uuid(),
            'sale_id'              => $sale->id,
            'store_id'             => $this->store->id,
            'siat_cufd_id'         => $invalidCufd->id,
            'issuer_nit'           => '1020304050',
            'issuer_business_name' => 'EMPRESA TEST',
            'branch_code'          => 0,
            'point_of_sale_code'   => 0,
            'siat_environment'     => 2,
            'siat_modality'        => 2,
            'buyer_document_type'  => 1,
            'buyer_document_number'=> '1234567',
            'buyer_name'           => 'Cliente Test',
            'invoice_number'       => 1,
            'control_code'         => $invalidCufd->control_code,
            'issued_at'            => now(),
            'subtotal'             => '100.00',
            'total'                => '100.00',
            'status'               => 'draft',
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('no pertenece a la misma tienda');

        $this->generator->generateAndPersist($invoice);
    }

    public function test_rechaza_si_cufd_expirado_respecto_a_fecha_de_emision(): void
    {
        $issuedPast = now()->subDays(2); // Fecha de emisión hace 2 días, fuera de validez del CUFD
        $invoice = $this->createDraftInvoice(3, $issuedPast);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('fuera del período de vigencia del CUFD histórico');

        $this->generator->generateAndPersist($invoice);
    }

    public function test_unicidad_del_cuf_en_base_de_datos(): void
    {
        $invoice1 = $this->createDraftInvoice(10);
        $persisted1 = $this->generator->generateAndPersist($invoice1);

        $invoice2 = $this->createDraftInvoice(11);

        // Forzar asignación manual del mismo CUF a la segunda factura para verificar restricción unique
        $this->expectException(QueryException::class);
        $invoice2->cuf = $persisted1->cuf;
        $invoice2->save();
    }
}
