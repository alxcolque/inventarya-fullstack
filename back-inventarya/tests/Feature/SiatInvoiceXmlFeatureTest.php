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
use App\Models\SiatPaymentMapping;
use App\Models\SiatPaymentMethod;
use App\Models\Store;
use App\Models\User;
use App\Services\Siat\SiatCufGenerator;
use App\Services\Siat\SiatInvoiceNumberService;
use App\Services\Siat\SiatInvoicePreparationService;
use App\Services\Siat\SiatInvoiceXmlBuilder;
use App\Services\Siat\SiatInvoiceXmlValidator;
use App\Services\Siat\SiatPaymentMethodMapper;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SiatInvoiceXmlFeatureTest extends TestCase
{
    private User $user;
    private Store $store;
    private Setting $setting;
    private SiatInvoicePreparationService $prepService;
    private SiatCufGenerator $cufGenerator;
    private SiatInvoiceXmlBuilder $xmlBuilder;
    private SiatInvoiceXmlValidator $xmlValidator;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.invoice_xml_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_xml_test',
        ]);
        DB::purge('invoice_xml_test');
        Storage::fake('local');

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

        $this->user = User::create([
            'name'     => 'Cajero Test',
            'email'    => 'cajero@test.com',
            'password' => bcrypt('password'),
            'role'     => 'seller',
        ]);

        $this->store = Store::create([
            'id'                          => (string) Str::uuid(),
            'name'                        => 'Sucursal Central',
            'location'                    => 'La Paz',
            'address'                     => 'Av. 6 de Agosto 1234',
            'phone'                       => '2441122',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 0,
            'sin_point_of_sale_code'      => 0,
        ]);

        $this->setting = Setting::create([
            'tax_nit'           => '123456789',
            'tax_business_name' => 'EMPRESA COMERCIALIZADORA S.R.L.',
            'address'           => 'Calle Fiscal 456',
            'phone'             => '2223334',
            'siat_environment'  => 2,
            'siat_modality'     => 2,
            'siat_system_code'  => 'SYS-TEST-001',
            'siat_api_token'    => 'fake-token',
        ]);

        SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-FEAT-TEST',
            'valid_until'        => now()->addMonths(6),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-FEAT-TEST-123456',
            'control_code'       => 'CTRL-FEAT-999',
            'valid_from'         => now()->subHour(),
            'valid_until'        => now()->addHours(23),
            'is_active'          => true,
        ]);

        SiatLegend::create([
            'activity_code' => '471100',
            'description'   => 'Ley N° 453: El proveedor debe brindar atención sin discriminación.',
        ]);

        SiatPaymentMethod::create([
            'code'        => 1,
            'description' => 'EFECTIVO',
        ]);

        SiatPaymentMapping::create(['commercial_method' => 'efectivo', 'siat_payment_method_code' => 1]);
        SiatPaymentMapping::create(['commercial_method' => 'card', 'siat_payment_method_code' => 2]);
        SiatPaymentMapping::create(['commercial_method' => 'qr', 'siat_payment_method_code' => 10]);

        $this->prepService = new SiatInvoicePreparationService(
            new SiatInvoiceNumberService(),
            new SiatPaymentMethodMapper()
        );

        $this->cufGenerator = new SiatCufGenerator();
        $this->xmlValidator = new SiatInvoiceXmlValidator();
        $this->xmlBuilder   = new SiatInvoiceXmlBuilder($this->xmlValidator);
    }

    private function createProduct(string $name = 'Arroz 1kg', string $activityCode = '471100'): Product
    {
        return Product::create([
            'name'              => $name,
            'sku'               => 'ARR-001',
            'sin_product_code'  => '12345',
            'sin_activity_code' => $activityCode,
            'sin_unit_code'     => 57,
        ]);
    }

    public function test_end_to_end_preparation_cuf_xml_persisted_and_xsd_valid(): void
    {
        $product = $this->createProduct();
        $customer = Customer::create([
            'name'                => 'JUAN PÉREZ & ASOCIADOS',
            'document_type'       => 1,
            'document_number'     => '4892112',
            'document_complement' => null,
        ]);

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'customer_id'    => $customer->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '50.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 5,
            'price'      => 10.00,
            'subtotal'   => 50.00,
        ]);

        // 1. Prepare
        $invoice = $this->prepService->prepare($sale);
        $this->assertEquals(1, $invoice->invoice_number);
        $this->assertNull($invoice->cuf);
        $this->assertNull($invoice->xml_path);

        // 2. Generate CUF
        $invoice = $this->cufGenerator->generateAndPersist($invoice);
        $this->assertNotNull($invoice->cuf);

        // 3. Build & Persist XML
        $result = $this->xmlBuilder->buildAndPersist($invoice, 'tenant-test');
        $this->assertFalse($result['already_existed']);
        $this->assertNotNull($result['xml_path']);

        // Check file on storage
        $this->assertTrue(Storage::disk('local')->exists($result['xml_path']));
        $content = Storage::disk('local')->get($result['xml_path']);

        // Validate directly from storage
        $isValid = $this->xmlValidator->validate($content);
        $this->assertTrue($isValid);

        // Verify DB updated
        $invoice->refresh();
        $this->assertEquals($result['xml_path'], $invoice->xml_path);
    }

    public function test_idempotency_returns_existing_xml_without_regeneration(): void
    {
        $product = $this->createProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '20.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 2,
            'price'      => 10.00,
            'subtotal'   => 20.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        $res1 = $this->xmlBuilder->buildAndPersist($invoice, 'tenant-test');
        $this->assertFalse($res1['already_existed']);

        // Second call
        $res2 = $this->xmlBuilder->buildAndPersist($invoice->fresh(), 'tenant-test');
        $this->assertTrue($res2['already_existed']);
        $this->assertEquals($res1['xml_path'], $res2['xml_path']);
    }

    public function test_inconsistency_when_xml_path_in_db_but_file_missing_throws_exception(): void
    {
        $product = $this->createProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '10.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 10.00,
            'subtotal'   => 10.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        // Artificially set xml_path to non-existent file
        $invoice->update(['xml_path' => 'tenant/tenant-test/siat/invoices/2026/10/ghost.xml']);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('no existe en el almacenamiento');

        $this->xmlBuilder->buildAndPersist($invoice, 'tenant-test');
    }

    public function test_legend_rejection_when_activity_not_found_in_legends_table(): void
    {
        // Product has activity 999999 which has NO matching legend in siat_legends
        $product = $this->createProduct('Servicio X', '999999');

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '30.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 3,
            'price'      => 10.00,
            'subtotal'   => 30.00,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('No se encontró ninguna leyenda fiscal en el catálogo local de SIAT');

        // Must reject during preparation, without fallback to random first legend
        $this->prepService->prepare($sale);
    }

    public function test_controller_generate_xml_endpoint_returns_safe_response(): void
    {
        $product = $this->createProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '10.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 10.00,
            'subtotal'   => 10.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory(new \App\Services\Siat\FakeSiatSoapClient())
        );

        $request = Request::create("/api/siat/invoices/{$invoice->id}/xml", 'POST');
        $response = $controller->generateXml($request, $invoice, $this->xmlBuilder);

        $this->assertEquals(200, $response->getStatusCode());
        $data = $response->getData(true);

        $this->assertTrue($data['success']);
        $this->assertEquals($invoice->id, $data['data']['invoice_id']);
        $this->assertEquals($invoice->cuf, $data['data']['cuf']);
        $this->assertNotEmpty($data['data']['xml_path']);
        $this->assertArrayNotHasKey('absolute_path', $data['data']);
        $this->assertArrayNotHasKey('token', $data['data']);
        $this->assertArrayNotHasKey('certificate', $data['data']);
    }
}
