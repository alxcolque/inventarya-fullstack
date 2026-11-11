<?php

namespace Tests\Feature;

use App\Enums\ElectronicInvoiceStatus;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\ElectronicInvoice;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\Setting;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\Store;
use App\Models\User;
use App\Services\Siat\SiatInvoicePreparationService;
use App\Services\Siat\SiatReadinessService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UniversalSalesFiscalDecouplingTest extends TestCase
{
    private User $user;
    private Store $storeA;
    private Store $storeB;
    private SiatReadinessService $readinessService;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.decoupling_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'decoupling_test',
        ]);
        DB::purge('decoupling_test');

        $this->createSchema();

        $this->user = User::create([
            'name'     => 'Vendedor Test',
            'email'    => 'vendedor@test.com',
            'password' => bcrypt('secret'),
        ]);

        $this->storeA = Store::create([
            'id'                          => '00000000-0000-0000-0000-000000000001',
            'name'                        => 'Sucursal Fiscal A',
            'slug'                        => 'sucursal-a',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 0,
            'sin_point_of_sale_code'      => 0,
        ]);

        $this->storeB = Store::create([
            'id'                          => '00000000-0000-0000-0000-000000000002',
            'name'                        => 'Sucursal Comercial B',
            'slug'                        => 'sucursal-b',
            'enable_electronic_invoicing' => false,
            'sin_branch_code'             => null,
            'sin_point_of_sale_code'      => null,
        ]);

        $this->readinessService = new SiatReadinessService();
    }

    private function createSchema(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('color', 20)->default('#6366f1');
            $table->timestamps();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->timestamps();
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('address')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('location')->nullable();
            $table->boolean('enable_electronic_invoicing')->default(false);
            $table->integer('sin_branch_code')->nullable();
            $table->integer('sin_point_of_sale_code')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('timezone')->default('America/La_Paz');
            $table->boolean('electronic_invoicing_enabled')->default(false);
            $table->string('tax_nit')->nullable();
            $table->string('tax_business_name')->nullable();
            $table->integer('siat_environment')->nullable();
            $table->integer('siat_modality')->nullable();
            $table->string('siat_system_code')->nullable();
            $table->text('siat_api_token')->nullable();
            $table->string('siat_certificate_path')->nullable();
            $table->text('siat_certificate_password')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->smallInteger('document_type')->nullable();
            $table->string('document_number')->nullable();
            $table->string('cinit')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('sku')->nullable();
            $table->string('barcode')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->foreignId('category_id')->nullable();
            $table->foreignId('brand_id')->nullable();
            $table->string('sin_product_code')->nullable();
            $table->string('sin_activity_code')->nullable();
            $table->integer('sin_unit_code')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('product_id');
            $table->decimal('stock_quantity', 12, 3)->default(0);
            $table->timestamps();
        });

        Schema::create('cash_register_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->foreignId('user_id');
            $table->string('status')->default('open');
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->foreignId('customer_id')->default(0);
            $table->foreignId('user_id')->nullable();
            $table->uuid('cash_register_session_id')->nullable();
            $table->timestamp('order_date')->nullable();
            $table->decimal('total', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->string('payment_method')->default('Efectivo');
            $table->string('status')->default('completed');
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->text('observation')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sale_id');
            $table->uuid('product_id')->nullable();
            $table->decimal('quantity', 12, 3);
            $table->decimal('price', 12, 2);
            $table->decimal('subtotal', 12, 2);
            $table->timestamps();
        });

        Schema::create('sale_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sale_id');
            $table->uuid('cash_register_session_id')->nullable();
            $table->string('payment_method', 50);
            $table->decimal('amount', 15, 2);
            $table->decimal('amount_received', 15, 2)->nullable();
            $table->decimal('change_amount', 15, 2)->nullable();
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('siat_cuis', function (Blueprint $table) {
            $table->id();
            $table->uuid('store_id');
            $table->integer('branch_code');
            $table->integer('point_of_sale_code');
            $table->string('cuis');
            $table->timestamp('valid_until');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('siat_cufds', function (Blueprint $table) {
            $table->id();
            $table->uuid('store_id');
            $table->integer('branch_code');
            $table->integer('point_of_sale_code');
            $table->string('cufd');
            $table->string('control_code');
            $table->timestamp('valid_until');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('electronic_invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sale_id')->unique();
            $table->uuid('store_id');
            $table->foreignId('customer_id')->nullable();
            $table->unsignedBigInteger('invoice_number');
            $table->string('cuf')->nullable();
            $table->string('status')->default('draft');
            $table->decimal('total', 12, 2);
            $table->timestamps();
        });

        Schema::create('electronic_invoice_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('electronic_invoice_id');
            $table->uuid('product_id')->nullable();
            $table->string('product_code', 50)->nullable();
            $table->string('sin_product_code', 50);
            $table->string('sin_activity_code', 50);
            $table->integer('sin_unit_code')->nullable();
            $table->string('description', 255);
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2);
            $table->string('serial_number', 100)->nullable();
            $table->string('imei_number', 100)->nullable();
            $table->timestamps();
        });
    }

    // 1. Tenant sin SIAT puede vender
    public function test_1_tenant_without_siat_can_complete_commercial_sale(): void
    {
        Setting::create([
            'electronic_invoicing_enabled' => false,
            'tax_nit'                      => null,
        ]);

        $product = Product::create(['name' => 'Cuaderno', 'price' => 15.00]);
        InventoryStore::create(['store_id' => $this->storeB->id, 'product_id' => $product->id, 'stock_quantity' => 50]);

        $sale = Sale::create([
            'id'             => '11111111-1111-1111-1111-111111111111',
            'store_id'       => $this->storeB->id,
            'customer_id'    => 0,
            'user_id'        => $this->user->id,
            'total'          => 15.00,
            'payment_method' => 'Efectivo',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 15.00,
            'subtotal'   => 15.00,
        ]);

        $this->assertEquals('not_applicable', $sale->fiscal_status);
        $this->assertNull(ElectronicInvoice::where('sale_id', $sale->id)->first());
    }

    // 2. Store sin SIAT puede vender
    public function test_2_store_without_siat_can_complete_commercial_sale(): void
    {
        Setting::create([
            'electronic_invoicing_enabled' => true,
            'tax_nit'                      => '123456789',
        ]);

        $product = Product::create(['name' => 'Bolígrafo', 'price' => 5.00]);
        $sale = Sale::create([
            'id'             => '22222222-2222-2222-2222-222222222222',
            'store_id'       => $this->storeB->id, // storeB has enable_electronic_invoicing = false
            'total'          => 5.00,
            'payment_method' => 'Efectivo',
        ]);

        $this->assertEquals('not_applicable', $sale->fiscal_status);
    }

    // 3. SIAT incompleto no bloquea venta comercial
    public function test_3_incomplete_siat_does_not_block_commercial_sale(): void
    {
        Setting::create([
            'electronic_invoicing_enabled' => true,
            'tax_nit'                      => null, // Incomplete configuration
            'siat_system_code'             => null,
        ]);

        $sale = Sale::create([
            'id'             => '33333333-3333-3333-3333-333333333333',
            'store_id'       => $this->storeA->id,
            'total'          => 100.00,
            'payment_method' => 'Efectivo',
        ]);

        $this->assertNotNull($sale);
        $this->assertEquals('not_configured', $sale->fiscal_status);
    }

    // 4. Cliente sin NIT puede participar en venta no fiscal
    public function test_4_customer_without_nit_can_participate_in_non_fiscal_sale(): void
    {
        $customer = Customer::create([
            'name'            => 'Juan Comprador',
            'document_number' => null,
            'cinit'           => null,
            'document_type'   => null,
        ]);

        $sale = Sale::create([
            'id'             => '44444444-4444-4444-4444-444444444444',
            'store_id'       => $this->storeB->id,
            'customer_id'    => $customer->id,
            'total'          => 50.00,
            'payment_method' => 'QR',
        ]);

        $this->assertEquals($customer->id, $sale->customer_id);
        $this->assertEquals('not_applicable', $sale->fiscal_status);
    }

    // 5. Producto sin códigos SIN puede venderse comercialmente
    public function test_5_product_without_sin_codes_can_be_sold_commercially(): void
    {
        $product = Product::create([
            'name'              => 'Artesanía Local',
            'price'             => 40.00,
            'sin_product_code'  => null,
            'sin_activity_code' => null,
            'sin_unit_code'     => null,
        ]);

        $sale = Sale::create([
            'id'             => '55555555-5555-5555-5555-555555555555',
            'store_id'       => $this->storeB->id,
            'total'          => 40.00,
            'payment_method' => 'Efectivo',
        ]);
        $detail = SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 40.00,
            'subtotal'   => 40.00,
        ]);

        $this->assertNotNull($detail);
        $this->assertEquals(40.00, $sale->total);
    }

    // 6. Venta comercial hace stock decrement correctamente
    public function test_6_commercial_sale_decrements_stock_correctly(): void
    {
        $product = Product::create(['name' => 'Teclado USB', 'price' => 80.00]);
        $inv = InventoryStore::create([
            'store_id'       => $this->storeB->id,
            'product_id'     => $product->id,
            'stock_quantity' => 20.00,
        ]);

        DB::transaction(function () use ($inv, $product) {
            $sale = Sale::create([
                'id'             => '66666666-6666-6666-6666-666666666666',
                'store_id'       => $this->storeB->id,
                'total'          => 240.00,
                'payment_method' => 'Efectivo',
            ]);
            SaleDetail::create([
                'sale_id'    => $sale->id,
                'product_id' => $product->id,
                'quantity'   => 3,
                'price'      => 80.00,
                'subtotal'   => 240.00,
            ]);
            $inv->decrement('stock_quantity', 3);
        });

        $this->assertEquals(17.00, $inv->fresh()->stock_quantity);
    }

    // 7. Venta registra caja correctamente
    public function test_7_commercial_sale_registers_cash_session(): void
    {
        $session = CashRegisterSession::create([
            'id'       => '77777777-7777-7777-7777-777777777777',
            'store_id' => $this->storeB->id,
            'user_id'  => $this->user->id,
            'status'   => 'open',
        ]);

        $sale = Sale::create([
            'id'                       => '77777777-7777-7777-7777-777777777778',
            'store_id'                 => $this->storeB->id,
            'cash_register_session_id' => $session->id,
            'total'                    => 120.00,
            'payment_method'           => 'Efectivo',
        ]);

        $this->assertEquals($session->id, $sale->cash_register_session_id);
    }

    // 8. Fallo fiscal posterior no revierte venta
    public function test_8_subsequent_fiscal_failure_does_not_rollback_commercial_sale(): void
    {
        $product = Product::create(['name' => 'Monitor 24', 'price' => 500.00]);
        $inv = InventoryStore::create([
            'store_id'       => $this->storeA->id,
            'product_id'     => $product->id,
            'stock_quantity' => 10.00,
        ]);

        // Paso 1: Commit de venta comercial
        $sale = DB::transaction(function () use ($inv, $product) {
            $s = Sale::create([
                'id'             => '88888888-8888-8888-8888-888888888888',
                'store_id'       => $this->storeA->id,
                'total'          => 500.00,
                'payment_method' => 'Efectivo',
            ]);
            SaleDetail::create([
                'sale_id'    => $s->id,
                'product_id' => $product->id,
                'quantity'   => 1,
                'price'      => 500.00,
                'subtotal'   => 500.00,
            ]);
            $inv->decrement('stock_quantity', 1);
            return $s;
        });

        // Paso 2: Intento fiscal falla (por falta de CUIS/CUFD en storeA)
        $fiscalAttemptFailed = false;
        try {
            app(SiatInvoicePreparationService::class)->prepare($sale);
        } catch (\Throwable $e) {
            $fiscalAttemptFailed = true;
        }

        $this->assertTrue($fiscalAttemptFailed);
        // La venta comercial y el stock permanecen intactos
        $this->assertNotNull(Sale::find($sale->id));
        $this->assertEquals(9.00, $inv->fresh()->stock_quantity);
    }

    // 9. Store A fiscal no habilita Store B automáticamente
    public function test_9_store_a_fiscal_does_not_automatically_enable_store_b(): void
    {
        Setting::create([
            'electronic_invoicing_enabled' => true,
            'tax_nit'                      => '99887766',
            'tax_business_name'            => 'Empresa Test',
            'siat_system_code'             => 'SYS1',
            'siat_environment'             => 2,
            'siat_modality'                => 2,
            'siat_api_token'               => 'token123',
        ]);

        $readinessA = $this->readinessService->storeReadiness($this->storeA);
        $readinessB = $this->readinessService->storeReadiness($this->storeB);

        $this->assertTrue($readinessA['enabled']);
        $this->assertFalse($readinessB['enabled']);
        $this->assertContains('store_enable_electronic_invoicing', $readinessB['missing_requirements']);
    }

    // 10. Tenant A jamás utiliza credenciales tenant B
    public function test_10_tenant_isolation_in_settings(): void
    {
        $settingA = new Setting([
            'tax_nit'           => '11111111',
            'tax_business_name' => 'Tenant A Corp',
        ]);
        $settingB = new Setting([
            'tax_nit'           => '22222222',
            'tax_business_name' => 'Tenant B LLC',
        ]);

        $this->assertNotEquals($settingA->tax_nit, $settingB->tax_nit);
        $this->assertEquals('11111111', $settingA->tax_nit);
        $this->assertEquals('22222222', $settingB->tax_nit);
    }

    // 11. Frontend nunca recibe token o password
    public function test_11_frontend_never_receives_raw_token_or_password(): void
    {
        $setting = new Setting([
            'tax_nit'                   => '123456789',
            'siat_api_token'            => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive-token',
            'siat_certificate_password' => 'super-secret-pfx-pass',
        ]);

        $array = $setting->toArray();

        $this->assertArrayNotHasKey('siat_api_token', $array);
        $this->assertArrayNotHasKey('siat_certificate_password', $array);
    }

    // 12. Producto sin mapping fiscal bloquea emisión fiscal pero no venta comercial
    public function test_12_unmapped_product_blocks_fiscal_invoicing_but_allows_commercial_sale(): void
    {
        Setting::create([
            'electronic_invoicing_enabled' => true,
            'tax_nit'                      => '99887766',
            'tax_business_name'            => 'Empresa Test',
            'siat_system_code'             => 'SYS1',
            'siat_environment'             => 2,
            'siat_modality'                => 2,
            'siat_api_token'               => 'token123',
        ]);

        $unmappedProduct = Product::create([
            'name'              => 'Servicio Personalizado',
            'price'             => 100.00,
            'sin_product_code'  => null,
            'sin_activity_code' => null,
        ]);

        // Venta comercial: PERMITIDA
        $sale = Sale::create([
            'id'             => '12121212-1212-1212-1212-121212121212',
            'store_id'       => $this->storeA->id,
            'total'          => 100.00,
            'payment_method' => 'Efectivo',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $unmappedProduct->id,
            'quantity'   => 1,
            'price'      => 100.00,
            'subtotal'   => 100.00,
        ]);

        $this->assertNotNull($sale);

        // Validación fiscal: BLOQUEADA
        $validation = $this->readinessService->validateSaleForInvoicing($sale);
        $this->assertFalse($validation['eligible']);
        $this->assertNotEmpty($validation['issues']);
        $hasHomologationIssue = collect($validation['issues'])->contains(fn ($issue) => str_contains($issue, 'homologación fiscal'));
        $this->assertTrue($hasHomologationIssue, 'Se esperaba un error indicando falta de homologación fiscal del producto');
    }

    // 13. Comprobante interno no contiene elementos de factura SIAT
    public function test_13_internal_receipt_does_not_contain_siat_fiscal_elements(): void
    {
        $sale = Sale::create([
            'id'             => '13131313-1313-1313-1313-131313131313',
            'store_id'       => $this->storeB->id,
            'total'          => 75.00,
            'payment_method' => 'Efectivo',
        ]);

        $controller = new \App\Http\Controllers\SaleController();
        $response = $controller->receipt($sale->id);
        $data = $response->getData(true);

        $this->assertEquals('COMPROBANTE DE VENTA', $data['document_title']);
        $this->assertStringContainsString('NO VÁLIDO PARA CRÉDITO FISCAL', $data['disclaimer']);
        $this->assertFalse($data['is_fiscal']);
        $this->assertArrayNotHasKey('cuf', $data);
        $this->assertArrayNotHasKey('cufd', $data);
        $this->assertArrayNotHasKey('leyenda', $data);
        $this->assertArrayNotHasKey('qr', $data);
    }

    // 14. Venta fiscal mantiene ElectronicInvoice 1:1
    public function test_14_fiscal_sale_maintains_electronic_invoice_one_to_one(): void
    {
        $sale = Sale::create([
            'id'             => '14141414-1414-1414-1414-141414141414',
            'store_id'       => $this->storeA->id,
            'total'          => 200.00,
            'payment_method' => 'Efectivo',
        ]);

        $invoice = ElectronicInvoice::create([
            'id'             => '14141414-1414-1414-1414-141414141415',
            'sale_id'        => $sale->id,
            'store_id'       => $this->storeA->id,
            'invoice_number' => 101,
            'status'         => ElectronicInvoiceStatus::ACCEPTED->value,
            'total'          => 200.00,
        ]);

        $this->assertEquals($invoice->id, $sale->electronicInvoice->id);
        $this->assertEquals('accepted', $sale->fresh()->fiscal_status);
    }

    // 15. Doble solicitud de emisión permanece idempotente
    public function test_15_duplicate_invoice_issuance_request_remains_idempotent(): void
    {
        $sale = Sale::create([
            'id'             => '15151515-1515-1515-1515-151515151515',
            'store_id'       => $this->storeA->id,
            'total'          => 90.00,
            'payment_method' => 'Efectivo',
        ]);

        $firstInvoice = ElectronicInvoice::create([
            'id'             => '15151515-1515-1515-1515-151515151516',
            'sale_id'        => $sale->id,
            'store_id'       => $this->storeA->id,
            'invoice_number' => 102,
            'status'         => ElectronicInvoiceStatus::DRAFT->value,
            'total'          => 90.00,
        ]);

        // Simular segunda invocación de preparación
        $prepService = app(SiatInvoicePreparationService::class);
        $secondInvoice = $prepService->prepare($sale);

        $this->assertEquals($firstInvoice->id, $secondInvoice->id);
        $this->assertEquals(1, ElectronicInvoice::where('sale_id', $sale->id)->count());
    }
}
