<?php

namespace Tests\Feature;

use App\Http\Controllers\BrandController;
use App\Http\Controllers\CentralProfileController;
use App\Http\Controllers\ConfigurationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductImageController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\UserController;
use App\Http\Requests\BrandRequest;
use App\Http\Requests\ProductImageRequest;
use App\Http\Requests\ProductRequest;
use App\Http\Requests\StoreRequest;
use App\Http\Requests\UpdateCentralProfileRequest;
use App\Http\Requests\UserRequest;
use App\Models\Brand;
use App\Models\CentralUser;
use App\Models\Configuration;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use App\Services\EmployeeInvitationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicMediaPersistenceTest extends TestCase
{
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.media_testing' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
            ],
            'database.default' => 'media_testing',
            'filesystems.media_disk' => 'local',
            'filesystems.disks.local.url' => 'http://localhost:8000/storage',
            'filesystems.disks.public.url' => 'http://localhost:8000/storage',
        ]);
        DB::purge('media_testing');
        Storage::fake('local');
        Storage::fake('public');

        $this->createTables();
    }

    public function test_product_and_gallery_persist_relative_paths(): void
    {
        $request = $this->validated(ProductRequest::class, 'POST', [
            'name' => 'Producto',
            'image' => self::PNG,
        ]);

        (new ProductController)->store($request);
        $product = Product::firstOrFail();
        $productPath = $product->getRawOriginal('image');

        $this->assertStringStartsWith('tenant/default/products/', $productPath);
        $this->assertFalse(filter_var($productPath, FILTER_VALIDATE_URL));
        Storage::disk('local')->assertExists($productPath);

        $galleryRequest = $this->validated(ProductImageRequest::class, 'POST', [
            'product_id' => $product->id,
            'image' => self::PNG,
        ]);
        (new ProductImageController)->store($galleryRequest);

        $gallery = ProductImage::firstOrFail();
        $this->assertSame($gallery->getRawOriginal('image'), $gallery->image_key);
        $this->assertStringStartsWith('tenant/default/products/gallery/', $gallery->image_key);
    }

    public function test_brand_store_and_tenant_avatar_replace_only_after_persistence(): void
    {
        $oldBrand = 'tenant/default/brands/old.webp';
        Storage::disk('local')->put($oldBrand, 'old');
        $brand = Brand::create(['name' => 'OLD', 'slug' => 'old', 'image' => $oldBrand, 'image_key' => $oldBrand]);
        $request = $this->validated(BrandRequest::class, 'PUT', ['name' => 'Nueva', 'image' => self::PNG]);
        (new BrandController)->update($request, $brand->id);
        $brand->refresh();
        $this->assertSame($brand->getRawOriginal('image'), $brand->image_key);
        Storage::disk('local')->assertMissing($oldBrand);
        Storage::disk('local')->assertExists($brand->image_key);

        $oldStore = 'tenant/default/stores/old.webp';
        Storage::disk('local')->put($oldStore, 'old');
        $store = Store::create([
            'name' => 'Tienda',
            'slug' => 'tienda',
            'phone' => '70000000',
            'address' => 'Dirección',
            'front_image' => $oldStore,
            'front_image_key' => $oldStore,
        ]);
        $request = $this->validated(StoreRequest::class, 'PUT', [
            'name' => 'Tienda',
            'phone' => '70000000',
            'address' => 'Dirección',
            'front_image' => UploadedFile::fake()->image('store.png', 20, 20),
        ]);
        (new StoreController)->update($request, $store->id);
        $store->refresh();
        Storage::disk('local')->assertMissing($oldStore);
        Storage::disk('local')->assertExists($store->front_image_key);

        $oldAvatar = 'tenant/default/users/old.webp';
        Storage::disk('local')->put($oldAvatar, 'old');
        $user = User::create([
            'name' => 'Usuario',
            'email' => 'user@example.com',
            'password' => 'secret123',
            'role' => 'staff',
            'status' => 'active',
            'avatar' => $oldAvatar,
            'avatar_key' => $oldAvatar,
        ]);
        $request = $this->validated(UserRequest::class, 'PUT', [
            'name' => 'Usuario',
            'email' => 'user@example.com',
            'role' => 'staff',
            'status' => 'active',
            'avatar' => self::PNG,
        ], ['user' => $user->id]);
        (new UserController(app(EmployeeInvitationService::class)))->update($request, (string) $user->id);
        $user->refresh();
        Storage::disk('local')->assertMissing($oldAvatar);
        Storage::disk('local')->assertExists($user->avatar_key);
    }

    public function test_tenant_and_central_branding_use_media_disk_and_relative_paths(): void
    {
        $setting = Setting::create(['business_name' => 'Tenant']);
        $request = Request::create('/settings', 'POST', ['business_name' => 'Tenant'], [], [
            'logo_file' => UploadedFile::fake()->image('logo.png', 20, 20),
        ]);
        (new SettingController)->update($request, $setting->id);
        $setting->refresh();

        $this->assertStringStartsWith('settings/', $setting->getRawOriginal('logo'));
        Storage::disk('local')->assertExists($setting->getRawOriginal('logo'));

        $configuration = Configuration::create(['name' => 'Inventarya']);
        $request = Request::create('/configuration', 'POST', ['name' => 'Inventarya'], [], [
            'logo_file' => UploadedFile::fake()->image('logo.png', 20, 20),
        ]);
        (new ConfigurationController)->update($request);
        $configuration->refresh();

        $this->assertStringStartsWith('configurations/', $configuration->getRawOriginal('logo'));
        Storage::disk('local')->assertExists($configuration->getRawOriginal('logo'));
    }

    public function test_central_avatar_persists_a_relative_path(): void
    {
        $user = CentralUser::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'secret123',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $request = $this->validated(UpdateCentralProfileRequest::class, 'PUT', [
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'avatar' => self::PNG,
        ], [], $user);

        (new CentralProfileController)->update($request);
        $user->refresh();

        $path = $user->getRawOriginal('avatar');
        $this->assertStringStartsWith('central/users/', $path);
        $this->assertFalse(filter_var($path, FILTER_VALIDATE_URL));
        Storage::disk('local')->assertExists($path);
    }

    private function validated(
        string $class,
        string $method,
        array $data,
        array $routeParameters = [],
        mixed $user = null
    ): FormRequest {
        /** @var FormRequest $request */
        $request = $class::create('/', $method, $data);
        $request->setContainer($this->app);
        $request->setRedirector($this->app->make('redirect'));
        $request->setUserResolver(fn () => $user);

        if ($routeParameters !== []) {
            $route = new Route([$method], '/', []);
            $route->bind($request);
            foreach ($routeParameters as $key => $value) {
                $route->setParameter($key, $value);
            }
            $request->setRouteResolver(fn () => $route);
        }

        $request->validateResolved();

        return $request;
    }

    private function createTables(): void
    {
        Schema::create('brands', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug');
            $table->string('image')->nullable();
            $table->string('image_key')->nullable();
            $table->timestamps();
        });
        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug');
            $table->string('color')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamps();
        });
        Schema::create('products', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('brand_id')->nullable();
            $table->string('sku')->nullable();
            $table->string('barcode')->nullable();
            $table->timestamps();
        });
        Schema::create('product_images', function (Blueprint $table): void {
            $table->id();
            $table->uuid('product_id');
            $table->string('image');
            $table->string('image_key')->nullable();
            $table->timestamps();
        });
        Schema::create('stores', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug');
            $table->string('location')->nullable();
            $table->string('phone');
            $table->string('front_image')->nullable();
            $table->string('front_image_key')->nullable();
            $table->string('address');
            $table->boolean('is_active')->default(true);
            $table->boolean('api_status')->default(false);
            $table->string('api_key')->nullable();
            $table->string('api_secret')->nullable();
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('username')->nullable();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('avatar')->nullable();
            $table->string('avatar_key')->nullable();
            $table->string('role');
            $table->string('phone')->nullable();
            $table->string('ci')->nullable();
            $table->string('status')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
        Schema::create('user_invitations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('invited_by_id')->nullable();
            $table->string('token_hash')->unique();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
        Schema::create('settings', function (Blueprint $table): void {
            $table->id();
            $table->string('business_name');
            $table->string('logo')->nullable();
            $table->string('favicon')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('theme')->nullable();
            $table->string('primary_color')->nullable();
            $table->text('terms')->nullable();
            $table->text('policy')->nullable();
            $table->string('currency')->nullable();
            $table->string('timezone')->nullable();
            $table->json('social')->nullable();
            $table->timestamps();
        });
        Schema::create('configurations', function (Blueprint $table): void {
            $table->id();
            $table->string('logo')->nullable();
            $table->string('favicon')->nullable();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('privacy')->nullable();
            $table->text('terms')->nullable();
            $table->text('about_us')->nullable();
            $table->timestamps();
        });
        Schema::create('central_users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role');
            $table->string('status');
            $table->string('avatar')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
    }
}
