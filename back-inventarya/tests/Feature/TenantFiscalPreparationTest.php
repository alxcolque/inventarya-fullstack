<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Store;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TenantFiscalPreparationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'database.connections.fiscal_test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
            'database.default' => 'fiscal_test',
        ]);
        DB::purge('fiscal_test');

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

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            $table->string('slug', 100)->nullable();
            $table->string('address')->nullable();
            $table->string('phone', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('enable_electronic_invoicing')->default(false);
            $table->integer('sin_branch_code')->nullable();
            $table->integer('sin_point_of_sale_code')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('address')->nullable();
            $table->smallInteger('document_type')->nullable();
            $table->string('document_number', 50)->nullable();
            $table->string('document_complement', 20)->nullable();
            $table->timestamps();
            $table->unique(
                ['document_type', 'document_number', 'document_complement'],
                'customers_document_unique'
            );
        });

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 150);
            $table->string('slug', 150)->nullable();
            $table->string('sku', 100)->nullable();
            $table->string('barcode', 100)->nullable();
            $table->string('sin_product_code')->nullable();
            $table->string('sin_activity_code')->nullable();
            $table->integer('sin_unit_code')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('business_name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->boolean('electronic_invoicing_enabled')->default(false);
            $table->string('tax_nit', 30)->nullable();
            $table->string('tax_business_name', 200)->nullable();
            $table->smallInteger('siat_environment')->nullable();
            $table->smallInteger('siat_modality')->nullable();
            $table->string('siat_system_code')->nullable();
            $table->text('siat_api_token')->nullable();
            $table->text('siat_certificate_path')->nullable();
            $table->text('siat_certificate_password')->nullable();
            $table->timestamps();
        });
    }

    public function test_store_supports_electronic_invoicing_fields(): void
    {
        $store = Store::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Sucursal Central',
            'phone' => '70000000',
            'address' => 'Calle 1',
            'enable_electronic_invoicing' => true,
            'sin_branch_code' => 0,
            'sin_point_of_sale_code' => 1,
        ]);

        $this->assertTrue($store->enable_electronic_invoicing);
        $this->assertSame(0, $store->sin_branch_code);
        $this->assertSame(1, $store->sin_point_of_sale_code);
    }

    public function test_customer_supports_siat_document_fields(): void
    {
        $customer = Customer::create([
            'document_number' => '1234567',
            'name' => 'JUAN PEREZ',
            'document_type' => 1,
            'document_complement' => '1B',
        ]);

        $this->assertSame(1, $customer->document_type);
        $this->assertSame('1234567', $customer->document_number);
        $this->assertSame('1B', $customer->document_complement);
        $this->assertSame('1234567', $customer->cinit);
    }

    public function test_product_supports_siat_catalog_codes(): void
    {
        $product = Product::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Tinta Epson 00N1',
            'sin_product_code' => '844331',
            'sin_activity_code' => '474100',
            'sin_unit_code' => 57,
        ]);

        $this->assertSame('844331', $product->sin_product_code);
        $this->assertSame('474100', $product->sin_activity_code);
        $this->assertSame(57, $product->sin_unit_code);
    }

    public function test_setting_encrypts_credentials_and_hides_secrets(): void
    {
        $setting = Setting::create([
            'business_name' => 'EMPRESA TEST S.R.L.',
            'electronic_invoicing_enabled' => true,
            'tax_nit' => '1020304050',
            'siat_environment' => 2,
            'siat_modality' => 1,
            'siat_system_code' => 'SYS-ABC-123',
            'siat_api_token' => 'super-secret-token-value',
            'siat_certificate_password' => 'secret-cert-pass',
        ]);

        // Check raw database storage is encrypted, not plain text
        $raw = DB::table('settings')->where('id', $setting->id)->first();
        $this->assertNotSame('super-secret-token-value', $raw->siat_api_token);
        $this->assertNotSame('secret-cert-pass', $raw->siat_certificate_password);

        // Check Eloquent decrypted retrieval
        $this->assertSame('super-secret-token-value', $setting->siat_api_token);
        $this->assertSame('secret-cert-pass', $setting->siat_certificate_password);

        // Check serialized array hides secrets and shows configured booleans
        $array = $setting->toArray();
        $this->assertArrayNotHasKey('siat_api_token', $array);
        $this->assertArrayNotHasKey('siat_certificate_password', $array);
        $this->assertTrue($array['siat_token_configured']);
        $this->assertTrue($array['siat_certificate_password_configured']);
        $this->assertSame('1020304050', $array['tax_nit']);
    }
}
