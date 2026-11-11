<?php

namespace Tests\Feature;

use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatInvoiceSequence;
use App\Models\Store;
use App\Models\Tenant;
use App\Services\Siat\SiatInvoiceNumberService;
use App\Services\Siat\SiatInvoicePreparationService;
use App\Services\Siat\SiatPaymentMethodMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * SiatInvoiceNumberPostgresTest — Fase 4A
 *
 * Pruebas de integración fiscal sobre PostgreSQL real del tenant (alex):
 *  - Existencia de las tablas fiscales y de secuencia en PostgreSQL.
 *  - Asignación atómica de números correlativos con SELECT ... FOR UPDATE.
 *  - Numeración independiente por sucursal y punto de venta.
 *  - Continuidad de numeración tras renovación de CUFD (no se reinicia por cambio de CUFD).
 *  - Rollback atómico en transacción ante fallos.
 */
class SiatInvoiceNumberPostgresTest extends TestCase
{
    private ?Store $store = null;
    private SiatInvoiceNumberService $numberService;

    protected function setUp(): void
    {
        parent::setUp();

        if (!Tenant::where('id', 'alex')->exists()) {
            $this->markTestSkipped('Tenant alex no existe en base de datos central.');
        }

        config([
            'tenancy.bootstrappers' => [
                \Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper::class,
            ],
        ]);

        tenancy()->initialize('alex');

        $this->store = Store::firstOrCreate(
            ['slug' => 'tienda-correlativo-postgres'],
            [
                'id'                          => (string) Str::uuid(),
                'name'                        => 'Tienda Correlativo Postgres',
                'enable_electronic_invoicing' => true,
                'sin_branch_code'             => 0,
                'sin_point_of_sale_code'      => 0,
            ]
        );

        $this->numberService = new SiatInvoiceNumberService();
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }

