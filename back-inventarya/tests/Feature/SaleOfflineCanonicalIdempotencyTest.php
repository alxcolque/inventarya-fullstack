<?php

namespace Tests\Feature;

use App\Http\Controllers\SaleController;
use App\Models\Assignment;
use App\Models\CashRegisterSession;
use App\Models\Customer;
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
 * Tests para Idempotencia Canónica y Reconciliación Autoritativa (Fase 6B.4B)
 */
class SaleOfflineCanonicalIdempotencyTest extends TestCase
{
    private User $user;
    private Store $storeA;
    private Store $storeB;
    private CashRegisterSession $sessionA;
    private CashRegisterSession $sessionB;
    private Product $productA;
    private Product $productB;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.canonical_idempotency_test' => [
                'driver'   => 'sqlite',
                'database' => ':memory:',
                'prefix'   => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'canonical_idempotency_test',
        ]);
        DB::purge('canonical_idempotency_test');

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
            $t->text('description')->nullable();
            $t->foreignId('category_id')->nullable();
            $t->foreignId('brand_id')->nullable();
            $t->decimal('cost_price', 12, 2)->default(0);
            $t->decimal('sale_price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('inventory_stores', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->uuid('product_id');
            $t->decimal('stock_quantity', 12, 2)->default(0);
            $t->decimal('price', 12, 2)->default(0);
            $t->decimal('sale_price', 12, 2)->default(0);
            $t->decimal('cost_price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('cash_register_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id');
            $t->decimal('opening_amount', 12, 2)->default(0);
            $t->decimal('closing_amount', 12, 2)->nullable();
            $t->decimal('expected_amount', 12, 2)->nullable();
            $t->decimal('difference', 12, 2)->nullable();
            $t->string('status')->default('open');
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
            $t->text('notes')->nullable();
            $t->timestamps();
        });

        Schema::create('sales', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id');
            $t->foreignId('customer_id')->default(0);
            $t->decimal('total', 12, 2);
            $t->decimal('discount', 12, 2)->default(0);
            $t->string('payment_method')->default('efectivo');
            $t->string('status')->default('completed');
            $t->uuid('cash_register_session_id')->nullable();
            $t->string('observation')->nullable();
            $t->timestamp('order_date')->nullable();
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
            $t->string('key')->unique();
            $t->text('value')->nullable();
            $t->timestamps();
        });

        $this->user = User::create([
            'name'     => 'Alex Colque',
            'email'    => 'alex@test.com',
            'password' => bcrypt('password'),
            'role'     => 'owner',
        ]);

        Gate::define('sales:create', fn () => true);
        Gate::define('sales:edit-price', fn () => false);
        Gate::define('pos:access', fn () => true);
        Gate::define('stores:view-all', fn () => true);

        $this->storeA = Store::create(['id' => (string) Str::uuid(), 'name' => 'Sucursal Central', 'slug' => 'sucursal-central']);
        $this->storeB = Store::create(['id' => (string) Str::uuid(), 'name' => 'Sucursal Norte', 'slug' => 'sucursal-norte']);

        $this->sessionA = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->user->id,
            'opening_amount' => 100.00,
            'status'         => 'open',
            'opened_at'      => now(),
        ]);

        $this->sessionB = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeB->id,
            'user_id'        => $this->user->id,
            'opening_amount' => 100.00,
            'status'         => 'open',
            'opened_at'      => now(),
        ]);

        $this->productA = Product::create([
            'id'         => (string) Str::uuid(),
            'name'       => 'Teclado Mecánico',
            'sku'        => 'TEC-MEC-01',
            'sale_price' => 50.00,
        ]);

        $this->productB = Product::create([
            'id'         => (string) Str::uuid(),
            'name'       => 'Mouse Gamer',
            'sku'        => 'MOU-GAM-02',
            'sale_price' => 30.00,
        ]);

        InventoryStore::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'product_id'     => $this->productA->id,
            'stock_quantity' => 10.00,
            'sale_price'     => 50.00,
        ]);

        InventoryStore::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'product_id'     => $this->productB->id,
            'stock_quantity' => 15.00,
            'sale_price'     => 30.00,
        ]);

        Route::post('/test/sales', [SaleController::class, 'store']);
    }

    private function basePayload(array $overrides = []): array
    {
        return array_merge([
            'store_id'                 => $this->storeA->id,
            'cash_register_session_id' => $this->sessionA->id,
            'status'                   => 'completed',
            'products'                 => [
                ['product_id' => $this->productA->id, 'quantity' => 1],
            ],
            'payment_method'           => 'efectivo',
            'amount_received'          => 50.00,
            'total'                    => 50.00,
            'discount'                 => 0.00,
        ], $overrides);
    }

    public function test_same_uuid_same_payload_returns_200_and_authoritative_stock(): void
    {
        $uuid = (string) Str::uuid();

        $payload = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 2],
            ],
            'amount_received' => 100.00,
            'total'           => 100.00,
        ]);

        // 1. Envío inicial (201 Created)
        $res1 = $this->actingAs($this->user)->postJson('/test/sales', $payload);
        $res1->assertStatus(201);
        $res1->assertJsonPath('is_duplicate', false);
        $res1->assertJsonPath('code', null);
        $this->assertCount(1, $res1->json('affected_products'));
        $this->assertEquals(8.00, $res1->json('affected_products.0.stock_quantity'));

        // Stock en BD decrementado a 8
        $invA = InventoryStore::where('store_id', $this->storeA->id)->where('product_id', $this->productA->id)->first();
        $this->assertEquals(8.00, (float) $invA->stock_quantity);

        // 2. Reintento idéntico (Respuesta perdida / Retry): 200 SALE_ALREADY_SYNCED
        $res2 = $this->actingAs($this->user)->postJson('/test/sales', $payload);
        $res2->assertStatus(200);
        $res2->assertJsonPath('is_duplicate', true);
        $res2->assertJsonPath('code', 'SALE_ALREADY_SYNCED');
        $this->assertCount(1, $res2->json('affected_products'));
        $this->assertEquals(8.00, $res2->json('affected_products.0.stock_quantity'));

        // El stock NO se decrementó nuevamente (invariante: decrementado exactamente una vez)
        $invA->refresh();
        $this->assertEquals(8.00, (float) $invA->stock_quantity);

        // Solo 1 venta y 1 registro de pago en BD
        $this->assertEquals(1, Sale::where('id', $uuid)->count());
        $this->assertEquals(1, SalePayment::where('sale_id', $uuid)->count());
    }

    public function test_reordered_product_lines_normalized_and_accepted_as_synced(): void
    {
        $uuid = (string) Str::uuid();

        // Envío inicial: ProdA x 1, ProdB x 1
        $payload1 = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 1],
                ['product_id' => $this->productB->id, 'quantity' => 1],
            ],
            'amount_received' => 80.00,
            'total'           => 80.00,
        ]);

        $res1 = $this->actingAs($this->user)->postJson('/test/sales', $payload1);
        $res1->assertStatus(201);

        // Retry con líneas invertidas: ProdB x 1, ProdA x 1
        $payload2 = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productB->id, 'quantity' => 1],
                ['product_id' => $this->productA->id, 'quantity' => 1],
            ],
            'amount_received' => 80.00,
            'total'           => 80.00,
        ]);

        $res2 = $this->actingAs($this->user)->postJson('/test/sales', $payload2);
        $res2->assertStatus(200);
        $res2->assertJsonPath('code', 'SALE_ALREADY_SYNCED');
    }

    public function test_consolidated_product_lines_normalized_and_accepted(): void
    {
        $uuid = (string) Str::uuid();

        // Envío inicial: ProdA x 2 (50 x 2 = 100)
        $payload1 = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 2],
            ],
            'amount_received' => 100.00,
            'total'           => 100.00,
        ]);

        $this->actingAs($this->user)->postJson('/test/sales', $payload1)->assertStatus(201);

        // Retry con dos líneas de 1 unidad que consolidan 2 unidades
        $payload2 = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 1],
                ['product_id' => $this->productA->id, 'quantity' => 1],
            ],
            'amount_received' => 100.00,
            'total'           => 100.00,
        ]);

        $res2 = $this->actingAs($this->user)->postJson('/test/sales', $payload2);
        $res2->assertStatus(200);
        $res2->assertJsonPath('code', 'SALE_ALREADY_SYNCED');
    }

    public function test_conflict_on_different_products(): void
    {
        $uuid = (string) Str::uuid();

        $payload1 = $this->basePayload([
            'id'       => $uuid,
            'products' => [
                ['product_id' => $this->productA->id, 'quantity' => 1],
            ],
        ]);
        $this->actingAs($this->user)->postJson('/test/sales', $payload1)->assertStatus(201);

        $payloadConflict = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productB->id, 'quantity' => 1],
            ],
            'amount_received' => 30.00,
            'total'           => 30.00,
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payloadConflict);
        $res->assertStatus(409);
        $res->assertJsonPath('code', 'SALE_IDEMPOTENCY_CONFLICT');
    }

    public function test_conflict_on_different_quantities(): void
    {
        $uuid = (string) Str::uuid();

        $payload1 = $this->basePayload([
            'id'       => $uuid,
            'products' => [
                ['product_id' => $this->productA->id, 'quantity' => 1],
            ],
        ]);
        $this->actingAs($this->user)->postJson('/test/sales', $payload1)->assertStatus(201);

        $payloadConflict = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 2],
            ],
            'amount_received' => 100.00,
            'total'           => 100.00,
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payloadConflict);
        $res->assertStatus(409);
        $res->assertJsonPath('code', 'SALE_IDEMPOTENCY_CONFLICT');
    }

    public function test_conflict_on_different_discount(): void
    {
        $uuid = (string) Str::uuid();

        $payload1 = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 2], // 100 subtotal
            ],
            'discount'        => 10.00,
            'amount_received' => 90.00,
            'total'           => 90.00,
        ]);
        $this->actingAs($this->user)->postJson('/test/sales', $payload1)->assertStatus(201);

        // Retry con descuento 0 y total diferente
        $payloadConflict = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 2],
            ],
            'discount'        => 0.00,
            'amount_received' => 100.00,
            'total'           => 100.00,
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payloadConflict);
        $res->assertStatus(409);
        $res->assertJsonPath('code', 'SALE_IDEMPOTENCY_CONFLICT');
    }

    public function test_conflict_on_different_payment_breakdown(): void
    {
        $uuid = (string) Str::uuid();

        // Venta inicial con pago mixto: 50 efectivo + 50 qr = 100
        $payload1 = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 2],
            ],
            'payment_method'  => null,
            'payments'        => [
                ['payment_method' => 'efectivo', 'amount' => 50.00, 'amount_received' => 50.00],
                ['payment_method' => 'qr', 'amount' => 50.00],
            ],
            'amount_received' => null,
            'total'           => 100.00,
        ]);
        $this->actingAs($this->user)->postJson('/test/sales', $payload1)->assertStatus(201);

        // Retry con desglose de pagos diferente: 100 efectivo
        $payloadConflict = $this->basePayload([
            'id'              => $uuid,
            'products'        => [
                ['product_id' => $this->productA->id, 'quantity' => 2],
            ],
            'payment_method'  => null,
            'payments'        => [
                ['payment_method' => 'efectivo', 'amount' => 100.00, 'amount_received' => 100.00],
            ],
            'amount_received' => null,
            'total'           => 100.00,
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payloadConflict);
        $res->assertStatus(409);
        $res->assertJsonPath('code', 'SALE_IDEMPOTENCY_CONFLICT');
    }

    public function test_conflict_on_different_commercial_customer(): void
    {
        $c1 = Customer::create(['name' => 'Cliente Uno', 'phone' => '70000001']);
        $c2 = Customer::create(['name' => 'Cliente Dos', 'phone' => '70000002']);

        $uuid = (string) Str::uuid();

        $payload1 = $this->basePayload([
            'id'          => $uuid,
            'customer_id' => $c1->id,
        ]);
        $this->actingAs($this->user)->postJson('/test/sales', $payload1)->assertStatus(201);

        $payloadConflict = $this->basePayload([
            'id'          => $uuid,
            'customer_id' => $c2->id,
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payloadConflict);
        $res->assertStatus(409);
        $res->assertJsonPath('code', 'SALE_IDEMPOTENCY_CONFLICT');
    }

    public function test_cash_register_closed_returns_structured_code_and_no_reassignment(): void
    {
        // Crear una sesión y cerrarla inmediatamente
        $closedSession = CashRegisterSession::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->storeA->id,
            'user_id'        => $this->user->id,
            'opening_amount' => 50.00,
            'status'         => 'closed',
            'closed_at'      => now(),
        ]);

        $uuid = (string) Str::uuid();
        $payload = $this->basePayload([
            'id'                       => $uuid,
            'cash_register_session_id' => $closedSession->id,
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payload);
        $res->assertStatus(422);
        $res->assertJsonPath('code', 'CASH_REGISTER_CLOSED');

        // La venta NO fue creada y NO fue reasignada a sessionA que está abierta
        $this->assertEquals(0, Sale::where('id', $uuid)->count());
    }

    public function test_cash_register_store_mismatch_returns_structured_code(): void
    {
        // Intentar registrar en storeA usando sesión de storeB
        $uuid = (string) Str::uuid();
        $payload = $this->basePayload([
            'id'                       => $uuid,
            'cash_register_session_id' => $this->sessionB->id,
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payload);
        $res->assertStatus(422);
        $res->assertJsonPath('code', 'CASH_REGISTER_STORE_MISMATCH');
        $this->assertEquals(0, Sale::where('id', $uuid)->count());
    }

    public function test_cash_register_not_found_returns_structured_code(): void
    {
        $uuid = (string) Str::uuid();
        $payload = $this->basePayload([
            'id'                       => $uuid,
            'cash_register_session_id' => (string) Str::uuid(),
        ]);

        $res = $this->actingAs($this->user)->postJson('/test/sales', $payload);
        $res->assertStatus(422);
        $res->assertJsonPath('code', 'CASH_REGISTER_NOT_FOUND');
    }
}
