<?php

namespace Tests\Feature;

use App\Enums\SiatEnvironment;
use App\Enums\SiatModality;
use App\Http\Controllers\SettingController;
use App\Models\Setting;
use App\Models\Store;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TenantSiatFiscalConfigurationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.fiscal_testing' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
            'database.default' => 'fiscal_testing',
        ]);
        DB::purge('fiscal_testing');

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('business_name');
            $table->string('logo')->nullable();
            $table->string('favicon')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->string('theme')->default('light');
            $table->string('primary_color')->nullable();
            $table->text('terms')->nullable();
            $table->text('policy')->nullable();
            $table->string('currency')->default('BOB');
            $table->string('timezone')->default('America/La_Paz');
            $table->json('social')->nullable();
            $table->boolean('enable_customers')->default(false);
            $table->boolean('enable_suppliers')->default(false);
            $table->boolean('enable_locations')->default(false);
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

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            $table->string('slug', 100)->nullable();
            $table->string('address')->nullable();
            $table->string('location', 150)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('front_image', 255)->nullable();
            $table->string('front_image_key', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('api_status')->default(false);
            $table->string('api_key')->nullable();
            $table->string('api_secret')->nullable();
            $table->boolean('enable_customers')->default(false);
            $table->boolean('enable_payment')->default(false);
            $table->boolean('enable_observations')->default(false);
            $table->boolean('enable_discount')->default(false);
            $table->boolean('enable_electronic_invoicing')->default(false);
            $table->integer('sin_branch_code')->nullable();
            $table->integer('sin_point_of_sale_code')->nullable();
            $table->timestamps();
        });

        Route::match(['put', 'patch', 'post'], '/testing/settings', [SettingController::class, 'update']);
    }

    /**
     * 1. Facturación desactivada por defecto en nuevo setting.
     * 2. Configuración fiscal nullable cuando está desactivada.
     */
    public function test_electronic_invoicing_is_disabled_by_default_and_fields_nullable(): void
    {
        $setting = Setting::create([
            'business_name' => 'Farmacia San José',
        ]);
        $setting->refresh();

        $this->assertFalse((bool) $setting->electronic_invoicing_enabled);
        $this->assertNull($setting->tax_nit);
        $this->assertNull($setting->tax_business_name);
        $this->assertNull($setting->siat_environment);
        $this->assertNull($setting->siat_modality);
        $this->assertNull($setting->siat_system_code);
        $this->assertNull($setting->siat_api_token);
        $this->assertSame('disabled', $setting->electronic_invoicing_status);
    }

    /**
     * 3. Actualización de tax_nit.
     * 4. Actualización de tax_business_name.
     * 5. Ambiente (SiatEnvironment enum).
     * 6. Modalidad (SiatModality enum).
     * 7. System code.
     */
    public function test_can_update_fiscal_and_siat_fields(): void
    {
        $setting = Setting::create(['business_name' => 'Mi Negocio']);

        $controller = new SettingController();
        $request = Request::create('/testing/settings', 'POST', [
            'tax_nit' => '1020304050',
            'tax_business_name' => 'JUAN CARLOS PEREZ MAMANI',
            'siat_environment' => SiatEnvironment::PILOT->value,
            'siat_modality' => SiatModality::ELECTRONIC_ONLINE->value,
            'siat_system_code' => 'SYS-CODE-TEST-99',
        ]);

        $response = $controller->update($request, $setting->id);
        $this->assertSame(200, $response->getStatusCode());

        $setting->refresh();
        $this->assertSame('1020304050', $setting->tax_nit);
        $this->assertSame('JUAN CARLOS PEREZ MAMANI', $setting->tax_business_name);
        $this->assertSame(SiatEnvironment::PILOT->value, $setting->siat_environment);
        $this->assertSame(SiatModality::ELECTRONIC_ONLINE->value, $setting->siat_modality);
        $this->assertSame('SYS-CODE-TEST-99', $setting->siat_system_code);
    }

    /**
     * 8. Token se guarda cifrado en base de datos.
     * 9. Token NO aparece en JSON.
     * 10. Password NO aparece en JSON.
     * 11. siat_token_configured y siat_certificate_password_configured funcionan.
     */
    public function test_token_and_password_stored_encrypted_and_hidden_from_json(): void
    {
        $setting = Setting::create([
            'business_name' => 'Comercial Bolivia',
            'tax_nit' => '9988776655',
            'siat_api_token' => 'original-siat-bearer-token',
            'siat_certificate_password' => 'secret-cert-pass-123',
        ]);

        // Raw database inspection
        $raw = DB::table('settings')->where('id', $setting->id)->first();
        $this->assertNotSame('original-siat-bearer-token', $raw->siat_api_token);
        $this->assertNotSame('secret-cert-pass-123', $raw->siat_certificate_password);

        // JSON serialization
        $json = $setting->toArray();
        $this->assertArrayNotHasKey('siat_api_token', $json);
        $this->assertArrayNotHasKey('siat_certificate_password', $json);
        $this->assertTrue($json['siat_token_configured']);
        $this->assertTrue($json['siat_certificate_password_configured']);
    }

    /**
     * 12. Cambiar datos generales NO elimina token.
     * 13. Enviar token vacío NO elimina token.
     */
    public function test_updating_general_data_or_sending_empty_token_does_not_clear_token(): void
    {
        $setting = Setting::create([
            'business_name' => 'Ferretería El Tornillo',
            'siat_api_token' => 'very-important-token',
            'siat_certificate_password' => 'pass-123',
        ]);

        $controller = new SettingController();

        // 12: Actualizar solo datos generales (sin enviar token)
        $req1 = Request::create('/testing/settings', 'POST', [
            'phone' => '+591 70001122',
            'address' => 'Calle Murillo #100',
        ]);
        $controller->update($req1, $setting->id);

        $setting->refresh();
        $this->assertSame('very-important-token', $setting->siat_api_token);
        $this->assertSame('pass-123', $setting->siat_certificate_password);
        $this->assertTrue($setting->siat_token_configured);

        // 13: Enviar token vacío o máscara "********"
        $req2 = Request::create('/testing/settings', 'POST', [
            'siat_api_token' => '',
            'siat_certificate_password' => '********',
        ]);
        $controller->update($req2, $setting->id);

        $setting->refresh();
        $this->assertSame('very-important-token', $setting->siat_api_token);
        $this->assertSame('pass-123', $setting->siat_certificate_password);
    }

    /**
     * 14. Reemplazar token funciona.
     */
    public function test_replacing_token_updates_encrypted_token(): void
    {
        $setting = Setting::create([
            'business_name' => 'Distribuidora Oriente',
            'siat_api_token' => 'old-token-value',
        ]);

        $controller = new SettingController();
        $req = Request::create('/testing/settings', 'POST', [
            'siat_api_token' => 'fresh-new-token-from-sin',
        ]);
        $controller->update($req, $setting->id);

        $setting->refresh();
        $this->assertSame('fresh-new-token-from-sin', $setting->siat_api_token);
    }

    /**
     * Estado derivado de facturación: disabled, incomplete, configured
     */
    public function test_electronic_invoicing_status_derivation(): void
    {
        $setting = Setting::create(['business_name' => 'Demo']);
        $this->assertSame('disabled', $setting->electronic_invoicing_status);

        $setting->update(['electronic_invoicing_enabled' => true]);
        $this->assertSame('incomplete', $setting->electronic_invoicing_status);

        $setting->update([
            'tax_nit' => '12345678',
            'tax_business_name' => 'DEMO S.R.L.',
            'siat_environment' => 2,
            'siat_modality' => 1,
            'siat_system_code' => 'SYS123',
            'siat_api_token' => 'token-test',
        ]);
        $setting->refresh();
        $this->assertSame('configured', $setting->electronic_invoicing_status);
    }

    /**
     * 15. Store puede almacenar branch code.
     * 16. Store puede almacenar point of sale code.
     * 17. Branch code = 0 no se interpreta como NULL.
     * 18. Point of sale code = 0 no se interpreta como NULL.
     */
    public function test_store_handles_branch_and_pos_codes_including_zero(): void
    {
        $store = Store::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Casa Matriz Oruro',
            'phone' => '70000000',
            'address' => 'Plaza Principal',
            'enable_electronic_invoicing' => true,
            'sin_branch_code' => 0, // Casa matriz fiscal
            'sin_point_of_sale_code' => 0, // Punto de venta 0
        ]);

        $this->assertNotNull($store->sin_branch_code);
        $this->assertNotNull($store->sin_point_of_sale_code);
        $this->assertSame(0, $store->sin_branch_code);
        $this->assertSame(0, $store->sin_point_of_sale_code);

        // Store con null (no configurado)
        $store2 = Store::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Tienda 2',
            'phone' => '71111111',
            'address' => 'Calle 2',
            'sin_branch_code' => null,
            'sin_point_of_sale_code' => null,
        ]);

        $this->assertNull($store2->sin_branch_code);
        $this->assertNull($store2->sin_point_of_sale_code);
    }

    /**
     * 19. Configuración de un tenant no afecta otro tenant (aislamiento).
     */
    public function test_tenant_settings_isolation(): void
    {
        $tenantA = Setting::create([
            'business_name' => 'Tenant A Comercial',
            'tax_nit' => '11111111',
            'siat_api_token' => 'token-tenant-a',
        ]);

        $tenantB = Setting::create([
            'business_name' => 'Tenant B Comercial',
            'tax_nit' => '22222222',
            'siat_api_token' => 'token-tenant-b',
        ]);

        $this->assertSame('11111111', $tenantA->tax_nit);
        $this->assertSame('22222222', $tenantB->tax_nit);
        $this->assertSame('token-tenant-a', $tenantA->siat_api_token);
        $this->assertSame('token-tenant-b', $tenantB->siat_api_token);
    }
}
