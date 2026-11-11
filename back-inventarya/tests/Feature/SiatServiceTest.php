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
use App\Services\Siat\FakeSiatSoapClient;
use App\Services\Siat\SiatService;
use App\Services\Siat\SiatServiceFactory;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * SiatServiceTest — Fase 3B.1
 *
 * Prueba la lógica de negocio y endurecimiento de SiatService:
 *  - Persistencia, concurrencia, tolerancia a fallos e historial de CUIS y CUFD.
 *  - Persistencia y consulta de catálogos en BD.
 *  - Readiness fiscal y separación entre validez legal y ventana de renovación.
 *  - Mensajes de error controlados y sanitización.
 */
class SiatServiceTest extends TestCase
{
    private FakeSiatSoapClient $fake;
    private SiatService        $service;
    private Store              $store;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.siat_test' => [
                'driver'   => 'sqlite',
                'database' => ':memory:',
                'prefix'   => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'siat_test',
        ]);
        DB::purge('siat_test');
        Cache::flush();

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->boolean('enable_electronic_invoicing')->default(false);
            $table->integer('sin_branch_code')->nullable();
            $table->integer('sin_point_of_sale_code')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('business_name');
            $table->string('email')->nullable();
            $table->boolean('electronic_invoicing_enabled')->default(false);
            $table->string('tax_nit', 30)->nullable();
            $table->string('tax_business_name', 200)->nullable();
            $table->smallInteger('siat_environment')->nullable();
            $table->smallInteger('siat_modality')->nullable();
            $table->string('siat_system_code')->nullable();
            $table->text('siat_api_token')->nullable();
            $table->string('siat_certificate_path')->nullable();
            $table->text('siat_certificate_password')->nullable();
            $table->timestamps();
        });

        Schema::create('siat_cuis', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->integer('branch_code');
            $table->integer('point_of_sale_code');
            $table->string('cuis', 255);
            $table->timestamp('valid_until');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('siat_cufds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->integer('branch_code');
            $table->integer('point_of_sale_code');
            $table->text('cufd');
            $table->string('control_code')->nullable();
            $table->timestamp('valid_from')->nullable();
            $table->timestamp('valid_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('siat_economic_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 50)->unique();
            $table->text('description');
            $table->string('activity_type', 100)->nullable();
            $table->timestamps();
        });

        Schema::create('siat_product_services', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('activity_code', 50);
            $table->bigInteger('sin_product_code');
            $table->text('description');
            $table->string('nandina', 50)->nullable();
            $table->timestamps();
        });

        Schema::create('siat_legends', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('activity_code', 50);
            $table->text('description');
            $table->timestamps();
        });

        Schema::create('siat_payment_methods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->integer('code')->unique();
            $table->string('description', 255);
            $table->timestamps();
        });

        $this->store = Store::create([
            'id'                          => (string) Str::uuid(),
            'name'                        => 'Tienda Principal',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 0,
            'sin_point_of_sale_code'      => 0,
        ]);

        $this->fake    = new FakeSiatSoapClient();
        $this->service = app(SiatServiceFactory::class)->makeWithClient($this->fake, 'tenant-test-001');
    }

    // =========================================================================
    // 1. VERIFICAR COMUNICACIÓN & SANITIZACIÓN
    // =========================================================================

    public function test_verificar_comunicacion_exitosa(): void
    {
        $result = $this->service->verificarComunicacion();

        $this->assertTrue($result['success']);
        $this->assertEquals(926, $result['code']);
        $this->assertEquals('Comunicación exitosa con SIAT.', $result['message']);
    }

    public function test_verificar_comunicacion_exitosa_con_mensajes_list(): void
    {
        $this->fake->willReturn('verificarComunicacion', [
            'RespuestaVerificarComunicacion' => [
                'transaccion'  => true,
                'mensajesList' => [
                    'codigo'      => 926,
                    'descripcion' => 'COMUNICACIÓN EXITOSA',
                ],
            ],
        ]);

        $result = $this->service->verificarComunicacion();

        $this->assertTrue($result['success']);
        $this->assertEquals(926, $result['code']);
        $this->assertEquals('Comunicación exitosa con SIAT.', $result['message']);
    }

    public function test_verificar_comunicacion_con_error_no_expone_traza_cruda(): void
    {
        $this->fake->willThrow('verificarComunicacion', new \RuntimeException('Raw SOAP Fault: Connection refused at /secret/path'));

        $result = $this->service->verificarComunicacion();

        $this->assertFalse($result['success']);
        $this->assertNull($result['code']);
        $this->assertEquals('No fue posible establecer comunicación con SIAT.', $result['message']);
    }

    // =========================================================================
    // 2. FECHA Y HORA
    // =========================================================================

    public function test_sincronizar_fecha_hora_retorna_campos(): void
    {
        $result = $this->service->sincronizarFechaHora();

        $this->assertArrayHasKey('siat_datetime', $result);
        $this->assertArrayHasKey('local_datetime', $result);
        $this->assertArrayHasKey('drift_seconds', $result);
        $this->assertArrayHasKey('warning', $result);
        $this->assertFalse($result['warning']);
    }

    // =========================================================================
    // 3. PERSISTENCIA, HISTORIAL Y CONCURRENCIA DE CUIS
    // =========================================================================

    public function test_cuis_se_persiste_en_base_de_datos(): void
    {
        $data = $this->service->getCuis($this->store);

        $this->assertNotEmpty($data['cuis']);
        $this->assertDatabaseHas('siat_cuis', [
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => $data['cuis'],
            'is_active'          => true,
        ]);
    }

    public function test_cuis_vigente_se_reutiliza_desde_db_sin_llamar_al_sin(): void
    {
        // 1. Obtener y persistir
        $first = $this->service->getCuis($this->store);

        // 2. Limpiar caché en memoria/redis
        Cache::flush();

        // 3. Segunda llamada: debe consultar la BD sin llamar SOAP
        $second = $this->service->getCuis($this->store);

        $this->assertEquals($first['cuis'], $second['cuis']);
        $this->assertEquals(1, SiatCuis::count());
    }

    public function test_cuis_fuera_de_ventana_de_5_dias_no_renueva(): void
    {
        // CUIS vigente con 20 días restantes
        SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-EXISTENTE-VALIDO',
            'valid_until'        => now()->addDays(20),
            'is_active'          => true,
        ]);

        $data = $this->service->getCuis($this->store);

        $this->assertEquals('CUIS-EXISTENTE-VALIDO', $data['cuis']);
        $this->assertEquals(1, SiatCuis::count());
        $this->assertFalse($this->fake->wasCalled('obtenerCuis'));
    }

    public function test_cuis_dentro_de_ventana_de_5_dias_intenta_renovacion_y_desactiva_anterior(): void
    {
        // CUIS vigente pero con solo 2 días restantes (dentro de ventana de 5 días)
        $old = SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-PROXIMO-A-VENCER',
            'valid_until'        => now()->addDays(2),
            'is_active'          => true,
        ]);

        $data = $this->service->getCuis($this->store);

        $this->assertNotEquals('CUIS-PROXIMO-A-VENCER', $data['cuis']);
        $this->assertEquals(2, SiatCuis::count()); // conserva historial

        $old->refresh();
        $this->assertFalse($old->is_active);

        $this->assertDatabaseHas('siat_cuis', [
            'store_id'  => $this->store->id,
            'cuis'      => $data['cuis'],
            'is_active' => true,
        ]);
    }

    public function test_fallo_en_renovacion_cuis_dentro_de_ventana_conserva_cuis_vigente_anterior(): void
    {
        $old = SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-VIGENTE-DE-RESPALDO',
            'valid_until'        => now()->addDays(2), // vigente aún
            'is_active'          => true,
        ]);

        // Falla SOAP
        $this->fake->willThrow('obtenerCuis', new \RuntimeException('SIN service timeout'));

        $data = $this->service->getCuis($this->store);

        // Se mantiene el CUIS anterior sin lanzar excepción fatal
        $this->assertEquals('CUIS-VIGENTE-DE-RESPALDO', $data['cuis']);
        $old->refresh();
        $this->assertTrue($old->is_active);
    }

    public function test_branch_0_y_pos_0_funcionan_correctamente_para_cuis(): void
    {
        $this->assertEquals(0, $this->store->sin_branch_code);
        $this->assertEquals(0, $this->store->sin_point_of_sale_code);

        $data = $this->service->getCuis($this->store);

        $this->assertNotNull($data['cuis']);
        $this->assertDatabaseHas('siat_cuis', [
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'is_active'          => true,
        ]);
    }

    // =========================================================================
    // 4. ATOMICIDAD, TOLERANCIA Y CONCURRENCIA DE CUFD
    // =========================================================================

    public function test_cufd_proximo_a_vencer_renueva_y_desactiva_anterior_atomicamente(): void
    {
        $oldCufd = SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-ANTERIOR-001',
            'control_code'       => 'CTRL-001',
            'valid_from'         => now()->subHours(23),
            'valid_until'        => now()->addMinutes(30), // menos de 60m
            'is_active'          => true,
        ]);

        $newCufd = $this->service->getCufd($this->store);

        $this->assertNotEquals($oldCufd->id, $newCufd->id);
        $this->assertEquals(2, SiatCufd::count()); // conserva historial

        $oldCufd->refresh();
        $this->assertFalse($oldCufd->is_active);
        $this->assertTrue($newCufd->is_active);
    }

    public function test_fallo_soap_en_renovacion_cufd_conserva_cufd_vigente_anterior(): void
    {
        $oldCufd = SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-ANTERIOR-AUN-VALIDO',
            'control_code'       => 'CTRL-001',
            'valid_from'         => now()->subHours(23),
            'valid_until'        => now()->addMinutes(30), // dentro del threshold de 60m pero vigente
            'is_active'          => true,
        ]);

        // Simular que el SIN falla en obtenerCufd
        $this->fake->willThrow('obtenerCufd', new \RuntimeException('Error 500 SIN'));

        $cufd = $this->service->getCufd($this->store);

        // Debe conservar y devolver el CUFD vigente anterior
        $this->assertEquals('CUFD-ANTERIOR-AUN-VALIDO', $cufd->cufd);
        $oldCufd->refresh();
        $this->assertTrue($oldCufd->is_active);
    }

    public function test_aislamiento_entre_stores_en_cufd(): void
    {
        $storeB = Store::create([
            'id'                          => (string) Str::uuid(),
            'name'                        => 'Sucursal 1',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 1,
            'sin_point_of_sale_code'      => 0,
        ]);

        $cufdA = $this->service->getCufd($this->store);
        $cufdB = $this->service->getCufd($storeB);

        $this->assertNotEquals($cufdA->id, $cufdB->id);
        $this->assertEquals($this->store->id, $cufdA->store_id);
        $this->assertEquals($storeB->id, $cufdB->store_id);
        $this->assertEquals(0, $cufdA->branch_code);
        $this->assertEquals(1, $cufdB->branch_code);
    }

    // =========================================================================
    // 5. CATÁLOGOS PERSISTIDOS EN BASE DE DATOS
    // =========================================================================

    public function test_catalogo_actividades_se_persiste_en_base_de_datos(): void
    {
        $items = $this->service->getCatalog('Actividades', $this->store);

        $this->assertNotEmpty($items);
        $this->assertDatabaseHas('siat_economic_activities', [
            'code' => '47111',
        ]);
    }

    public function test_catalogo_productos_servicios_se_persiste_en_base_de_datos(): void
    {
        $items = $this->service->getCatalog('ProductosServicios', $this->store);

        $this->assertNotEmpty($items);
        $this->assertDatabaseHas('siat_product_services', [
            'activity_code'    => '47111',
            'sin_product_code' => 99100,
        ]);
    }

    public function test_catalogo_leyendas_se_persiste_en_base_de_datos(): void
    {
        $items = $this->service->getCatalog('LeyendasFactura', $this->store);

        $this->assertNotEmpty($items);
        $this->assertDatabaseHas('siat_legends', [
            'activity_code' => '47111',
        ]);
    }

    public function test_catalogo_metodos_pago_se_persiste_en_base_de_datos(): void
    {
        $items = $this->service->getCatalog('TipoMetodoPago', $this->store);

        $this->assertNotEmpty($items);
        $this->assertDatabaseHas('siat_payment_methods', [
            'code'        => 1,
            'description' => 'EFECTIVO',
        ]);
        $this->assertDatabaseHas('siat_payment_methods', [
            'code'        => 2,
            'description' => 'TARJETA DE DEBITO',
        ]);
    }

    public function test_cache_vacio_recupera_catalogo_desde_base_de_datos_sin_llamar_al_sin(): void
    {
        // 1. Sincronizar y persistir
        $this->service->getCatalog('TipoMetodoPago', $this->store);
        $this->assertEquals(2, SiatPaymentMethod::count());

        // 2. Vaciar caché
        Cache::flush();

        // 3. Crear nuevo fake que fallaría si se llama
        $failingFake = new FakeSiatSoapClient();
        $failingFake->willThrow('sincronizarParametrica:TipoMetodoPago', new \RuntimeException('SIN offline'));
        $service = app(SiatServiceFactory::class)->makeWithClient($failingFake, 'tenant-test-001');

        // Debe resolver exitosamente desde la base de datos
        $items = $service->getCatalog('TipoMetodoPago', $this->store);
        $this->assertCount(2, $items);
        $this->assertEquals(1, $items[0]['codigoClasificador']);
    }

    public function test_sincronizacion_catalogo_hace_upsert_sin_duplicar(): void
    {
        $this->service->getCatalog('TipoMetodoPago', $this->store, forceRefresh: true);
        $this->assertEquals(2, SiatPaymentMethod::count());

        // Segunda sincronización
        $this->service->getCatalog('TipoMetodoPago', $this->store, forceRefresh: true);
        $this->assertEquals(2, SiatPaymentMethod::count()); // no duplica
    }

    // =========================================================================
    // 6. READINESS FISCAL
    // =========================================================================

    public function test_readiness_store_ready_con_cuis_y_cufd_activos(): void
    {
        $setting = Setting::create([
            'business_name'               => 'Empresa Test',
            'electronic_invoicing_enabled'=> true,
            'tax_nit'                     => '123456789',
            'tax_business_name'           => 'Empresa Test SRL',
            'siat_environment'            => 2,
            'siat_modality'               => 2, // Computarizada en línea
            'siat_system_code'            => 'SYS-TEST-001',
            'siat_api_token'              => 'token-valido',
        ]);

        SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-ACTIVO-001',
            'valid_until'        => now()->addMonths(6),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-ACTIVO-001',
            'control_code'       => 'CTRL-001',
            'valid_from'         => now()->subHours(2),
            'valid_until'        => now()->addHours(22),
            'is_active'          => true,
        ]);

        $result = $this->service->storeIsReady($this->store, $setting);

        $this->assertTrue($result['ready']);
        $this->assertEmpty($result['issues']);
    }

    public function test_readiness_cufd_proximo_a_vencer_pero_valido_es_ready(): void
    {
        $setting = Setting::create([
            'business_name'               => 'Empresa Test',
            'electronic_invoicing_enabled'=> true,
            'tax_nit'                     => '123456789',
            'tax_business_name'           => 'Empresa Test SRL',
            'siat_environment'            => 2,
            'siat_modality'               => 2,
            'siat_system_code'            => 'SYS-TEST-001',
            'siat_api_token'              => 'token-valido',
        ]);

        SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-ACTIVO-001',
            'valid_until'        => now()->addMonths(6),
            'is_active'          => true,
        ]);

        // CUFD con 20 minutos de vigencia (dentro de la ventana de renovación de 60m, pero VÁLIDO legalmente)
        $cufd = SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-EN-VENTANA-001',
            'control_code'       => 'CTRL-001',
            'valid_from'         => now()->subHours(23),
            'valid_until'        => now()->addMinutes(20),
            'is_active'          => true,
        ]);

        $this->assertTrue($cufd->isValid());
        $this->assertTrue($cufd->shouldRenew(60));

        $result = $this->service->storeIsReady($this->store, $setting);

        // Debe ser READY porque todavía es válido legalmente
        $this->assertTrue($result['ready']);
        $this->assertEmpty($result['issues']);
    }

    public function test_readiness_sin_cuis_retorna_not_ready(): void
    {
        $setting = Setting::create([
            'business_name'               => 'Empresa Test',
            'electronic_invoicing_enabled'=> true,
            'tax_nit'                     => '123456789',
            'tax_business_name'           => 'Empresa Test SRL',
            'siat_environment'            => 2,
            'siat_modality'               => 2,
            'siat_system_code'            => 'SYS-TEST-001',
            'siat_api_token'              => 'token-valido',
        ]);

        SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-ACTIVO-001',
            'valid_from'         => now(),
            'valid_until'        => now()->addHours(24),
            'is_active'          => true,
        ]);

        $result = $this->service->storeIsReady($this->store, $setting);

        $this->assertFalse($result['ready']);
        $this->assertStringContainsString('no tiene CUIS activo y vigente', implode(', ', $result['issues']));
    }

    public function test_readiness_modalidad_1_requiere_certificado(): void
    {
        $setting = Setting::create([
            'business_name'               => 'Empresa Test',
            'electronic_invoicing_enabled'=> true,
            'tax_nit'                     => '123456789',
            'tax_business_name'           => 'Empresa Test SRL',
            'siat_environment'            => 2,
            'siat_modality'               => 1, // Electrónica en línea
            'siat_system_code'            => 'SYS-TEST-001',
            'siat_api_token'              => 'token-valido',
            'siat_certificate_path'       => null, // sin certificado
        ]);

        $result = $this->service->storeIsReady($this->store, $setting);

        $this->assertFalse($result['ready']);
        $this->assertStringContainsString('requiere certificado digital', implode(', ', $result['issues']));
    }

    public function test_readiness_modalidad_2_no_requiere_certificado(): void
    {
        $setting = Setting::create([
            'business_name'               => 'Empresa Test',
            'electronic_invoicing_enabled'=> true,
            'tax_nit'                     => '123456789',
            'tax_business_name'           => 'Empresa Test SRL',
            'siat_environment'            => 2,
            'siat_modality'               => 2, // Computarizada en línea
            'siat_system_code'            => 'SYS-TEST-001',
            'siat_api_token'              => 'token-valido',
            'siat_certificate_path'       => null,
        ]);

        SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-001',
            'valid_until'        => now()->addMonths(6),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-001',
            'valid_from'         => now(),
            'valid_until'        => now()->addHours(24),
            'is_active'          => true,
        ]);

        $result = $this->service->storeIsReady($this->store, $setting);

        $this->assertTrue($result['ready']);
    }
}
