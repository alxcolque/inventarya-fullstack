<?php

namespace Tests\Feature;

use App\Contracts\SiatSoapClientInterface;
use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\Customer;
use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\Setting;
use App\Models\SiatCancellationReason;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatInvoiceOperation;
use App\Models\SiatInvoiceSequence;
use App\Models\SiatLegend;
use App\Models\SiatPaymentMapping;
use App\Models\SiatPaymentMethod;
use App\Models\Store;
use App\Models\User;
use App\Notifications\Tenant\SiatInvoiceCancelledNotification;
use App\Services\Siat\FakeSiatSoapClient;
use App\Services\Siat\SiatCancellationDeadlineService;
use App\Services\Siat\SiatCufGenerator;
use App\Services\Siat\SiatInvoiceCancellationService;
use App\Services\Siat\SiatInvoiceNumberService;
use App\Services\Siat\SiatInvoicePreparationService;
use App\Services\Siat\SiatInvoiceRepresentationService;
use App\Services\Siat\SiatPaymentMethodMapper;
use App\Services\Siat\SiatServiceFactory;
use App\Services\Siat\SiatSoapClient;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class SiatInvoiceCancellationFeatureTest extends TestCase
{
    private User $user;
    private Store $store;
    private Setting $setting;
    private FakeSiatSoapClient $fakeSoapClient;
    private SiatServiceFactory $factory;
    private SiatCancellationDeadlineService $deadlineService;
    private SiatInvoiceCancellationService $cancellationService;
    private SiatInvoiceRepresentationService $representationService;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.invoice_cancellation_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_cancellation_test',
            'siat.live_submission_enabled' => false,
        ]);
        DB::purge('invoice_cancellation_test');
        Storage::fake('local');

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('role')->default('owner');
            $table->timestamps();
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('location')->nullable();
            $table->string('address')->nullable();
            $table->string('municipality')->nullable();
            $table->string('phone')->nullable();
            $table->integer('sin_branch_code')->default(0);
            $table->integer('sin_point_of_sale_code')->default(0);
            $table->boolean('enable_electronic_invoicing')->default(true);
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('business_name')->nullable();
            $table->string('nit')->nullable();
            $table->boolean('electronic_invoicing_enabled')->default(true);
            $table->string('electronic_invoicing_status')->default('ready');
            $table->string('tax_business_name')->nullable();
            $table->string('tax_nit')->nullable();
            $table->integer('siat_environment')->default(2);
            $table->integer('siat_modality')->default(1);
            $table->string('siat_system_code')->default('SYS-CANCEL-TEST');
            $table->text('siat_api_token')->nullable();
            $table->string('certificate_path')->nullable();
            $table->text('certificate_password')->nullable();
            $table->dateTime('certificate_expiration')->nullable();
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
            $table->string('document_number')->default('0');
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
        (require database_path('migrations/tenant/2026_10_12_000012_create_siat_cancellation_reasons_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000013_add_cancellation_fields_to_electronic_invoices_table.php'))->up();

        $this->seedInitialData();

        $this->fakeSoapClient = new FakeSiatSoapClient();
        $this->app->instance(SiatSoapClientInterface::class, $this->fakeSoapClient);

        $this->factory = new SiatServiceFactory();
        $this->deadlineService = new SiatCancellationDeadlineService();
        $this->cancellationService = new SiatInvoiceCancellationService($this->factory, $this->deadlineService);
        $this->representationService = $this->app->make(SiatInvoiceRepresentationService::class);
    }

    private function seedInitialData(): void
    {
        $this->user = User::create([
            'name'     => 'Owner User',
            'email'    => 'owner@example.com',
            'role'     => 'owner',
            'password' => bcrypt('secret123'),
        ]);

        $this->store = Store::create([
            'id'                         => (string) Str::uuid(),
            'name'                       => 'Central Store',
            'address'                    => 'Av. 6 de Agosto #2450',
            'municipality'               => 'La Paz',
            'phone'                      => '22445566',
            'sin_branch_code'            => 0,
            'sin_point_of_sale_code'     => 0,
            'enable_electronic_invoicing'=> true,
        ]);

        $this->setting = Setting::create([
            'business_name'                => 'INVENTARYA S.R.L.',
            'nit'                          => '1003579028',
            'tax_business_name'            => 'INVENTARYA S.R.L.',
            'tax_nit'                      => '1003579028',
            'electronic_invoicing_enabled' => true,
            'electronic_invoicing_status'  => 'ready',
            'siat_environment'             => 2,
            'siat_modality'                => 1,
            'siat_system_code'             => 'SYS-CANCEL-TEST',
            'siat_api_token'               => 'TokenTestFake123',
        ]);

        SiatCuis::create([
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-TEST-998877',
            'valid_until'        => now()->addMonths(6),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-TEST-OPERATIVE-1234567890',
            'control_code'       => 'CTRL-FAKE-1234',
            'valid_from'         => now()->subHours(2),
            'valid_until'        => now()->addHours(22),
            'is_active'          => true,
        ]);

        // Catálogo de motivos oficiales de anulación
        SiatCancellationReason::create(['code' => 1, 'description' => 'FACTURA MAL EMITIDA']);
        SiatCancellationReason::create(['code' => 2, 'description' => 'NOTA DE CREDITO-DEBITO MAL EMITIDA']);
        SiatCancellationReason::create(['code' => 3, 'description' => 'DATOS DE EMISION INCORRECTOS']);
        SiatCancellationReason::create(['code' => 4, 'description' => 'FACTURA O NOTA DEVOLUCION']);
    }

    private function createAcceptedInvoice(array $overrides = []): ElectronicInvoice
    {
        $customer = Customer::create([
            'name'            => 'JUAN PEREZ',
            'email'           => 'juan.perez@example.com',
            'document_type'   => 1,
            'document_number' => '4567890',
        ]);

        $sale = Sale::create([
            'id'             => (string) Str::uuid(),
            'store_id'       => $this->store->id,
            'customer_id'    => $customer->id,
            'user_id'        => $this->user->id,
            'total'          => 150.00,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $product = Product::create([
            'id'                => (string) Str::uuid(),
            'name'              => 'Teclado Mecanico',
            'sin_product_code'  => '47111',
            'sin_activity_code' => '471110',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 150.00,
            'subtotal'   => 150.00,
        ]);

        $defaultCuf = 'CUF' . strtoupper(Str::random(50));

        $invoice = ElectronicInvoice::create(array_merge([
            'sale_id'                 => $sale->id,
            'store_id'                => $this->store->id,
            'issuer_nit'              => '1003579028',
            'issuer_business_name'    => 'INVENTARYA S.R.L.',
            'branch_code'             => 0,
            'point_of_sale_code'      => 0,
            'siat_environment'        => 2,
            'siat_modality'           => 1,
            'buyer_document_type'     => 1,
            'buyer_document_number'   => '4567890',
            'buyer_name'              => 'JUAN PEREZ',
            'invoice_number'          => 101,
            'cuf'                     => $defaultCuf,
            'cufd_snapshot'           => 'CUFD-TEST-OPERATIVE-1234567890',
            'issued_at'               => now(),
            'document_sector_code'    => 1,
            'subtotal'                => 150.00,
            'total'                   => 150.00,
            'total_subject_to_vat'    => 150.00,
            'currency_code'           => 1,
            'payment_method_code'     => 1,
            'legend'                  => 'Ley N° 453',
            'status'                  => ElectronicInvoiceStatus::ACCEPTED,
            'reception_code'          => 'REC-' . (string) Str::uuid(),
            'sin_response'            => ['codigoEstado' => 908, 'codigoRecepcion' => 'REC-INIT'],
            'xml_path'                => 'tenant/siat/invoices/2026/10/invoice_101.xml',
        ], $overrides));

        ElectronicInvoiceDetail::create([
            'id'                    => (string) Str::uuid(),
            'electronic_invoice_id' => $invoice->id,
            'product_id'            => $product->id,
            'product_code'          => 'TEC-01',
            'description'           => 'Teclado Mecanico',
            'quantity'              => 1,
            'unit_price'            => 150.00,
            'discount'              => 0,
            'subtotal'              => 150.00,
            'sin_product_code'      => 47111,
            'activity_code'         => '471110',
            'unit_code'             => 58,
        ]);

        return $invoice;
    }

    public function test_catalog_synchronization_fake_and_persistence_and_unique_code(): void
    {
        // 1. Catálogo se sincroniza con FakeSiatSoapClient
        $service = $this->factory->makeWithClient($this->fakeSoapClient, 'test-tenant');
        $items = $service->syncAndPersistCatalog('MotivoAnulacion', $this->store);

        $this->assertNotEmpty($items);
        $this->assertDatabaseHas('siat_cancellation_reasons', [
            'code'        => 1,
            'description' => 'FACTURA MAL EMITIDA',
        ]);

        // 2. Unicidad del código
        $countBefore = SiatCancellationReason::where('code', 1)->count();
        $this->assertEquals(1, $countBefore);

        // Re-sincronización no duplica
        $service->syncAndPersistCatalog('MotivoAnulacion', $this->store);
        $this->assertEquals(1, SiatCancellationReason::where('code', 1)->count());

        // 3. Recuperación desde DB sin llamar SOAP cuando forceRefresh=false
        $loaded = $service->getCatalog('MotivoAnulacion', $this->store, false);
        $this->assertCount(4, $loaded);
    }

    public function test_cannot_cancel_unaccepted_invoices(): void
    {
        $invoiceDraft = $this->createAcceptedInvoice(['status' => ElectronicInvoiceStatus::DRAFT]);
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("Solo es posible anular facturas en estado ACCEPTED");
        $this->cancellationService->cancel($invoiceDraft, 1);
    }

    public function test_cannot_cancel_processing_or_rejected_invoice(): void
    {
        $invoiceRejected = $this->createAcceptedInvoice(['status' => ElectronicInvoiceStatus::REJECTED]);
        $this->expectException(SiatFiscalException::class);
        $this->cancellationService->cancel($invoiceRejected, 1);
    }

    public function test_cancellation_confirmed_905_transitions_to_cancelled(): void
    {
        Notification::fake();

        $invoice = $this->createAcceptedInvoice();
        $originalCuf = $invoice->cuf;
        $originalXmlPath = $invoice->xml_path;
        $originalSaleId = $invoice->sale_id;

        $this->fakeSoapClient->willReturn('anulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 905,
                'codigoRecepcion'   => 'REC-CANCEL-CONFIRMED-905',
                'codigoDescripcion' => 'ANULACION CONFIRMADA',
                'mensajesList'      => [],
            ],
        ]);

        $result = $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);

        $this->assertTrue($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED->value, $result['status']);
        $this->assertEquals(905, $result['codigo_estado']);
        $this->assertEquals('sent', $result['buyer_notification_status']);

        // Base de datos actualizada
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED, $invoice->status);
        $this->assertEquals(1, $invoice->cancellation_reason_code);
        $this->assertEquals(905, $invoice->cancellation_status_code);
        $this->assertNotNull($invoice->cancelled_at);
        $this->assertNull($invoice->cancellation_pending_at);

        // Integridad inmutable: CUF, XML y Sale intactos
        $this->assertEquals($originalCuf, $invoice->cuf);
        $this->assertEquals($originalXmlPath, $invoice->xml_path);
        $this->assertEquals($originalSaleId, $invoice->sale_id);

        // Venta comercial intacta (NO borrada, NO modificada a cancelled comercialmente)
        $sale = Sale::find($originalSaleId);
        $this->assertNotNull($sale);
        $this->assertEquals('completed', $sale->status);
        $this->assertEquals(150.00, (float) $sale->total);

        // Auditoría registrada
        $operation = SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)
            ->where('operation', 'cancel')
            ->first();
        $this->assertNotNull($operation);
        $this->assertEquals('success', $operation->transport_status);
        $this->assertEquals(905, $operation->siat_status_code);
        $this->assertEquals('REC-CANCEL-CONFIRMED-905', $operation->reception_code);

        // Notificación al comprador enviada
        Notification::assertSentOnDemand(SiatInvoiceCancelledNotification::class);
    }

    public function test_cancellation_rejected_906_remains_accepted(): void
    {
        Notification::fake();

        $invoice = $this->createAcceptedInvoice();

        $this->fakeSoapClient->willReturn('anulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 906,
                'codigoDescripcion' => 'ANULACION RECHAZADA',
                'mensajesList'      => [
                    ['codigo' => 906, 'descripcion' => 'DOCUMENTO NO CUMPLE CONDICIONES PARA ANULACION'],
                ],
            ],
        ]);

        $result = $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertEquals(906, $result['codigo_estado']);

        // Factura permanece fiscalmente ACCEPTED
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertEquals(906, $invoice->cancellation_status_code);
        $this->assertNull($invoice->cancelled_at);
        $this->assertNull($invoice->cancellation_pending_at);

        // CERO notificaciones enviadas
        Notification::assertNothingSent();

        // Auditoría registrada
        $operation = SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)->first();
        $this->assertNotNull($operation);
        $this->assertEquals('rejected', $operation->transport_status);
        $this->assertEquals(906, $operation->siat_status_code);
    }

    public function test_cancellation_invalid_reason_925(): void
    {
        Notification::fake();

        $invoice = $this->createAcceptedInvoice();

        $this->fakeSoapClient->willReturn('anulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 925,
                'codigoDescripcion' => 'MOTIVO DE ANULACION INVALIDO',
                'mensajesList'      => [
                    ['codigo' => 925, 'descripcion' => 'EL MOTIVO ESPECIFICADO NO ES ACEPTADO'],
                ],
            ],
        ]);

        $result = $this->cancellationService->cancel($invoice, 2, null, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertEquals(925, $result['codigo_estado']);

        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        Notification::assertNothingSent();
    }

    public function test_cancellation_deadline_exceeded_local_validation(): void
    {
        // Factura emitida hace 3 meses (claramente fuera del plazo local)
        $invoice = $this->createAcceptedInvoice([
            'issued_at' => now()->subMonths(3),
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("ha excedido el plazo legal de anulación");

        $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);
    }

    public function test_cancellation_deadline_exceeded_sin_934(): void
    {
        Notification::fake();

        $invoice = $this->createAcceptedInvoice();

        $this->fakeSoapClient->willReturn('anulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 934,
                'codigoDescripcion' => 'SOLICITUD DE ANULACION FUERA DE PLAZO',
                'mensajesList'      => [
                    ['codigo' => 934, 'descripcion' => 'PLAZO DE ANULACION EXPIRADO'],
                ],
            ],
        ]);

        $result = $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertEquals(934, $result['codigo_estado']);

        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        Notification::assertNothingSent();
    }

    public function test_cancellation_transport_timeout_remains_accepted_and_marks_pending(): void
    {
        Notification::fake();

        $invoice = $this->createAcceptedInvoice();

        $this->fakeSoapClient->willThrow('anulacionFactura', new RuntimeException('SoapClient HTTP request timed out after 20 seconds.'));

        $result = $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertTrue($result['cancellation_pending']);
        $this->assertStringContainsString('timed out', $result['error_message']);

        // Factura permanece ACCEPTED
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertNull($invoice->cancelled_at);

        // Auditoría registrada como timeout
        $operation = SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)->first();
        $this->assertNotNull($operation);
        $this->assertEquals('timeout', $operation->transport_status);
        $this->assertNull($operation->siat_status_code);

        Notification::assertNothingSent();
    }

    public function test_concurrency_and_double_click_claim(): void
    {
        $invoice = $this->createAcceptedInvoice([
            'cancellation_pending_at' => now(), // Simulando solicitud concurrente en curso
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("Ya existe una solicitud de anulación en curso");

        $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);
    }

    public function test_idempotency_cancelled_invoice_rejects_second_cancellation(): void
    {
        $invoice = $this->createAcceptedInvoice([
            'status' => ElectronicInvoiceStatus::CANCELLED,
            'cancelled_at' => now(),
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("ya se encuentra anulada fiscalmente");

        $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);
    }

    public function test_buyer_notification_when_buyer_has_no_email_does_not_fail_cancellation(): void
    {
        // Comprador sin correo
        $invoice = $this->createAcceptedInvoice();
        $invoice->sale->customer->update(['email' => null]);

        $this->fakeSoapClient->willReturn('anulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 905,
                'codigoRecepcion'   => 'REC-NO-EMAIL-905',
                'codigoDescripcion' => 'ANULACION CONFIRMADA',
                'mensajesList'      => [],
            ],
        ]);

        $result = $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);

        $this->assertTrue($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED->value, $result['status']);
        $this->assertEquals('unavailable', $result['buyer_notification_status']);

        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED, $invoice->status);
    }

    public function test_pdf_representation_invalidates_cache_and_shows_factura_anulada(): void
    {
        $invoice = $this->createAcceptedInvoice();

        // 1. Generar PDF para factura válida (ACCEPTED)
        $pdfAccepted = $this->representationService->generatePdf($invoice, 'thermal');
        $this->assertFalse($pdfAccepted['from_cache']);
        $this->assertStringContainsString('.pdf', $pdfAccepted['path']);
        $this->assertStringNotContainsString('_cancelled.pdf', $pdfAccepted['path']);

        $htmlAccepted = $this->representationService->renderHtml($invoice, 'thermal');
        $this->assertStringNotContainsString('FACTURA ANULADA', $htmlAccepted);

        // 2. Anular fiscalmente la factura con 905
        $this->fakeSoapClient->willReturn('anulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 905,
                'codigoRecepcion'   => 'REC-PDF-TEST-905',
                'codigoDescripcion' => 'ANULACION CONFIRMADA',
                'mensajesList'      => [],
            ],
        ]);

        $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED, $invoice->status);

        // 3. Renderizado HTML muestra sello obligatorio FACTURA ANULADA
        $htmlCancelled = $this->representationService->renderHtml($invoice, 'thermal');
        $this->assertStringContainsString('FACTURA ANULADA', $htmlCancelled);

        $htmlA4Cancelled = $this->representationService->renderHtml($invoice, 'a4');
        $this->assertStringContainsString('FACTURA ANULADA', $htmlA4Cancelled);

        // 4. Solicitar PDF nuevamente: genera versión con sello ANULADA y no devuelve el cacheado previo
        $pdfCancelled = $this->representationService->generatePdf($invoice, 'thermal');
        $this->assertStringContainsString('_cancelled.pdf', $pdfCancelled['path']);
        $this->assertStringContainsString('%PDF-', $pdfCancelled['content']);

        // El PDF original anterior continúa existiendo en disco para evidencia histórica
        $this->assertTrue(Storage::disk('local')->exists($pdfAccepted['path']));
        $this->assertTrue(Storage::disk('local')->exists($pdfCancelled['path']));
    }

    public function test_kill_switch_blocks_real_client_anulacion_factura(): void
    {
        config(['siat.live_submission_enabled' => false]);

        $realClient = new SiatSoapClient($this->setting);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('kill switch activo: live_submission_enabled = false');

        $realClient->anulacionFactura([
            'codigoAmbiente' => 2,
            'cuf'            => 'TEST-CUF-001',
        ]);
    }

    public function test_controller_cancellation_reasons_endpoint_returns_catalog(): void
    {
        $controller = new \App\Http\Controllers\SiatController($this->factory);

        $response = $controller->cancellationReasons();
        $this->assertEquals(200, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertTrue($data['success']);
        $this->assertNotEmpty($data['data']);
        $this->assertEquals(1, $data['data'][0]['code']);
        $this->assertEquals('FACTURA MAL EMITIDA', $data['data'][0]['description']);
    }

    public function test_controller_cancel_endpoint_confirmed_returns_200(): void
    {
        $invoice = $this->createAcceptedInvoice();
        $controller = new \App\Http\Controllers\SiatController($this->factory);

        $mockCancellationService = $this->createMock(SiatInvoiceCancellationService::class);
        $mockCancellationService->method('cancel')->willReturn([
            'success'                   => true,
            'status'                    => 'cancelled',
            'codigo_estado'             => 905,
            'codigo_recepcion'          => 'REC-CTRL-CANCEL-905',
            'cancellation_pending'      => false,
            'error_message'             => null,
            'cuf'                       => $invoice->cuf,
            'sin_response'              => ['codigoEstado' => 905],
            'buyer_notification_status' => 'sent',
        ]);

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/cancel", 'POST', [
            'reason_code' => 1,
        ]);

        $response = $controller->cancelInvoice($request, $invoice, $mockCancellationService);
        $this->assertEquals(200, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertTrue($data['success']);
        $this->assertSame(905, $data['data']['codigo_estado']);
        $this->assertSame('sent', $data['data']['buyer_notification_status']);

        // Seguridad: no exponer credenciales ni tokens
        $this->assertArrayNotHasKey('token', $data['data']);
        $this->assertArrayNotHasKey('apikey', $data['data']);
        $this->assertArrayNotHasKey('password', $data['data']);
        $this->assertArrayNotHasKey('cuis', $data['data']);
        $this->assertArrayNotHasKey('cufd', $data['data']);
    }

    public function test_controller_cancel_endpoint_rejected_returns_422(): void
    {
        $invoice = $this->createAcceptedInvoice();
        $controller = new \App\Http\Controllers\SiatController($this->factory);

        $mockCancellationService = $this->createMock(SiatInvoiceCancellationService::class);
        $mockCancellationService->method('cancel')->willReturn([
            'success'                   => false,
            'status'                    => 'accepted',
            'codigo_estado'             => 906,
            'codigo_recepcion'          => null,
            'cancellation_pending'      => false,
            'error_message'             => 'ANULACION RECHAZADA',
            'cuf'                       => $invoice->cuf,
            'sin_response'              => ['codigoEstado' => 906],
            'buyer_notification_status' => 'not_sent',
        ]);

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/cancel", 'POST', [
            'reason_code' => 1,
        ]);

        $response = $controller->cancelInvoice($request, $invoice, $mockCancellationService);
        $this->assertEquals(422, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertFalse($data['success']);
        $this->assertSame(906, $data['data']['codigo_estado']);
    }

    public function test_controller_cancel_endpoint_timeout_returns_202(): void
    {
        $invoice = $this->createAcceptedInvoice();
        $controller = new \App\Http\Controllers\SiatController($this->factory);

        $mockCancellationService = $this->createMock(SiatInvoiceCancellationService::class);
        $mockCancellationService->method('cancel')->willReturn([
            'success'                   => false,
            'status'                    => 'accepted',
            'codigo_estado'             => null,
            'codigo_recepcion'          => null,
            'cancellation_pending'      => true,
            'error_message'             => 'HTTP timeout',
            'cuf'                       => $invoice->cuf,
            'sin_response'              => null,
            'buyer_notification_status' => 'not_sent',
        ]);

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/cancel", 'POST', [
            'reason_code' => 1,
        ]);

        $response = $controller->cancelInvoice($request, $invoice, $mockCancellationService);
        $this->assertEquals(202, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertFalse($data['success']);
        $this->assertTrue($data['data']['cancellation_pending']);
    }
}
