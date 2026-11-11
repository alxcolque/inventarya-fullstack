<?php

namespace Tests\Feature;

use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\Customer;
use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\Setting;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatInvoiceSequence;
use App\Models\SiatLegend;
use App\Models\SiatPaymentMethod;
use App\Models\Store;
use App\Models\User;
use App\Services\Siat\SiatInvoiceNumberService;
use App\Services\Siat\SiatInvoicePreparationService;
use App\Services\Siat\SiatPaymentMethodMapper;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SiatInvoicePreparationTest extends TestCase
{
    private User $user;
    private Store $store;
    private Setting $setting;
    private SiatInvoicePreparationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.invoice_prep_test' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_prep_test',
        ]);
        DB::purge('invoice_prep_test');

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('role')->default('seller');
            $table->timestamps();
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('location')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->boolean('enable_electronic_invoicing')->default(false);
            $table->integer('sin_branch_code')->nullable();
            $table->integer('sin_point_of_sale_code')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('tax_nit')->nullable();
            $table->string('tax_business_name')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->integer('siat_environment')->default(2);
            $table->integer('siat_modality')->default(2);
            $table->string('siat_system_code')->nullable();
            $table->text('siat_api_token')->nullable();
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->timestamps();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->integer('document_type')->default(1);
            $table->string('document_number')->nullable();
            $table->string('document_complement')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('sku')->nullable();
            $table->string('sin_product_code')->nullable();
            $table->string('sin_activity_code')->nullable();
            $table->integer('sin_unit_code')->nullable();
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores');
            $table->foreignId('customer_id')->nullable();
            $table->decimal('total', 15, 2);
            $table->decimal('discount', 15, 2)->default(0.00);
            $table->string('payment_method', 50)->default('efectivo');
            $table->foreignId('user_id')->constrained('users');
            $table->string('status')->default('completed');
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->string('observation')->nullable();
            $table->uuid('cash_register_session_id')->nullable();
            $table->timestamp('order_date')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('quantity', 15, 3)->default(0.000);
            $table->decimal('price', 15, 2)->default(0.00);
            $table->decimal('subtotal', 15, 2)->default(0.00);
            $table->timestamps();
        });

        // Tablas SIAT
        (require database_path('migrations/tenant/2026_10_12_000001_create_siat_cufds_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000004_create_siat_cuis_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000007_create_siat_legends_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000008_create_siat_payment_methods_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000002_create_electronic_invoices_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000003_create_electronic_invoice_details_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000009_create_siat_invoice_sequences_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000010_create_siat_payment_mappings_table.php'))->up();

        $this->user = User::create(['name' => 'Cajero Principal', 'email' => 'cajero@test.com']);
        $this->store = Store::create([
            'name'                        => 'Sucursal Central',
            'location'                    => 'La Paz',
            'address'                     => 'Av. 16 de Julio #1440',
            'phone'                       => '22445566',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 0,
            'sin_point_of_sale_code'      => 0,
        ]);

        $this->setting = Setting::create([
            'tax_nit'           => '1020304050',
            'tax_business_name' => 'INVENTARYA TECH S.R.L.',
            'siat_environment'  => 2,
            'siat_modality'     => 2,
            'address'           => 'Av. Arce #2000',
            'phone'             => '22112233',
        ]);

        // CUIS y CUFD activos con correspondencia exacta
        SiatCuis::create([
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-TEST-ACTIVE-001',
            'valid_until'        => now()->addDays(180),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-TEST-KEY-001',
            'control_code'       => 'CTRL-CODE-999',
            'valid_from'         => now()->subHour(),
            'valid_until'        => now()->addHours(23),
            'is_active'          => true,
        ]);

        // Catálogos locales requeridos
        SiatPaymentMethod::create(['code' => 1, 'description' => 'EFECTIVO']);
        SiatPaymentMethod::create(['code' => 2, 'description' => 'TARJETA']);
        SiatPaymentMethod::create(['code' => 10, 'description' => 'QR']);

        // Homologaciones de pago configuradas por tenant
        \App\Models\SiatPaymentMapping::create(['commercial_method' => 'efectivo', 'siat_payment_method_code' => 1]);
        \App\Models\SiatPaymentMapping::create(['commercial_method' => 'cash', 'siat_payment_method_code' => 1]);
        \App\Models\SiatPaymentMapping::create(['commercial_method' => 'tarjeta', 'siat_payment_method_code' => 2]);
        \App\Models\SiatPaymentMapping::create(['commercial_method' => 'card', 'siat_payment_method_code' => 2]);
        \App\Models\SiatPaymentMapping::create(['commercial_method' => 'qr', 'siat_payment_method_code' => 10]);

        SiatLegend::create([
            'activity_code' => '471100',
            'description'   => 'Ley N° 453: Los servicios deben prestarse en condiciones de inocuidad y calidad.',
        ]);

        $this->service = new SiatInvoicePreparationService(
            new SiatInvoiceNumberService(),
            new SiatPaymentMethodMapper()
        );
    }

    private function createHomologatedProduct(string $name = 'Teclado Mecánico', string $sku = 'TEC-001'): Product
    {
        return Product::create([
            'name'              => $name,
            'sku'               => $sku,
            'sin_product_code'  => '62111',
            'sin_activity_code' => '471100',
            'sin_unit_code'     => 57, // Unidad
        ]);
    }

    public function test_preparacion_correcta_con_snapshots_completos(): void
    {
        $customer = Customer::create([
            'name'                => 'Carlos Mamani',
            'document_type'       => 1, // CI
            'document_number'     => '4892011',
            'document_complement' => '1B',
        ]);

        $product1 = $this->createHomologatedProduct('Monitor Gamer', 'MON-001');
        $product2 = $this->createHomologatedProduct('Mouse Óptico', 'MOU-002');

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'customer_id'    => $customer->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '350.00',
            'discount'       => '0.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product1->id,
            'quantity'   => 1,
            'price'      => 300.00,
            'subtotal'   => 300.00,
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product2->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $invoice = $this->service->prepare($sale);

        // Verificaciones del documento principal
        $this->assertEquals(ElectronicInvoiceStatus::DRAFT, $invoice->status);
        $this->assertNull($invoice->cuf); // CUF no debe generarse en Fase 4A
        $this->assertEquals(1, $invoice->invoice_number);
        $this->assertEquals('1020304050', $invoice->issuer_nit);
        $this->assertEquals('INVENTARYA TECH S.R.L.', $invoice->issuer_business_name);
        $this->assertEquals('La Paz', $invoice->issuer_municipality);
        $this->assertEquals('Av. 16 de Julio #1440', $invoice->issuer_address);
        $this->assertEquals('CUFD-TEST-KEY-001', $invoice->cufd_snapshot);
        $this->assertEquals('CTRL-CODE-999', $invoice->control_code);

        // Snapshot Comprador
        $this->assertEquals(1, $invoice->buyer_document_type);
        $this->assertEquals('4892011', $invoice->buyer_document_number);
        $this->assertEquals('1B', $invoice->buyer_document_complement);
        $this->assertEquals('Carlos Mamani', $invoice->buyer_name);
        $this->assertEquals((string) $customer->id, $invoice->buyer_customer_code);

        // Importes y Moneda
        $this->assertEquals('350.00', (string) $invoice->subtotal);
        $this->assertEquals('350.00', (string) $invoice->total);
        $this->assertEquals('350.00', (string) $invoice->total_subject_to_vat);
        $this->assertEquals(1, $invoice->currency_code);
        $this->assertEquals('1.00000', (string) $invoice->exchange_rate);
        $this->assertEquals('350.00', (string) $invoice->total_in_currency);
        $this->assertEquals(1, $invoice->payment_method_code); // Efectivo

        // Leyenda
        $this->assertStringContainsString('Ley N° 453', $invoice->legend);

        // Snapshot Detalles
        $this->assertCount(2, $invoice->details);
        $d1 = $invoice->details->firstWhere('product_id', $product1->id);
        $this->assertEquals('62111', $d1->sin_product_code);
        $this->assertEquals('471100', $d1->sin_activity_code);
        $this->assertEquals(57, $d1->sin_unit_code);
        $this->assertEquals('300.00', (string) $d1->subtotal);
    }

    public function test_snapshot_comprador_consumidor_final(): void
    {
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'customer_id'    => 0, // Sin cliente registrado
            'name'           => 'Cliente Ocasional',
            'user_id'        => $this->user->id,
            'payment_method' => 'cash',
            'total'          => '100.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 100.00,
            'subtotal'   => 100.00,
        ]);

        $invoice = $this->service->prepare($sale);

        $this->assertEquals(5, $invoice->buyer_document_type);
        $this->assertEquals('0', $invoice->buyer_document_number);
        $this->assertEquals('Cliente Ocasional', $invoice->buyer_name);
        $this->assertEquals('CF', $invoice->buyer_customer_code);
    }

    public function test_falla_si_tienda_no_tiene_facturacion_habilitada(): void
    {
        $this->store->update(['enable_electronic_invoicing' => false]);
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('no tiene habilitada la facturación electrónica');

        $this->service->prepare($sale);
    }

    public function test_falla_si_falta_configuracion_fiscal_setting(): void
    {
        $this->setting->update(['tax_nit' => null]);
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('incompleta');

        $this->service->prepare($sale);
    }

    public function test_falla_si_cuis_expirado_o_inactivo(): void
    {
        SiatCuis::where('store_id', $this->store->id)->update([
            'valid_until' => now()->subDay(),
        ]);

        $product = $this->createHomologatedProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('No existe un CUIS activo y vigente');

        $this->service->prepare($sale);
    }

    public function test_falla_si_cufd_expirado_o_inactivo(): void
    {
        SiatCufd::where('store_id', $this->store->id)->update([
            'valid_until' => now()->subMinute(),
        ]);

        $product = $this->createHomologatedProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('No existe un CUFD activo y vigente');

        $this->service->prepare($sale);
    }

    public function test_falla_si_producto_sin_homologacion_fiscal(): void
    {
        $nonHomologated = Product::create([
            'name'              => 'Producto Huérfano',
            'sku'               => 'HUE-999',
            'sin_product_code'  => null, // Falta código SIN
            'sin_activity_code' => '471100',
            'sin_unit_code'     => 57,
        ]);

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '40.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $nonHomologated->id,
            'quantity'   => 1,
            'price'      => 40.00,
            'subtotal'   => 40.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('no cuenta con homologación fiscal completa');

        $this->service->prepare($sale);
    }

    public function test_falla_si_importes_inconsistentes(): void
    {
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '120.00', // El total comercial dice 120, pero el ítem sumará 100
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 100.00,
            'subtotal'   => 100.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('Inconsistencia en importes');

        $this->service->prepare($sale);
    }

    public function test_falla_si_metodo_pago_no_homologado(): void
    {
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'criptomoneda_desconocida',
            'total'          => '100.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 100.00,
            'subtotal'   => 100.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('no tiene una homologación fiscal configurada');

        $this->service->prepare($sale);
    }

    public function test_idempotencia_retorna_factura_existente_sin_consumir_correlativo(): void
    {
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '100.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 100.00,
            'subtotal'   => 100.00,
        ]);

        $invoice1 = $this->service->prepare($sale);
        $this->assertEquals(1, $invoice1->invoice_number);

        // Segunda llamada idéntica
        $invoice2 = $this->service->prepare($sale);
        $this->assertEquals($invoice1->id, $invoice2->id);
        $this->assertEquals(1, $invoice2->invoice_number);

        // La secuencia fiscal debe seguir en 1
        $sequence = SiatInvoiceSequence::where('store_id', $this->store->id)->first();
        $this->assertEquals(1, $sequence->last_number);
    }

    public function test_sucursal_cero_y_punto_de_venta_cero_son_soportados(): void
    {
        $this->store->update([
            'sin_branch_code'        => 0,
            'sin_point_of_sale_code' => 0,
        ]);

        $product = $this->createHomologatedProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '80.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 80.00,
            'subtotal'   => 80.00,
        ]);

        $invoice = $this->service->prepare($sale);

        $this->assertSame(0, $invoice->branch_code);
        $this->assertSame(0, $invoice->point_of_sale_code);
    }

    public function test_aislamiento_entre_stores(): void
    {
        $store2 = Store::create([
            'name'                        => 'Sucursal Cochabamba',
            'location'                    => 'Cochabamba',
            'address'                     => 'Av. Heroínas #500',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 1,
            'sin_point_of_sale_code'      => 0,
        ]);

        SiatCuis::create([
            'store_id'           => $store2->id,
            'branch_code'        => 1,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-STORE2',
            'valid_until'        => now()->addDays(100),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'store_id'           => $store2->id,
            'branch_code'        => 1,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-STORE2',
            'control_code'       => 'CTRL-2',
            'valid_from'         => now()->subHour(),
            'valid_until'        => now()->addHours(20),
            'is_active'          => true,
        ]);

        $product = $this->createHomologatedProduct();

        // Venta en Tienda 1
        $sale1 = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale1->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        // Venta en Tienda 2
        $sale2 = Sale::create([
            'store_id'       => $store2->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale2->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $inv1 = $this->service->prepare($sale1);
        $inv2 = $this->service->prepare($sale2);

        // Ambas deben comenzar en 1 independientemente
        $this->assertEquals(1, $inv1->invoice_number);
        $this->assertEquals(1, $inv2->invoice_number);
        $this->assertEquals($this->store->id, $inv1->store_id);
        $this->assertEquals($store2->id, $inv2->store_id);
    }

    public function test_controller_prepare_invoice_retorna_200(): void
    {
        $product = $this->createHomologatedProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory(new \App\Services\Siat\FakeSiatSoapClient())
        );

        $request = \Illuminate\Http\Request::create('/siat/invoices/prepare/' . $sale->id, 'POST');
        $response = $controller->prepareInvoice($request, $sale, $this->service);

        $this->assertEquals(200, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertTrue($data['success']);
        $this->assertEquals(1, $data['invoice']['invoice_number']);
        $this->assertEquals('draft', $data['invoice']['status']);
    }

    public function test_falla_si_store_carece_de_sucursal_o_punto_de_venta_configurado(): void
    {
        $this->store->update(['sin_branch_code' => null]);
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('no tiene configurados los códigos fiscales de sucursal o punto de venta');

        $this->service->prepare($sale);
    }

    public function test_falla_si_falta_municipio_o_direccion(): void
    {
        $this->store->update(['location' => null]);
        $this->setting->update(['address' => null]);
        $product = $this->createHomologatedProduct();

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('municipio fiscal');

        $this->service->prepare($sale);
    }

    public function test_venta_mayor_a_1000_exige_identificacion_obligatoria_del_comprador(): void
    {
        $product = $this->createHomologatedProduct('Laptop Pro', 'LAP-001');

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'customer_id'    => 0, // Consumidor final sin registrar
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '1500.00', // Excede el umbral de Bs. 1.000
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 1500.00,
            'subtotal'   => 1500.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('Bs. 1.000');

        $this->service->prepare($sale);
    }

    public function test_generacion_y_persistencia_de_cuf_en_factura_preparada(): void
    {
        $product = $this->createHomologatedProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 50.00,
            'subtotal'   => 50.00,
        ]);

        $invoice = $this->service->prepare($sale);
        $this->assertNull($invoice->cuf);

        $cufGenerator = new \App\Services\Siat\SiatCufGenerator();
        $persistedInvoice = $cufGenerator->generateAndPersist($invoice);

        $this->assertNotNull($persistedInvoice->cuf);
        $this->assertStringEndsWith('CTRL-CODE-999', $persistedInvoice->cuf);
        $this->assertEquals(ElectronicInvoiceStatus::DRAFT, $persistedInvoice->status);

        // Reintento debe ser idempotente
        $retestedInvoice = $cufGenerator->generateAndPersist($persistedInvoice);
        $this->assertEquals($persistedInvoice->cuf, $retestedInvoice->cuf);
    }
}

