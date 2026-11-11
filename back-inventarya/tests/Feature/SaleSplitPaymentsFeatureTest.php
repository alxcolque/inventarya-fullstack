<?php

namespace Tests\Feature;

use App\Http\Controllers\SaleController;
use App\Models\Assignment;
use App\Models\CashRegisterSession;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
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
use Tests\TestCase;

class SaleSplitPaymentsFeatureTest extends TestCase
{
    private User $user;
    private Store $store;
    private CashRegisterSession $session;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.split_test' => [
                'driver'   => 'sqlite',
                'database' => ':memory:',
                'prefix'   => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'split_test',
        ]);
        DB::purge('split_test');

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

        Schema::create('settings', function (Blueprint $t) {
            $t->id();
            $t->string('timezone')->default('America/La_Paz');
            $t->timestamps();
        });

        Schema::create('products', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('slug')->nullable();
            $t->string('sku')->nullable();
            $t->decimal('price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('inventory_stores', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->uuid('product_id');
            $t->decimal('stock_quantity', 12, 3)->default(0);
            $t->decimal('price', 12, 2)->default(0);
            $t->decimal('sale_price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('cash_register_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id');
            $t->decimal('opening_amount', 15, 2)->default(0);
            $t->decimal('closing_amount', 15, 2)->nullable();
            $t->decimal('expected_amount', 15, 2)->nullable();
            $t->decimal('difference', 15, 2)->nullable();
            $t->string('status', 20)->default('open');
            $t->timestamp('opened_at')->useCurrent();
            $t->timestamp('closed_at')->nullable();
            $t->timestamps();
        });

        Schema::create('cash_register_movements', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('cash_register_session_id');
            $t->foreignId('user_id');
            $t->string('type', 20);
            $t->decimal('amount', 15, 2);
            $t->string('reason');
            $t->timestamps();
        });

        Schema::create('sales', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('store_id');
            $t->foreignId('user_id')->nullable();
            $t->foreignId('seller_id')->nullable();
            $t->foreignId('customer_id')->default(0);
            $t->uuid('cash_register_session_id')->nullable();
            $t->timestamp('order_date')->nullable();
            $t->decimal('total', 15, 2);
            $t->decimal('discount', 15, 2)->default(0);
            $t->string('payment_method', 50)->default('efectivo');
            $t->string('status', 30)->default('completado');
            $t->decimal('amount_received', 15, 2)->nullable();
            $t->decimal('change', 15, 2)->nullable();
            $t->text('observation')->nullable();
            $t->string('name')->nullable();
            $t->string('phone')->nullable();
            $t->timestamps();
        });

        Schema::create('sale_details', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->uuid('product_id')->nullable();
            $t->decimal('quantity', 12, 3);
            $t->decimal('price', 12, 2);
            $t->decimal('subtotal', 12, 2);
            $t->timestamps();
        });

        Schema::create('sale_payments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->uuid('cash_register_session_id')->nullable();
            $t->string('payment_method', 50);
            $t->decimal('amount', 15, 2);
            $t->decimal('amount_received', 15, 2)->nullable();
            $t->decimal('change_amount', 15, 2)->nullable();
            $t->string('reference', 100)->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
        });

        Schema::create('electronic_invoices', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->string('status', 50)->default('pending');
            $t->timestamps();
        });

        Route::post('/test/sales', [SaleController::class, 'store']);
        Route::get('/test/sales', [SaleController::class, 'index']);
        Route::get('/test/sales/{id}', [SaleController::class, 'show']);
        Route::get('/test/sales/{id}/receipt', [SaleController::class, 'receipt']);
        Route::get('/test/stores/{slug}/sales', [SaleController::class, 'getSalesByStoreId']);

        Gate::before(function ($user, $ability) {
            $role = $user->role ?? 'staff';
            $perms = \App\Permissions\TenantPermissions::PERMISSIONS[$role] ?? [];
            if (in_array('*', $perms, true)) {
                return true;
            }
            return in_array($ability, $perms, true);
        });

        $this->user = User::create(['name' => 'Cashier', 'email' => 'cashier@test.com', 'role' => 'owner']);
        $this->store = Store::create(['name' => 'Store 1', 'slug' => 'store-1']);
        Assignment::create(['user_id' => $this->user->id, 'store_id' => $this->store->id]);

        $this->session = CashRegisterSession::create([
            'store_id' => $this->store->id,
            'user_id' => $this->user->id,
            'opening_amount' => 100.00,
            'status' => 'open',
        ]);

        $this->product = Product::create(['name' => 'Test Item', 'price' => 50.00]);
        InventoryStore::create([
            'store_id' => $this->store->id,
            'product_id' => $this->product->id,
            'stock_quantity' => 20,
            'price' => 50.00,
            'sale_price' => 50.00,
        ]);

        $this->actingAs($this->user);
    }

    public function test_sale_with_split_payments_persists_breakdown_and_updates_cash_register(): void
    {
        $payload = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'discount' => 0,
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'price' => 50.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method' => 'efectivo',
                    'amount' => 60.00,
                    'amount_received' => 100.00,
                    'change_amount' => 40.00,
                ],
                [
                    'payment_method' => 'qr',
                    'amount' => 40.00,
                    'reference' => 'TRANS-123456',
                ],
            ],
        ];

        $response = $this->postJson('/test/sales', $payload);
        $response->assertStatus(201);

        $saleId = $response->json('id');
        $sale = Sale::with('payments')->find($saleId);

        $this->assertNotNull($sale);
        $this->assertEquals('mixto', $sale->payment_method);
        $this->assertCount(2, $sale->payments);

        $cashPayment = $sale->payments->firstWhere('payment_method', 'efectivo');
        $this->assertNotNull($cashPayment);
        $this->assertEquals(60.00, (float) $cashPayment->amount);
        $this->assertEquals(100.00, (float) $cashPayment->amount_received);
        $this->assertEquals(40.00, (float) $cashPayment->change_amount);

        $qrPayment = $sale->payments->firstWhere('payment_method', 'qr');
        $this->assertNotNull($qrPayment);
        $this->assertEquals(40.00, (float) $qrPayment->amount);
        $this->assertEquals('TRANS-123456', $qrPayment->reference);

        // Verify CashRegister summary calculation
        $cashService = new CashRegisterService();
        $summary = $cashService->summary($this->session);

        // Opening cash = 100 + cash payment portion (60) = 160.00
        $this->assertEquals('160.00', $summary['expected_cash']);
        $this->assertEquals('100.00', $summary['sales']['total']);
        $this->assertEquals('60.00', $summary['sales']['cash']);
        $this->assertEquals('40.00', $summary['sales']['by_method']['qr']);
    }

    public function test_single_payment_creates_sale_payment_record(): void
    {
        $payload = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'amount_received' => 70.00,
            'change' => 20.00,
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'price' => 50.00,
                ],
            ],
        ];

        $response = $this->postJson('/test/sales', $payload);
        $response->assertStatus(201);

        $saleId = $response->json('id');
        $sale = Sale::with('payments')->find($saleId);

        $this->assertNotNull($sale);
        $this->assertCount(1, $sale->payments);
        $this->assertEquals('efectivo', $sale->payments[0]->payment_method);
        $this->assertEquals(50.00, (float) $sale->payments[0]->amount);
        $this->assertEquals(70.00, (float) $sale->payments[0]->amount_received);
        $this->assertEquals(20.00, (float) $sale->payments[0]->change_amount);
    }

    public function test_mismatched_split_payment_sum_is_rejected(): void
    {
        $payload = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'price' => 50.00, // Total = 100.00
                ],
            ],
            'payments' => [
                [
                    'payment_method' => 'efectivo',
                    'amount' => 50.00,
                ],
                [
                    'payment_method' => 'qr',
                    'amount' => 30.00, // Sum = 80.00 != 100.00
                ],
            ],
        ];

        $response = $this->postJson('/test/sales', $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['payments']);
    }

    public function test_unauthorized_user_cannot_manipulate_price_or_subtotal_or_total(): void
    {
        $staff = User::create(['name' => 'Staff Member', 'role' => 'staff']);
        Assignment::create(['user_id' => $staff->id, 'store_id' => $this->store->id]);
        $this->actingAs($staff);

        // Catalog price is 50.00, staff attempts price=10.00, subtotal=10.00, total=10.00
        $payload = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'total' => 10.00,
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'price' => 10.00,
                    'subtotal' => 10.00,
                ],
            ],
        ];

        $response = $this->postJson('/test/sales', $payload);
        $response->assertStatus(201);

        $saleId = $response->json('id');
        $sale = Sale::with('saleDetails')->find($saleId);

        // Backend authoritative calculation: 1 * 50.00 = 50.00
        $this->assertEquals(50.00, (float) $sale->total);
        $this->assertEquals(50.00, (float) $sale->saleDetails[0]->price);
        $this->assertEquals(50.00, (float) $sale->saleDetails[0]->subtotal);
    }

    public function test_authorized_user_can_edit_price(): void
    {
        // Owner has 'sales:edit-price'
        $this->actingAs($this->user);

        $payload = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'price' => 45.00,
                ],
            ],
        ];

        $response = $this->postJson('/test/sales', $payload);
        $response->assertStatus(201);

        $sale = Sale::with('saleDetails')->find($response->json('id'));
        $this->assertEquals(45.00, (float) $sale->total);
        $this->assertEquals(45.00, (float) $sale->saleDetails[0]->price);
    }

    public function test_invalid_discount_is_rejected(): void
    {
        $this->actingAs($this->user);

        // Negative discount
        $payloadNegative = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'discount' => -5.00,
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'price' => 50.00,
                ],
            ],
        ];
        $responseNeg = $this->postJson('/test/sales', $payloadNegative);
        $responseNeg->assertStatus(422);

        // Discount > Subtotal
        $payloadExcessive = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'discount' => 100.00, // Subtotal is 50.00
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'price' => 50.00,
                ],
            ],
        ];
        $responseExc = $this->postJson('/test/sales', $payloadExcessive);
        $responseExc->assertStatus(422);
    }

    public function test_multi_store_isolation_for_staff(): void
    {
        $storeB = Store::create(['name' => 'Store B', 'slug' => 'store-b']);
        InventoryStore::create([
            'store_id' => $storeB->id,
            'product_id' => $this->product->id,
            'stock_quantity' => 10,
        ]);

        $sessionB = CashRegisterSession::create([
            'store_id' => $storeB->id,
            'user_id' => $this->user->id,
            'opening_amount' => 50.00,
            'status' => 'open',
        ]);

        $staffA = User::create(['name' => 'Staff Store A', 'role' => 'staff']);
        Assignment::create(['user_id' => $staffA->id, 'store_id' => $this->store->id]);

        $this->actingAs($staffA);

        // Staff A cannot read Store B sales
        $responseGetB = $this->getJson('/test/stores/' . $storeB->id . '/sales');
        $responseGetB->assertStatus(403);

        // Staff A cannot post sale to Store B
        $payloadB = [
            'store_id' => $storeB->id,
            'cash_register_session_id' => $sessionB->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                ],
            ],
        ];
        $responsePostB = $this->postJson('/test/sales', $payloadB);
        $responsePostB->assertStatus(403);
    }

    public function test_cash_accounting_with_mixed_payments_and_change(): void
    {
        $this->actingAs($this->user);

        // Case 1: Sale Bs 120 with Cash Bs 50, QR Bs 40, Card Bs 30
        // We use $this->session with initial opening_amount = 100
        $payload120 = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'price' => 60.00, // Total = 120.00
                ],
            ],
            'payments' => [
                ['payment_method' => 'efectivo', 'amount' => 50.00],
                ['payment_method' => 'qr', 'amount' => 40.00],
                ['payment_method' => 'tarjeta', 'amount' => 30.00],
            ],
        ];

        $res1 = $this->postJson('/test/sales', $payload120);
        $res1->assertStatus(201);

        $summary1 = app(CashRegisterService::class)->summary($this->session);
        // Expected cash should increase ONLY by the cash portion (+50.00), so 100 + 50 = 150.00 (NOT +120)
        $this->assertEquals('150.00', $summary1['expected_cash']);
        $this->assertEquals('120.00', $summary1['sales']['total']);
        $this->assertEquals('50.00', $summary1['sales']['cash']);
        $this->assertEquals('40.00', $summary1['sales']['by_method']['qr']);
        $this->assertEquals('30.00', $summary1['sales']['by_method']['tarjeta']);

        // Case 2: Cash sale Bs 87 with amount_received = 100, change = 13
        $payload87 = [
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'amount_received' => 100.00,
            'change' => 13.00,
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'price' => 87.00, // Total = 87.00
                ],
            ],
        ];

        $res2 = $this->postJson('/test/sales', $payload87);
        $res2->assertStatus(201);

        $summary2 = app(CashRegisterService::class)->summary($this->session);
        // Previous expected 150 + 87 = 237.00 (NOT 150 + 100)
        $this->assertEquals('237.00', $summary2['expected_cash']);
    }

    public function test_idempotency_prevents_duplicate_deduction_and_payments(): void
    {
        $this->actingAs($this->user);
        $fixedUuid = (string) \Illuminate\Support\Str::uuid();

        $initialStock = (float) InventoryStore::where('store_id', $this->store->id)
            ->where('product_id', $this->product->id)
            ->value('stock_quantity');

        $payload = [
            'id' => $fixedUuid,
            'store_id' => $this->store->id,
            'cash_register_session_id' => $this->session->id,
            'status' => 'completado',
            'payment_method' => 'efectivo',
            'products' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'price' => 50.00,
                ],
            ],
        ];

        // First call
        $res1 = $this->postJson('/test/sales', $payload);
        $res1->assertStatus(201);

        $stockAfterFirst = (float) InventoryStore::where('store_id', $this->store->id)
            ->where('product_id', $this->product->id)
            ->value('stock_quantity');
        $this->assertEquals($initialStock - 2, $stockAfterFirst);

        // Second call with same UUID
        $res2 = $this->postJson('/test/sales', $payload);
        $res2->assertStatus(200);
        $this->assertTrue($res2->json('is_duplicate'));

        $stockAfterSecond = (float) InventoryStore::where('store_id', $this->store->id)
            ->where('product_id', $this->product->id)
            ->value('stock_quantity');
        $this->assertEquals($stockAfterFirst, $stockAfterSecond);

        // Total payments for this sale must be exactly 1
        $paymentsCount = SalePayment::where('sale_id', $fixedUuid)->count();
        $this->assertEquals(1, $paymentsCount);
    }

    public function test_legacy_sales_compatibility_and_receipt(): void
    {
        $this->actingAs($this->user);

        // Create legacy sale without any rows in sale_payments
        $legacySale = Sale::create([
            'store_id' => $this->store->id,
            'user_id' => $this->user->id,
            'customer_id' => 0,
            'name' => 'Legacy Customer',
            'total' => 100.00,
            'status' => 'completado',
            'payment_method' => 'tarjeta',
            'order_date' => now(),
        ]);

        // 1. GET /sales/{id} loads successfully
        $resShow = $this->getJson('/test/sales/' . $legacySale->id);
        $resShow->assertStatus(200);
        $this->assertEquals('tarjeta', $resShow->json('payment_method'));
        $this->assertEmpty($resShow->json('payments'));

        // 2. GET /receipt/{id} works and generates receipt without error
        $resReceipt = $this->getJson('/test/sales/' . $legacySale->id . '/receipt');
        $resReceipt->assertStatus(200);
        $this->assertEquals('tarjeta', $resReceipt->json('payment_method'));
        $this->assertEquals('COMPROBANTE DE VENTA', $resReceipt->json('document_title'));
        $this->assertEquals('DOCUMENTO INTERNO COMERCIAL - NO VÁLIDO PARA CRÉDITO FISCAL', $resReceipt->json('disclaimer'));
        $this->assertArrayNotHasKey('cuf', $resReceipt->json());
        $this->assertArrayNotHasKey('cufd', $resReceipt->json());
        $this->assertArrayNotHasKey('qr_string', $resReceipt->json());
    }
}
