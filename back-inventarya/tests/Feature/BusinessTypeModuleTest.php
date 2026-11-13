<?php

namespace Tests\Feature;

use App\Http\Middleware\InitializeTenancyFlexible;
use App\Http\Requests\ProductRequest;
use App\Http\Requests\TenantStoreRequest;
use App\Models\BusinessType;
use App\Models\BusinessTypeField;
use App\Models\CentralUser;
use App\Models\InventoryStore;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\ProductAttributeService;
use App\Services\TenantService;
use Database\Seeders\BusinessTypeSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BusinessTypeModuleTest extends TestCase
{
    private CentralUser $superadmin;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.central' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
            'database.connections.tenant' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'central',
            'tenancy.central_domains' => ['localhost'],
        ]);

        DB::purge('central');
        DB::purge('tenant');
        Cache::flush();

        $this->createCentralSchema();
        $this->createTenantSchema();

        $this->superadmin = CentralUser::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@test.local',
            'password' => bcrypt('secret123'),
            'role' => 'superadmin',
            'status' => 'active',
        ]);
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
        parent::tearDown();
    }

    private function createCentralSchema(): void
    {
        $schema = Schema::connection('central');

        $schema->create('central_users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role')->default('superadmin');
            $table->string('status')->default('active');
            $table->string('avatar')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        $schema->create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('yearly_price', 10, 2)->default(0);
            $table->integer('max_users')->nullable();
            $table->integer('max_stores')->nullable();
            $table->integer('max_products')->nullable();
            $table->json('features')->nullable();
            $table->boolean('custom_domain')->default(false);
            $table->boolean('multi_store')->default(false);
            $table->boolean('reports')->default(true);
            $table->integer('trial_days')->default(0);
            $table->string('status')->default('active');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        $schema->create('business_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $schema->create('business_type_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_type_id')->constrained('business_types')->cascadeOnDelete();
            $table->string('key', 100);
            $table->string('label', 150);
            $table->string('type', 30);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('options')->nullable();
            $table->json('validation')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['business_type_id', 'key']);
        });

        $schema->create('tenants', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('active');
            $table->string('database');
            $table->string('database_host')->nullable();
            $table->string('database_port')->nullable();
            $table->string('database_username')->nullable();
            $table->string('database_password')->nullable();
            $table->string('owner_name')->nullable();
            $table->string('owner_email')->nullable();
            $table->string('owner_phone')->nullable();
            $table->string('logo')->nullable();
            $table->json('data')->nullable();
            $table->foreignId('business_type_id')->nullable()->constrained('business_types')->restrictOnDelete();
            $table->timestamps();
        });

        $schema->create('domains', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('tenant_id', 36);
            $table->string('type')->default('subdomain');
            $table->boolean('is_primary')->default(false);
            $table->string('status')->default('active');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        $schema->create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id', 36);
            $table->foreignId('plan_id')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->timestamps();
        });
    }

    private function createTenantSchema(): void
    {
        $schema = Schema::connection('tenant');

        $schema->create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role')->default('owner');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        $schema->create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('color', 20)->default('#6366f1');
            $table->timestamps();
        });

        $schema->create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->timestamps();
        });

        $schema->create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        $schema->create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('location')->nullable();
            $table->string('api_key')->nullable();
            $table->string('api_secret')->nullable();
            $table->boolean('api_status')->default(true);
            $table->boolean('api_enabled')->default(true);
            $table->timestamps();
        });

        $schema->create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable()->unique();
            $table->string('sku')->nullable();
            $table->string('barcode', 100)->nullable();
            $table->string('sin_product_code')->nullable();
            $table->string('sin_activity_code')->nullable();
            $table->integer('sin_unit_code')->nullable();
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->foreignId('category_id')->nullable();
            $table->foreignId('brand_id')->nullable();
            $table->json('attributes')->default('{}');
            $table->timestamps();
        });

        $schema->create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('product_id');
            $table->string('image');
            $table->timestamps();
        });

        $schema->create('inventory_stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id');
            $table->foreignUuid('store_id');
            $table->decimal('quantity', 10, 3)->default(0);
            $table->double('price')->default(0);
            $table->timestamp('restock_date')->nullable();
            $table->decimal('stock_quantity', 10, 3)->default(0);
            $table->decimal('min_stock', 10, 3)->default(0);
            $table->string('unit', 50);
            $table->double('sale_price')->default(0);
            $table->date('expiration_date')->nullable();
            $table->foreignId('location_id')->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('is_public')->default(true);
            $table->timestamps();
        });
    }

    private function bindTenantContext(Tenant $tenant): void
    {
        tenancy()->tenant = $tenant;
        tenancy()->initialized = true;
        DB::setDefaultConnection('tenant');
    }

    public function test_business_types_crud_fields_and_dependency_protection(): void
    {
        Sanctum::actingAs($this->superadmin);

        // Create
        $createRes = $this->postJson('http://localhost/api/business-types', [
            'name' => 'Optica',
            'description' => 'Lentes y monturas',
            'is_active' => true,
        ]);
        $createRes->assertStatus(201);
        $typeId = $createRes->json('business_type.id');
        $this->assertSame('optica', $createRes->json('business_type.slug'));

        // List & search
        $listRes = $this->getJson('http://localhost/api/business-types?search=Opt');
        // SQLite LIKE matches ASCII; verify paginated structure and exact search
        $listRes->assertStatus(200)->assertJsonStructure(['data', 'meta' => ['total', 'per_page', 'current_page', 'last_page']]);

        $exactSearch = $this->getJson('http://localhost/api/business-types?search=Optica');
        $exactSearch->assertStatus(200);
        $this->assertCount(1, $exactSearch->json('data'));

        // Update & toggle
        $this->putJson("http://localhost/api/business-types/{$typeId}", [
            'name' => 'Óptica Especializada',
        ])->assertStatus(200);

        $this->patchJson("http://localhost/api/business-types/{$typeId}/toggle-status")
            ->assertStatus(200)
            ->assertJsonPath('business_type.is_active', false);

        // Add fields & unique key check
        $fieldRes = $this->postJson("http://localhost/api/business-types/{$typeId}/fields", [
            'key' => 'lens_type',
            'label' => 'Tipo de lente',
            'type' => 'select',
            'is_required' => true,
            'options' => ['Monofocal', 'Bifocal', 'Progresivo'],
        ]);
        $fieldRes->assertStatus(201);
        $fieldId = $fieldRes->json('field.id');

        $this->postJson("http://localhost/api/business-types/{$typeId}/fields", [
            'key' => 'lens_type',
            'label' => 'Duplicado',
            'type' => 'text',
        ])->assertStatus(422);

        // Associate a tenant -> locks deletion of business type and field key/type changes
        Tenant::create([
            'id' => 'optica-uno',
            'name' => 'Optica Uno',
            'slug' => 'optica-uno',
            'status' => 'active',
            'database' => 'optica_uno',
            'business_type_id' => $typeId,
        ]);

        $this->deleteJson("http://localhost/api/business-types/{$typeId}")->assertStatus(422);
        $this->deleteJson("http://localhost/api/business-types/{$typeId}/fields/{$fieldId}")->assertStatus(422);

        $this->putJson("http://localhost/api/business-types/{$typeId}/fields/{$fieldId}", [
            'key' => 'other_key',
            'label' => 'Tipo de lente',
            'type' => 'select',
            'options' => ['Monofocal'],
        ])->assertStatus(422);

        // Label and options update is still allowed
        $this->putJson("http://localhost/api/business-types/{$typeId}/fields/{$fieldId}", [
            'label' => 'Tipo de cristal',
            'options' => ['Monofocal', 'Bifocal'],
        ])->assertStatus(200);
    }

    public function test_tenant_store_request_requires_active_business_type(): void
    {
        $plan = Plan::create([
            'name' => 'Free',
            'slug' => 'free',
            'price' => 0,
            'yearly_price' => 0,
            'status' => 'active',
        ]);

        $inactiveType = BusinessType::create([
            'name' => 'Inactivo',
            'slug' => 'inactivo',
            'is_active' => false,
        ]);

        $activeType = BusinessType::create([
            'name' => 'Farmacia',
            'slug' => 'farmacia',
            'is_active' => true,
        ]);

        $basePayload = [
            'tenant' => [
                'name' => 'Farmacia Vida',
                'slug' => 'farmacia-vida',
                'database' => 'farmacia_vida',
            ],
            'subscription' => [
                'plan_id' => $plan->id,
                'billing_cycle' => 'monthly',
            ],
            'owner' => [
                'name' => 'Ana',
                'email' => 'ana@vida.com',
                'password' => 'secret123',
            ],
        ];

        $req = new TenantStoreRequest();

        // Missing business_type_id
        $v1 = Validator::make($basePayload, $req->rules(), $req->messages());
        $this->assertTrue($v1->fails());
        $this->assertArrayHasKey('tenant.business_type_id', $v1->errors()->toArray());

        // Inactive business_type_id
        $payloadInactive = $basePayload;
        $payloadInactive['tenant']['business_type_id'] = $inactiveType->id;
        $v2 = Validator::make($payloadInactive, $req->rules(), $req->messages());
        $this->assertTrue($v2->fails());

        // Active business_type_id
        $payloadActive = $basePayload;
        $payloadActive['tenant']['business_type_id'] = $activeType->id;
        $v3 = Validator::make($payloadActive, $req->rules(), $req->messages());
        $this->assertFalse($v3->fails());
    }

    public function test_dynamic_product_attributes_validation_partial_updates_and_cache_invalidation(): void
    {
        $pharmacy = BusinessType::create(['name' => 'Farmacia', 'slug' => 'pharmacy', 'is_active' => true]);
        $hardware = BusinessType::create(['name' => 'Ferretería', 'slug' => 'hardware', 'is_active' => true]);

        $fActive = BusinessTypeField::create([
            'business_type_id' => $pharmacy->id,
            'key' => 'active_ingredient',
            'label' => 'Principio activo',
            'type' => 'text',
            'is_required' => true,
            'is_active' => true,
            'validation' => ['min_length' => 3, 'max_length' => 100],
            'sort_order' => 1,
        ]);

        $fPres = BusinessTypeField::create([
            'business_type_id' => $pharmacy->id,
            'key' => 'presentation',
            'label' => 'Presentación',
            'type' => 'select',
            'is_required' => false,
            'is_active' => true,
            'options' => ['Tableta', 'Jarabe'],
            'sort_order' => 2,
        ]);

        BusinessTypeField::create([
            'business_type_id' => $hardware->id,
            'key' => 'material',
            'label' => 'Material',
            'type' => 'text',
            'is_required' => false,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $tenantA = Tenant::create([
            'id' => 'farmacia-a',
            'name' => 'Farmacia A',
            'slug' => 'farmacia-a',
            'status' => 'active',
            'database' => 'farmacia_a',
            'business_type_id' => $pharmacy->id,
        ]);

        $tenantLegacy = Tenant::create([
            'id' => 'legacy-tenant',
            'name' => 'Legacy',
            'slug' => 'legacy-tenant',
            'status' => 'active',
            'database' => 'legacy_tenant',
            'business_type_id' => null,
        ]);

        // Legacy tenant works without business type
        $this->bindTenantContext($tenantLegacy);
        $service = app(ProductAttributeService::class);
        $this->assertSame([], $service->activeFieldsForCurrentTenant());

        // Tenant A gets pharmacy fields and invalidation works on field update
        $this->bindTenantContext($tenantA);
        $user = User::create([
            'name' => 'Owner',
            'email' => 'owner@farmacia-a.test',
            'password' => bcrypt('secret'),
            'role' => 'owner',
            'status' => 'active',
        ]);
        Sanctum::actingAs($user);

        $contractRes = $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->getJson('/api/business-type/product-fields');
        $contractRes->assertStatus(200)
            ->assertJsonPath('business_type.slug', 'pharmacy')
            ->assertJsonCount(2, 'fields');

        // Deactivate presentation -> cache invalidates automatically
        $fPres->update(['is_active' => false]);
        $contractRes2 = $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->getJson('/api/business-type/product-fields');
        $contractRes2->assertStatus(200)->assertJsonCount(1, 'fields');

        // Reactivate presentation for product tests
        $fPres->update(['is_active' => true]);

        // Reject unknown attribute (e.g. hardware field 'material' on a pharmacy tenant)
        $badRes = $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->postJson('/api/products', [
                'name' => 'Paracetamol',
                'attributes' => [
                    'active_ingredient' => 'Paracetamol',
                    'material' => 'Acero',
                ],
            ]);
        $badRes->assertStatus(422)->assertJsonValidationErrors(['attributes.material']);

        // Reject invalid select option
        $badSelect = $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->postJson('/api/products', [
                'name' => 'Paracetamol',
                'attributes' => [
                    'active_ingredient' => 'Paracetamol',
                    'presentation' => 'Inexistente',
                ],
            ]);
        $badSelect->assertStatus(422)->assertJsonValidationErrors(['attributes.presentation']);

        // Create valid product
        $okRes = $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->postJson('/api/products', [
                'name' => 'Paracetamol 500mg',
                'attributes' => [
                    'active_ingredient' => 'Paracetamol',
                    'presentation' => 'Tableta',
                ],
            ]);
        $okRes->assertStatus(201);
        $productId = $okRes->json('product.id');

        // Deactivate presentation, then update only name -> historical presentation is preserved
        $fPres->update(['is_active' => false]);
        $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->putJson("/api/products/{$productId}", [
                'name' => 'Paracetamol 500mg Forte',
            ])
            ->assertStatus(200);

        $freshProduct = Product::findOrFail($productId);
        $this->assertSame('Tableta', $freshProduct->attributes['presentation']);
        $this->assertSame('Paracetamol', $freshProduct->attributes['active_ingredient']);
    }

    public function test_inventory_store_is_public_filters_external_endpoint_but_keeps_internal(): void
    {
        $tenant = Tenant::create([
            'id' => 'tienda-pub',
            'name' => 'Tienda Pub',
            'slug' => 'tienda-pub',
            'status' => 'active',
            'database' => 'tienda_pub',
            'business_type_id' => null,
        ]);
        $this->bindTenantContext($tenant);

        $user = User::create([
            'name' => 'Owner',
            'email' => 'owner@pub.test',
            'password' => bcrypt('secret'),
            'role' => 'owner',
            'status' => 'active',
        ]);
        Sanctum::actingAs($user);

        $store = Store::create([
            'name' => 'Sucursal 1',
            'slug' => 'sucursal-1',
            'api_key' => 'test-key-123',
            'api_secret' => bcrypt('secret-123'),
            'api_status' => true,
            'api_enabled' => true,
        ]);

        $prodPublic = Product::create(['name' => 'Producto Público']);
        $prodPrivate = Product::create(['name' => 'Producto Privado']);

        $invPublic = InventoryStore::create([
            'product_id' => $prodPublic->id,
            'store_id' => $store->id,
            'quantity' => 10,
            'stock_quantity' => 10,
            'price' => 50,
            'sale_price' => 50,
            'unit' => 'Unidad',
            'is_public' => true,
        ]);

        $invPrivate = InventoryStore::create([
            'product_id' => $prodPrivate->id,
            'store_id' => $store->id,
            'quantity' => 5,
            'stock_quantity' => 5,
            'price' => 30,
            'sale_price' => 30,
            'unit' => 'Unidad',
            'is_public' => false,
        ]);

        // Internal authenticated endpoint sees both
        $internal = $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->getJson('/api/inventory-stores');
        $internal->assertStatus(200)->assertJsonCount(2);

        // Update is_public via PUT
        $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->putJson("/api/inventory-stores/{$invPublic->id}", ['is_public' => false])
            ->assertStatus(200)
            ->assertJsonPath('inventoryStore.is_public', false);

        $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->putJson("/api/inventory-stores/{$invPublic->id}", ['is_public' => true])
            ->assertStatus(200);

        // External endpoint excludes private records
        $extReq = $this->withoutMiddleware(InitializeTenancyFlexible::class)
            ->withHeaders([
                'X-API-KEY' => 'test-key-123',
                'X-API-SECRET' => 'secret-123',
            ])
            ->getJson('/api/external/store-products');
        $extReq->assertStatus(200)->assertJsonPath('total', 1);
        $this->assertSame($invPublic->id, $extReq->json('data.0.inventory_id'));
    }

    public function test_business_type_seeder_is_idempotent(): void
    {
        $seeder = new BusinessTypeSeeder();
        $seeder->run();
        $firstTypes = BusinessType::count();
        $firstFields = BusinessTypeField::count();

        $seeder->run();
        $this->assertSame(7, BusinessType::count());
        $this->assertSame($firstTypes, BusinessType::count());
        $this->assertSame($firstFields, BusinessTypeField::count());
    }
}