        parent::tearDown();
    }

    public function test_tablas_fiscales_y_secuencias_existen_en_postgresql(): void
    {
        $this->assertTrue(Schema::hasTable('electronic_invoices'));
        $this->assertTrue(Schema::hasTable('electronic_invoice_details'));
        $this->assertTrue(Schema::hasTable('siat_invoice_sequences'));

        $columns = Schema::getColumnListing('electronic_invoices');
        $this->assertContains('invoice_number', $columns);
        $this->assertContains('issuer_municipality', $columns);
        $this->assertContains('issuer_address', $columns);
        $this->assertContains('cufd_snapshot', $columns);
        $this->assertContains('control_code', $columns);
        $this->assertContains('total_subject_to_vat', $columns);
        $this->assertContains('currency_code', $columns);
        $this->assertContains('exchange_rate', $columns);
        $this->assertContains('total_in_currency', $columns);
        $this->assertContains('payment_method_code', $columns);
        $this->assertContains('legend', $columns);
    }

    public function test_correlativo_atomico_incremental_en_postgresql(): void
    {
        $branchCode = 99; // Sucursal de prueba única
        $posCode    = 88; // Punto de venta de prueba único

        // Limpiar secuencias previas de este punto de prueba si existen
        SiatInvoiceSequence::where('store_id', $this->store->id)
            ->where('branch_code', $branchCode)
            ->where('point_of_sale_code', $posCode)
            ->delete();

        $num1 = $this->numberService->getNextInvoiceNumber($this->store, $branchCode, $posCode);
        $num2 = $this->numberService->getNextInvoiceNumber($this->store, $branchCode, $posCode);
        $num3 = $this->numberService->getNextInvoiceNumber($this->store, $branchCode, $posCode);

        $this->assertEquals(1, $num1);
        $this->assertEquals(2, $num2);
        $this->assertEquals(3, $num3);

        $current = $this->numberService->getCurrentInvoiceNumber($this->store, $branchCode, $posCode);
        $this->assertEquals(3, $current);
    }

    public function test_numeracion_independiente_por_sucursal_y_punto_de_venta_en_postgresql(): void
    {
        $branchA = 10;
        $posA1   = 1;
        $posA2   = 2;
        $branchB = 20;
        $posB1   = 1;

        // Limpieza previa
        SiatInvoiceSequence::where('store_id', $this->store->id)
            ->whereIn('branch_code', [$branchA, $branchB])
            ->delete();

        // Incrementos alternados en diferentes puntos
        $n1 = $this->numberService->getNextInvoiceNumber($this->store, $branchA, $posA1); // Pos A1 -> 1
        $n2 = $this->numberService->getNextInvoiceNumber($this->store, $branchA, $posA2); // Pos A2 -> 1
        $n3 = $this->numberService->getNextInvoiceNumber($this->store, $branchB, $posB1); // Pos B1 -> 1
        $n4 = $this->numberService->getNextInvoiceNumber($this->store, $branchA, $posA1); // Pos A1 -> 2

        $this->assertEquals(1, $n1);
        $this->assertEquals(1, $n2);
        $this->assertEquals(1, $n3);
        $this->assertEquals(2, $n4);
    }

    public function test_continuidad_de_numeracion_tras_renovacion_cufd_en_postgresql(): void
    {
        $branchCode = 33;
        $posCode    = 44;

        SiatInvoiceSequence::where('store_id', $this->store->id)
            ->where('branch_code', $branchCode)
            ->where('point_of_sale_code', $posCode)
            ->delete();

        // 1. Emitir factura 1 con CUFD 1
        $cufd1 = SiatCufd::create([
            'store_id'           => $this->store->id,
            'branch_code'        => $branchCode,
            'point_of_sale_code' => $posCode,
            'cufd'               => 'CUFD-DAY-1-' . Str::random(8),
            'control_code'       => 'CTRL-1',
            'valid_from'         => now()->subHours(24),
            'valid_until'        => now()->subMinute(), // Expirado
            'is_active'          => false,
        ]);

        $num1 = $this->numberService->getNextInvoiceNumber($this->store, $branchCode, $posCode);
        $this->assertEquals(1, $num1);

        // 2. Simular renovación: nuevo CUFD activo
        $cufd2 = SiatCufd::create([
            'store_id'           => $this->store->id,
            'branch_code'        => $branchCode,
            'point_of_sale_code' => $posCode,
            'cufd'               => 'CUFD-DAY-2-' . Str::random(8),
            'control_code'       => 'CTRL-2',
            'valid_from'         => now(),
            'valid_until'        => now()->addHours(24),
            'is_active'          => true,
        ]);

        // 3. La numeración fiscal debe continuar progresivamente (2, 3...) sin reiniciarse
        $num2 = $this->numberService->getNextInvoiceNumber($this->store, $branchCode, $posCode);
        $num3 = $this->numberService->getNextInvoiceNumber($this->store, $branchCode, $posCode);

        $this->assertEquals(2, $num2);
        $this->assertEquals(3, $num3);
    }

    public function test_rollback_en_transaccion_no_persiste_factura_en_postgresql(): void
    {
        $uniqueSaleId = (string) Str::uuid();

        try {
            DB::transaction(function () use ($uniqueSaleId) {
                // Simulación de creación y posterior fallo
                ElectronicInvoice::create([
                    'id'                        => (string) Str::uuid(),
                    'sale_id'                   => $uniqueSaleId,
                    'store_id'                  => $this->store->id,
                    'issuer_nit'                => '1020304050',
                    'issuer_business_name'      => 'TEST ROLLBACK',
                    'branch_code'               => 0,
                    'point_of_sale_code'        => 0,
                    'siat_environment'          => 2,
                    'siat_modality'             => 2,
                    'buyer_document_type'       => 1,
                    'buyer_document_number'     => '123456',
                    'buyer_name'                => 'Test Rollback',
                    'invoice_number'            => 9999,
                    'subtotal'                  => '100.00',
                    'total'                     => '100.00',
                    'status'                    => 'draft',
                ]);

                throw new \RuntimeException('Fallo simulado para forzar rollback en PostgreSQL');
            });
        } catch (\RuntimeException $e) {
            // Esperado
        }

        // En PostgreSQL, la fila debe haber sido descartada completamente por el rollback
        $exists = ElectronicInvoice::where('sale_id', $uniqueSaleId)->exists();
        $this->assertFalse($exists, 'La factura no debe existir tras el rollback en PostgreSQL.');
    }
}
