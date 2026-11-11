<?php

namespace Tests\Feature;

use App\Http\Controllers\InventoryStoreController;
use App\Models\Brand;
use App\Models\Category;
use App\Models\InventoryStore;
use App\Models\Location;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class PosCategoryLeafTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.pos_cat_testing' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => false,
            ],
            'database.default' => 'pos_cat_testing',
        ]);
        DB::purge('pos_cat_testing');

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('color')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->timestamps();
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->timestamps();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('barcode')->nullable();
            $table->string('sku')->nullable();
            $table->string('image')->nullable();
            $table->string('image_thumb')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('brand_id')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('product_id');
            $table->unsignedBigInteger('location_id')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('sale_price', 10, 2)->default(0);
            $table->integer('quantity')->default(0);
            $table->integer('stock_quantity')->default(0);
            $table->integer('min_stock')->default(0);
            $table->string('unit')->default('Unidad');
            $table->date('expiration_date')->nullable();
            $table->date('restock_date')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Route::get('/testing/inventory-stores-get-by-store-slug/{slug}', [InventoryStoreController::class, 'getInventoryStoreSlug']);
        Route::get('/testing/inventory-stores-get-by-store-slug/{slug}/barcode/{code}', [InventoryStoreController::class, 'getByBarcode']);
    }

    public function test_category_model_leaf_name_attribute_returns_leaf_without_parents(): void
    {
        $cat1 = Category::create([
            'name' => 'Tecnología > Computación > Laptops',
            'slug' => 'laptops',
        ]);
        $this->assertEquals('Laptops', $cat1->leaf_name);

        $cat2 = Category::create([
            'name' => 'Bebidas / Gaseosas',
            'slug' => 'gaseosas',
        ]);
        $this->assertEquals('Gaseosas', $cat2->leaf_name);

        $cat3 = Category::create([
            'name' => 'Abarrotes',
            'slug' => 'abarrotes',
        ]);
        $this->assertEquals('Abarrotes', $cat3->leaf_name);
    }

    public function test_pos_store_endpoint_returns_leaf_category_without_parents(): void
    {
        $parent = Category::create(['name' => 'Tecnología', 'slug' => 'tec']);
        $child = Category::create(['name' => 'Computación', 'slug' => 'comp', 'parent_id' => $parent->id]);
        $leaf = Category::create(['name' => 'Laptops', 'slug' => 'laptops', 'parent_id' => $child->id]);

        $store = Store::create([
            'id' => (string) Str::uuid(),
            'name' => 'Sucursal Central',
            'slug' => 'central',
        ]);

        $product = Product::create([
            'name' => 'ThinkPad T14',
            'slug' => 'thinkpad-t14',
            'barcode' => '777123456',
            'sku' => 'TP-T14',
            'category_id' => $leaf->id,
        ]);

        InventoryStore::create([
            'id' => (string) Str::uuid(),
            'store_id' => $store->id,
            'product_id' => $product->id,
            'price' => 5000,
            'sale_price' => 5500,
            'quantity' => 10,
            'stock_quantity' => 10,
        ]);

        $res = $this->getJson('/testing/inventory-stores-get-by-store-slug/central');
        $res->assertOk();

        // 1. Array de categorías de la tienda debe tener el nombre hoja simple sin parents
        $categories = $res->json('categories');
        $this->assertNotEmpty($categories);
        $this->assertEquals('Laptops', $categories[0]['name']);

        // 2. En la agrupación de productos, category y category_path deben ser el nombre hoja
        $groups = $res->json('products');
        $this->assertNotEmpty($groups);
        $this->assertEquals('Laptops', $groups[0]['category']);
        $this->assertEquals('Laptops', $groups[0]['category_path']);

        // 3. getByBarcode también debe devolver category, category_name y category_path como hoja
        $resBarcode = $this->getJson('/testing/inventory-stores-get-by-store-slug/central/barcode/777123456');
        $resBarcode->assertOk();
        $prodData = $resBarcode->json('product');
        $this->assertEquals('Laptops', $prodData['category']);
        $this->assertEquals('Laptops', $prodData['category_name']);
        $this->assertEquals('Laptops', $prodData['category_path']);
    }

    public function test_pos_store_endpoint_handles_concatenated_category_strings_cleanly(): void
    {
        $catWithAncestors = Category::create([
            'name' => 'Bebidas > Gaseosas > Mini Botella',
            'slug' => 'mini-botella',
        ]);

        $store = Store::create([
            'id' => (string) Str::uuid(),
            'name' => 'Sucursal Norte',
            'slug' => 'norte',
        ]);

        $product = Product::create([
            'name' => 'Coca Cola 250ml',
            'slug' => 'coca-cola-250ml',
            'barcode' => '111222333',
            'sku' => 'CC-250',
            'category_id' => $catWithAncestors->id,
        ]);

        InventoryStore::create([
            'id' => (string) Str::uuid(),
            'store_id' => $store->id,
            'product_id' => $product->id,
            'price' => 5,
            'sale_price' => 7,
            'quantity' => 50,
            'stock_quantity' => 50,
        ]);

        $res = $this->getJson('/testing/inventory-stores-get-by-store-slug/norte');
        $res->assertOk();

        $categories = $res->json('categories');
        $this->assertEquals('Mini Botella', $categories[0]['name']);

        $groups = $res->json('products');
        $this->assertEquals('Mini Botella', $groups[0]['category']);
        $this->assertEquals('Mini Botella', $groups[0]['category_path']);
    }
}
