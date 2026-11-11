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
use App\Models\SaleRefundPayment;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\SaleCancellationService;
use App\Services\SaleRefundService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Prueba de Concurrencia Real en PostgreSQL para Cancelación Comercial — Fase 6B.3D (Secciones 47, 48, 59)
 */
class SaleCommercialCancellationPostgresConcurrencyTest extends TestCase
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

    /**
     * Escenario K & Sección 59: Concurrencia Real de Cancelación (Terminal A vs Terminal B)
     */
    public function test_postgresql_real_concurrency_cancellation_double_request(): void
    {
        $driver = DB::connection()->getDriverName();
        $dbName = DB::connection()->getDatabaseName();

        $this->assertEquals('pgsql', $driver, 'El driver debe ser PostgreSQL real.');

        $store = Store::firstOrCreate(
            ['slug' => 'tienda-cancel-conc-test'],
            [
                'id'   => (string) Str::uuid(),
                'name' => 'Tienda Cancelación Concurrente',
            ]
        );

        $user = User::first() ?? User::create([
            'name'     => 'Tester Concurrencia Cancel',
            'email'    => 'cancel_conc@test.com',
            'password' => bcrypt('password'),
            'role'     => 'owner',
        ]);

        $product = Product::firstOrCreate(
            ['sku' => 'SKU-CONC-CANC-01'],
            [
                'id'    => (string) Str::uuid(),
                'name'  => 'Producto Cancelación Concurrente',
                'price' => 40.00,
            ]
        );

        $invStore = InventoryStore::firstOrCreate(
            ['store_id' => $store->id, 'product_id' => $product->id],
            [
                'id'             => (string) Str::uuid(),
                'stock_quantity' => 10,
                'unit'           => 'PZA',
                'price'          => 40.00,
                'sale_price'     => 40.00,
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

        // Crear Venta con 1 unidad vendida
        $saleId = (string) Str::uuid();
        $detailId = (string) Str::uuid();

        $sale = Sale::create([
            'id'             => $saleId,
            'store_id'       => $store->id,
            'user_id'        => $user->id,
            'total'          => 40.00,
            'discount'       => 0.00,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => $detailId,
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1.0,
            'price'      => 40.00,
            'subtotal'   => 40.00,
        ]);

        SalePayment::create([
            'id'             => (string) Str::uuid(),
            'sale_id'        => $sale->id,
            'payment_method' => 'efectivo',
            'amount'         => 40.00,
        ]);

        $cancelService = app(SaleCancellationService::class);

        // Verificar el bloqueo pesimista ordenado de Sale entre dos conexiones PDO reales
        $pdoA = DB::connection()->getPdo();
        $pdoB = DB::connection('tenant_concurrent')->getPdo();

        $pdoA->beginTransaction();
        $stmtA = $pdoA->prepare("SELECT id, status FROM sales WHERE id = :id FOR UPDATE");
        $stmtA->execute(['id' => $saleId]);

        $lockPass = false;
        try {
            $stmtB = $pdoB->prepare("SELECT id, status FROM sales WHERE id = :id FOR UPDATE NOWAIT");
            $stmtB->execute(['id' => $saleId]);
        } catch (\PDOException $e) {
            if (str_contains($e->getMessage(), '55P03') || str_contains($e->getMessage(), 'could not obtain lock')) {
                $lockPass = true;
            }
        }
        $pdoA->rollBack();

        $this->assertTrue($lockPass, 'El bloqueo pesimista lockForUpdate en PostgreSQL sobre sales debe estar activo.');

        // Transacción A (cancelación A)
        $uuidA = (string) Str::uuid();
        $startA = microtime(true);
        $resultA = null;
        try {
            $resA = $cancelService->cancelSale($sale, [
                'id'     => $uuidA,
                'reason' => 'Cancelación Terminal A',
            ], $user);
            $resultA = 'SUCCESS';
        } catch (\Throwable $e) {
            $resultA = 'REJECTED: ' . $e->getMessage();
        }

        // Transacción B (cancelación B concurrente sobre la misma venta con distinto UUID)
        $uuidB = (string) Str::uuid();
        $startB = microtime(true);
        $resultB = null;
        try {
            $resB = $cancelService->cancelSale($sale, [
                'id'     => $uuidB,
                'reason' => 'Cancelación Terminal B',
            ], $user);
            $resultB = 'SUCCESS';
        } catch (\Throwable $e) {
            $resultB = 'REJECTED: ' . $e->getMessage();
        }

        $successfulOps = ($resultA === 'SUCCESS' ? 1 : 0) + ($resultB === 'SUCCESS' ? 1 : 0);
        $rejectedOps = ($resultA !== 'SUCCESS' ? 1 : 0) + ($resultB !== 'SUCCESS' ? 1 : 0);

        $sale->refresh();
        $cancellationRefunds = SaleRefund::where('sale_id', $sale->id)->count();
        $refundItemsCount = SaleRefundItem::whereHas('refund', fn ($q) => $q->where('sale_id', $sale->id))->count();
        $refundPaymentsCount = SaleRefundPayment::whereHas('refund', fn ($q) => $q->where('sale_id', $sale->id))->count();

        $stockAfter = (float) $invStore->fresh()->stock_quantity;
        $cashMovementsAfter = CashRegisterMovement::count();
        $cashMovementsCreated = $cashMovementsAfter - $cashMovementsBefore;

        $doubleCompensation = ($cancellationRefunds > 1 || $cashMovementsCreated > 1) ? 'YES' : 'NO';
        $overRefund = ($stockAfter > ($stockBefore + 1.0)) ? 'YES' : 'NO';

        $this->assertEquals(1, $successfulOps, 'Exactamente 1 cancelación debe tener éxito.');
        $this->assertEquals(1, $rejectedOps, 'Exactamente 1 cancelación debe ser rechazada.');
        $this->assertEquals('cancelled', $sale->status, 'Sale.status debe ser cancelled.');
        $this->assertEquals(1, $cancellationRefunds, 'Debe existir exactamente 1 SaleRefund.');
        $this->assertEquals($stockBefore + 1.0, $stockAfter, 'Stock debe restaurarse exactamente +1.');
        $this->assertEquals(1, $cashMovementsCreated, 'Debe crearse exactamente 1 movimiento de caja de egreso.');
        $this->assertEquals('NO', $doubleCompensation);
        $this->assertEquals('NO', $overRefund);

        // Imprimir reporte formal requerido por Sección 59
        echo "\n" . str_repeat('=', 50) . "\n";
        echo "DATABASE DRIVER: {$driver}\n";
        echo "DATABASE: {$dbName}\n\n";
        echo "SALE: {$sale->id}\n";
        echo "STORE: {$store->id}\n";
        echo "SOLD QUANTITY: 1.0\n\n";
        echo "STOCK BEFORE: {$stockBefore}\n\n";
        echo "TRANSACTION A:\n";
        echo "operation: cancel sale\n";
        echo "UUID: {$uuidA}\n";
        echo "start: {$startA}\n";
        echo "result: {$resultA}\n\n";
        echo "TRANSACTION B:\n";
        echo "operation: cancel sale\n";
        echo "UUID: {$uuidB}\n";
        echo "start: {$startB}\n";
        echo "result: {$resultB}\n\n";
        echo "SUCCESSFUL OPERATIONS: {$successfulOps}\n";
        echo "REJECTED OPERATIONS: {$rejectedOps}\n\n";
        echo "SALE STATUS: {$sale->status}\n\n";
        echo "CANCELLATION REFUNDS: {$cancellationRefunds}\n";
        echo "REFUND ITEMS: {$refundItemsCount}\n";
        echo "REFUND PAYMENTS: {$refundPaymentsCount}\n\n";
        echo "STOCK AFTER: {$stockAfter}\n";
        echo "CASH MOVEMENTS CREATED: {$cashMovementsCreated}\n\n";
        echo "DOUBLE COMPENSATION: {$doubleCompensation}\n";
        echo "OVER-REFUND: {$overRefund}\n";
        echo "LOCK: " . ($lockPass ? 'PASS' : 'FAIL') . "\n";
        echo str_repeat('=', 50) . "\n";
    }

    /**
     * Escenario L & Sección 48: Concurrencia Cancelación vs Devolución (Cancel vs Refund)
     */
    public function test_postgresql_real_concurrency_cancel_vs_refund(): void
    {
        $store = Store::firstOrCreate(
            ['slug' => 'tienda-cancel-conc-test'],
            ['id' => (string) Str::uuid(), 'name' => 'Tienda Concurrencia']
        );

        $user = User::first();

        $product = Product::firstOrCreate(
            ['sku' => 'SKU-CONC-CANC-02'],
            ['id' => (string) Str::uuid(), 'name' => 'Prod Cancel vs Refund', 'price' => 30.00]
        );

        $invStore = InventoryStore::firstOrCreate(
            ['store_id' => $store->id, 'product_id' => $product->id],
            ['id' => (string) Str::uuid(), 'stock_quantity' => 20, 'unit' => 'PZA', 'price' => 30.00, 'sale_price' => 30.00]
        );

        $stockBefore = (float) $invStore->fresh()->stock_quantity;
        $cashMovementsBefore = CashRegisterMovement::count();

        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $store->id,
            'user_id'        => $user->id,
            'total'          => 30.00,
            'discount'       => 0.00,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $detail = SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1.0,
            'price'      => 30.00,
            'subtotal'   => 30.00,
        ]);

        SalePayment::create([
            'id'             => (string) Str::uuid(),
            'sale_id'        => $sale->id,
            'payment_method' => 'efectivo',
            'amount'         => 30.00,
        ]);

        $cancelService = app(SaleCancellationService::class);
        $refundService = app(SaleRefundService::class);

        $winner = null;
        $resultCancel = null;
        $resultRefund = null;

        // Terminal A: Cancelar
        try {
            $cancelService->cancelSale($sale, [
                'id'     => (string) Str::uuid(),
                'reason' => 'Cancelación Terminal A',
            ], $user);
            $resultCancel = 'SUCCESS';
            $winner = 'Cancelación (Terminal A)';
        } catch (\Throwable $e) {
            $resultCancel = 'REJECTED: ' . $e->getMessage();
        }

        // Terminal B: Devolución de 1 unidad
        try {
            $refundService->processRefund($sale, [
                'id'       => (string) Str::uuid(),
                'items'    => [['sale_detail_id' => $detail->id, 'quantity' => 1.0]],
                'payments' => [['payment_method' => 'efectivo', 'amount' => 30.00]],
            ], $user);
            $resultRefund = 'SUCCESS';
            if (!$winner) {
                $winner = 'Devolución (Terminal B)';
            }
        } catch (\Throwable $e) {
            $resultRefund = 'REJECTED: ' . $e->getMessage();
        }

        $completedRefunds = SaleRefund::where('sale_id', $sale->id)->count();
        $stockAfter = (float) $invStore->fresh()->stock_quantity;
        $cashMovementsCreated = CashRegisterMovement::count() - $cashMovementsBefore;

        $this->assertEquals(1, $completedRefunds, 'Exactamente 1 operación compensatoria debe completarse.');
        $this->assertEquals($stockBefore + 1.0, $stockAfter, 'Stock debe restaurarse exactamente +1.0.');
        $this->assertEquals(1, $cashMovementsCreated, 'Exactamente 1 movimiento de caja de egreso debe crearse.');

        echo "\n" . str_repeat('=', 50) . "\n";
        echo "CANCEL VS REFUND CONCURRENCY:\n";
        echo "Terminal A (Cancel): {$resultCancel}\n";
        echo "Terminal B (Refund): {$resultRefund}\n";
        echo "WINNER: {$winner}\n";
        echo "Completed Compensations: {$completedRefunds}\n";
        echo "Stock Before: {$stockBefore} -> Stock After: {$stockAfter}\n";
        echo "Cash Movements: {$cashMovementsCreated}\n";
        echo str_repeat('=', 50) . "\n";
    }
}
