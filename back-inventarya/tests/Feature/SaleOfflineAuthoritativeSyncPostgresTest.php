<?php

namespace Tests\Feature;

use App\Http\Controllers\SaleController;
use App\Models\CashRegisterMovement;
use App\Models\CashRegisterSession;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SalePayment;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Prueba Empírica de Concurrencia e Idempotencia en PostgreSQL Real (Fase 6B.4B)
 */
class SaleOfflineAuthoritativeSyncPostgresTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'tenancy.bootstrappers' => [
                \Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper::class,
            ],
        ]);

        tenancy()->initialize('alex');
        DB::setDefaultConnection('tenant');

        \Illuminate\Support\Facades\Event::fake([
            \App\Events\Tenant\SaleCompletedEvent::class,
        ]);

        config([
            'database.connections.tenant_concurrent' => [
                'driver'         => 'pgsql',
                'host'           => config('database.connections.tenant.host', '127.0.0.1'),
                'port'           => config('database.connections.tenant.port', '5432'),
                'database'       => config('database.connections.tenant.database', 'tenant_alex_db'),
                'username'       => config('database.connections.tenant.username', 'postgres'),
                'password'       => config('database.connections.tenant.password', 'postgres'),
                'charset'        => 'utf8',
                'prefix'         => '',
                'prefix_indexes' => true,
                'search_path'    => 'public',
                'sslmode'        => 'prefer',
            ],
        ]);
        DB::purge('tenant_concurrent');
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }

        parent::tearDown();
    }

    public function test_postgresql_concurrency_same_uuid_same_payload_and_different_payload(): void
    {
        $driver = DB::connection()->getDriverName();
        $this->assertEquals('pgsql', $driver, 'El driver debe ser PostgreSQL real.');

        $store = Store::firstOrCreate(
            ['slug' => 'tienda-sync-pg-conc-test'],
            [
                'id'   => (string) Str::uuid(),
                'name' => 'Tienda Sync PostgreSQL Concurrente',
            ]
        );

        $user = User::first() ?? User::create([
            'name'     => 'Tester PostgreSQL Sync',
            'email'    => 'pg_sync_tester@test.com',
            'password' => bcrypt('password'),
            'role'     => 'owner',
        ]);

        Gate::define('sales:create', fn () => true);
        Gate::define('sales:edit-price', fn () => false);
        Gate::define('pos:access', fn () => true);
        Gate::define('stores:view-all', fn () => true);

        DB::setDefaultConnection('tenant');

        $productA = Product::firstOrCreate(
            ['sku' => 'SKU-PG-SYNC-01'],
            [
                'id'    => (string) Str::uuid(),
                'name'  => 'Producto PostgreSQL Sync A',
                'price' => 50.00,
            ]
        );

        $invStore = InventoryStore::firstOrCreate(
            ['store_id' => $store->id, 'product_id' => $productA->id],
            [
                'id'             => (string) Str::uuid(),
                'stock_quantity' => 10.00,
                'unit'           => 'PZA',
                'price'          => 50.00,
                'sale_price'     => 50.00,
            ]
        );
        $invStore->update(['stock_quantity' => 10.00]);

        $cashSession = CashRegisterSession::where('store_id', $store->id)->where('status', 'open')->first();
        if (!$cashSession) {
            $cashSession = CashRegisterSession::create([
                'id'             => (string) Str::uuid(),
                'store_id'       => $store->id,
                'user_id'        => $user->id,
                'opening_amount' => 100.00,
                'status'         => 'open',
                'opened_at'      => now(),
            ]);
        }

        // 1. Verificación de Bloqueo Pesimista en PostgreSQL Real entre dos conexiones PDO
        $pdoA = DB::connection()->getPdo();
        $pdoB = DB::connection('tenant_concurrent')->getPdo();

        $pdoA->beginTransaction();
        $stmtA = $pdoA->prepare("SELECT id, stock_quantity FROM inventory_stores WHERE id = :id FOR UPDATE");
        $stmtA->execute(['id' => $invStore->id]);

        $lockPass = false;
        try {
            $stmtB = $pdoB->prepare("SELECT id, stock_quantity FROM inventory_stores WHERE id = :id FOR UPDATE NOWAIT");
            $stmtB->execute(['id' => $invStore->id]);
        } catch (\PDOException $e) {
            if (str_contains($e->getMessage(), '55P03') || str_contains($e->getMessage(), 'could not obtain lock')) {
                $lockPass = true;
            }
        }
        $pdoA->rollBack();
        $this->assertTrue($lockPass, 'El bloqueo pesimista lockForUpdate en PostgreSQL sobre inventory_stores debe ser activo.');

        // 2. ESCENARIO 1: Same UUID + Same Payload (Retries Concurrentes)
        $uuid1 = (string) Str::uuid();
        $stockBefore = (float) $invStore->fresh()->stock_quantity;

        $payloadSameA = [
            'id'                       => $uuid1,
            'store_id'                 => $store->id,
            'cash_register_session_id' => $cashSession->id,
            'status'                   => 'completed',
            'products'                 => [
                ['product_id' => $productA->id, 'quantity' => 2],
            ],
            'payment_method'           => 'efectivo',
            'amount_received'          => 100.00,
            'total'                    => 100.00,
            'discount'                 => 0.00,
        ];

        // Request 1: primera creación
        $res1 = $this->executeSaleStore($user, $payloadSameA);
        $this->assertEquals(201, $res1->getStatusCode());
        $data1 = $res1->getData(true);
        $this->assertFalse($data1['is_duplicate']);
        $this->assertNotEmpty($data1['affected_products']);

        // Request 2 concurrente / retry idéntico
        $res2 = $this->executeSaleStore($user, $payloadSameA);
        $this->assertEquals(200, $res2->getStatusCode());
        $data2 = $res2->getData(true);
        $this->assertTrue($data2['is_duplicate']);
        $this->assertEquals('SALE_ALREADY_SYNCED', $data2['code']);
        $this->assertNotEmpty($data2['affected_products']);

        $stockAfter = (float) $invStore->fresh()->stock_quantity;
        $this->assertEquals($stockBefore - 2.0, $stockAfter, 'El stock debe decrementarse exactamente UNA vez.');

        $salesCount = Sale::where('id', $uuid1)->count();
        $paymentsCount = SalePayment::where('sale_id', $uuid1)->count();

        $this->assertEquals(1, $salesCount, 'Exactamente 1 venta económica creada.');
        $this->assertEquals(1, $paymentsCount, 'Exactamente 1 pago registrado (sin pagos duplicados).');

        // 3. ESCENARIO 2: Same UUID + Different Payload (Conflicto de Idempotencia Concurrente)
        $uuid2 = (string) Str::uuid();
        $stockBefore2 = (float) $invStore->fresh()->stock_quantity;

        $payloadInitial = [
            'id'                       => $uuid2,
            'store_id'                 => $store->id,
            'cash_register_session_id' => $cashSession->id,
            'status'                   => 'completed',
            'products'                 => [
                ['product_id' => $productA->id, 'quantity' => 1],
            ],
            'payment_method'           => 'efectivo',
            'amount_received'          => 50.00,
            'total'                    => 50.00,
            'discount'                 => 0.00,
        ];

        $resInit = $this->executeSaleStore($user, $payloadInitial);
        $this->assertEquals(201, $resInit->getStatusCode());

        // Segundo request con MISMO UUID pero PAYLOAD DIFERENTE (qty 3 y total 150)
        $payloadDiff = [
            'id'                       => $uuid2,
            'store_id'                 => $store->id,
            'cash_register_session_id' => $cashSession->id,
            'status'                   => 'completed',
            'products'                 => [
                ['product_id' => $productA->id, 'quantity' => 3],
            ],
            'payment_method'           => 'efectivo',
            'amount_received'          => 150.00,
            'total'                    => 150.00,
            'discount'                 => 0.00,
        ];

        $resDiff = $this->executeSaleStore($user, $payloadDiff);
        $this->assertEquals(409, $resDiff->getStatusCode());
        $dataDiff = $resDiff->getData(true);
        $this->assertEquals('SALE_IDEMPOTENCY_CONFLICT', $dataDiff['code']);

        $stockAfter2 = (float) $invStore->fresh()->stock_quantity;
        $this->assertEquals($stockBefore2 - 1.0, $stockAfter2, 'El stock solo debe ser afectado por la venta inicial exitosa.');
        $this->assertEquals(1, Sale::where('id', $uuid2)->count());
    }

    private function executeSaleStore(User $user, array $payload): \Illuminate\Http\JsonResponse
    {
        DB::setDefaultConnection('tenant');
        $request = new \App\Http\Requests\SaleRequest($payload);
        $request->setUserResolver(fn () => $user);
        $request->setContainer(app());
        $request->validateResolved();

        return app(SaleController::class)->store($request);
    }
}
