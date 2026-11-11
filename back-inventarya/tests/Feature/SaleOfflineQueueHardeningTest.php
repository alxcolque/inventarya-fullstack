<?php

namespace Tests\Feature;

use App\Http\Controllers\SaleController;
use App\Models\Assignment;
use App\Models\CashRegisterSession;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SalePayment;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use App\Services\CashRegisterService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Tests para Endurecimiento de la Cola Offline (Fase 6B.4A)
 */
class SaleOfflineQueueHardeningTest extends TestCase
{
    private User $user;
    private Store $store;
    private CashRegisterSession $session;
    private Product $productA;
    private Product $productB;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.offline_queue_test' => [
                'driver'   => 'sqlite',
                'database' => ':memory:',
                'prefix'   => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'offline_queue_test',
        ]);
        DB::purge('offline_queue_test');

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

        Schema::create('stores', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('slug')->unique();
            $t->timestamps();
        });

        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email')->unique();
            $t->string('password');
            $t->string('role')->default('admin');
            $t->timestamps();
        });

        Schema::create('assignments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id');
            $t->uuid('store_id');
            $t->timestamps();
        });

        Schema::create('products', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('slug')->nullable();
            $t->string('sku')->nullable();
            $t->string('barcode')->nullable();
            $t->decimal('price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('inventory_stores', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->uuid('product_id');
            $t->decimal('price', 12, 2)->default(10.00);
            $t->decimal('sale_price', 12, 2)->default(10.00);
            $t->decimal('stock_quantity', 12, 2)->default(100.00);
            $t->timestamps();
        });

        Schema::create('cash_register_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id');
            $t->string('status')->default('open');
            $t->decimal('opening_amount', 12, 2)->default(0);
            $t->decimal('expected_amount', 12, 2)->default(0);
            $t->decimal('closing_amount', 12, 2)->nullable();
            $t->decimal('difference', 12, 2)->nullable();
            $t->timestamp('opened_at')->nullable();
            $t->timestamp('closed_at')->nullable();
            $t->foreignId('closed_by')->nullable();
            $t->timestamps();
        });

        Schema::create('cash_register_movements', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('cash_register_session_id');
            $t->foreignId('user_id');
            $t->string('type');
            $t->decimal('amount', 12, 2);
            $t->string('description')->nullable();
            $t->uuid('sale_refund_id')->nullable();
            $t->timestamps();
        });

        Schema::create('sales', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id');
            $t->unsignedBigInteger('customer_id')->default(0);
            $t->uuid('cash_register_session_id')->nullable();
            $t->decimal('total', 12, 2);
            $t->decimal('discount', 12, 2)->default(0);
            $t->string('payment_method')->default('efectivo');
            $t->string('status')->default('completed');
            $t->timestamp('order_date')->nullable();
            $t->timestamp('cancelled_at')->nullable();
            $t->foreignId('cancelled_by')->nullable();
            $t->text('cancellation_reason')->nullable();
            $t->uuid('cancellation_refund_id')->nullable();
            $t->timestamps();
        });

        Schema::create('sale_details', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->uuid('product_id');
            $t->decimal('quantity', 12, 2);
            $t->decimal('price', 12, 2);
            $t->decimal('subtotal', 12, 2);
            $t->timestamps();
        });

        Schema::create('sale_payments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->string('payment_method');
            $t->decimal('amount', 12, 2);
            $t->decimal('amount_received', 12, 2)->nullable();
            $t->decimal('change_amount', 12, 2)->nullable();
            $t->string('reference')->nullable();
            $t->timestamps();
        });

        Schema::create('electronic_invoices', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->string('status', 50)->default('pending');
            $t->timestamps();
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->id();
            $t->string('timezone')->default('America/La_Paz');
            $t->timestamps();
        });

        $this->store = Store::create([
            'id' => (string) Str::uuid(),
            'name' => 'Store Offline Test',
            'slug' => 'store-offline-test',
        ]);

        $this->user = User::create([
            'name' => 'Offline Worker',
            'email' => 'offline_worker@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);

        Assignment::create([
            'user_id' => $this->user->id,
            'store_id' => $this->store->id,
        ]);

        $this->session = CashRegisterSession::create([
            'id' => (string) Str::uuid(),
            'store_id' => $this->store->id,
            'user_id' => $this->user->id,
            'status' => 'open',
            'opened_at' => now(),
        ]);

        $this->productA = Product::create([
            'name' => 'Prod Offline A',
            'sku' => 'SKU-OFF-A',
        ]);

        $this->productB = Product::create([
            'name' => 'Prod Offline B',
            'sku' => 'SKU-OFF-B',
        ]);

        InventoryStore::create([
            'store_id' => $this->store->id,
            'product_id' => $this->productA->id,
            'price' => 10.00,
            'sale_price' => 10.00,
            'stock_quantity' => 5.00,
        ]);

        InventoryStore::create([
            'store_id' => $this->store->id,
            'product_id' => $this->productB->id,
            'price' => 20.00,
            'sale_price' => 20.00,
            'stock_quantity' => 10.00,
        ]);

        Gate::define('sales:create', fn () => true);
        Gate::define('pos:access', fn () => true);
        Gate::define('stores:view-all', fn () => true);
        Gate::define('sales:edit-price', fn () => false);

        Route::post('/test-offline/sales', [SaleController::class, 'store']);
    }

    /**
     * Test: Mismo UUID + Mismo Payload => 200 is_duplicate: true y code SALE_ALREADY_SYNCED
     */
    public function test_sale_idempotent_duplicate_same_payload_returns_200_and_code(): void
    {
        $this->actingAs($this->user);

        $uuid = (string) Str::uuid();
        $payload = [
            'id' => $uuid,
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completed',
            'payment_method' => 'efectivo',
            'total' => 20.00,
            'products' => [
                ['product_id' => $this->productA->id, 'quantity' => 2, 'price' => 10.00],
            ],
        ];

        // 1. Primer envío
        $res1 = $this->postJson('/test-offline/sales', $payload);
        $res1->assertStatus(201);
        $this->assertEquals($uuid, $res1->json('id'));

        // Stock A decrementado de 5 a 3
        $stock = InventoryStore::where('store_id', $this->store->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $this->assertEquals(3.00, (float) $stock);

        // 2. Reintento con exactamente el mismo UUID y payload
        $res2 = $this->postJson('/test-offline/sales', $payload);
        $res2->assertStatus(200);
        $this->assertTrue($res2->json('is_duplicate'));
        $this->assertEquals('SALE_ALREADY_SYNCED', $res2->json('code'));

        // Stock no se vuelve a decrementar
        $stock2 = InventoryStore::where('store_id', $this->store->id)->where('product_id', $this->productA->id)->value('stock_quantity');
        $this->assertEquals(3.00, (float) $stock2);
    }

    /**
     * Test: Mismo UUID + Payload Diferente (otra sucursal o productos distintos) => 409 SALE_IDEMPOTENCY_CONFLICT
     */
    public function test_sale_idempotency_conflict_different_payload_returns_409(): void
    {
        $this->actingAs($this->user);

        $uuid = (string) Str::uuid();
        $payloadOriginal = [
            'id' => $uuid,
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completed',
            'payment_method' => 'efectivo',
            'total' => 10.00,
            'products' => [
                ['product_id' => $this->productA->id, 'quantity' => 1, 'price' => 10.00],
            ],
        ];

        $res1 = $this->postJson('/test-offline/sales', $payloadOriginal);
        $res1->assertStatus(201);

        // Reintento con MISMO UUID pero producto diferente (Prod B en vez de Prod A)
        $payloadConflicto = [
            'id' => $uuid,
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completed',
            'payment_method' => 'efectivo',
            'total' => 20.00,
            'products' => [
                ['product_id' => $this->productB->id, 'quantity' => 1, 'price' => 20.00],
            ],
        ];

        $res2 = $this->postJson('/test-offline/sales', $payloadConflicto);
        $res2->assertStatus(409);
        $this->assertEquals('SALE_IDEMPOTENCY_CONFLICT', $res2->json('code'));

        // Reintento con MISMO UUID pero cantidad diferente
        $payloadConflictoQty = [
            'id' => $uuid,
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completed',
            'payment_method' => 'efectivo',
            'total' => 30.00,
            'products' => [
                ['product_id' => $this->productA->id, 'quantity' => 3, 'price' => 10.00],
            ],
        ];

        $res3 = $this->postJson('/test-offline/sales', $payloadConflictoQty);
        $res3->assertStatus(409);
        $this->assertEquals('SALE_IDEMPOTENCY_CONFLICT', $res3->json('code'));
    }

    /**
     * Test: Stock Insuficiente en Backend => 400 y código STOCK_INSUFFICIENT
     */
    public function test_sale_stock_insufficient_returns_400_and_code(): void
    {
        $this->actingAs($this->user);

        // Stock disponible para A es 5.00
        $uuid = (string) Str::uuid();
        $payload = [
            'id' => $uuid,
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completed',
            'payment_method' => 'efectivo',
            'total' => 100.00,
            'products' => [
                ['product_id' => $this->productA->id, 'quantity' => 10, 'price' => 10.00],
            ],
        ];

        $res = $this->postJson('/test-offline/sales', $payload);
        $res->assertStatus(400);
        $this->assertEquals('STOCK_INSUFFICIENT', $res->json('code'));
        $this->assertStringContainsString('Stock insuficiente', $res->json('message'));

        // No se creó venta
        $this->assertNull(Sale::find($uuid));
    }
}
