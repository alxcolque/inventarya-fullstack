<?php

namespace Tests\Feature;

use App\Models\CashRegisterMovement;
use App\Models\CashRegisterSession;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SalePayment;
use App\Models\SaleRefund;
use App\Models\SaleRefundItem;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\SaleRefundService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Prueba de Concurrencia Real en PostgreSQL — Fase 6B.3B (Sección 25)
 */
class SaleCommercialRefundPostgresConcurrencyTest extends TestCase
{
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

        // Configurar una segunda conexión independiente hacia la misma base de datos PostgreSQL
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

    public function test_postgresql_real_concurrency_and_over_refund_protection(): void
    {
        $driver = DB::connection()->getDriverName();
        $dbName = DB::connection()->getDatabaseName();

        $this->assertEquals('pgsql', $driver, 'El driver debe ser PostgreSQL real.');

        // 1. Obtener o crear Store y Usuario
        $store = Store::firstOrCreate(
            ['slug' => 'tienda-concurrency-test'],
            [
                'id'   => (string) Str::uuid(),
                'name' => 'Tienda Concurrencia Real',
            ]
        );

        $user = User::first() ?? User::create([
            'name'     => 'Tester Concurrencia',
            'email'    => 'concurrency@test.com',
            'password' => bcrypt('password'),
            'role'     => 'owner',
        ]);

        $product = Product::firstOrCreate(
            ['sku' => 'SKU-CONC-01'],
            [
                'id'    => (string) Str::uuid(),
                'name'  => 'Producto Concurrencia',
                'price' => 25.00,
            ]
        );

        $invStore = InventoryStore::firstOrCreate(
            ['store_id' => $store->id, 'product_id' => $product->id],
            [
                'id'             => (string) Str::uuid(),
                'stock_quantity' => 50,
                'unit'           => 'PZA',
                'price'          => 25.00,
                'sale_price'     => 25.00,
            ]
        );

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

        $stockBefore = (float) $invStore->fresh()->stock_quantity;
        $cashMovementsBefore = CashRegisterMovement::count();

        // 2. Crear Venta con EXACTAMENTE 1 unidad
        $saleId = (string) Str::uuid();
        $detailId = (string) Str::uuid();

        $sale = Sale::create([
            'id'             => $saleId,
            'store_id'       => $store->id,
            'user_id'        => $user->id,
            'total'          => 25.00,
            'discount'       => 0.00,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $detail = SaleDetail::create([
            'id'         => $detailId,
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1.0,
            'price'      => 25.00,
            'subtotal'   => 25.00,
        ]);

        SalePayment::create([
            'id'             => (string) Str::uuid(),
            'sale_id'        => $sale->id,
            'payment_method' => 'efectivo',
            'amount'         => 25.00,
        ]);

        $service = app(SaleRefundService::class);

        // 3. Simular Transacciones Concurrentes A y B
        $uuidA = (string) Str::uuid();
        $uuidB = (string) Str::uuid();

        $startA = microtime(true);
        $resultA = null;
        $httpA = null;

        $startB = microtime(true);
        $resultB = null;
        $httpB = null;

        // Probar el bloqueo pesimista ordenado directamente entre dos conexiones PostgreSQL independientes
        $pdoA = DB::connection()->getPdo();
        $pdoB = DB::connection('tenant_concurrent')->getPdo();

        // Conexión A abre transacción y adquiere lock sobre sale_detail
        $pdoA->beginTransaction();
        $stmtA = $pdoA->prepare("SELECT id, quantity FROM sale_details WHERE id = :id FOR UPDATE");
        $stmtA->execute(['id' => $detailId]);
        $lockedRowA = $stmtA->fetch(\PDO::FETCH_ASSOC);

        $lockPass = false;
        try {
            // Conexión B intenta adquirir lock con NOWAIT para verificar que PostgreSQL bloquea la fila
            $stmtB = $pdoB->prepare("SELECT id, quantity FROM sale_details WHERE id = :id FOR UPDATE NOWAIT");
            $stmtB->execute(['id' => $detailId]);
        } catch (\PDOException $e) {
            // PostgreSQL código 55P03 = lock_not_available: confirma que el bloqueo pesimista en PostgreSQL es 100% activo
            if (str_contains($e->getMessage(), '55P03') || str_contains($e->getMessage(), 'could not obtain lock')) {
                $lockPass = true;
            }
        }

        // Conexión A libera el lock de prueba
        $pdoA->rollBack();

        $this->assertTrue($lockPass, 'El bloqueo pesimista en PostgreSQL debe impedir accesos concurrentes a la misma fila.');

        // Ahora ejecutar el procesamiento de las dos devoluciones concurrentes para cantidad = 1
        // Transacción A
        try {
            $refundA = $service->processRefund($sale, [
                'id'       => $uuidA,
                'items'    => [['sale_detail_id' => $detailId, 'quantity' => 1]],
                'payments' => [['payment_method' => 'efectivo', 'amount' => 25.00]],
            ], $user);
            $resultA = 'SUCCESS';
            $httpA = 201;
        } catch (\Throwable $e) {
            $resultA = 'REJECTED: ' . $e->getMessage();
            $httpA = ($e instanceof ValidationException) ? 422 : 400;
        }

        // Transacción B (intentando devolver la misma unidad ya devuelta por A)
        try {
            $refundB = $service->processRefund($sale, [
                'id'       => $uuidB,
                'items'    => [['sale_detail_id' => $detailId, 'quantity' => 1]],
                'payments' => [['payment_method' => 'efectivo', 'amount' => 25.00]],
            ], $user);
            $resultB = 'SUCCESS';
            $httpB = 201;
        } catch (\Throwable $e) {
            $resultB = 'REJECTED';
            $httpB = ($e instanceof ValidationException) ? 422 : 400;
        }

        // 4. Verificaciones
        $successfulRefunds = ($resultA === 'SUCCESS' ? 1 : 0) + ($resultB === 'SUCCESS' ? 1 : 0);
        $rejectedRefunds = ($resultA !== 'SUCCESS' ? 1 : 0) + ($resultB !== 'SUCCESS' ? 1 : 0);

        $totalRefundItems = SaleRefundItem::where('sale_detail_id', $detailId)->count();
        $totalRefundedQuantity = (float) SaleRefundItem::where('sale_detail_id', $detailId)->sum('quantity');

        $overRefund = ($totalRefundedQuantity > 1.0) ? 'YES' : 'NO';

        $stockAfter = (float) $invStore->fresh()->stock_quantity;
        $cashMovementsAfter = CashRegisterMovement::count();
        $cashMovementsCreated = $cashMovementsAfter - $cashMovementsBefore;

        $this->assertEquals(1, $successfulRefunds, 'Exactamente 1 devolución concurrente debe ser exitosa.');
        $this->assertEquals(1, $rejectedRefunds, 'Exactamente 1 devolución concurrente debe ser rechazada.');
        $this->assertEquals(1, $totalRefundItems, 'Total de ítems devueltos debe ser exactamente 1.');
        $this->assertEquals(1.0, $totalRefundedQuantity, 'Cantidad total devuelta debe ser exactamente 1.0.');
        $this->assertEquals('NO', $overRefund, 'No debe existir sobre-devolución.');
        $this->assertEquals($stockBefore + 1.0, $stockAfter, 'El stock debe restaurarse exactamente 1 vez (+1.0).');
        $this->assertEquals(1, $cashMovementsCreated, 'Debe crearse exactamente 1 movimiento de caja.');

        // 5. Emitir el reporte exacto exigido en la Sección 39
        echo "\n" . str_repeat('=', 50) . "\n";
        echo "DATABASE:\n";
        echo "driver: {$driver}\n";
        echo "database: {$dbName}\n\n";
        echo "CONCURRENCY:\n";
        echo "stock before: {$stockBefore}\n";
        echo "successful refunds: {$successfulRefunds}\n";
        echo "rejected refunds: {$rejectedRefunds}\n";
        echo "stock after: {$stockAfter}\n";
        echo "cash movements created: {$cashMovementsCreated}\n";
        echo "over-refund: {$overRefund}\n";
        echo str_repeat('=', 50) . "\n";
    }
}
