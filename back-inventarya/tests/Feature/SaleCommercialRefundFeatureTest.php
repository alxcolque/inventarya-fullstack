<?php

namespace Tests\Feature;

use App\Http\Controllers\SaleRefundController;
use App\Models\Assignment;
use App\Models\CashRegisterMovement;
use App\Models\CashRegisterSession;
use App\Models\ElectronicInvoice;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SalePayment;
use App\Models\SaleRefund;
use App\Models\SaleRefundItem;
use App\Models\SaleRefundPayment;
use App\Models\Store;
use App\Models\User;
use App\Permissions\TenantPermissions;
use App\Services\CashRegisterService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class SaleCommercialRefundFeatureTest extends TestCase
{
    private User $owner;
    private User $staffStoreA;
    private User $staffStoreB;
    private Store $storeA;
    private Store $storeB;
    private Product $productA;
    private Product $productB;
    private CashRegisterSession $sessionStoreA;
    private CashRegisterSession $sessionStoreB;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.refund_test' => [
                'driver'   => 'sqlite',
                'database' => ':memory:',
                'prefix'   => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'refund_test',
        ]);
        DB::purge('refund_test');

        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('slug')->nullable();
            $t->timestamps();
        });

        Schema::create('brands', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('slug')->nullable();
            $t->timestamps();
        });

        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('phone')->nullable();
            $t->timestamps();
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->id();
            $t->string('timezone')->default('America/La_Paz');
            $t->timestamps();
        });

        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email')->nullable();
            $t->string('password')->nullable();
            $t->string('role')->default('owner');
            $t->timestamps();
        });

        Schema::create('stores', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('slug')->nullable();
            $t->timestamps();
        });

        Schema::create('assignments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('user_id');
            $t->uuid('store_id');
            $t->timestamps();
        });

        Schema::create('products', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('slug')->nullable();
            $t->string('sku')->nullable();
            $t->decimal('price', 15, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('inventory_stores', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->uuid('product_id');
            $t->decimal('stock_quantity', 15, 3)->default(0);
            $t->decimal('price', 15, 2)->default(0);
            $t->decimal('sale_price', 15, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('cash_register_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id');
            $t->foreignId('closed_by')->nullable();
            $t->decimal('opening_amount', 15, 2)->default(0);
            $t->decimal('expected_amount', 15, 2)->nullable();
            $t->decimal('closing_amount', 15, 2)->nullable();
            $t->decimal('difference', 15, 2)->nullable();
            $t->string('status', 20)->default('open');
            $t->timestamp('opened_at')->nullable();
            $t->timestamp('closed_at')->nullable();
            $t->text('opening_note')->nullable();
            $t->text('closing_note')->nullable();
            $t->timestamps();
        });

        Schema::create('cash_register_movements', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('cash_register_session_id');
            $t->uuid('sale_refund_id')->nullable();
            $t->foreignId('user_id');
            $t->string('type', 20);
            $t->decimal('amount', 15, 2);
            $t->string('reason');
            $t->text('description')->nullable();
            $t->timestamps();
        });

        Schema::create('sales', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id')->nullable();
            $t->foreignId('customer_id')->default(0);
            $t->uuid('cash_register_session_id')->nullable();
            $t->timestamp('order_date')->nullable();
            $t->decimal('total', 15, 2);
            $t->decimal('discount', 15, 2)->default(0);
            $t->string('payment_method', 50)->default('efectivo');
            $t->string('status', 30)->default('completed');
            $t->timestamps();
        });

        Schema::create('sale_details', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->uuid('product_id')->nullable();
            $t->decimal('quantity', 15, 3);
            $t->decimal('price', 15, 2);
            $t->decimal('subtotal', 15, 2);
            $t->timestamps();
        });

        Schema::create('sale_payments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->string('payment_method', 50);
            $t->decimal('amount', 15, 2);
            $t->decimal('amount_received', 15, 2)->nullable();
            $t->decimal('change_amount', 15, 2)->nullable();
            $t->string('reference', 255)->nullable();
            $t->timestamps();
        });

        Schema::create('sale_refunds', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->uuid('store_id');
            $t->foreignId('user_id');
            $t->string('status', 50)->default('completed');
            $t->string('reason', 255)->nullable();
            $t->text('notes')->nullable();
            $t->decimal('total', 15, 2)->default(0.00);
            $t->timestamps();
        });

        Schema::create('sale_refund_items', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_refund_id');
            $t->uuid('sale_detail_id');
            $t->uuid('product_id')->nullable();
            $t->string('product_name', 255)->nullable();
            $t->string('product_sku', 100)->nullable();
            $t->decimal('quantity', 15, 3)->default(0.000);
            $t->decimal('unit_price', 15, 2)->default(0.00);
            $t->decimal('subtotal', 15, 2)->default(0.00);
            $t->timestamps();
        });

        Schema::create('sale_refund_payments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_refund_id');
            $t->string('payment_method', 50)->default('efectivo');
            $t->decimal('amount', 15, 2)->default(0.00);
            $t->string('reference', 255)->nullable();
            $t->timestamps();
        });

        Schema::create('electronic_invoices', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->string('cuf', 255)->nullable();
            $t->string('status', 50)->default('pending');
            $t->timestamps();
        });

        Route::get('/sales/{sale}/refundable', [SaleRefundController::class, 'refundable']);
        Route::get('/sales/{sale}/refunds', [SaleRefundController::class, 'indexBySale']);
        Route::post('/sales/{sale}/refunds', [SaleRefundController::class, 'store']);
        Route::get('/sale-refunds/{refund}', [SaleRefundController::class, 'show']);

        Gate::before(function ($user, $ability) {
            $role = $user->role ?? 'staff';
            $perms = TenantPermissions::PERMISSIONS[$role] ?? [];
            if (in_array('*', $perms, true)) {
                return true;
            }
            return in_array($ability, $perms, true);
        });

        $this->owner = User::create(['name' => 'Owner Test', 'email' => 'owner@test.com', 'role' => 'owner']);
        $this->staffStoreA = User::create(['name' => 'Staff A', 'email' => 'staffa@test.com', 'role' => 'staff']);
        $this->staffStoreB = User::create(['name' => 'Staff B', 'email' => 'staffb@test.com', 'role' => 'staff']);

        $this->storeA = Store::create(['id' => (string) Str::uuid(), 'name' => 'Store A', 'slug' => 'store-a']);
        $this->storeB = Store::create(['id' => (string) Str::uuid(), 'name' => 'Store B', 'slug' => 'store-b']);

        Assignment::create(['user_id' => $this->staffStoreA->id, 'store_id' => $this->storeA->id]);
        Assignment::create(['user_id' => $this->staffStoreB->id, 'store_id' => $this->storeB->id]);

        $this->productA = Product::create([
            'id' => (string) Str::uuid(),
            'name' => 'Producto A',
            'sku' => 'SKU-A',
            'price' => 10.00,
        ]);
        $this->productB = Product::create([
            'id' => (string) Str::uuid(),
            'name' => 'Producto B',
            'sku' => 'SKU-B',
            'price' => 20.00,
        ]);

        InventoryStore::create([
            'id' => (string) Str::uuid(),
            'store_id' => $this->storeA->id,
            'product_id' => $this->productA->id,
            'stock_quantity' => 100,
            'price' => 10.00,
            'sale_price' => 10.00,
        ]);
        InventoryStore::create([
            'id' => (string) Str::uuid(),
            'store_id' => $this->storeA->id,
            'product_id' => $this->productB->id,
            'stock_quantity' => 50,
            'price' => 20.00,
            'sale_price' => 20.00,
        ]);

        $this->sessionStoreA = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'opening_amount' => 100.00,
            'status'         => 'open',
            'opened_at'      => now(),
        ]);

        $this->sessionStoreB = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeB->id,
            'user_id'        => $this->owner->id,
            'opening_amount' => 100.00,
            'status'         => 'open',
            'opened_at'      => now(),
        ]);
    }

    /**
     * Helper para crear una venta con detalles y pagos.
     */
    private function createSale(array $attributes = [], array $details = [], array $payments = []): Sale
    {
        $saleId = (string) Str::uuid();
        $sale = Sale::create(array_merge([
            'id'             => $saleId,
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 50.00,
            'discount'       => 0.00,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ], $attributes));

        if (empty($details)) {
            SaleDetail::create([
                'id'         => (string) Str::uuid(),
                'sale_id'    => $sale->id,
                'product_id' => $this->productA->id,
                'quantity'   => 5.0,
                'price'      => 10.00,
                'subtotal'   => 50.00,
            ]);
        } else {
            foreach ($details as $d) {
                SaleDetail::create(array_merge(['id' => (string) Str::uuid(), 'sale_id' => $sale->id], $d));
            }
        }

        if (empty($payments)) {
            SalePayment::create([
                'id'             => (string) Str::uuid(),
                'sale_id'        => $sale->id,
                'payment_method' => 'efectivo',
                'amount'         => (float) $sale->total,
            ]);
        } else {
            foreach ($payments as $p) {
                SalePayment::create(array_merge(['id' => (string) Str::uuid(), 'sale_id' => $sale->id], $p));
            }
        }

        return $sale->fresh(['saleDetails', 'payments']);
    }

    // A. DEVOLUCIÓN PARCIAL CON RESTAURACIÓN DE STOCK Y CAJA
    public function test_a_partial_refund(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $stockBefore = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');

        $response = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [
                ['sale_detail_id' => $detail->id, 'quantity' => 2],
            ],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 20.00],
            ],
        ]);

        $response->assertStatus(201);
        $this->assertEquals(20.00, (float) $response->json('refund.total'));

        // Stock restaurado +2
        $stockAfter = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');
        $this->assertEquals($stockBefore + 2, $stockAfter);

        // Movimiento de caja registrado
        $refundId = $response->json('id');
        $movement = CashRegisterMovement::where('sale_refund_id', $refundId)->first();
        $this->assertNotNull($movement);
        $this->assertEquals('expense', $movement->type);
        $this->assertEquals(20.00, (float) $movement->amount);

        $refundable = $this->actingAs($this->owner)->getJson("/sales/{$sale->id}/refundable");
        $refundable->assertStatus(200);
        $this->assertEquals(3.0, (float) $refundable->json('items.0.refundable_quantity'));
        $this->assertEquals(30.00, (float) $refundable->json('remaining_refundable_amount'));
        $this->assertEquals('partially_refunded', $refundable->json('refund_status'));
    }

    // B. SEGUNDA DEVOLUCIÓN SOBRE LA MISMA VENTA
    public function test_b_second_refund_accumulates(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $stockBefore = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');

        // Primera devolución: 2
        $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ])->assertStatus(201);

        // Segunda devolución: 2 adicionales
        $res2 = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ]);
        $res2->assertStatus(201);

        $stockAfter = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');
        $this->assertEquals($stockBefore + 4, $stockAfter);

        $refundable = $this->actingAs($this->owner)->getJson("/sales/{$sale->id}/refundable");
        $refundable->assertStatus(200);
        $this->assertEquals(4.0, (float) $refundable->json('items.0.refunded_quantity'));
        $this->assertEquals(1.0, (float) $refundable->json('items.0.refundable_quantity'));
        $this->assertEquals(10.00, (float) $refundable->json('remaining_refundable_amount'));
    }

    // C. EXCESO: INTENTO DE DEVOLVER MÁS DE LO DISPONIBLE
    public function test_c_over_refund_protection_rejects(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        // Devolver 4 de 5
        $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 4]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 40.00]],
        ])->assertStatus(201);

        $stockBeforeOverRefund = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');

        // Queda 1 disponible. Intentar devolver 2: DEBE RECHAZARSE
        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsString('supera la cantidad disponible', $res->json('message'));
        $this->assertEquals(1, SaleRefund::where('sale_id', $sale->id)->count());

        $stockAfterOverRefund = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');
        $this->assertEquals($stockBeforeOverRefund, $stockAfterOverRefund);
    }

    // D. DEVOLUCIÓN TOTAL
    public function test_d_total_refund(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 5]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 50.00]],
        ]);
        $res->assertStatus(201);

        $refundable = $this->actingAs($this->owner)->getJson("/sales/{$sale->id}/refundable");
        $refundable->assertStatus(200);
        $this->assertEquals(0.0, (float) $refundable->json('items.0.refundable_quantity'));
        $this->assertEquals(0.00, (float) $refundable->json('remaining_refundable_amount'));
        $this->assertEquals('refunded', $refundable->json('refund_status'));
    }

    // E. MÚLTIPLES PRODUCTOS EN LA MISMA VENTA
    public function test_e_multiple_products_independent_calculation(): void
    {
        $sale = $this->createSale(
            ['total' => 130.00],
            [
                ['product_id' => $this->productA->id, 'quantity' => 3.0, 'price' => 10.00, 'subtotal' => 30.00],
                ['product_id' => $this->productB->id, 'quantity' => 5.0, 'price' => 20.00, 'subtotal' => 100.00],
            ],
            [
                ['payment_method' => 'efectivo', 'amount' => 130.00],
            ]
        );

        $details = $sale->saleDetails->keyBy('product_id');
        $detA = $details->get($this->productA->id);
        $detB = $details->get($this->productB->id);

        $stockABefore = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $stockBBefore = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productB->id)->value('stock_quantity');

        // Devolver A x 1 (10.00) y B x 2 (40.00) = 50.00
        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [
                ['sale_detail_id' => $detA->id, 'quantity' => 1],
                ['sale_detail_id' => $detB->id, 'quantity' => 2],
            ],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 50.00],
            ],
        ]);

        $res->assertStatus(201);
        $this->assertEquals(50.00, (float) $res->json('refund.total'));

        $stockAAfter = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $stockBAfter = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productB->id)->value('stock_quantity');

        $this->assertEquals($stockABefore + 1, $stockAAfter);
        $this->assertEquals($stockBBefore + 2, $stockBAfter);
    }

    // F. MONTO MANIPULADO DESDE FRONTEND: BACKEND CALCULA AUTORITATIVAMENTE
    public function test_f_manipulated_price_ignored_by_backend(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [
                [
                    'sale_detail_id' => $detail->id,
                    'quantity'       => 2,
                    'unit_price'     => 0.01,
                    'subtotal'       => 0.01,
                    'price'          => 0.01,
                ]
            ],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 20.00],
            ],
        ]);

        $res->assertStatus(201);
        $this->assertEquals(20.00, (float) $res->json('refund.total'));
        $this->assertEquals(10.00, (float) $res->json('refund.items.0.unit_price'));
        $this->assertEquals(20.00, (float) $res->json('refund.items.0.subtotal'));
    }

    // G. REEMBOLSO: SUMA DE PAGOS DEBE COINCIDIR EXACTAMENTE CON TOTAL
    public function test_g_refund_payment_sum_validation(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $failRes = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 3]],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 10.00],
                ['payment_method' => 'efectivo', 'amount' => 25.00],
            ],
        ]);
        $failRes->assertStatus(422);

        $passRes = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 3]],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 10.00],
                ['payment_method' => 'efectivo', 'amount' => 20.00],
            ],
        ]);
        $passRes->assertStatus(201);
    }

    // H. LÍMITES POR MÉTODO DE PAGO
    public function test_h_payment_method_limits_strictly_enforced(): void
    {
        $sale = $this->createSale(
            ['total' => 100.00],
            [['product_id' => $this->productA->id, 'quantity' => 10.0, 'price' => 10.00, 'subtotal' => 100.00]],
            [
                ['payment_method' => 'efectivo', 'amount' => 40.00],
                ['payment_method' => 'qr', 'amount' => 60.00],
            ]
        );
        $detail = $sale->saleDetails->first();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 5]],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 41.00],
                ['payment_method' => 'qr', 'amount' => 9.00],
            ],
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsString('supera el remanente disponible', $res->json('message'));
    }

    // I. LEGACY PAYMENT: COMPATIBILIDAD CON VENTAS SIN REGISTROS EN sale_payments
    public function test_i_legacy_payment_support(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 100.00,
            'discount'       => 0.00,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);
        $detail = SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 10.0,
            'price'      => 10.00,
            'subtotal'   => 100.00,
        ]);

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ]);
        $res->assertStatus(201);
        $this->assertEquals(20.00, (float) $res->json('refund.total'));
    }

    // J. IDEMPOTENCIA: MISMO UUID + MISMO PAYLOAD NO DUPLICA STOCK NI CAJA
    public function test_j_idempotency_returns_existing_record_without_duplicate_effects(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();
        $idempotentUuid = (string) Str::uuid();

        $stockBefore = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $movementsBefore = CashRegisterMovement::count();

        $payload = [
            'id'       => $idempotentUuid,
            'items'    => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ];

        // Primer request
        $res1 = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", $payload);
        $res1->assertStatus(201);
        $refundId = $res1->json('id');

        $stockAfter1 = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $this->assertEquals($stockBefore + 2, $stockAfter1);
        $this->assertEquals($movementsBefore + 1, CashRegisterMovement::count());

        // Segundo request idéntico
        $res2 = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", $payload);
        $res2->assertStatus(200);
        $this->assertTrue($res2->json('is_duplicate'));
        $this->assertEquals($refundId, $res2->json('id'));

        // Stock y movimientos no se duplican
        $stockAfter2 = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $this->assertEquals($stockAfter1, $stockAfter2);
        $this->assertEquals($movementsBefore + 1, CashRegisterMovement::count());
        $this->assertEquals(1, SaleRefund::where('sale_id', $sale->id)->count());
    }

    // K. UUID REUTILIZADO CON PAYLOAD DIFERENTE: 409 CONFLICT SIN EFECTOS
    public function test_k_uuid_payload_conflict_returns_409(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();
        $idempotentUuid = (string) Str::uuid();

        // Primer request: devolver 1
        $res1 = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'id'       => $idempotentUuid,
            'items'    => [['sale_detail_id' => $detail->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 10.00]],
        ]);
        $res1->assertStatus(201);

        $stockBeforeConflict = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $movementsBeforeConflict = CashRegisterMovement::count();

        // Segundo request con MISMO UUID pero diferente cantidad (2)
        $res2 = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'id'       => $idempotentUuid,
            'items'    => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ]);

        $res2->assertStatus(409);
        $this->assertStringContainsString('Conflicto de idempotencia', $res2->json('message'));

        $this->assertEquals($stockBeforeConflict, (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity'));
        $this->assertEquals($movementsBeforeConflict, CashRegisterMovement::count());
    }

    // L. MULTI-STORE ISOLATION
    public function test_l_multi_store_isolation(): void
    {
        $saleStoreB = $this->createSale(['store_id' => $this->storeB->id, 'total' => 50.00]);
        $detail = $saleStoreB->saleDetails->first();

        $res = $this->actingAs($this->staffStoreA)->postJson("/sales/{$saleStoreB->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 10.00]],
        ]);

        $res->assertStatus(403);
        $this->assertEquals(0, SaleRefund::where('sale_id', $saleStoreB->id)->count());
    }

    // N. 6B.3C: RESTAURACIÓN DE STOCK CONFIRMADA
    public function test_n_stock_restoration_confirmed(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $invBefore = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');

        $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ])->assertStatus(201);

        $invAfter = (float) InventoryStore::where('store_id', $this->storeA->id)
            ->where('product_id', $this->productA->id)
            ->value('stock_quantity');

        $this->assertEquals($invBefore + 2.0, $invAfter);
    }

    // O. 6B.3C: MOVIMIENTO DE CAJA REGISTRADO
    public function test_o_cash_movement_registered(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $movementsBefore = CashRegisterMovement::count();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ]);
        $res->assertStatus(201);

        $this->assertEquals($movementsBefore + 1, CashRegisterMovement::count());
        $m = CashRegisterMovement::where('sale_refund_id', $res->json('id'))->first();
        $this->assertNotNull($m);
        $this->assertEquals('expense', $m->type);
        $this->assertEquals(20.00, (float) $m->amount);
        $this->assertEquals('sale_refund', $m->reason);
        $this->assertEquals($this->sessionStoreA->id, $m->cash_register_session_id);
    }

    // P. FISCAL DECOUPLING: ELECTRONIC INVOICE UNCHANGED
    public function test_p_fiscal_decoupling(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $invoice = ElectronicInvoice::create([
            'id'      => (string) Str::uuid(),
            'sale_id' => $sale->id,
            'cuf'     => 'ORIGINAL_CUF_123456789',
            'status'  => 'accepted',
        ]);

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 10.00]],
        ]);
        $res->assertStatus(201);

        $invoiceAfter = ElectronicInvoice::find($invoice->id);
        $this->assertEquals(\App\Enums\ElectronicInvoiceStatus::ACCEPTED, $invoiceAfter->status);
        $this->assertEquals('ORIGINAL_CUF_123456789', $invoiceAfter->cuf);
    }

    // Q. DESCUENTOS: PRORRATEO EXACTO Y SUMA ACUMULADA <= SALE.TOTAL
    public function test_q_discount_exact_prorating_and_cap(): void
    {
        $sale = $this->createSale(
            ['total' => 80.00, 'discount' => 20.00],
            [
                ['product_id' => $this->productA->id, 'quantity' => 1.0, 'price' => 50.00, 'subtotal' => 50.00],
                ['product_id' => $this->productB->id, 'quantity' => 1.0, 'price' => 50.00, 'subtotal' => 50.00],
            ],
            [
                ['payment_method' => 'efectivo', 'amount' => 80.00],
            ]
        );

        $details = $sale->saleDetails->keyBy('product_id');
        $detA = $details->get($this->productA->id);
        $detB = $details->get($this->productB->id);

        $resA = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detA->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 40.00]],
        ]);
        $resA->assertStatus(201);
        $this->assertEquals(40.00, (float) $resA->json('refund.total'));

        $resB = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detB->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 40.00]],
        ]);
        $resB->assertStatus(201);
        $this->assertEquals(40.00, (float) $resB->json('refund.total'));

        $totalRefunded = SaleRefund::where('sale_id', $sale->id)->sum('total');
        $this->assertEquals(80.00, (float) $totalRefunded);
    }

    // SECCIÓN 31: PRUEBAS DE CAJA — QR NO GENERA MOVIMIENTO FÍSICO
    public function test_qr_refund_generates_zero_cash_movements(): void
    {
        $sale = $this->createSale(
            ['total' => 50.00],
            [['product_id' => $this->productA->id, 'quantity' => 5.0, 'price' => 10.00, 'subtotal' => 50.00]],
            [['payment_method' => 'qr', 'amount' => 50.00]]
        );
        $detail = $sale->saleDetails->first();

        $movementsBefore = CashRegisterMovement::count();
        $stockBefore = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'qr', 'amount' => 20.00]],
        ]);
        $res->assertStatus(201);

        // Movimientos de caja física = 0 nuevos
        $this->assertEquals($movementsBefore, CashRegisterMovement::count());
        // Stock sí se restaura
        $stockAfter = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $this->assertEquals($stockBefore + 2.0, $stockAfter);
    }

    // SECCIÓN 31: PRUEBAS DE CAJA — PAGO MIXTO AFECTA SOLO EFECTIVO
    public function test_mixed_refund_affects_only_cash_portion(): void
    {
        $sale = $this->createSale(
            ['total' => 100.00],
            [['product_id' => $this->productA->id, 'quantity' => 10.0, 'price' => 10.00, 'subtotal' => 100.00]],
            [
                ['payment_method' => 'efectivo', 'amount' => 30.00],
                ['payment_method' => 'qr', 'amount' => 50.00],
                ['payment_method' => 'tarjeta', 'amount' => 20.00],
            ]
        );
        $detail = $sale->saleDetails->first();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 10]],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 30.00],
                ['payment_method' => 'qr', 'amount' => 50.00],
                ['payment_method' => 'tarjeta', 'amount' => 20.00],
            ],
        ]);
        $res->assertStatus(201);
        $this->assertEquals(100.00, (float) $res->json('refund.total'));

        // Solo 1 movimiento por 30.00
        $refundId = $res->json('id');
        $movement = CashRegisterMovement::where('sale_refund_id', $refundId)->first();
        $this->assertNotNull($movement);
        $this->assertEquals(30.00, (float) $movement->amount);
        $this->assertEquals('expense', $movement->type);
    }

    // SECCIÓN 31: EFECTO EN SUMMARY() DE CAJA
    public function test_cash_register_summary_reflects_refund_expense(): void
    {
        // Sesión con opening = 100.00
        $sale = $this->createSale(
            ['total' => 80.00, 'cash_register_session_id' => $this->sessionStoreA->id],
            [['product_id' => $this->productA->id, 'quantity' => 8.0, 'price' => 10.00, 'subtotal' => 80.00]],
            [['payment_method' => 'efectivo', 'amount' => 80.00]]
        );
        $detail = $sale->saleDetails->first();

        // Devolución en efectivo por 30.00
        $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 3]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 30.00]],
        ])->assertStatus(201);

        // Expected cash: 100 (opening) + 80 (cash sales) - 30 (refund expense) = 150.00
        $service = app(CashRegisterService::class);
        $summary = $service->summary($this->sessionStoreA->fresh());

        $this->assertEquals('150.00', $summary['expected_cash']);
    }

    // SECCIÓN 32: VENTA ORIGINAL EN SESIÓN CERRADA, SALIDA EN SESIÓN ABIERTA ACTUAL
    public function test_refund_uses_current_open_session_when_original_is_closed(): void
    {
        // Sesión A cerrada
        $sessionA = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'opening_amount' => 50.00,
            'status'         => 'closed',
            'opened_at'      => now()->subDays(2),
            'closed_at'      => now()->subDay(),
        ]);

        $sale = $this->createSale(
            ['total' => 40.00, 'cash_register_session_id' => $sessionA->id],
            [['product_id' => $this->productA->id, 'quantity' => 4.0, 'price' => 10.00, 'subtotal' => 40.00]],
            [['payment_method' => 'efectivo', 'amount' => 40.00]]
        );
        $detail = $sale->saleDetails->first();

        // Devolución procesada hoy: debe asignarse a $this->sessionStoreA (que está OPEN)
        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 10.00]],
        ]);
        $res->assertStatus(201);

        $movement = CashRegisterMovement::where('sale_refund_id', $res->json('id'))->first();
        $this->assertEquals($this->sessionStoreA->id, $movement->cash_register_session_id);
        $this->assertEquals(0, CashRegisterMovement::where('cash_register_session_id', $sessionA->id)->count());
    }

    // SECCIÓN 32: RECHAZO SI NO HAY CAJA ABIERTA PARA REFUND EN EFECTIVO
    public function test_cash_refund_fails_and_rolls_back_if_no_open_session(): void
    {
        // Cerrar la sesión abierta de storeA
        $this->sessionStoreA->update(['status' => 'closed']);

        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $stockBefore = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $refundsBefore = SaleRefund::count();
        $movementsBefore = CashRegisterMovement::count();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsString('caja', $res->json('message'));

        // ATOMICIDAD: Nada se creó, stock intacto
        $this->assertEquals($stockBefore, (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity'));
        $this->assertEquals($refundsBefore, SaleRefund::count());
        $this->assertEquals($movementsBefore, CashRegisterMovement::count());
    }

    // SECCIÓN 32: REFUND 100% QR FUNCIONA AÚN SIN CAJA ABIERTA
    public function test_qr_refund_succeeds_even_without_open_cash_session(): void
    {
        // Cerrar caja
        $this->sessionStoreA->update(['status' => 'closed']);

        $sale = $this->createSale(
            ['total' => 50.00],
            [['product_id' => $this->productA->id, 'quantity' => 5.0, 'price' => 10.00, 'subtotal' => 50.00]],
            [['payment_method' => 'qr', 'amount' => 50.00]]
        );
        $detail = $sale->saleDetails->first();

        $stockBefore = (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity');

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'qr', 'amount' => 20.00]],
        ]);

        $res->assertStatus(201);
        $this->assertEquals($stockBefore + 2, (float) InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->value('stock_quantity'));
        $this->assertEquals(0, CashRegisterMovement::count());
    }

    // SECCIÓN 33: ATOMICIDAD — ROLLBACK SI INVENTORY_STORE FALTA
    public function test_missing_inventory_store_triggers_total_rollback(): void
    {
        // Producto sin InventoryStore en Store A
        $orphanProduct = Product::create([
            'id'    => (string) Str::uuid(),
            'name'  => 'Producto Huérfano',
            'price' => 15.00,
        ]);

        $sale = $this->createSale(
            ['total' => 15.00],
            [['product_id' => $orphanProduct->id, 'quantity' => 1.0, 'price' => 15.00, 'subtotal' => 15.00]],
            [['payment_method' => 'efectivo', 'amount' => 15.00]]
        );
        $detail = $sale->saleDetails->first();

        $refundsBefore = SaleRefund::count();
        $movementsBefore = CashRegisterMovement::count();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 15.00]],
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsString('inventario', $res->json('message'));

        $this->assertEquals($refundsBefore, SaleRefund::count());
        $this->assertEquals($movementsBefore, CashRegisterMovement::count());
    }

    // TRAZABILIDAD REFUND -> CASH MOVEMENT
    public function test_refund_cash_movement_bidirectional_relationship(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 2]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.00]],
        ]);
        $res->assertStatus(201);

        $refund = SaleRefund::with('cashMovement')->find($res->json('id'));
        $this->assertNotNull($refund->cashMovement);
        $this->assertEquals(20.00, (float) $refund->cashMovement->amount);

        $movement = CashRegisterMovement::with('saleRefund')->find($refund->cashMovement->id);
        $this->assertEquals($refund->id, $movement->saleRefund->id);
    }

    // INMUTABILIDAD DEL MODELO SaleRefund
    public function test_completed_refund_is_immutable(): void
    {
        $sale = $this->createSale(['total' => 50.00]);
        $detail = $sale->saleDetails->first();

        $res = $this->actingAs($this->owner)->postJson("/sales/{$sale->id}/refunds", [
            'items' => [['sale_detail_id' => $detail->id, 'quantity' => 1]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 10.00]],
        ]);
        $res->assertStatus(201);

        $refund = SaleRefund::find($res->json('id'));

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('inmutable');
        $refund->update(['notes' => 'Hack']);
    }
}
