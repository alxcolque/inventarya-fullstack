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
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatInvoiceSequence;
use App\Models\SiatLegend;
use App\Models\SiatPaymentMapping;
use App\Models\SiatPaymentMethod;
use App\Models\Store;
use App\Models\User;
use App\Services\Siat\FakeSiatSoapClient;
use App\Services\Siat\SiatCertificateService;
use App\Services\Siat\SiatCufGenerator;
use App\Services\Siat\SiatInvoiceNumberService;
use App\Services\Siat\SiatInvoicePackageBuilder;
use App\Services\Siat\SiatInvoicePreparationService;
use App\Services\Siat\SiatInvoiceSubmissionService;
use App\Services\Siat\SiatInvoiceXmlBuilder;
use App\Services\Siat\SiatInvoiceXmlValidator;
use App\Services\Siat\SiatPaymentMethodMapper;
use App\Services\Siat\SiatServiceFactory;
use App\Services\Siat\SiatSoapClient;
use App\Services\Siat\SiatXmlSignatureValidator;
use App\Services\Siat\SiatXmlSigner;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class SiatInvoiceSubmissionFeatureTest extends TestCase
{
    private User $user;
    private Store $store;
    private Setting $setting;
    private SiatInvoicePreparationService $prepService;
    private SiatCufGenerator $cufGenerator;
    private SiatInvoiceXmlBuilder $xmlBuilder;
    private SiatInvoiceXmlValidator $xmlValidator;
    private SiatXmlSignatureValidator $sigValidator;
    private SiatCertificateService $certService;
    private SiatInvoicePackageBuilder $packageBuilder;
    private SiatInvoiceSubmissionService $submissionService;
    private FakeSiatSoapClient $fakeSoapClient;

    private string $p12Password = 'SubmissionTestPass4E!';
    private string $p12Path = 'tenant/certs/test_tenant_cert.p12';

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureOpenSslConfig();

        config([
            'database.connections.invoice_submission_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_submission_test',
            'siat.live_submission_enabled' => false,
        ]);
        DB::purge('invoice_submission_test');
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
        $this->generateSelfSignedPkcs12();

        $this->xmlValidator = new SiatInvoiceXmlValidator();
        $this->sigValidator = new SiatXmlSignatureValidator();
        $this->certService  = new SiatCertificateService();
        $signer             = new SiatXmlSigner();
        $this->xmlBuilder   = new SiatInvoiceXmlBuilder($this->xmlValidator, $signer, $this->sigValidator, $this->certService);
        $this->cufGenerator = new SiatCufGenerator();
        $this->prepService  = new SiatInvoicePreparationService(
            new SiatInvoiceNumberService(),
            new SiatPaymentMethodMapper()
        );
        $this->packageBuilder = new SiatInvoicePackageBuilder();
        $this->fakeSoapClient = new FakeSiatSoapClient();
        $factory = new SiatServiceFactory();

        $this->submissionService = new SiatInvoiceSubmissionService(
            $this->packageBuilder,
            $this->xmlBuilder,
            $this->xmlValidator,
            $this->sigValidator,
            $factory
        );
    }

    private function ensureOpenSslConfig(): void
    {
        if (empty(getenv('OPENSSL_CONF')) && empty($_SERVER['OPENSSL_CONF'])) {
            $candidates = [
                'C:\\xampp\\apache\\bin\\openssl.cnf',
                'C:\\xampp\\php\\extras\\ssl\\openssl.cnf',
            ];
            foreach ($candidates as $cand) {
                if (file_exists($cand)) {
                    putenv("OPENSSL_CONF={$cand}");
                    $_ENV['OPENSSL_CONF'] = $cand;
                    $_SERVER['OPENSSL_CONF'] = $cand;
                    break;
                }
            }
        }
    }

    private function generateSelfSignedPkcs12(): void
    {
        $cnf = getenv('OPENSSL_CONF') ?: null;
        $args = $cnf ? ['config' => $cnf] : [];

        $dn = [
            'countryName'            => 'BO',
            'stateOrProvinceName'    => 'La Paz',
            'localityName'           => 'La Paz',
            'organizationName'       => 'INVENTARYA TEST S.R.L.',
            'organizationalUnitName' => 'Sistemas SIAT',
            'commonName'             => 'EMPRESA TEST SIAT',
        ];

        $privKey = openssl_pkey_new(array_merge($args, [
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]));

        $csr = openssl_csr_new($dn, $privKey, $args);
        $cert = openssl_csr_sign($csr, null, $privKey, 365, array_merge($args, [
            'digest_alg' => 'sha256',
        ]));

        openssl_pkcs12_export($cert, $p12Out, $privKey, $this->p12Password);
        Storage::disk('local')->put($this->p12Path, $p12Out);
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
            'name'                        => 'Sucursal Central 4E',
            'location'                    => 'La Paz',
            'address'                     => 'Av. 6 de Agosto #2450',
            'phone'                       => '22446688',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 0,
            'sin_point_of_sale_code'      => 0,
        ]);

        $this->setting = Setting::create([
            'tax_nit'                   => '1003579028',
            'tax_business_name'         => 'INVENTARYA TEST S.R.L.',
            'address'                   => 'Av. 6 de Agosto #2450',
            'phone'                     => '22446688',
            'siat_environment'          => 2, // Piloto
            'siat_modality'             => 1, // Electrónica en línea
            'siat_system_code'          => 'SYS-4E-TEST-001',
            'siat_api_token'            => 'FAKE-API-TOKEN-4E-999',
            'siat_certificate_path'     => $this->p12Path,
            'siat_certificate_password' => $this->p12Password,
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
    }

    private function createPreparedInvoice(int $modality = 1): ElectronicInvoice
    {
        $this->setting->update(['siat_modality' => $modality]);

        $cufd = SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-VALID-4E-XYZ-1234567890',
            'control_code'       => 'CTRL-4E-998877',
            'valid_from'         => now()->subHour(),
            'valid_until'        => now()->addHours(20),
            'is_active'          => true,
        ]);

        $customer = Customer::create([
            'name'                => 'JUAN PEREZ PEREZ',
            'document_type'       => 1,
            'document_number'     => '5544332',
            'document_complement' => null,
        ]);

        $product = Product::create([
            'name'              => 'TECLADO MECANICO RGB',
            'sku'               => 'TEC-RGB-001',
            'sin_product_code'  => '84711',
            'sin_activity_code' => '471100',
            'sin_unit_code'     => 57,
        ]);

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'customer_id'    => $customer->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '150.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 150.00,
            'subtotal'   => 150.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);
        $this->xmlBuilder->buildAndPersist($invoice);

        return $invoice->fresh(['details', 'siatCufd', 'store']);
    }

    // =========================================================================
    // CASO 1: MODALIDAD 1 — E2E ACEPTADA (CÓDIGO 908)
    // =========================================================================

    public function test_modalidad_1_e2e_successful_submission_accepted_by_sin(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $this->assertEquals(ElectronicInvoiceStatus::DRAFT, $invoice->status);

        $fakeReceptionCode = 'REC-M1-' . Str::uuid()->toString();

        $this->fakeSoapClient->willReturn('recepcionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 908, // VALIDADA / ACEPTADA
                'codigoRecepcion'   => $fakeReceptionCode,
                'codigoDescripcion' => 'VALIDADA',
                'mensajesList'      => [],
            ],
        ]);

        $result = $this->submissionService->submit($invoice, $this->fakeSoapClient);

        // 1. Verificación del resultado retornado
        $this->assertTrue($result['success']);
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertSame(908, $result['codigo_estado']);
        $this->assertSame($fakeReceptionCode, $result['codigo_recepcion']);
        $this->assertNull($result['error_message']);
        $this->assertNotEmpty($result['hash_archivo']);
        $this->assertGreaterThan(0, $result['compressed_size']);

        // 2. Verificación de persistencia en base de datos
        $fresh = $invoice->fresh();
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED, $fresh->status);
        $this->assertSame($fakeReceptionCode, $fresh->reception_code);
        $this->assertNull($fresh->error_message);
        $this->assertEquals(908, $fresh->sin_response['codigoEstado']);

        // 3. Inspección del llamado registrado por Fake
        $calls = $this->fakeSoapClient->recordedCalls();
        $this->assertArrayHasKey('recepcionFactura', $calls);
        $solicitud = $calls['recepcionFactura']['solicitud'];

        $this->assertSame(2, $solicitud['codigoAmbiente']);
        $this->assertSame(1, $solicitud['codigoDocumentoSector']);
        $this->assertSame(1, $solicitud['codigoEmision']);
        $this->assertSame(1, $solicitud['codigoModalidad']);
        $this->assertSame(0, $solicitud['codigoPuntoVenta']);
        $this->assertSame(0, $solicitud['codigoSucursal']);
        $this->assertSame('SYS-4E-TEST-001', $solicitud['codigoSistema']);
        $this->assertSame('CUIS-ACTIVE-BRANCH0-POS0', $solicitud['cuis']);
        $this->assertSame(1003579028, $solicitud['nit']);
        $this->assertSame(1, $solicitud['tipoFacturaDocumento']);
        $this->assertSame($result['hash_archivo'], $solicitud['hashArchivo']);

        // 4. El archivo enviado es un GZIP válido que al descomprimir mantiene la firma digital
        $decompressed = $this->packageBuilder->decompress($solicitud['archivo']);
        $this->assertStringContainsString('Signature', $decompressed);
        $sigCheck = $this->sigValidator->validateDetails($decompressed);
        $this->assertTrue($sigCheck['is_valid']);
    }

    // =========================================================================
    // CASO 2: MODALIDAD 2 — E2E ACEPTADA (CÓDIGO 908)
    // =========================================================================

    public function test_modalidad_2_e2e_successful_submission_accepted_by_sin(): void
    {
        $invoice = $this->createPreparedInvoice(2);
        $this->assertEquals(ElectronicInvoiceStatus::DRAFT, $invoice->status);

        $fakeReceptionCode = 'REC-M2-' . Str::uuid()->toString();

        $this->fakeSoapClient->willReturn('recepcionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 908,
                'codigoRecepcion'   => $fakeReceptionCode,
                'codigoDescripcion' => 'VALIDADA',
                'mensajesList'      => [],
            ],
        ]);

        $result = $this->submissionService->submit($invoice, $this->fakeSoapClient);

        $this->assertTrue($result['success']);
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED->value, $result['status']);
        $this->assertSame(908, $result['codigo_estado']);

        $fresh = $invoice->fresh();
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED, $fresh->status);

        // En Modalidad 2, el XML dentro del GZIP NO debe tener Signature
        $calls = $this->fakeSoapClient->recordedCalls();
        $decompressed = $this->packageBuilder->decompress($calls['recepcionFactura']['solicitud']['archivo']);
        $this->assertStringNotContainsString('Signature', $decompressed);
    }

    // =========================================================================
    // CASO 3: RECHAZO FISCAL POR EL SIN (CÓDIGO 902)
    // =========================================================================

    public function test_sin_rejection_marks_invoice_rejected_and_keeps_sale_intact(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $originalSaleTotal = $invoice->sale->total;

        $this->fakeSoapClient->willReturn('recepcionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 902, // RECHAZADA
                'codigoRecepcion'   => null,
                'codigoDescripcion' => 'RECHAZADA',
                'mensajesList'      => [
                    ['codigo' => 1024, 'descripcion' => 'EL CUFD PROPORCIONADO NO SE ENCUENTRA ACTIVO'],
                ],
            ],
        ]);

        $result = $this->submissionService->submit($invoice, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertSame(ElectronicInvoiceStatus::REJECTED->value, $result['status']);
        $this->assertSame(902, $result['codigo_estado']);
        $this->assertStringContainsString('1024', $result['error_message']);

        // Estado en DB
        $fresh = $invoice->fresh();
        $this->assertSame(ElectronicInvoiceStatus::REJECTED, $fresh->status);
        $this->assertStringContainsString('EL CUFD PROPORCIONADO NO SE ENCUENTRA ACTIVO', $fresh->error_message);

        // Integridad inmutable: La venta comercial permanece intacta
        $this->assertEquals($originalSaleTotal, $fresh->sale->fresh()->total);
        $this->assertNotNull($fresh->cuf);
        $this->assertNotNull($fresh->invoice_number);
    }

    // =========================================================================
    // CASO 4: TIMEOUT O ERROR DE RED AMBIGUO (TIMEOUT ≠ REJECTED)
    // =========================================================================

    public function test_transport_timeout_marks_invoice_as_processing_without_blind_retry(): void
    {
        $invoice = $this->createPreparedInvoice(1);

        // Simulamos timeout de red
        $this->fakeSoapClient->willThrow(
            'recepcionFactura',
            new RuntimeException('cURL error 28: Operation timed out after 20000 milliseconds with 0 bytes received')
        );

        try {
            $this->submissionService->submit($invoice, $this->fakeSoapClient);
            $this->fail('Se esperaba que el timeout lanzara una excepción.');
        } catch (\Throwable $e) {
            $this->assertStringContainsString('Operation timed out', $e->getMessage());
        }

        // REGLA CRÍTICA:
        // NO aceptada.
        // NO rechazada.
        // Permanece en PROCESSING como resultado fiscal ambiguo.
        $fresh = $invoice->fresh();
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $fresh->status);
        $this->assertStringContainsString('Error de transporte / resultado fiscal ambiguo', $fresh->error_message);
        $this->assertTrue($fresh->sin_response['transport_error']);
    }

    // =========================================================================
    // CASO 5: IDEMPOTENCIA Y PROTECCIÓN ANTE REENVÍO CIEGO
    // =========================================================================

    public function test_cannot_resubmit_already_accepted_or_processing_invoice(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::ACCEPTED, 'reception_code' => 'REC-EXISTING-123']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('ya fue aceptada previamente por el SIN');

        $this->submissionService->submit($invoice, $this->fakeSoapClient);
    }

    public function test_cannot_resubmit_already_rejected_invoice_blindly(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::REJECTED]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('fue rechazada por el SIN. No se puede reenviar ciegamente');

        $this->submissionService->submit($invoice, $this->fakeSoapClient);
    }

    // =========================================================================
    // CASO 6: CONCURRENCIA ("DOBLE CLICK")
    // =========================================================================

    public function test_concurrency_double_claim_prevents_duplicate_soap_calls(): void
    {
        $invoice = $this->createPreparedInvoice(1);

        // Simulamos que una primera petición ya puso la factura en PROCESSING durante el claim
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('ya se encuentra en procesamiento');

        // La segunda petición concurrente es rechazada antes de tocar SOAP
        $this->submissionService->submit($invoice, $this->fakeSoapClient);
    }

    // =========================================================================
    // CASO 7: KILL SWITCH — BLOQUEO DE LLAMADAS REALES AL SIN
    // =========================================================================

    public function test_kill_switch_blocks_real_siat_soap_client_before_network_io(): void
    {
        config(['siat.live_submission_enabled' => false]);

        $realClient = new SiatSoapClient($this->setting);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('kill switch activo: live_submission_enabled = false');

        $realClient->recepcionFactura([
            'SolicitudServicioRecepcionFactura' => ['nit' => 123456789]
        ]);
    }

    // =========================================================================
    // CASO 8: ENDPOINT HTTP CONTROLADO (POST /siat/invoices/{invoice}/submit)
    // =========================================================================

    public function test_controller_submit_invoice_returns_200_and_safe_payload_on_accepted(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $fakeReceptionCode = 'REC-HTTP-ACCEPTED-' . Str::uuid()->toString();

        $this->fakeSoapClient->willReturn('recepcionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 908,
                'codigoRecepcion'   => $fakeReceptionCode,
                'codigoDescripcion' => 'VALIDADA',
                'mensajesList'      => [],
            ],
        ]);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory()
        );

        // Bind client in container or mock service
        $customSubmissionService = new SiatInvoiceSubmissionService(
            $this->packageBuilder,
            $this->xmlBuilder,
            $this->xmlValidator,
            $this->sigValidator,
            new \App\Services\Siat\SiatServiceFactory()
        );

        // Invocamos submit inyectando el FakeSoapClient
        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/submit", 'POST');
        
        // Creamos un wrapper o mock de servicio para simular DI en controller
        $mockSubmissionService = $this->createMock(SiatInvoiceSubmissionService::class);
        $mockSubmissionService->method('submit')->willReturn([
            'success'          => true,
            'status'           => 'accepted',
            'codigo_estado'    => 908,
            'codigo_recepcion' => $fakeReceptionCode,
            'error_message'    => null,
            'hash_archivo'     => 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            'compressed_size'  => 1024,
            'sin_response'     => ['codigoEstado' => 908],
        ]);

        $response = $controller->submitInvoice($request, $invoice, $mockSubmissionService);

        $this->assertEquals(200, $response->getStatusCode());
        $data = $response->getData(true);

        $this->assertTrue($data['success']);
        $this->assertSame($invoice->id, $data['data']['invoice_id']);
        $this->assertSame('accepted', $data['data']['status']);
        $this->assertSame(908, $data['data']['codigo_estado']);
        $this->assertSame($fakeReceptionCode, $data['data']['codigo_recepcion']);
        $this->assertNull($data['data']['error_message']);

        // Verificamos que NO se filtran datos sensibles
        $this->assertArrayNotHasKey('token', $data['data']);
        $this->assertArrayNotHasKey('apikey', $data['data']);
        $this->assertArrayNotHasKey('password', $data['data']);
        $this->assertArrayNotHasKey('archivo', $data['data']);
        $this->assertArrayNotHasKey('xml', $data['data']);
    }

    public function test_controller_submit_invoice_returns_422_on_sin_rejection(): void
    {
        $invoice = $this->createPreparedInvoice(1);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory()
        );

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/submit", 'POST');

        $mockSubmissionService = $this->createMock(SiatInvoiceSubmissionService::class);
        $mockSubmissionService->method('submit')->willReturn([
            'success'          => false,
            'status'           => 'rejected',
            'codigo_estado'    => 902,
            'codigo_recepcion' => null,
            'error_message'    => '[1024] EL CUFD PROPORCIONADO NO SE ENCUENTRA ACTIVO',
            'hash_archivo'     => 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            'compressed_size'  => 1024,
            'sin_response'     => ['codigoEstado' => 902],
        ]);

        $response = $controller->submitInvoice($request, $invoice, $mockSubmissionService);

        $this->assertEquals(422, $response->getStatusCode());
        $data = $response->getData(true);

        $this->assertFalse($data['success']);
        $this->assertSame('rejected', $data['data']['status']);
        $this->assertSame(902, $data['data']['codigo_estado']);
        $this->assertStringContainsString('1024', $data['data']['error_message']);
    }

    public function test_recepcion_factura_returns_904_observed_preserves_observations_and_remains_processing(): void
    {
        $invoice = $this->createPreparedInvoice(1);

        $fakeReceptionCode = 'REC-OBS-904-XYZ';
        $this->fakeSoapClient->willReturn('recepcionFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 904,
                'codigoRecepcion'   => $fakeReceptionCode,
                'codigoDescripcion' => 'OBSERVADA',
                'mensajesList'      => [
                    ['codigo' => 9901, 'descripcion' => 'Advertencia: NIT no coincide con padrón biométrico'],
                ],
            ],
        ]);

        $result = $this->submissionService->submit($invoice, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertSame('processing', $result['status']);
        $this->assertSame(904, $result['codigo_estado']);
        $this->assertSame($fakeReceptionCode, $result['codigo_recepcion']);
        $this->assertStringContainsString('9901', $result['error_message']);

        $fresh = $invoice->fresh();
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $fresh->status);
        $this->assertSame($fakeReceptionCode, $fresh->reception_code);
        $this->assertStringContainsString('Advertencia: NIT no coincide', $fresh->error_message);
        $this->assertNotNull($fresh->next_verification_at);

        // Verify operation was logged
        $this->assertDatabaseHas('siat_invoice_operations', [
            'electronic_invoice_id' => $invoice->id,
            'operation'             => 'submit',
            'siat_status_code'      => 904,
            'reception_code'        => $fakeReceptionCode,
        ]);
    }
}
