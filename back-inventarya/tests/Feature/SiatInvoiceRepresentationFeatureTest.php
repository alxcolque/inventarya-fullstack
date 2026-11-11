<?php

namespace Tests\Feature;

use App\DTOs\SiatInvoiceRepresentationData;
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
use App\Services\Siat\SiatInvoiceQrService;
use App\Services\Siat\SiatInvoiceRepresentationService;
use App\Services\Siat\SiatPaymentMethodMapper;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SiatInvoiceRepresentationFeatureTest extends TestCase
{
    private User $user;
    private Store $store;
    private Setting $setting;
    private SiatInvoicePreparationService $prepService;
    private SiatCufGenerator $cufGenerator;
    private SiatInvoiceQrService $qrService;
    private SiatInvoiceRepresentationService $representationService;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.invoice_representation_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_representation_test',
            'siat.qr_urls.1'   => 'https://siat.impuestos.gob.bo/consulta/QR',
            'siat.qr_urls.2'   => 'https://pilotosiat.impuestos.gob.bo/consulta/QR',
        ]);
        DB::purge('invoice_representation_test');
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
            $table->integer('siat_modality')->default(1);
            $table->string('siat_system_code')->nullable();
            $table->text('siat_api_token')->nullable();
            $table->text('siat_certificate_path')->nullable();
            $table->text('siat_certificate_password')->nullable();
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

        (require database_path('migrations/tenant/2026_10_12_000001_create_siat_cufds_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000004_create_siat_cuis_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000007_create_siat_legends_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000008_create_siat_payment_methods_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000002_create_electronic_invoices_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000003_create_electronic_invoice_details_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000009_create_siat_invoice_sequences_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000010_create_siat_payment_mappings_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000011_create_siat_invoice_operations_table.php'))->up();

        $this->seedInitialData();

        $this->cufGenerator = new SiatCufGenerator();
        $this->prepService  = new SiatInvoicePreparationService(
            new SiatInvoiceNumberService(),
            new SiatPaymentMethodMapper()
        );

        $this->qrService = new SiatInvoiceQrService();
        $this->representationService = new SiatInvoiceRepresentationService($this->qrService);
    }

    private function seedInitialData(): void
    {
        $this->user = User::create([
            'name'     => 'Admin Owner',
            'email'    => 'owner@test.com',
            'password' => bcrypt('password'),
            'role'     => 'owner',
        ]);

        $this->store = Store::create([
            'id'                          => (string) Str::uuid(),
            'name'                        => 'Sucursal Central 4G',
            'location'                    => 'La Paz',
            'address'                     => 'Av. 6 de Agosto #2450',
            'phone'                       => '22446688',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 0,
            'sin_point_of_sale_code'      => 0,
        ]);

        $this->setting = Setting::create([
            'tax_nit'           => '1003579028',
            'tax_business_name' => 'INVENTARYA TEST S.R.L.',
            'address'           => 'Av. 6 de Agosto #2450',
            'phone'             => '22446688',
            'siat_environment'  => 2, // Piloto
            'siat_modality'     => 1, // Electrónica en línea
            'siat_system_code'  => 'SYS-4G-TEST-001',
        ]);

        SiatLegend::create([
            'activity_code' => '471100',
            'description'   => 'Ley N° 453: Los servicios deben prestarse en condiciones de calidad.',
        ]);

        SiatPaymentMethod::create([
            'code'        => 1,
            'description' => 'EFECTIVO',
        ]);

        SiatPaymentMapping::create([
            'commercial_method'        => 'efectivo',
            'siat_payment_method_code' => 1,
        ]);

        SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-ACTIVE-BRANCH0-POS0',
            'valid_until'        => now()->addYear(),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-VALID-4G-XYZ-1234567890',
            'control_code'       => 'CTRL-4G-998877',
            'valid_from'         => now()->subHour(),
            'valid_until'        => now()->addHours(20),
            'is_active'          => true,
        ]);
    }

    private function createPreparedAndAcceptedInvoice(int $modality = 1): ElectronicInvoice
    {
        $this->setting->update(['siat_modality' => $modality]);

        $customer = Customer::create([
            'name'                => 'CARLOS MENDOZA',
            'document_type'       => 1,
            'document_number'     => '4433221',
            'document_complement' => '1B',
        ]);

        $product = Product::create([
            'name'              => 'IMPRESORA TERMICA 80MM',
            'sku'               => 'IMP-80-001',
            'sin_product_code'  => '84711',
            'sin_activity_code' => '471100',
            'sin_unit_code'     => 57,
        ]);

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'customer_id'    => $customer->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '350.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 350.00,
            'subtotal'   => 350.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        // Simulamos aceptación fiscal por SIN
        $invoice->update([
            'status'         => ElectronicInvoiceStatus::ACCEPTED,
            'reception_code' => 'REC-4G-ACCEPTED-8899',
        ]);

        return $invoice->fresh(['details']);
    }

    // =========================================================================
    // CASO 1: SNAPSHOT PRESERVATION (SECCIÓN 37)
    // Mutaciones posteriores en Customer, Product y Store NO alteran la representación
    // =========================================================================

    public function test_representation_data_is_built_strictly_from_snapshots(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);

        // Modificamos las entidades comerciales originales después de la emisión
        Customer::where('document_number', '4433221')->update([
            'name'            => 'NOMBRE TOTALMENTE MUTADO',
            'document_number' => '9999999',
        ]);

        Product::where('sku', 'IMP-80-001')->update([
            'name' => 'PRODUCTO CON PRECIO Y NOMBRE MUTADO',
        ]);

        Store::where('id', $this->store->id)->update([
            'name'    => 'TIENDA MUTADA POST FACTURACION',
            'address' => 'DIRECCION ALTERADA',
        ]);

        // Construir representación gráfica
        $data = $this->representationService->buildRepresentationData($invoice, 'thermal');

        // Los datos deben corresponder estrictamente a los snapshots originales
        $this->assertSame('CARLOS MENDOZA', $data->buyer['name']);
        $this->assertSame('4433221', $data->buyer['document_number']);
        $this->assertSame('4433221-1B', $data->buyer['document_full']);
        $this->assertSame('IMPRESORA TERMICA 80MM', $data->items[0]['description']);
        $this->assertSame('350.00', $data->items[0]['subtotal']);
        $this->assertSame('INVENTARYA TEST S.R.L.', $data->issuer['business_name']);
        $this->assertSame('Av. 6 de Agosto #2450', $data->issuer['address']);
    }

    // =========================================================================
    // CASO 2: GENERACIÓN DE PDF Y VERIFICACIÓN BINARIA (SECCIÓN 38)
    // Comprobar cabecera %PDF-, tamaño > 0, persistencia de pdf_path
    // =========================================================================

    public function test_generate_pdf_thermal_produces_valid_binary_and_persists_path(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);
        $this->assertNull($invoice->pdf_path);

        $result = $this->representationService->generatePdf($invoice, 'thermal');

        $this->assertFalse($result['from_cache']);
        $this->assertNotNull($result['path']);
        $this->assertNotEmpty($result['content']);

        // Verificación de cabecera PDF válida
        $this->assertStringStartsWith('%PDF-', $result['content']);

        // Verificación en Storage
        $this->assertTrue(Storage::disk('local')->exists($result['path']));
        $this->assertSame($result['content'], Storage::disk('local')->get($result['path']));

        // Verificación en base de datos
        $invoice->refresh();
        $this->assertSame($result['path'], $invoice->pdf_path);

        // Estructura de la ruta: tenant/{tenantId}/siat/invoices/{YYYY}/{MM}/{invoice-id}_thermal.pdf
        $this->assertStringContainsString('siat/invoices/', $result['path']);
        $this->assertStringEndsWith("{$invoice->id}_thermal.pdf", $result['path']);
    }

    public function test_generate_pdf_a4_produces_valid_letter_format(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);

        $result = $this->representationService->generatePdf($invoice, 'a4');

        $this->assertStringStartsWith('%PDF-', $result['content']);
        $this->assertTrue(Storage::disk('local')->exists($result['path']));
        $this->assertStringEndsWith("{$invoice->id}_a4.pdf", $result['path']);
    }

    // =========================================================================
    // CASO 3: IDEMPOTENCIA Y DETECCIÓN DE INCONSISTENCIAS (SECCIÓN 25)
    // =========================================================================

    public function test_generate_pdf_is_idempotent_when_file_exists(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);

        $firstRun = $this->representationService->generatePdf($invoice, 'thermal');
        $this->assertFalse($firstRun['from_cache']);

        // Segunda llamada: debe retornar el archivo existente en disco
        $secondRun = $this->representationService->generatePdf($invoice->fresh(), 'thermal');
        $this->assertTrue($secondRun['from_cache']);
        $this->assertSame($firstRun['path'], $secondRun['path']);
        $this->assertSame($firstRun['content'], $secondRun['content']);
    }

    public function test_generate_pdf_throws_exception_on_storage_inconsistency(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);
        $result = $this->representationService->generatePdf($invoice, 'thermal');

        // Simulamos pérdida del archivo en disco
        Storage::disk('local')->delete($result['path']);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage('Inconsistencia de almacenamiento');

        $this->representationService->generatePdf($invoice->fresh(), 'thermal');
    }

    // =========================================================================
    // CASO 4: POLÍTICA SEGÚN ESTADO FISCAL (SECCIONES 4, 30 Y 31)
    // =========================================================================

    public function test_fiscal_states_and_watermarks(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);

        // Estado ACCEPTED: sin marca de agua
        $dataAccepted = $this->representationService->buildRepresentationData($invoice, 'thermal');
        $this->assertTrue($dataAccepted->fiscalStatus['is_accepted']);
        $this->assertTrue($dataAccepted->fiscalStatus['is_valid_for_tax_credit']);
        $this->assertNull($dataAccepted->fiscalStatus['watermark_text']);

        // Estado PROCESSING: marca de agua visible
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);
        $dataProcessing = $this->representationService->buildRepresentationData($invoice->fresh(), 'thermal');
        $this->assertFalse($dataProcessing->fiscalStatus['is_accepted']);
        $this->assertFalse($dataProcessing->fiscalStatus['is_valid_for_tax_credit']);
        $this->assertStringContainsString('PROCESAMIENTO', $dataProcessing->fiscalStatus['watermark_text']);

        // Estado REJECTED: marca de agua de rechazo
        $invoice->update(['status' => ElectronicInvoiceStatus::REJECTED]);
        $dataRejected = $this->representationService->buildRepresentationData($invoice->fresh(), 'thermal');
        $this->assertFalse($dataRejected->fiscalStatus['is_accepted']);
        $this->assertFalse($dataRejected->fiscalStatus['is_valid_for_tax_credit']);
        $this->assertStringContainsString('RECHAZADO', $dataRejected->fiscalStatus['watermark_text']);
    }

    // =========================================================================
    // CASO 5: MODALIDADES 1 Y 2 (SECCIÓN 40)
    // =========================================================================

    public function test_modalities_display_proper_labels(): void
    {
        // Modalidad 1
        $invoiceM1 = $this->createPreparedAndAcceptedInvoice(1);
        $dataM1 = $this->representationService->buildRepresentationData($invoiceM1, 'thermal');
        $this->assertSame('ELECTRÓNICA EN LÍNEA', $dataM1->invoice['modality_label']);

        // Modalidad 2
        $invoiceM2 = $this->createPreparedAndAcceptedInvoice(2);
        $dataM2 = $this->representationService->buildRepresentationData($invoiceM2, 'thermal');
        $this->assertSame('COMPUTARIZADA EN LÍNEA', $dataM2->invoice['modality_label']);
    }

    // =========================================================================
    // CASO 6: ENDPOINTS HTTP PDF Y PREVIEW (SECCIONES 32 Y 33)
    // =========================================================================

    public function test_controller_pdf_endpoint_returns_pdf_stream(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory()
        );

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/pdf?format=thermal", 'GET');

        $response = $controller->downloadPdf($request, $invoice, $this->representationService);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('inline; filename="Factura_', $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF-', $response->getContent());
    }

    public function test_controller_representation_html_endpoint_returns_200(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory()
        );

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/representation?format=a4", 'GET');

        $response = $controller->showRepresentation($request, $invoice, $this->representationService);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertStringContainsString('text/html', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('INVENTARYA TEST S.R.L.', $response->getContent());
        $this->assertStringContainsString('IMPRESORA TERMICA 80MM', $response->getContent());
        $this->assertStringContainsString('data:image/svg+xml;base64,', $response->getContent());
    }

    public function test_consumidor_final_representation_formats_properly(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);
        $invoice->update([
            'buyer_name'            => '',
            'buyer_document_number' => '0',
        ]);

        $data = $this->representationService->buildRepresentationData($invoice->fresh(), 'thermal');

        $this->assertSame('CONSUMIDOR FINAL', $data->buyer['name']);
        $this->assertSame('0', $data->buyer['document_number']);
        $this->assertFalse(str_contains(strtolower($data->buyer['name']), 'null'));
        $this->assertFalse(str_contains(strtolower($data->buyer['name']), 'undefined'));
    }

    public function test_tenant_storage_path_isolation_and_security(): void
    {
        $invoice = $this->createPreparedAndAcceptedInvoice(1);

        $result = $this->representationService->generatePdf($invoice, 'thermal');

        // La ruta debe estar aislada en la convención tenant/{id}/siat/invoices/...
        $this->assertStringStartsWith('tenant/', $result['path']);
        $this->assertStringNotContainsString('../', $result['path']);
        $this->assertStringNotContainsString('..\\', $result['path']);
    }
}
