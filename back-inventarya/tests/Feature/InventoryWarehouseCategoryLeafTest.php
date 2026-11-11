<?php

namespace Tests\Feature;

use App\Http\Controllers\InventoryWarehouseController;
use App\Models\Brand;
use App\Models\Category;
use App\Models\InventoryWarehouse;
use App\Models\Location;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class InventoryWarehouseCategoryLeafTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.wh_cat_testing' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => false,
            ],
            'database.default' => 'wh_cat_testing',
        ]);
        DB::purge('wh_cat_testing');

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

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
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
            $table->boolean('is_in_warehouse')->default(false);
            $table->timestamps();
        });

        Schema::create('inventory_warehouses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->unsignedBigInteger('supplier_id')->nullable();
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

        Route::get('/testing/inventory-warehouses', [InventoryWarehouseController::class, 'index']);
        Route::get('/testing/inventory-warehouses/purchase-products', [InventoryWarehouseController::class, 'purchaseProducts']);
    }

    public function test_inventory_warehouses_index_returns_leaf_category_without_parents(): void
    {
        $parent = Category::create(['name' => 'Tecnología', 'slug' => 'tec']);
        $leaf = Category::create([
            'name' => 'Tecnología > Computación > Laptops',
            'slug' => 'laptops',
            'parent_id' => $parent->id,
            'color' => '#10b981',
        ]);

        $product = Product::create([
            'name' => 'MacBook Pro M3',
            'slug' => 'macbook-pro-m3',
            'barcode' => '888123456',
            'sku' => 'MBP-M3',
            'category_id' => $leaf->id,
        ]);

        InventoryWarehouse::create([
            'id' => (string) Str::uuid(),
            'product_id' => $product->id,
            'price' => 12000,
            'sale_price' => 14000,
            'quantity' => 5,
            'stock_quantity' => 5,
        ]);

        $response = $this->getJson('/testing/inventory-warehouses');
        $response->assertStatus(200);

        $data = $response->json();

        // 1. Verificar lista de categorías
        $this->assertCount(1, $data['categories']);
        $this->assertEquals('Laptops', $data['categories'][0]['name']);

        // 2. Verificar productos agrupados
        $this->assertNotEmpty($data['products']);
        $firstGroup = $data['products'][0];
        $this->assertEquals('Laptops', $firstGroup['category']);
        $this->assertEquals('Laptops', $firstGroup['category_path']);
        $this->assertEquals('Laptops', $firstGroup['subcategory']);

        $firstItem = $firstGroup['products'][0];
        $this->assertEquals('Laptops', $firstItem['category']);
        $this->assertEquals('Laptops', $firstItem['category_path']);
    }

    public function test_purchase_products_endpoint_returns_leaf_category_without_parents(): void
    {
        $cat = Category::create([
            'name' => 'Bebidas / Gaseosas',
            'slug' => 'gaseosas',
        ]);

        Product::create([
            'name' => 'Coca Cola 2L',
            'slug' => 'coca-cola-2l',
            'barcode' => '777000111',
            'sku' => 'CC-2L',
            'category_id' => $cat->id,
        ]);

        $response = $this->getJson('/testing/inventory-warehouses/purchase-products');
        $response->assertStatus(200);

        $data = $response->json();
        $this->assertNotEmpty($data['products']);
        $this->assertEquals('Gaseosas', $data['products'][0]['category']);
        $this->assertEquals('Gaseosas', $data['products'][0]['category_path']);
    }
}
