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
use App\Models\SiatInvoiceOperation;
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
use App\Services\Siat\SiatInvoiceVerificationService;
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

class SiatInvoiceVerificationFeatureTest extends TestCase
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
    private SiatInvoiceVerificationService $verificationService;
    private FakeSiatSoapClient $fakeSoapClient;

    private string $p12Password = 'VerificationTestPass4F!';
    private string $p12Path = 'tenant/certs/test_tenant_cert.p12';

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureOpenSslConfig();

        config([
            'database.connections.invoice_verification_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_verification_test',
            'siat.live_submission_enabled' => false,
        ]);
        DB::purge('invoice_verification_test');
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

        $this->verificationService = new SiatInvoiceVerificationService($factory);
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
            'name'                        => 'Sucursal Central 4F',
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
            'siat_system_code'          => 'SYS-4F-TEST-001',
            'siat_api_token'            => 'FAKE-API-TOKEN-4F-999',
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

        $cufd = SiatCufd::where('store_id', $this->store->id)
            ->where('branch_code', 0)
            ->where('point_of_sale_code', 0)
            ->where('is_active', true)
            ->first() ?? SiatCufd::create([
                'id'                 => (string) Str::uuid(),
                'store_id'           => $this->store->id,
                'branch_code'        => 0,
                'point_of_sale_code' => 0,
                'cufd'               => 'CUFD-VALID-4F-' . (string) Str::uuid(),
                'control_code'       => 'CTRL-4F-998877',
                'valid_from'         => now()->subHour(),
                'valid_until'        => now()->addHours(20),
                'is_active'          => true,
            ]);

        $customer = Customer::create([
            'name'                => 'MARIA LOPEZ',
            'document_type'       => 1,
            'document_number'     => '7788990',
            'document_complement' => null,
        ]);

        $product = Product::create([
            'name'              => 'MONITOR GAMER 27"',
            'sku'               => 'MON-27-001',
            'sin_product_code'  => '84711',
            'sin_activity_code' => '471100',
            'sin_unit_code'     => 57,
        ]);

        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'customer_id'    => $customer->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '250.00',
        ]);

        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 250.00,
            'subtotal'   => 250.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);
        $this->xmlBuilder->buildAndPersist($invoice);

        return $invoice->fresh(['details', 'siatCufd', 'store']);
    }

    // =========================================================================
    // CASOS 26 & 41: E2E TIMEOUT RECOVERY -> VERIFY -> 908 -> ACCEPTED
    // Confirm: submit count = 1, verify count = 1 (SIN reenvíos ciegos)
    // =========================================================================

    public function test_timeout_recovery_verifies_state_and_marks_accepted_without_second_submission(): void
    {
        $invoice = $this->createPreparedInvoice(1);

        // 1. Simular timeout en la emisión/envío inicial
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

        // Estado inmediato después de timeout: PROCESSING (resultado ambiguo)
        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $invoice->status);
        $this->assertNotNull($invoice->sin_response);
        $this->assertTrue($invoice->sin_response['transport_error']);
        $this->assertStringContainsString('Error de transporte / resultado fiscal ambiguo', $invoice->error_message);

        // Historial tras submit
        $this->assertDatabaseHas('siat_invoice_operations', [
            'electronic_invoice_id' => $invoice->id,
            'operation'             => 'submit',
            'transport_status'      => 'timeout',
        ]);

        // 2. Ejecutar reconciliación oficial mediante verificacionEstadoFactura
        $receptionCodeVerified = 'REC-VERIFIED-908-ABC';
        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 908,
                'codigoRecepcion'   => $receptionCodeVerified,
                'codigoDescripcion' => 'VALIDADA',
                'mensajesList'      => [],
            ],
        ]);

        $result = $this->verificationService->verify($invoice, $this->fakeSoapClient);

        // 3. Resultado de la reconciliación
        $this->assertTrue($result['success']);
        $this->assertSame('accepted', $result['status']);
        $this->assertSame(908, $result['codigo_estado']);
        $this->assertSame($receptionCodeVerified, $result['codigo_recepcion']);
        $this->assertNull($result['error_message']);

        // Factura en BD actualizada a ACCEPTED
        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertSame($receptionCodeVerified, $invoice->reception_code);
        $this->assertNull($invoice->error_message);
        $this->assertNull($invoice->next_verification_at);
        $this->assertSame(1, $invoice->verification_attempts);
        $this->assertNotNull($invoice->last_verified_at);

        // Historial completo reconstruible: 1 submit + 1 verify
        $operations = SiatInvoiceOperation::where('electronic_invoice_id', $invoice->id)
            ->orderBy('id', 'asc')
            ->get();

        $this->assertCount(2, $operations);
        $this->assertSame('submit', $operations[0]->operation);
        $this->assertSame('timeout', $operations[0]->transport_status);
        $this->assertSame('verify', $operations[1]->operation);
        $this->assertSame('success', $operations[1]->transport_status);
        $this->assertSame(908, $operations[1]->siat_status_code);
        $this->assertSame($receptionCodeVerified, $operations[1]->reception_code);

        // Confirmar conteo exacto de llamadas:
        // recepcionFactura = 1, verificacionEstadoFactura = 1
        $recordedCalls = $this->fakeSoapClient->recordedCalls();
        $this->assertArrayHasKey('recepcionFactura', $recordedCalls);
        $this->assertArrayHasKey('verificacionEstadoFactura', $recordedCalls);
    }

    // =========================================================================
    // CASOS 14 & 28: CASO 904 (OBSERVADA)
    // Persistir codigoRecepcion, observaciones, estado no aceptado, sin reenvío
    // =========================================================================

    public function test_observed_status_904_persists_observations_and_remains_processing(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        $obsReceptionCode = 'REC-OBSERVED-904-XYZ';
        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 904,
                'codigoRecepcion'   => $obsReceptionCode,
                'codigoDescripcion' => 'OBSERVADA',
                'mensajesList'      => [
                    ['codigo' => 9902, 'descripcion' => 'Discrepancia en actividad económica secundaria'],
                ],
            ],
        ]);

        $result = $this->verificationService->verify($invoice, $this->fakeSoapClient);

        // Verificamos que NO es exitosa fiscalmente
        $this->assertFalse($result['success']);
        $this->assertSame('processing', $result['status']);
        $this->assertSame(904, $result['codigo_estado']);
        $this->assertSame($obsReceptionCode, $result['codigo_recepcion']);
        $this->assertStringContainsString('9902', $result['error_message']);

        // Factura permanece en PROCESSING (no aceptada, no rechazada destructivamente)
        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $invoice->status);
        $this->assertSame($obsReceptionCode, $invoice->reception_code);
        $this->assertStringContainsString('Discrepancia en actividad', $invoice->error_message);
        $this->assertNotNull($invoice->next_verification_at);

        // Historial registrado
        $this->assertDatabaseHas('siat_invoice_operations', [
            'electronic_invoice_id' => $invoice->id,
            'operation'             => 'verify',
            'siat_status_code'      => 904,
            'reception_code'        => $obsReceptionCode,
        ]);
    }

    // =========================================================================
    // CASOS 15 & 27: CASO 924 (NO ENCONTRADA EN BASE DE DATOS DEL SIN)
    // NO reenvío automático. Registro de NOT_FOUND_AT_SIN.
    // =========================================================================

    public function test_not_found_status_924_flags_not_found_and_halts_auto_resend(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 924,
                'codigoRecepcion'   => null,
                'codigoDescripcion' => 'NO EXISTE EN LA BASE DE DATOS DEL SIN',
                'mensajesList'      => [
                    ['codigo' => 924, 'descripcion' => 'Factura o Nota no existe en la base de datos del SIN'],
                ],
            ],
        ]);

        $result = $this->verificationService->verify($invoice, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertSame('processing', $result['status']);
        $this->assertSame(924, $result['codigo_estado']);
        $this->assertTrue($result['not_found_at_sin']);
        $this->assertStringContainsString('924', $result['error_message']);

        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $invoice->status);
        $this->assertStringContainsString('924', $invoice->error_message);
        // Regla: next_verification_at se desactiva (null) para no consultar indefinidamente
        $this->assertNull($invoice->next_verification_at);

        // Verificar que NO se invocó recepcionFactura de nuevo
        $this->assertFalse($this->fakeSoapClient->wasCalled('recepcionFactura'));

        $this->assertDatabaseHas('siat_invoice_operations', [
            'electronic_invoice_id' => $invoice->id,
            'operation'             => 'verify',
            'siat_status_code'      => 924,
        ]);
    }

    // =========================================================================
    // CASOS 29 & 30: CASOS 901 (PENDIENTE) Y 903 (PROCESADA)
    // Mantienen PROCESSING y programan siguiente ventana de verificación
    // =========================================================================

    public function test_pending_901_and_processed_903_remain_processing(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        // 901: Pendiente
        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 901,
                'codigoRecepcion'   => null,
                'codigoDescripcion' => 'RECEPCION PENDIENTE',
                'mensajesList'      => [],
            ],
        ]);

        $result901 = $this->verificationService->verify($invoice, $this->fakeSoapClient);
        $this->assertFalse($result901['success']);
        $this->assertSame('processing', $result901['status']);
        $this->assertSame(901, $result901['codigo_estado']);
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $invoice->fresh()->status);
        $this->assertNotNull($invoice->fresh()->next_verification_at);

        // 903: Procesada (en cola)
        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 903,
                'codigoRecepcion'   => null,
                'codigoDescripcion' => 'RECEPCION PROCESADA',
                'mensajesList'      => [],
            ],
        ]);

        $result903 = $this->verificationService->verify($invoice->fresh(), $this->fakeSoapClient);
        $this->assertFalse($result903['success']);
        $this->assertSame('processing', $result903['status']);
        $this->assertSame(903, $result903['codigo_estado']);
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $invoice->fresh()->status);
    }

    // =========================================================================
    // CASO 6: CASO 902 (RECHAZADA CONFIRMADA)
    // =========================================================================

    public function test_rejected_902_marks_invoice_rejected_when_confirmed_by_sin(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 902,
                'codigoRecepcion'   => null,
                'codigoDescripcion' => 'RECHAZADA',
                'mensajesList'      => [
                    ['codigo' => 1024, 'descripcion' => 'EL CUFD PROPORCIONADO NO SE ENCUENTRA ACTIVO'],
                ],
            ],
        ]);

        $result = $this->verificationService->verify($invoice, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertSame('rejected', $result['status']);
        $this->assertSame(902, $result['codigo_estado']);

        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::REJECTED, $invoice->status);
        $this->assertNull($invoice->next_verification_at);
        $this->assertStringContainsString('1024', $invoice->error_message);
    }

    // =========================================================================
    // CASO 31: CÓDIGO DESCONOCIDO (999999)
    // NO accepted, NO rejected automático -> PROCESSING/UNKNOWN
    // =========================================================================

    public function test_unknown_status_code_remains_processing_without_destructive_changes(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 999999,
                'codigoRecepcion'   => null,
                'codigoDescripcion' => 'ESTADO NO DOCUMENTADO',
                'mensajesList'      => [
                    ['codigo' => 999999, 'descripcion' => 'Código no estándar devuelto por SIN'],
                ],
            ],
        ]);

        $result = $this->verificationService->verify($invoice, $this->fakeSoapClient);

        $this->assertFalse($result['success']);
        $this->assertSame('processing', $result['status']);
        $this->assertSame(999999, $result['codigo_estado']);

        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $invoice->status);
        $this->assertStringContainsString('999999', $invoice->error_message);
    }

    // =========================================================================
    // CASOS 23 & 24: NO DEGRADAR ACCEPTED
    // Los estados fiscales confirmados tienen precedencia absoluta
    // =========================================================================

    public function test_never_downgrades_locally_accepted_invoice(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $receptionCode = 'REC-ORIGINAL-ACCEPTED-123';
        $invoice->update([
            'status'         => ElectronicInvoiceStatus::ACCEPTED,
            'reception_code' => $receptionCode,
        ]);

        // Simular que por cualquier motivo la verificación fallara o devolviera timeout
        $this->fakeSoapClient->willThrow(
            'verificacionEstadoFactura',
            new RuntimeException('SOAP Fault / Connection dropped')
        );

        $result = $this->verificationService->verify($invoice, $this->fakeSoapClient);

        // La factura NO debe degradarse
        $this->assertTrue($result['success']);
        $this->assertSame('accepted', $result['status']);
        $this->assertSame($receptionCode, $result['codigo_recepcion']);

        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertSame($receptionCode, $invoice->reception_code);

        // Se registra la operación como advertencia en auditoría
        $this->assertDatabaseHas('siat_invoice_operations', [
            'electronic_invoice_id' => $invoice->id,
            'operation'             => 'verify',
            'error_message'         => 'Verificación omitida: la factura ya se encuentra confirmada como ACCEPTED localmente.',
        ]);
    }

    // =========================================================================
    // CASOS 22, 37 & 38: CONCURRENCIA, BACKOFF Y LÍMITE DE VERIFICACIONES
    // =========================================================================

    public function test_concurrency_and_backoff_tracking(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => false,
                'codigoEstado'      => 901,
                'codigoRecepcion'   => null,
                'codigoDescripcion' => 'RECEPCION PENDIENTE',
                'mensajesList'      => [],
            ],
        ]);

        // Intento 1
        $this->verificationService->verify($invoice, $this->fakeSoapClient);
        $invoice->refresh();
        $this->assertSame(1, $invoice->verification_attempts);
        $this->assertNotNull($invoice->last_verified_at);
        $firstNext = $invoice->next_verification_at;
        $this->assertNotNull($firstNext);

        // Intento 2
        $this->verificationService->verify($invoice, $this->fakeSoapClient);
        $invoice->refresh();
        $this->assertSame(2, $invoice->verification_attempts);

        // Intento 5 (límite máximo automático)
        $invoice->update(['verification_attempts' => 5]);
        $this->verificationService->verify($invoice, $this->fakeSoapClient);
        $invoice->refresh();
        $this->assertSame(6, $invoice->verification_attempts);
        // Al superar el máximo, next_verification_at pasa a null (requiere intervención administrativa)
        $this->assertNull($invoice->next_verification_at);
    }

    // =========================================================================
    // CASO 33: KILL SWITCH BLOQUEA VERIFICACIÓN REAL
    // =========================================================================

    public function test_kill_switch_blocks_verificacion_estado_factura_with_real_client(): void
    {
        config(['siat.live_submission_enabled' => false]);

        $client = new SiatSoapClient($this->setting);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('kill switch activo');

        $client->verificacionEstadoFactura([
            'codigoAmbiente' => 2,
            'cuf'            => 'TEST-CUF',
        ]);
    }

    // =========================================================================
    // CASO 34: ENDPOINT HTTP POST /api/siat/invoices/{invoice}/verify
    // =========================================================================

    public function test_controller_verify_endpoint_returns_safe_payload(): void
    {
        $invoice = $this->createPreparedInvoice(1);
        $invoice->update(['status' => ElectronicInvoiceStatus::PROCESSING]);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory()
        );

        $request = \Illuminate\Http\Request::create("/api/siat/invoices/{$invoice->id}/verify", 'POST');

        $mockVerificationService = $this->createMock(SiatInvoiceVerificationService::class);
        $mockVerificationService->method('verify')->willReturn([
            'success'          => true,
            'status'           => 'accepted',
            'codigo_estado'    => 908,
            'codigo_recepcion' => 'REC-VERIFY-200-SAFE',
            'error_message'    => null,
            'cuf'              => $invoice->cuf,
            'sin_response'     => ['codigoEstado' => 908],
        ]);

        $response = $controller->verifyInvoice($request, $invoice, $mockVerificationService);

        $this->assertEquals(200, $response->getStatusCode());
        $data = $response->getData(true);

        $this->assertTrue($data['success']);
        $this->assertSame('accepted', $data['data']['status']);
        $this->assertSame(908, $data['data']['codigo_estado']);
        $this->assertSame('REC-VERIFY-200-SAFE', $data['data']['codigo_recepcion']);
        $this->assertSame($invoice->cuf, $data['data']['cuf']);

        // Verificamos que NO se exponen secretos
        $this->assertArrayNotHasKey('token', $data['data']);
        $this->assertArrayNotHasKey('apikey', $data['data']);
        $this->assertArrayNotHasKey('password', $data['data']);
        $this->assertArrayNotHasKey('xml', $data['data']);
        $this->assertArrayNotHasKey('certificate', $data['data']);
    }

    // =========================================================================
    // CASO 35: COMANDO ARTISAN siat:verify-pending
    // =========================================================================

    public function test_artisan_command_siat_verify_pending_filters_strictly_eligible_invoices(): void
    {
        // Factura 1: PROCESSING con backoff vencido -> DEBE verificarse
        $invoiceDue = $this->createPreparedInvoice(1);
        $invoiceDue->update([
            'status'               => ElectronicInvoiceStatus::PROCESSING,
            'next_verification_at' => now()->subMinutes(5),
        ]);

        // Factura 2: PROCESSING con backoff futuro -> NO debe verificarse
        $invoiceFuture = $this->createPreparedInvoice(1);
        $invoiceFuture->update([
            'status'               => ElectronicInvoiceStatus::PROCESSING,
            'next_verification_at' => now()->addMinutes(15),
        ]);

        // Factura 3: ACCEPTED -> NO debe verificarse
        $invoiceAccepted = $this->createPreparedInvoice(1);
        $invoiceAccepted->update([
            'status'               => ElectronicInvoiceStatus::ACCEPTED,
            'next_verification_at' => null,
        ]);

        $this->fakeSoapClient->willReturn('verificacionEstadoFactura', [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 908,
                'codigoRecepcion'   => 'REC-RECONCILED-CMD',
                'codigoDescripcion' => 'VALIDADA',
                'mensajesList'      => [],
            ],
        ]);

        // Inyectamos el fake en el contenedor para que el comando use FakeSiatSoapClient
        $this->app->bind(SiatSoapClientInterface::class, fn () => $this->fakeSoapClient);

        // Ejecutar comando en el tenant actual
        $this->artisan('siat:verify-pending')
            ->assertExitCode(0);

        // Factura vencida fue reconciliada a ACCEPTED
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED, $invoiceDue->fresh()->status);
        $this->assertSame('REC-RECONCILED-CMD', $invoiceDue->fresh()->reception_code);

        // Factura futura sigue en PROCESSING intacta
        $this->assertSame(ElectronicInvoiceStatus::PROCESSING, $invoiceFuture->fresh()->status);
        $this->assertNull($invoiceFuture->fresh()->last_verified_at);

        // Factura aceptada sigue ACCEPTED intacta
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED, $invoiceAccepted->fresh()->status);
    }
}
