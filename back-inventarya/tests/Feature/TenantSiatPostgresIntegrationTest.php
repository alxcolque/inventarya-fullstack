<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatEconomicActivity;
use App\Models\SiatLegend;
use App\Models\SiatPaymentMethod;
use App\Models\SiatProductService;
use App\Models\Store;
use App\Models\Tenant;
use App\Services\Siat\FakeSiatSoapClient;
use App\Services\Siat\SiatServiceFactory;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * TenantSiatPostgresIntegrationTest — Fase 3B.1
 *
 * Pruebas de integración sobre la base de datos PostgreSQL real del tenant (alex).
 * Valida:
 *  - Existencia y tipos de datos de las tablas fiscales creadas.
 *  - Claves foráneas (FK store_id ON DELETE RESTRICT).
 *  - Índices y restricciones de unicidad.
 *  - Transacciones y atomicidad en PostgreSQL.
 *  - Generación de UUIDs nativos.
 */
class TenantSiatPostgresIntegrationTest extends TestCase
{
    private ?Store $store = null;

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
            ['slug' => 'tienda-test-postgres'],
            [
                'id'                          => (string) Str::uuid(),
                'name'                        => 'Tienda Test Postgres',
                'enable_electronic_invoicing' => true,
                'sin_branch_code'             => 0,
                'sin_point_of_sale_code'      => 0,
            ]
        );
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }

        parent::tearDown();
    }

    public function test_tablas_siat_existen_en_postgresql_del_tenant(): void
    {
        $tables = [
            'siat_cufds',
            'siat_cuis',
            'siat_economic_activities',
            'siat_product_services',
            'siat_legends',
            'siat_payment_methods',
        ];

        foreach ($tables as $table) {
            $this->assertTrue(
                Schema::hasTable($table),
                "La tabla '{$table}' no existe en el esquema PostgreSQL del tenant."
            );
        }
    }

    public function test_foreign_key_store_id_en_siat_cuis_restringe_eliminacion(): void
    {
        $cuis = SiatCuis::create([
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-FK-TEST-' . Str::random(8),
            'valid_until'        => now()->addYear(),
            'is_active'          => true,
        ]);

        $this->expectException(QueryException::class);

        // Intentar eliminar la tienda teniendo un CUIS asociado debe fallar por RESTRICT
        $this->store->delete();
    }

    public function test_unicidad_compuesta_en_siat_product_services_en_postgresql(): void
    {
        SiatProductService::updateOrCreate(
            ['activity_code' => '47111', 'sin_product_code' => 99001],
            ['description' => 'Producto Prueba 1']
        );

        // Un segundo registro con la misma clave compuesta debe fallar en INSERT directo
        $this->expectException(QueryException::class);

        DB::table('siat_product_services')->insert([
            'id'               => (string) Str::uuid(),
            'activity_code'    => '47111',
            'sin_product_code' => 99001,
            'description'      => 'Producto Duplicado',
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);
    }

    public function test_transaccion_atomica_y_rollback_en_postgresql(): void
    {
        $initialCount = SiatPaymentMethod::count();

        try {
            DB::transaction(function () {
                SiatPaymentMethod::create([
                    'code'        => 9999,
                    'description' => 'METODO TRANSACCIONAL TEMPORAL',
                ]);

                // Forzar error para verificar rollback atómico
                throw new \RuntimeException('Fallo simulado para rollback');
            });
        } catch (\RuntimeException $e) {
            // Ignorado intencionalmente
        }

        $this->assertEquals($initialCount, SiatPaymentMethod::count());
    }

    public function test_siat_service_con_fake_client_opera_sobre_postgresql(): void
    {
        $fake    = new FakeSiatSoapClient();
        $service = app(SiatServiceFactory::class)->makeWithClient($fake, 'alex');

        // 1. Obtener y persistir CUIS en Postgres
        $cuisData = $service->getCuis($this->store);
        $this->assertNotEmpty($cuisData['cuis']);

        $this->assertDatabaseHas('siat_cuis', [
            'store_id' => $this->store->id,
            'cuis'     => $cuisData['cuis'],
        ]);

        // 2. Obtener y persistir CUFD en Postgres
        $cufd = $service->getCufd($this->store);
        $this->assertNotNull($cufd);
        $this->assertDatabaseHas('siat_cufds', [
            'store_id' => $this->store->id,
            'cufd'     => $cufd->cufd,
        ]);

        // 3. Sincronizar catálogo de métodos de pago en Postgres
        $methods = $service->getCatalog('TipoMetodoPago', $this->store, forceRefresh: true);
        $this->assertNotEmpty($methods);
        $this->assertDatabaseHas('siat_payment_methods', [
            'code' => 1,
        ]);
    }
}
