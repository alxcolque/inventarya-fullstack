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
use App\Services\Siat\SiatCertificateService;
use App\Services\Siat\SiatCufGenerator;
use App\Services\Siat\SiatInvoiceNumberService;
use App\Services\Siat\SiatInvoicePreparationService;
use App\Services\Siat\SiatInvoiceXmlBuilder;
use App\Services\Siat\SiatInvoiceXmlValidator;
use App\Services\Siat\SiatPaymentMethodMapper;
use App\Services\Siat\SiatXmlSignatureValidator;
use App\Services\Siat\SiatXmlSigner;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SiatInvoiceXmlSigningFeatureTest extends TestCase
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

    private string $p12Password = 'TenantCertPass4D!';
    private string $p12Path = 'tenant/certs/test_tenant_cert.p12';

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureOpenSslConfig();

        config([
            'database.connections.invoice_signing_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_signing_test',
        ]);
        DB::purge('invoice_signing_test');
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

        // Generar y almacenar certificado de prueba en Storage
        $p12Binary = $this->generateTestPkcs12('TEST ONLY - TENANT 4D', $this->p12Password);
        Storage::disk('local')->put($this->p12Path, $p12Binary);

        $this->user = User::create([
            'name'     => 'Cajero Modalidad 1',
            'email'    => 'cajero1@test.com',
            'password' => bcrypt('password'),
            'role'     => 'seller',
        ]);

        $this->store = Store::create([
            'id'                          => (string) Str::uuid(),
            'name'                        => 'Sucursal Modalidad 1',
            'location'                    => 'La Paz',
            'address'                     => 'Av. Arce 2450',
            'phone'                       => '2221144',
            'enable_electronic_invoicing' => true,
            'sin_branch_code'             => 0,
            'sin_point_of_sale_code'      => 0,
        ]);

        $this->setting = Setting::create([
            'tax_nit'                   => '1003579028',
            'tax_business_name'         => 'EMPRESA ELECTRONICA S.R.L.',
            'address'                   => 'Av. Arce 2450',
            'phone'                     => '2221144',
            'siat_environment'          => 2,
            'siat_modality'             => 1, // Modalidad 1: Electrónica en Línea
            'siat_system_code'          => 'SYS-ELEC-001',
            'siat_api_token'            => 'fake-token-modalidad-1',
            'siat_certificate_path'     => $this->p12Path,
            'siat_certificate_password' => $this->p12Password,
        ]);

        SiatCuis::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cuis'               => 'CUIS-FEAT-MOD1',
            'valid_until'        => now()->addMonths(6),
            'is_active'          => true,
        ]);

        SiatCufd::create([
            'id'                 => (string) Str::uuid(),
            'store_id'           => $this->store->id,
            'branch_code'        => 0,
            'point_of_sale_code' => 0,
            'cufd'               => 'CUFD-FEAT-MOD1-123456',
            'control_code'       => 'CTRL-FEAT-MOD1-999',
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

        $this->prepService  = new SiatInvoicePreparationService(
            new SiatInvoiceNumberService(),
            new SiatPaymentMethodMapper()
        );
        $this->cufGenerator = new SiatCufGenerator();
        $this->certService  = new SiatCertificateService();
        $this->xmlValidator = new SiatInvoiceXmlValidator();
        $this->sigValidator = new SiatXmlSignatureValidator();
        $this->xmlBuilder   = new SiatInvoiceXmlBuilder(
            $this->xmlValidator,
            new SiatXmlSigner(),
            $this->sigValidator,
            $this->certService
        );
    }

    private function ensureOpenSslConfig(): void
    {
        if (getenv('OPENSSL_CONF') && file_exists(getenv('OPENSSL_CONF'))) {
            return;
        }

        $candidates = [
            'C:/xampp/php/extras/ssl/openssl.cnf',
            'C:/xampp/apache/conf/openssl.cnf',
            'C:/laragon/bin/php/php-8.2/extras/ssl/openssl.cnf',
            dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf',
        ];

        foreach ($candidates as $cand) {
            if (file_exists($cand)) {
                putenv("OPENSSL_CONF={$cand}");
                break;
            }
        }
    }

    private function generateTestPkcs12(string $cn, string $password): string
    {
        $cnf = getenv('OPENSSL_CONF') ?: null;
        $args = $cnf ? ['config' => $cnf] : [];

        $pkey = openssl_pkey_new(array_merge($args, [
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]));

        $dn = [
            'countryName'            => 'BO',
            'stateOrProvinceName'    => 'La Paz',
            'localityName'           => 'La Paz',
            'organizationName'       => 'Empresa de Prueba S.R.L.',
            'organizationalUnitName' => 'Facturacion',
            'commonName'             => $cn,
        ];

        $csr = openssl_csr_new($dn, $pkey, $args);
        $cert = openssl_csr_sign($csr, null, $pkey, 365, array_merge($args, [
            'digest_alg' => 'sha256',
        ]));

        openssl_pkcs12_export($cert, $p12Out, $pkey, $password);

        return $p12Out;
    }

    private function createProduct(): Product
    {
        return Product::create([
            'name'              => 'Servidor Rack 1U',
            'sku'               => 'SRV-001',
            'sin_product_code'  => '84711',
            'sin_activity_code' => '471100',
            'sin_unit_code'     => 57,
        ]);
    }

    public function test_modalidad_1_flujo_completo_genera_xml_firmado_valido_y_persistido(): void
    {
        $product = $this->createProduct();
        $customer = Customer::create([
            'name'                => 'TELECOM ASOCIADOS S.A.',
            'document_type'       => 1,
            'document_number'     => '1020304050',
            'document_complement' => null,
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

        // 1. Prepare
        $invoice = $this->prepService->prepare($sale);
        $this->assertEquals(1, $invoice->siat_modality);

        // 2. Generate CUF
        $invoice = $this->cufGenerator->generateAndPersist($invoice);
        $this->assertNotNull($invoice->cuf);

        // 3. Build & Persist (Modalidad 1 firma automáticamente con el certificado de Settings)
        $result = $this->xmlBuilder->buildAndPersist($invoice, 'tenant-mod1');
        $this->assertFalse($result['already_existed']);
        $this->assertTrue($result['is_signed']);
        $this->assertNotNull($result['xml_path']);

        // 4. Verificar contenido en Storage
        $this->assertTrue(Storage::disk('local')->exists($result['xml_path']));
        $signedXmlContent = Storage::disk('local')->get($result['xml_path']);

        $this->assertStringContainsString('<ds:Signature', $signedXmlContent);
        $this->assertStringContainsString('<ds:SignedInfo', $signedXmlContent);
        $this->assertStringContainsString('<ds:SignatureValue', $signedXmlContent);

        // 5. Validar XSD oficial post-firma
        $isValidXsd = $this->xmlValidator->validate($signedXmlContent);
        $this->assertTrue($isValidXsd);

        // 6. Validar criptográficamente la firma
        $verifyOk = $this->sigValidator->verify($signedXmlContent);
        $this->assertTrue($verifyOk);
    }

    public function test_modalidad_2_flujo_no_agrega_nodo_signature(): void
    {
        // Cambiar configuración temporal a Modalidad 2
        $this->setting->update(['siat_modality' => 2]);

        $product = $this->createProduct();
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

        $invoice = $this->prepService->prepare($sale);
        $this->assertEquals(2, $invoice->siat_modality);

        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        $result = $this->xmlBuilder->buildAndPersist($invoice, 'tenant-mod2');
        $this->assertFalse($result['is_signed']);

        $xmlContent = Storage::disk('local')->get($result['xml_path']);
        $this->assertStringNotContainsString('ds:Signature', $xmlContent);
        $this->assertStringContainsString('<facturaComputarizadaCompraVenta', $xmlContent);
        $this->assertTrue($this->xmlValidator->validate($xmlContent));
    }

    public function test_idempotencia_modalidad_1_retorna_xml_firmado_existente(): void
    {
        $product = $this->createProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '75.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 75.00,
            'subtotal'   => 75.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        $res1 = $this->xmlBuilder->buildAndPersist($invoice, 'tenant-mod1');
        $this->assertFalse($res1['already_existed']);
        $this->assertTrue($res1['is_signed']);

        // Segunda llamada con la misma factura
        $res2 = $this->xmlBuilder->buildAndPersist($invoice->fresh(), 'tenant-mod1');
        $this->assertTrue($res2['already_existed']);
        $this->assertTrue($res2['is_signed']);
        $this->assertEquals($res1['xml_path'], $res2['xml_path']);
    }

    public function test_deteccion_de_manipulacion_en_archivo_firmado_persistido(): void
    {
        $product = $this->createProduct();
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

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        $result = $this->xmlBuilder->buildAndPersist($invoice, 'tenant-mod1');

        // Modificar maliciosamente el archivo en disco
        $content = Storage::disk('local')->get($result['xml_path']);
        $tampered = str_replace('<montoTotal>100.00</montoTotal>', '<montoTotal>10.00</montoTotal>', $content);
        Storage::disk('local')->put($result['xml_path'], $tampered);

        // Validar que la verificación criptográfica detecta la manipulación
        $details = $this->sigValidator->validateDetails($tampered);
        $this->assertFalse($details['is_valid']);
        $this->assertStringContainsString('Digest mismatch', $details['error']);
    }

    public function test_controller_sign_invoice_endpoint_retorna_200_con_datos_seguros(): void
    {
        $product = $this->createProduct();
        $sale = Sale::create([
            'store_id'       => $this->store->id,
            'user_id'        => $this->user->id,
            'payment_method' => 'efectivo',
            'total'          => '120.00',
        ]);
        SaleDetail::create([
            'sale_id'    => $sale->id,
            'product_id' => $product->id,
            'quantity'   => 1,
            'price'      => 120.00,
            'subtotal'   => 120.00,
        ]);

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory(new \App\Services\Siat\FakeSiatSoapClient())
        );

        $request = Request::create("/api/siat/invoices/{$invoice->id}/sign", 'POST');
        $response = $controller->signInvoice($request, $invoice, $this->xmlBuilder);

        $this->assertEquals(200, $response->getStatusCode());
        $data = $response->getData(true);

        $this->assertTrue($data['success']);
        $this->assertEquals($invoice->id, $data['data']['invoice_id']);
        $this->assertTrue($data['data']['is_signed']);
        $this->assertNotEmpty($data['data']['xml_path']);
        $this->assertNotEmpty($data['data']['certificate_fingerprint']);

        // Verificar que no se fugan claves ni contraseñas
        $this->assertArrayNotHasKey('password', $data['data']);
        $this->assertArrayNotHasKey('private_key', $data['data']);
        $this->assertArrayNotHasKey('p12', $data['data']);
    }

    public function test_controller_sign_invoice_rechaza_modalidad_2(): void
    {
        $this->setting->update(['siat_modality' => 2]);

        $product = $this->createProduct();
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

        $invoice = $this->prepService->prepare($sale);
        $invoice = $this->cufGenerator->generateAndPersist($invoice);

        $controller = new \App\Http\Controllers\SiatController(
            new \App\Services\Siat\SiatServiceFactory(new \App\Services\Siat\FakeSiatSoapClient())
        );

        $request = Request::create("/api/siat/invoices/{$invoice->id}/sign", 'POST');
        $response = $controller->signInvoice($request, $invoice, $this->xmlBuilder);

        $this->assertEquals(422, $response->getStatusCode());
        $data = $response->getData(true);
        $this->assertFalse($data['success']);
        $this->assertStringContainsString('Modalidad 2 (Computarizada en Línea) no requiere firma digital', $data['message']);
    }
}
