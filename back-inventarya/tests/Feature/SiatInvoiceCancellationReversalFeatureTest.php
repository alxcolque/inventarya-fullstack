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
use App\Models\Store;
use App\Models\User;
use App\Notifications\Tenant\SiatInvoiceCancellationReversedNotification;
use App\Services\Siat\FakeSiatSoapClient;
use App\Services\Siat\SiatCancellationDeadlineService;
use App\Services\Siat\SiatInvoiceCancellationReversalService;
use App\Services\Siat\SiatInvoiceCancellationService;
use App\Services\Siat\SiatInvoiceRepresentationService;
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

class SiatInvoiceCancellationReversalFeatureTest extends TestCase
{
    private User $user;
    private Store $store;
    private Setting $setting;
    private FakeSiatSoapClient $fakeSoapClient;
    private SiatCancellationDeadlineService $deadlineService;
    private SiatInvoiceCancellationService $cancellationService;
    private SiatInvoiceCancellationReversalService $reversalService;
    private SiatInvoiceRepresentationService $representationService;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.invoice_reversal_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_reversal_test',
            'siat.live_submission_enabled' => false,
        ]);
        DB::purge('invoice_reversal_test');
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
            $table->string('siat_system_code')->default('SYS-REV-TEST');
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
        (require database_path('migrations/tenant/2026_10_12_000014_add_cancellation_reversal_fields_to_electronic_invoices_table.php'))->up();

        $this->seedInitialData();

        $this->fakeSoapClient = new FakeSiatSoapClient();
        $this->app->instance(SiatSoapClientInterface::class, $this->fakeSoapClient);

        $this->deadlineService = new SiatCancellationDeadlineService();
        $this->cancellationService = new SiatInvoiceCancellationService(new \App\Services\Siat\SiatServiceFactory(), $this->deadlineService);
        $this->reversalService = new SiatInvoiceCancellationReversalService($this->deadlineService);
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
            'siat_system_code'             => 'SYS-REV-TEST',
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

        SiatCancellationReason::create(['code' => 1, 'description' => 'FACTURA MAL EMITIDA']);
    }

    private function createCancelledInvoice(array $overrides = []): ElectronicInvoice
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
            'total'          => 200.00,
            'payment_method' => 'efectivo',
            'status'         => 'completed',
        ]);

        $product = Product::create([
            'id'                => (string) Str::uuid(),
            'name'              => 'Monitor LED 24',
            'sin_product_code'  => '47111',
            'sin_activity_code' => '471110',
        ]);

        SaleDetail::create([
            'id'         => (string) Str::uuid(),
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 200.00,
            'subtotal'   => 200.00,
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
            'invoice_number'          => 202,
            'cuf'                     => $defaultCuf,
            'cufd_snapshot'           => 'CUFD-TEST-OPERATIVE-1234567890',
            'issued_at'               => now(),
            'document_sector_code'    => 1,
            'subtotal'                => 200.00,
            'total'                   => 200.00,
            'total_subject_to_vat'    => 200.00,
            'currency_code'           => 1,
            'payment_method_code'     => 1,
            'legend'                  => 'Ley N° 453',
            'status'                  => ElectronicInvoiceStatus::CANCELLED,
            'cancellation_reason_code'=> 1,
            'cancelled_at'            => now()->subHour(),
            'cancellation_status_code'=> 905,
            'reception_code'          => 'REC-' . (string) Str::uuid(),
            'sin_response'            => ['codigoEstado' => 905, 'codigoRecepcion' => 'REC-CANCELLED'],
            'xml_path'                => 'tenant/siat/invoices/2026/10/invoice_202.xml',
        ], $overrides));

        ElectronicInvoiceDetail::create([
            'id'                    => (string) Str::uuid(),
            'electronic_invoice_id' => $invoice->id,
            'product_id'            => $product->id,
            'product_code'          => 'MON-24',
            'description'           => 'Monitor LED 24',
            'quantity'              => 1,
            'unit_price'            => 200.00,
            'discount'              => 0,
            'subtotal'              => 200.00,
            'sin_product_code'      => 47111,
            'activity_code'         => '471110',
            'unit_code'             => 58,
        ]);

        // Registrar operación histórica de anulación confirmada (905)
        SiatInvoiceOperation::create([
            'electronic_invoice_id' => $invoice->id,
            'operation'             => 'cancel',
            'started_at'            => now()->subHour(),
            'finished_at'           => now()->subHour(),
            'transport_status'      => 'success',
            'siat_status_code'      => 905,
            'reception_code'        => 'REC-CANCEL-OP-905',
            'response'              => ['codigoEstado' => 905],
        ]);

        return $invoice;
    }

    public function test_cannot_reverse_invoice_not_in_cancelled_status(): void
    {
        $invoiceAccepted = $this->createCancelledInvoice([
            'status' => ElectronicInvoiceStatus::ACCEPTED,
            'cancellation_status_code' => null,
            'cancelled_at' => null,
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("Solo es posible revertir la anulación de facturas en estado CANCELLED");

        $this->reversalService->reverse($invoiceAccepted);
    }

    public function test_cannot_reverse_cancelled_invoice_without_905_evidence(): void
    {
        // Factura artificialmente CANCELLED pero sin 905 en base de datos ni auditoría
        $invoiceSuspicious = $this->createCancelledInvoice([
            'cancellation_status_code' => 906, // no 905
        ]);
        SiatInvoiceOperation::where('electronic_invoice_id', $invoiceSuspicious->id)->delete();

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("No existe evidencia fiscal de anulación confirmada (Código 905)");

        $this->reversalService->reverse($invoiceSuspicious);
    }

    public function test_reversal_confirmed_907_transitions_to_accepted_and_reinstates_tax_credit(): void
    {
        Notification::fake();

        $invoice = $this->createCancelledInvoice();
        $originalCuf = $invoice->cuf;
        $originalXmlPath = $invoice->xml_path;
        $originalSaleId = $invoice->sale_id;

        $this->fakeSoapClient->willReturn('reversionAnulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 907,
                'codigoRecepcion'   => 'REC-REVERSE-CONFIRMED-907',
                'codigoDescripcion' => 'REVERSION DE ANULACION CONFIRMADA',
                'mensajesList'      => [],
            ],
        ]);

        $result = $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);

        $this->assertTrue($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertEquals(907, $result['codigo_estado']);
        $this->assertEquals('sent', $result['buyer_notification_status']);

        // Factura actualizada en BD a ACCEPTED
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertTrue($invoice->isCancellationReversed());
        $this->assertNotNull($invoice->cancellation_reversed_at);
        $this->assertEquals(907, $invoice->cancellation_reversal_status_code);
        $this->assertNull($invoice->cancellation_reversal_pending_at);
        $this->assertNull($invoice->cancellation_pending_at);

        // Inmutabilidad estricta: NO se crea nueva factura, CUF, XML y Sale permanecen intactos
        $this->assertEquals($originalCuf, $invoice->cuf);
        $this->assertEquals($originalXmlPath, $invoice->xml_path);
        $this->assertEquals($originalSaleId, $invoice->sale_id);

        // Auditoría registrada
        $operation = SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)
            ->where('operation', 'reverse_cancel')
            ->first();
        $this->assertNotNull($operation);
        $this->assertEquals('success', $operation->transport_status);
        $this->assertEquals(907, $operation->siat_status_code);
        $this->assertEquals('REC-REVERSE-CONFIRMED-907', $operation->reception_code);

        // Notificación al comprador despachada
        Notification::assertSentOnDemand(SiatInvoiceCancellationReversedNotification::class);
    }

    public function test_modalidad_1_reversal_preserves_xml_and_signature_intact(): void
    {
        $invoice = $this->createCancelledInvoice(['siat_modality' => 1]);
        $originalXmlPath = $invoice->xml_path;

        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
        $invoice->refresh();

        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertEquals($originalXmlPath, $invoice->xml_path);
        $this->assertEquals(1, $invoice->siat_modality);
    }

    public function test_modalidad_2_reversal_preserves_xml_intact(): void
    {
        $invoice = $this->createCancelledInvoice(['siat_modality' => 2]);
        $originalXmlPath = $invoice->xml_path;

        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
        $invoice->refresh();

        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertEquals($originalXmlPath, $invoice->xml_path);
        $this->assertEquals(2, $invoice->siat_modality);
    }

    public function test_reversal_can_only_be_executed_once_permanent_re_cancellation_prohibition(): void
    {
        // 1. Factura cancelada -> reversión exitosa (907) -> vuelve a ACCEPTED
        $invoice = $this->createCancelledInvoice();
        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertTrue($invoice->isCancellationReversed());

        // 2. Intento de re-anular la factura revertida
        // Regla obligatoria: SiatInvoiceCancellationService debe rechazar permanentemente
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("CANCELLATION_AFTER_REVERSAL_NOT_ALLOWED");

        $this->cancellationService->cancel($invoice, 1, null, $this->fakeSoapClient);
    }

    public function test_double_reversal_attempt_is_rejected_without_soap_call(): void
    {
        // 1. Reversión exitosa
        $invoice = $this->createCancelledInvoice();
        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
        $invoice->refresh();

        // 2. Intento de segunda reversión
        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("Solo es posible revertir la anulación de facturas en estado CANCELLED");

        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
    }

    public function test_reversal_rejected_by_sin_remains_cancelled(): void
    {
        Notification::fake();

        $invoice = $this->createCancelledInvoice();

        $this->fakeSoapClient->willReturn('reversionAnulacionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 981,
                'codigoDescripcion' => 'FACTURA NO DISPONIBLE PARA REVERSION',
                'mensajesList'      => [
                    ['codigo' => 981, 'descripcion' => 'NO CUMPLE CONDICIONES DE REVERSION'],
                ],
            ],
        ]);

        $result = $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED->value, $result['status']);
        $this->assertEquals(981, $result['codigo_estado']);

        // Factura permanece CANCELLED
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED, $invoice->status);
        $this->assertEquals(981, $invoice->cancellation_reversal_status_code);
        $this->assertNull($invoice->cancellation_reversed_at);
        $this->assertNull($invoice->cancellation_reversal_pending_at);

        Notification::assertNothingSent();

        // Auditoría registrada como rechazo
        $operation = SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)
            ->where('operation', 'reverse_cancel')
            ->first();
        $this->assertNotNull($operation);
        $this->assertEquals('rejected', $operation->transport_status);
        $this->assertEquals(981, $operation->siat_status_code);
    }

    public function test_reversal_transport_timeout_remains_cancelled_and_marks_pending(): void
    {
        Notification::fake();

        $invoice = $this->createCancelledInvoice();

        $this->fakeSoapClient->willThrow('reversionAnulacionFactura', new RuntimeException('Connection timed out after 20000ms'));

        $result = $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED->value, $result['status']);
        $this->assertTrue($result['reversal_pending']);
        $this->assertStringContainsString('timed out', $result['error_message']);

        // Permanece CANCELLED con marca de pendiente
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::CANCELLED, $invoice->status);
        $this->assertNull($invoice->cancellation_reversed_at);

        // Auditoría registrada como timeout
        $operation = SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)
            ->where('operation', 'reverse_cancel')
            ->first();
        $this->assertNotNull($operation);
        $this->assertEquals('timeout', $operation->transport_status);

        Notification::assertNothingSent();
    }

    public function test_concurrency_and_double_click_claim_prevents_duplicate_soap_calls(): void
    {
        $invoice = $this->createCancelledInvoice([
            'cancellation_reversal_pending_at' => now(), // Solicitud en curso
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("Ya existe una solicitud de reversión de anulación en curso");

        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
    }

    public function test_reversal_deadline_exceeded_local_validation(): void
    {
        // Factura emitida hace 3 meses
        $invoice = $this->createCancelledInvoice([
            'issued_at' => now()->subMonths(3),
        ]);

        $this->expectException(SiatFiscalException::class);
        $this->expectExceptionMessage("ha excedido el plazo legal para reversión de anulación");

        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
    }

    public function test_pdf_representation_sequence_accepted_cancelled_reinstated(): void
    {
        $invoice = $this->createCancelledInvoice([
            'status' => ElectronicInvoiceStatus::ACCEPTED,
            'cancellation_status_code' => null,
            'cancelled_at' => null,
        ]);

        // 1. PDF Estado Válido Inicial
        $pdfAccepted = $this->representationService->generatePdf($invoice, 'thermal');
        $this->assertStringContainsString('.pdf', $pdfAccepted['path']);
        $this->assertStringNotContainsString('_cancelled.pdf', $pdfAccepted['path']);
        $this->assertStringNotContainsString('_reinstated.pdf', $pdfAccepted['path']);

        // 2. Anulación -> PDF con sello FACTURA ANULADA
        $invoice->update([
            'status' => ElectronicInvoiceStatus::CANCELLED,
            'cancellation_status_code' => 905,
            'cancelled_at' => now(),
            'pdf_path' => null,
        ]);
        SiatInvoiceOperation::create([
            'electronic_invoice_id' => $invoice->id,
            'operation'             => 'cancel',
            'started_at'            => now(),
            'finished_at'           => now(),
            'transport_status'      => 'success',
            'siat_status_code'      => 905,
        ]);

        $pdfCancelled = $this->representationService->generatePdf($invoice, 'thermal');
        $this->assertStringContainsString('_cancelled.pdf', $pdfCancelled['path']);
        $htmlCancelled = $this->representationService->renderHtml($invoice, 'thermal');
        $this->assertStringContainsString('FACTURA ANULADA', $htmlCancelled);

        // 3. Reversión -> Vuelve a ser Válido -> PDF Reinstated
        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
        $invoice->refresh();
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);

        $htmlReinstated = $this->representationService->renderHtml($invoice, 'thermal');
        $this->assertStringNotContainsString('FACTURA ANULADA', $htmlReinstated);

        $pdfReinstated = $this->representationService->generatePdf($invoice, 'thermal');
        $this->assertStringContainsString('_reinstated.pdf', $pdfReinstated['path']);
        $this->assertStringContainsString('%PDF-', $pdfReinstated['content']);

        // Evidencia histórica: los 3 archivos coexisten intactos en el almacenamiento
        $this->assertTrue(Storage::disk('local')->exists($pdfAccepted['path']));
        $this->assertTrue(Storage::disk('local')->exists($pdfCancelled['path']));
        $this->assertTrue(Storage::disk('local')->exists($pdfReinstated['path']));
    }

    public function test_qr_payload_remains_strictly_identical_before_during_and_after_reversal(): void
    {
        $qrService = $this->app->make(\App\Services\Siat\SiatInvoiceQrService::class);

        $invoice = $this->createCancelledInvoice();
        $qrCancelled = $qrService->buildUrlFromInvoice($invoice);

        $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);
        $invoice->refresh();

        $qrReinstated = $qrService->buildUrlFromInvoice($invoice);

        $this->assertEquals($qrCancelled, $qrReinstated);
    }

    public function test_buyer_notification_on_reversal_when_buyer_has_no_email_does_not_fail(): void
    {
        $invoice = $this->createCancelledInvoice();
        $invoice->sale->customer->update(['email' => null]);

        $result = $this->reversalService->reverse($invoice, null, $this->fakeSoapClient);

        $this->assertTrue($result['success']);
        $this->assertEquals(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertEquals('unavailable', $result['buyer_notification_status']);
    }

    public function test_kill_switch_blocks_real_client_reversion_anulacion_factura(): void
    {
        config(['siat.live_submission_enabled' => false]);

        $realClient = new SiatSoapClient($this->setting);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('kill switch activo: live_submission_enabled = false');

        $realClient->reversionAnulacionFactura([
            'codigoAmbiente' => 2,
            'cuf'            => 'TEST-CUF-001',
        ]);
    }

    public function test_controller_reverse_endpoint_confirmed_returns_200(): void
    {
        $invoice = $this->createCancelledInvoice();
        $controller = new \App\Http\Controllers\SiatController(new \App\Services\Siat\SiatServiceFactory());

        $mockReversalService = $this->createMock(SiatInvoiceCancellationReversalService::class);
        $mockReversalService->method('reverse')->willReturn([
            'success'                   => true,
            'status'                    => 'accepted',
            'codigo_estado'             => 907,
            'codigo_recepcion'          => 'REC-CTRL-REV-907',
            'reversal_pending'          => false,
            'error_message'             => null,
            'cuf'                       => $invoice->cuf,
            'sin_response'              => ['codigoEstado' => 907],
            'buyer_notification_status' => 'sent',
        ]);

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/reverse-cancellation", 'POST');

        $response = $controller->reverseCancellation($request, $invoice, $mockReversalService);
        $this->assertEquals(200, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertTrue($data['success']);
        $this->assertSame(907, $data['data']['codigo_estado']);

        // Seguridad: no exponer credenciales ni tokens
        $this->assertArrayNotHasKey('token', $data['data']);
        $this->assertArrayNotHasKey('apikey', $data['data']);
        $this->assertArrayNotHasKey('password', $data['data']);
        $this->assertArrayNotHasKey('cuis', $data['data']);
        $this->assertArrayNotHasKey('cufd', $data['data']);
    }

    public function test_controller_reverse_endpoint_rejected_returns_422(): void
    {
        $invoice = $this->createCancelledInvoice();
        $controller = new \App\Http\Controllers\SiatController(new \App\Services\Siat\SiatServiceFactory());

        $mockReversalService = $this->createMock(SiatInvoiceCancellationReversalService::class);
        $mockReversalService->method('reverse')->willReturn([
            'success'                   => false,
            'status'                    => 'cancelled',
            'codigo_estado'             => 981,
            'codigo_recepcion'          => null,
            'reversal_pending'          => false,
            'error_message'             => 'FACTURA NO DISPONIBLE PARA REVERSION',
            'cuf'                       => $invoice->cuf,
            'sin_response'              => ['codigoEstado' => 981],
            'buyer_notification_status' => 'not_sent',
        ]);

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/reverse-cancellation", 'POST');

        $response = $controller->reverseCancellation($request, $invoice, $mockReversalService);
        $this->assertEquals(422, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertFalse($data['success']);
        $this->assertSame(981, $data['data']['codigo_estado']);
    }

    public function test_controller_reverse_endpoint_timeout_returns_202(): void
    {
        $invoice = $this->createCancelledInvoice();
        $controller = new \App\Http\Controllers\SiatController(new \App\Services\Siat\SiatServiceFactory());

        $mockReversalService = $this->createMock(SiatInvoiceCancellationReversalService::class);
        $mockReversalService->method('reverse')->willReturn([
            'success'                   => false,
            'status'                    => 'cancelled',
            'codigo_estado'             => null,
            'codigo_recepcion'          => null,
            'reversal_pending'          => true,
            'error_message'             => 'HTTP timeout',
            'cuf'                       => $invoice->cuf,
            'sin_response'              => null,
            'buyer_notification_status' => 'not_sent',
        ]);

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/reverse-cancellation", 'POST');

        $response = $controller->reverseCancellation($request, $invoice, $mockReversalService);
        $this->assertEquals(202, $response->getStatusCode());

        $data = $response->getData(true);
        $this->assertFalse($data['success']);
        $this->assertTrue($data['data']['reversal_pending']);
    }
}
