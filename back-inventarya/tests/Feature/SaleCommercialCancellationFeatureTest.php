<?php

namespace Tests\Feature;

use App\Http\Controllers\CashRegisterController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\SaleDetailController;
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
use App\Services\SaleRefundService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Suite Integral de Pruebas de Cancelación Comercial — Fase 6B.3D
 */
class SaleCommercialCancellationFeatureTest extends TestCase
{
    private User $owner;
    private User $staffStoreA;
    private User $staffStoreB;
    private Store $storeA;
    private Store $storeB;
    private Product $productA;
    private Product $productB;
    private CashRegisterSession $sessionStoreA;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.cancel_test' => [
                'driver'   => 'sqlite',
                'database' => ':memory:',
                'prefix'   => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'cancel_test',
        ]);
        DB::purge('cancel_test');

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
            $t->string('address')->nullable();
            $t->string('phone')->nullable();
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
            $t->string('barcode')->nullable();
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
            $t->timestamp('cancelled_at')->nullable();
            $t->foreignId('cancelled_by')->nullable();
            $t->string('cancellation_reason', 255)->nullable();
            $t->uuid('cancellation_refund_id')->nullable();
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
            $t->string('cufd', 255)->nullable();
            $t->integer('invoice_number')->default(1);
            $t->string('status', 50)->default('accepted');
            $t->decimal('total', 15, 2)->default(0);
            $t->timestamps();
        });

        Route::post('/sales/{sale}/cancel', [SaleController::class, 'cancel']);
        Route::get('/sales/total-sales-today', [SaleController::class, 'totalSalesToday']);
        Route::put('/sales/{sale}', [SaleController::class, 'update']);
        Route::delete('/sales/{sale}', [SaleController::class, 'destroy']);

        Route::post('/sales/{sale}/refunds', [SaleRefundController::class, 'store']);
        Route::get('/sales/{sale}/refundable', [SaleRefundController::class, 'refundable']);

        Route::apiResource('/sale-details', SaleDetailController::class);
        Route::get('/cash-register/{session}/summary', [CashRegisterController::class, 'summary']);

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
            'id'    => (string) Str::uuid(),
            'name'  => 'Producto A',
            'sku'   => 'SKU-A',
            'price' => 10.00,
        ]);
        $this->productB = Product::create([
            'id'    => (string) Str::uuid(),
            'name'  => 'Producto B',
            'sku'   => 'SKU-B',
            'price' => 20.00,
        ]);

        InventoryStore::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'product_id'     => $this->productA->id,
            'stock_quantity' => 100,
            'price'          => 10.00,
            'sale_price'     => 10.00,
        ]);

        InventoryStore::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'product_id'     => $this->productB->id,
            'stock_quantity' => 50,
            'price'          => 20.00,
            'sale_price'     => 20.00,
        ]);

        $this->sessionStoreA = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'status'         => 'open',
            'opening_amount' => 100.00,
            'opened_at'      => now(),
        ]);

        $this->actingAs($this->owner);
    }

    /**
     * Escenario A (Sección 37): Cancelación Simple
     */
    public function test_a_simple_cancellation(): void
    {
        $sale = Sale::create([
            'id'                       => (string) Str::uuid(),
            'store_id'                 => $this->storeA->id,
            'user_id'                  => $this->owner->id,
            'cash_register_session_id' => $this->sessionStoreA->id,
            'total'                    => 20.0,
            'discount'                 => 0.0,
            'payment_method'           => 'efectivo',
            'status'                   => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 2.0,
            'price'      => 10.0,
            'subtotal'   => 20.0,
        ]);

        SalePayment::create([
            'id'             => (string) Str::uuid(),
            'sale_id'        => $sale->id,
            'payment_method' => 'efectivo',
            'amount'         => 20.0,
        ]);

        // Stock antes de cancelar = 100
        $invA = InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->first();
        $this->assertEquals(100.0, (float) $invA->stock_quantity);

        $cancelUuid = (string) Str::uuid();
        $response = $this->postJson("/sales/{$sale->id}/cancel", [
            'id'     => $cancelUuid,
            'reason' => 'Error de registro en caja',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('status', 'cancelled');
        $response->assertJsonPath('cancellation_reason', 'Error de registro en caja');
        $response->assertJsonPath('cancellation_refund_id', $cancelUuid);

        // Validar Sale inmutable excepto status y campos de auditoría
        $sale->refresh();
        $this->assertEquals('cancelled', $sale->status);
        $this->assertEquals(20.0, (float) $sale->total);
        $this->assertNotNull($sale->cancelled_at);
        $this->assertEquals($this->owner->id, $sale->cancelled_by);
        $this->assertEquals($cancelUuid, $sale->cancellation_refund_id);

        // Validar SaleRefund compensatorio
        $refund = SaleRefund::where('sale_id', $sale->id)->first();
        $this->assertNotNull($refund);
        $this->assertEquals('completed', $refund->status);
        $this->assertEquals(20.0, (float) $refund->total);

        // Validar RefundItem
        $this->assertCount(1, $refund->items);
        $this->assertEquals(2.0, (float) $refund->items->first()->quantity);

        // Validar RefundPayment
        $this->assertCount(1, $refund->payments);
        $this->assertEquals('efectivo', $refund->payments->first()->payment_method);
        $this->assertEquals(20.0, (float) $refund->payments->first()->amount);

        // Validar Stock restaurado: 100 + 2 = 102
        $invA->refresh();
        $this->assertEquals(102.0, (float) $invA->stock_quantity);

        // Validar CashMovement
        $movement = CashRegisterMovement::where('sale_refund_id', $refund->id)->first();
        $this->assertNotNull($movement);
        $this->assertEquals('expense', $movement->type);
        $this->assertEquals(20.0, (float) $movement->amount);
    }

    /**
     * Escenario B (Sección 38): Pagos Mixtos
     */
    public function test_b_mixed_payments_cancellation(): void
    {
        $sale = Sale::create([
            'id'                       => (string) Str::uuid(),
            'store_id'                 => $this->storeA->id,
            'user_id'                  => $this->owner->id,
            'cash_register_session_id' => $this->sessionStoreA->id,
            'total'                    => 100.0,
            'discount'                 => 0.0,
            'payment_method'           => 'mixto',
            'status'                   => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 10.0,
            'price'      => 10.0,
            'subtotal'   => 100.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 30.0]);
        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'qr', 'amount' => 50.0]);
        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'tarjeta', 'amount' => 20.0]);

        $response = $this->postJson("/sales/{$sale->id}/cancel", [
            'reason' => 'Cancelación pagos mixtos',
        ]);

        $response->assertStatus(201);

        $refund = SaleRefund::where('sale_id', $sale->id)->first();
        $this->assertNotNull($refund);

        $payMap = $refund->payments->pluck('amount', 'payment_method')->toArray();
        $this->assertEquals(30.0, (float) $payMap['efectivo']);
        $this->assertEquals(50.0, (float) $payMap['qr']);
        $this->assertEquals(20.0, (float) $payMap['tarjeta']);

        // Stock 100% restaurado: 100 + 10 = 110
        $invA = InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->first();
        $this->assertEquals(110.0, (float) $invA->stock_quantity);

        // Movimiento de caja SOLO por la porción de efectivo (30, NO 100)
        $movements = CashRegisterMovement::where('sale_refund_id', $refund->id)->get();
        $this->assertCount(1, $movements);
        $this->assertEquals(30.0, (float) $movements->first()->amount);
        $this->assertEquals('expense', $movements->first()->type);
    }

    /**
     * Escenario C (Sección 39): QR sin Caja Abierta
     */
    public function test_c_qr_cancellation_without_cash_session(): void
    {
        // Cerrar la caja abierta
        $this->sessionStoreA->update(['status' => 'closed']);

        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 100.0,
            'payment_method' => 'qr',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 10.0,
            'price'      => 10.0,
            'subtotal'   => 100.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'qr', 'amount' => 100.0]);

        $response = $this->postJson("/sales/{$sale->id}/cancel");

        $response->assertStatus(201);
        $sale->refresh();
        $this->assertEquals('cancelled', $sale->status);

        $invA = InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->first();
        $this->assertEquals(110.0, (float) $invA->stock_quantity);

        $this->assertEquals(0, CashRegisterMovement::whereHas('refund', fn ($q) => $q->where('sale_id', $sale->id))->count());
    }

    /**
     * Escenario D (Sección 40): Efectivo sin Caja Abierta Falla
     */
    public function test_d_cash_cancellation_without_open_session_fails_and_rolls_back(): void
    {
        // Cerrar la caja abierta
        $this->sessionStoreA->update(['status' => 'closed']);

        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 100.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 10.0,
            'price'      => 10.0,
            'subtotal'   => 100.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 100.0]);

        $response = $this->postJson("/sales/{$sale->id}/cancel");

        $response->assertStatus(422);

        // Estado intacto
        $sale->refresh();
        $this->assertEquals('completed', $sale->status);
        $this->assertNull($sale->cancellation_refund_id);
        $this->assertEquals(0, SaleRefund::where('sale_id', $sale->id)->count());

        $invA = InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->first();
        $this->assertEquals(100.0, (float) $invA->stock_quantity);
    }

    /**
     * Escenario E (Sección 41): Caja Original Cerrada, Nueva Caja Abierta
     */
    public function test_e_cancellation_uses_current_open_session_when_original_is_closed(): void
    {
        $sessionA = $this->sessionStoreA;
        $sessionA->update(['status' => 'closed']);

        $sessionB = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'status'         => 'open',
            'opening_amount' => 200.0,
            'opened_at'      => now(),
        ]);

        $sale = Sale::create([
            'id'                       => (string) Str::uuid(),
            'store_id'                 => $this->storeA->id,
            'user_id'                  => $this->owner->id,
            'cash_register_session_id' => $sessionA->id,
            'total'                    => 50.0,
            'payment_method'           => 'efectivo',
            'status'                   => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 5.0,
            'price'      => 10.0,
            'subtotal'   => 50.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 50.0]);

        $response = $this->postJson("/sales/{$sale->id}/cancel");
        $response->assertStatus(201);

        // Movimiento debe haberse registrado en Session B
        $movement = CashRegisterMovement::where('cash_register_session_id', $sessionB->id)->first();
        $this->assertNotNull($movement);
        $this->assertEquals(50.0, (float) $movement->amount);

        // Session A permanece inmutable
        $this->assertEquals(0, CashRegisterMovement::where('cash_register_session_id', $sessionA->id)->count());
    }

    /**
     * Escenario F (Sección 42): Rechazar Cancelación si Posee Refunds Previos
     */
    public function test_f_previous_refund_protection_rejects_cancellation(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 50.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $detail = SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 5.0,
            'price'      => 10.0,
            'subtotal'   => 50.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 50.0]);

        // Registrar una devolución parcial previa de 2 unidades
        app(SaleRefundService::class)->processRefund($sale, [
            'items'    => [['sale_detail_id' => $detail->id, 'quantity' => 2.0]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 20.0]],
        ], $this->owner);

        $this->assertEquals(1, SaleRefund::where('sale_id', $sale->id)->count());

        // Intentar cancelar la venta
        $response = $this->postJson("/sales/{$sale->id}/cancel");

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['sale']);
        $this->assertStringContainsString('La venta posee devoluciones previas', $response->json('message'));

        $sale->refresh();
        $this->assertNotEquals('cancelled', $sale->status);
        $this->assertNull($sale->cancellation_refund_id);
    }

    /**
     * Escenario G (Sección 43): Venta Totalmente Devuelta No Puede Cancelarse
     */
    public function test_g_fully_refunded_sale_cannot_be_cancelled(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 10.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $detail = SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 1.0,
            'price'      => 10.0,
            'subtotal'   => 10.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 10.0]);

        // Devolución total por flujo de refund
        app(SaleRefundService::class)->processRefund($sale, [
            'items'    => [['sale_detail_id' => $detail->id, 'quantity' => 1.0]],
            'payments' => [['payment_method' => 'efectivo', 'amount' => 10.0]],
        ], $this->owner);

        $response = $this->postJson("/sales/{$sale->id}/cancel");
        $response->assertStatus(422);

        $sale->refresh();
        $this->assertNotEquals('cancelled', $sale->status);
    }

    /**
     * Escenario H (Sección 44): Doble Cancelación con Distinto UUID
     */
    public function test_h_double_cancellation_with_different_uuid_rejected(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 10.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 1.0,
            'price'      => 10.0,
            'subtotal'   => 10.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 10.0]);

        $uuidA = (string) Str::uuid();
        $uuidB = (string) Str::uuid();

        $resA = $this->postJson("/sales/{$sale->id}/cancel", ['id' => $uuidA]);
        $resA->assertStatus(201);

        $resB = $this->postJson("/sales/{$sale->id}/cancel", ['id' => $uuidB]);
        $resB->assertStatus(422);
        $this->assertStringContainsString('ya se encuentra cancelada', $resB->json('message'));

        $this->assertEquals(1, SaleRefund::where('sale_id', $sale->id)->count());
        $this->assertEquals(1, CashRegisterMovement::whereHas('refund', fn ($q) => $q->where('sale_id', $sale->id))->count());
    }

    /**
     * Escenario I (Sección 45): Idempotencia con Mismo UUID y Payload
     */
    public function test_i_idempotency_returns_existing_record_without_duplicate_effects(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 20.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 2.0,
            'price'      => 10.0,
            'subtotal'   => 20.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 20.0]);

        $uuidA = (string) Str::uuid();
        $payload = ['id' => $uuidA, 'reason' => 'Error de registro'];

        // Request 1
        $res1 = $this->postJson("/sales/{$sale->id}/cancel", $payload);
        $res1->assertStatus(201);
        $this->assertFalse($res1->json('is_duplicate'));

        // Request 2 (Retry idéntico)
        $res2 = $this->postJson("/sales/{$sale->id}/cancel", $payload);
        $res2->assertStatus(200);
        $this->assertTrue($res2->json('is_duplicate'));

        // Efectos NO duplicados
        $this->assertEquals(1, SaleRefund::where('sale_id', $sale->id)->count());
        $this->assertEquals(1, CashRegisterMovement::whereHas('refund', fn ($q) => $q->where('sale_id', $sale->id))->count());
    }

    /**
     * Escenario J (Sección 46): Reutilizar UUID con Distinto Payload da 409
     */
    public function test_j_uuid_conflict_with_different_payload_returns_409(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 20.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 2.0,
            'price'      => 10.0,
            'subtotal'   => 20.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 20.0]);

        $uuidA = (string) Str::uuid();

        $res1 = $this->postJson("/sales/{$sale->id}/cancel", ['id' => $uuidA, 'reason' => 'Error de registro']);
        $res1->assertStatus(201);

        $res2 = $this->postJson("/sales/{$sale->id}/cancel", ['id' => $uuidA, 'reason' => 'Otro motivo totalmente distinto']);
        $res2->assertStatus(409);
    }

    /**
     * Escenario M (Sección 49): Protección contra DELETE Físico de Sales Finalizadas
     */
    public function test_m_physical_delete_of_finalized_sale_is_blocked(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 50.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $res = $this->deleteJson("/sales/{$sale->id}");
        $res->assertStatus(422);

        $this->assertDatabaseHas('sales', ['id' => $sale->id]);
    }

    /**
     * Escenario N (Sección 50): Protección contra UPDATE/PATCH Genérico de Sales Finalizadas
     */
    public function test_n_update_of_finalized_sale_is_blocked(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 50.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $res = $this->putJson("/sales/{$sale->id}", [
            'total'          => 10.0,
            'payment_method' => 'qr',
            'store_id'       => $this->storeA->id,
            'products'       => [],
        ]);

        $res->assertStatus(422);
        $sale->refresh();
        $this->assertEquals(50.0, (float) $sale->total);
        $this->assertEquals('efectivo', $sale->payment_method);
    }

    /**
     * Escenario O (Sección 51): Mutaciones de SaleDetail en Venta Finalizada Bloqueadas
     */
    public function test_o_sale_detail_mutations_blocked_on_finalized_sale(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 10.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $detail = SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 1.0,
            'price'      => 10.0,
            'subtotal'   => 10.0,
        ]);

        // Intentar agregar detalle
        $resStore = $this->postJson("/sale-details", [
            'sale_id'    => $sale->id,
            'product_id' => $this->productB->id,
            'quantity'   => 1.0,
            'price'      => 20.0,
            'subtotal'   => 20.0,
        ]);
        $resStore->assertStatus(422);

        // Intentar actualizar detalle
        $resUpdate = $this->putJson("/sale-details/{$detail->id}", [
            'quantity' => 5.0,
        ]);
        $resUpdate->assertStatus(422);

        // Intentar eliminar detalle
        $resDestroy = $this->deleteJson("/sale-details/{$detail->id}");
        $resDestroy->assertStatus(422);

        $this->assertDatabaseHas('sale_details', ['id' => $detail->id]);
    }

    /**
     * Escenario P (Sección 52): Integridad Contable en Reportes y Caja (Sin Doble Resta)
     */
    public function test_p_reporting_and_cash_summary_integrity(): void
    {
        $sale = Sale::create([
            'id'                       => (string) Str::uuid(),
            'store_id'                 => $this->storeA->id,
            'user_id'                  => $this->owner->id,
            'cash_register_session_id' => $this->sessionStoreA->id,
            'total'                    => 80.0,
            'discount'                 => 0.0,
            'payment_method'           => 'efectivo',
            'status'                   => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 8.0,
            'price'      => 10.0,
            'subtotal'   => 80.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 80.0]);

        // Cancelar venta
        $this->postJson("/sales/{$sale->id}/cancel")->assertStatus(201);

        // 1. Verificar totalSalesToday
        $resToday = $this->getJson('/sales/total-sales-today');
        $resToday->assertOk();
        $this->assertEquals(80.0, (float) $resToday->json('gross_sales'));
        $this->assertEquals(80.0, (float) $resToday->json('refunds'));
        $this->assertEquals(0.0, (float) $resToday->json('net_sales'));

        // 2. Verificar resumen de caja
        $resCash = $this->getJson("/cash-register/{$this->sessionStoreA->id}/summary");
        $resCash->assertOk();
        $this->assertEquals('80.00', $resCash->json('sales.cash'));
        $this->assertEquals('80.00', $resCash->json('movements.expense'));
        // expected_cash = opening (100.00) + cash sales (80.00) - expense (80.00) = 100.00
        $this->assertEquals('100.00', $resCash->json('expected_cash'));
    }

    /**
     * Escenario Q (Sección 53): Desacoplamiento Fiscal SIAT (Factura Electrónica Intacta)
     */
    public function test_q_siat_electronic_invoice_remains_intact_and_accepted(): void
    {
        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 50.0,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 5.0,
            'price'      => 10.0,
            'subtotal'   => 50.0,
        ]);

        SalePayment::create(['id' => (string) Str::uuid(), 'sale_id' => $sale->id, 'payment_method' => 'efectivo', 'amount' => 50.0]);

        $invoice = ElectronicInvoice::create([
            'id'             => (string) Str::uuid(),
            'sale_id'        => $sale->id,
            'invoice_number' => 99999,
            'cuf'            => 'CUF-TEST-ORIGINAL-999',
            'cufd'           => 'CUFD-TEST-999',
            'status'         => 'accepted',
            'total'          => 50.0,
        ]);

        $response = $this->postJson("/sales/{$sale->id}/cancel");
        $response->assertStatus(201);
        $response->assertJsonPath('has_electronic_invoice', true);
        $response->assertJsonPath('fiscal_action_performed', false);

        $sale->refresh();
        $this->assertEquals('cancelled', $sale->status);

        $invoice->refresh();
        $invStatus = $invoice->status instanceof \App\Enums\ElectronicInvoiceStatus ? $invoice->status->value : (string) $invoice->status;
        $this->assertEquals('accepted', $invStatus);
        $this->assertEquals('CUF-TEST-ORIGINAL-999', $invoice->cuf);
    }

    /**
     * Escenario R (Sección 54): Aislamiento Multi-Store
     */
    public function test_r_multi_store_isolation_rejects_unauthorized_store_staff(): void
    {
        // Venta en Store B
        $saleStoreB = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeB->id,
            'user_id'        => $this->owner->id,
            'total'          => 30.0,
            'payment_method' => 'qr',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $saleStoreB->id,
            'product_id' => $this->productA->id,
            'quantity'   => 3.0,
            'price'      => 10.0,
            'subtotal'   => 30.0,
        ]);

        // Staff Store A intenta cancelar venta de Store B
        $res = $this->actingAs($this->staffStoreA)->postJson("/sales/{$saleStoreB->id}/cancel");
        $res->assertStatus(403);
    }

    /**
     * Escenario S (Sección 55): Permisos de Cancelación
     */
    public function test_s_permissions_sales_cancel_enforced(): void
    {
        $staffWithoutCancel = User::create([
            'name'     => 'Staff No Cancel',
            'email'    => 'staff_nocancel@test.com',
            'password' => bcrypt('password'),
            'role'     => 'staff',
        ]);

        Assignment::create([
            'user_id'  => $staffWithoutCancel->id,
            'store_id' => $this->storeA->id,
        ]);

        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->owner->id,
            'total'          => 20.0,
            'payment_method' => 'qr',
            'status'         => 'completed',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $this->productA->id,
            'quantity'   => 2.0,
            'price'      => 10.0,
            'subtotal'   => 20.0,
        ]);

        // Staff sin sales:cancel
        $res = $this->actingAs($staffWithoutCancel)->postJson("/sales/{$sale->id}/cancel");
        $res->assertStatus(403);

        // Admin con sales:cancel
        $admin = User::create([
            'name'     => 'Admin Cancel',
            'email'    => 'admin_cancel@test.com',
            'password' => bcrypt('password'),
            'role'     => 'admin',
        ]);

        Assignment::create([
            'user_id'  => $admin->id,
            'store_id' => $this->storeA->id,
        ]);

        $resAdmin = $this->actingAs($admin)->postJson("/sales/{$sale->id}/cancel");
        $resAdmin->assertStatus(201);
    }
}
