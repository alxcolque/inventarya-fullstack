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

class InventoryWarehouseOptimizationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.inv_testing' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => false,
            ],
            'database.default' => 'inv_testing',
        ]);
        DB::purge('inv_testing');

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
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('brand_id')->nullable();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku')->nullable();
            $table->string('barcode')->nullable();
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_warehouses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->string('unit', 100)->nullable();
            $table->decimal('quantity', 10, 2)->default(0.00);
            $table->double('price')->default(0.00);
            $table->double('sale_price')->default(0.00);
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->timestamp('restock_date')->nullable();
            $table->decimal('stock_quantity', 10, 2)->default(0.00);
            $table->decimal('min_stock', 10, 2)->default(0.00);
            $table->unsignedBigInteger('location_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Route::prefix('testing')->group(function () {
            Route::get('/inventory-warehouses/summary', [InventoryWarehouseController::class, 'summary']);
            Route::get('/inventory-warehouses/purchase-products', [InventoryWarehouseController::class, 'purchaseProducts']);
            Route::get('/inventory-warehouses-product-ids', [InventoryWarehouseController::class, 'getRegisteredProductIds']);
            Route::post('/inventory-warehouses/bulk-purchase', [InventoryWarehouseController::class, 'bulkPurchase']);
            Route::apiResource('/inventory-warehouses', InventoryWarehouseController::class);
        });
    }

    private function createCategory(string $name, string $slug): Category
    {
        return Category::create(['name' => $name, 'slug' => $slug, 'color' => '#6366f1']);
    }

    private function createBrand(string $name, string $slug): Brand
    {
        return Brand::create(['name' => $name, 'slug' => $slug]);
    }

    private function createProduct(string $name, ?Category $category = null, ?Brand $brand = null, ?string $sku = null, ?string $barcode = null): Product
    {
        return Product::create([
            'id' => (string) Str::uuid(),
            'name' => $name,
            'slug' => Str::slug($name) . '-' . Str::random(5),
            'category_id' => $category?->id,
            'brand_id' => $brand?->id,
            'sku' => $sku ?: 'SKU-' . Str::random(6),
            'barcode' => $barcode ?: 'BC-' . Str::random(6),
        ]);
    }

    private function createWarehouseItem(Product $product, float $stock = 10, float $price = 50, string $unit = 'Unidad', ?int $supplierId = null, ?int $locationId = null): InventoryWarehouse
    {
        return InventoryWarehouse::create([
            'id' => (string) Str::uuid(),
            'product_id' => $product->id,
            'stock_quantity' => $stock,
            'quantity' => $stock,
            'price' => $price,
            'unit' => $unit,
            'min_stock' => 5,
            'supplier_id' => $supplierId,
            'location_id' => $locationId,
            'restock_date' => now(),
        ]);
    }

    public function test_first_page_and_cursor_pagination(): void
    {
        $cat = $this->createCategory('Laptops', 'laptops');
        for ($i = 1; $i <= 5; $i++) {
            $p = $this->createProduct("Laptop $i", $cat);
            $this->createWarehouseItem($p, 10, 100);
        }

        // Request page 1 with per_page = 2
        $res = $this->getJson('/testing/inventory-warehouses?per_page=2');
        $res->assertOk();
        $data = $res->json();

        $this->assertArrayHasKey('pagination', $data);
        $this->assertTrue($data['pagination']['has_more']);
        $this->assertNotNull($data['pagination']['next_cursor']);

        // Check products count in first page
        $productsInGroups = collect($data['products'])->flatMap(fn($g) => $g['products']);
        $this->assertCount(2, $productsInGroups);

        // Request page 2 with cursor
        $cursor = $data['pagination']['next_cursor'];
        $res2 = $this->getJson('/testing/inventory-warehouses?per_page=2&cursor=' . urlencode($cursor));
        $res2->assertOk();
        $data2 = $res2->json();

        $productsInPage2 = collect($data2['products'])->flatMap(fn($g) => $g['products']);
        $this->assertCount(2, $productsInPage2);

        // Ensure no overlapping products between pages
        $page1Ids = $productsInGroups->pluck('id')->all();
        $page2Ids = $productsInPage2->pluck('id')->all();
        $this->assertEmpty(array_intersect($page1Ids, $page2Ids));
    }

    public function test_search_and_filters(): void
    {
        $cat1 = $this->createCategory('Bebidas', 'bebidas');
        $cat2 = $this->createCategory('Snacks', 'snacks');
        $brand1 = $this->createBrand('Coca Cola', 'coca-cola');
        $brand2 = $this->createBrand('Pepsi', 'pepsi');

        $p1 = $this->createProduct('Coca Cola Zero', $cat1, $brand1, 'CC-001', '777123');
        $p2 = $this->createProduct('Pepsi Black', $cat1, $brand2, 'PB-001', '777456');
        $p3 = $this->createProduct('Papas Fritas', $cat2, $brand1, 'PF-001', '777789');

        $this->createWarehouseItem($p1);
        $this->createWarehouseItem($p2);
        $this->createWarehouseItem($p3);

        // 1. Search by SKU
        $res = $this->getJson('/testing/inventory-warehouses?search=CC-001');
        $res->assertOk();
        $prods = collect($res->json('products'))->flatMap(fn($g) => $g['products']);
        $this->assertCount(1, $prods);
        $this->assertSame($p1->id, $prods->first()['id']);

        // 2. Search by Barcode
        $res = $this->getJson('/testing/inventory-warehouses?search=777456');
        $res->assertOk();
        $prods = collect($res->json('products'))->flatMap(fn($g) => $g['products']);
        $this->assertCount(1, $prods);
        $this->assertSame($p2->id, $prods->first()['id']);

        // 3. Filter by category
        $res = $this->getJson('/testing/inventory-warehouses?categories=snacks');
        $res->assertOk();
        $prods = collect($res->json('products'))->flatMap(fn($g) => $g['products']);
        $this->assertCount(1, $prods);
        $this->assertSame($p3->id, $prods->first()['id']);

        // 4. Filter by brand
        $res = $this->getJson('/testing/inventory-warehouses?brands=pepsi');
        $res->assertOk();
        $prods = collect($res->json('products'))->flatMap(fn($g) => $g['products']);
        $this->assertCount(1, $prods);
        $this->assertSame($p2->id, $prods->first()['id']);
    }

    public function test_summary_kpis(): void
    {
        $p1 = $this->createProduct('Prod A');
        $p2 = $this->createProduct('Prod B');
        $p3 = $this->createProduct('Prod C');

        // Stock 10, price 20 -> Value 200 (healthy)
        $this->createWarehouseItem($p1, 10, 20);
        // Stock 0, price 15 -> Value 0 (out of stock)
        $this->createWarehouseItem($p2, 0, 15);
        // Stock 2, min_stock 5, price 30 -> Value 60 (low stock)
        $this->createWarehouseItem($p3, 2, 30);

        $res = $this->getJson('/testing/inventory-warehouses/summary');
        $res->assertOk();
        $data = $res->json();

        $this->assertEquals(3, $data['total_products']);
        $this->assertEquals(12, $data['total_stock']);
        $this->assertEquals(260, $data['total_value']);
        $this->assertEquals(1, $data['out_of_stock']);
        $this->assertEquals(1, $data['low_stock']);
    }

    public function test_purchase_products_catalog(): void
    {
        $cat = $this->createCategory('Lácteos', 'lacteos');
        $p1 = $this->createProduct('Leche Entera', $cat);
        $p2 = $this->createProduct('Yogurt Fresa', $cat);
        $p3 = $this->createProduct('Queso Edam', $cat);

        // Put p1 in warehouse
        $this->createWarehouseItem($p1, 5, 12, 'Litro');

        $res = $this->getJson('/testing/inventory-warehouses/purchase-products?per_page=2');
        $res->assertOk();
        $data = $res->json();

        $this->assertCount(2, $data['products']);
        $this->assertTrue($data['pagination']['has_more']);
        $this->assertNotNull($data['pagination']['next_cursor']);

        // Check is_in_warehouse flag
        $allRes = $this->getJson('/testing/inventory-warehouses/purchase-products?per_page=10');
        $items = collect($allRes->json('products'))->keyBy('id');
        $this->assertTrue($items[$p1->id]['is_in_warehouse']);
        $this->assertFalse($items[$p2->id]['is_in_warehouse']);
        $this->assertEquals('Litro', $items[$p1->id]['unit']);
        $this->assertEquals(12, $items[$p1->id]['price']);

        // Test search on purchase products
        $searchRes = $this->getJson('/testing/inventory-warehouses/purchase-products?search=Yogurt');
        $searchRes->assertOk();
        $this->assertCount(1, $searchRes->json('products'));
        $this->assertSame($p2->id, $searchRes->json('products.0.id'));
    }

    public function test_bulk_purchase_with_new_existing_multiple_units_and_suppliers(): void
    {
        $supplier = Supplier::create(['name' => 'Distribuidora Central']);
        $location = Location::create(['name' => 'Pasillo 4']);

        $p1 = $this->createProduct('Aceite Girasol');
        $p2 = $this->createProduct('Arroz Extra');

        // Existing warehouse item for p1
        $this->createWarehouseItem($p1, 10, 8.5, 'Botella');

        $payload = [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'invoice_number' => 'FAC-9988',
            'notes' => 'Lote de prueba',
            'items' => [
                // 1. Existing product + same unit -> Should restock (10 + 5 = 15)
                [
                    'product_id' => $p1->id,
                    'price' => 9.0,
                    'quantity' => 5,
                    'unit' => 'Botella',
                ],
                // 2. Existing product + different unit -> Should create new warehouse row
                [
                    'product_id' => $p1->id,
                    'price' => 100.0,
                    'quantity' => 2,
                    'unit' => 'Caja',
                ],
                // 3. New product -> Should create new warehouse row
                [
                    'product_id' => $p2->id,
                    'price' => 4.5,
                    'quantity' => 20,
                    'unit' => 'Kilo',
                    'supplier_id' => $supplier->id,
                    'location_id' => $location->id,
                    'min_stock' => 10,
                ],
            ],
        ];

        $res = $this->postJson('/testing/inventory-warehouses/bulk-purchase', $payload);
        $res->assertStatus(201);
        $res->assertJson([
            'registered_count' => 2,
            'updated_count' => 1,
        ]);

        // Verify database state
        $p1Botella = InventoryWarehouse::where('product_id', $p1->id)->where('unit', 'Botella')->first();
        $this->assertNotNull($p1Botella);
        $this->assertEquals(15, $p1Botella->stock_quantity);
        $this->assertEquals(9.0, $p1Botella->price);
        $this->assertEquals('FAC-9988', $p1Botella->metadata['invoice_number']);

        $p1Caja = InventoryWarehouse::where('product_id', $p1->id)->where('unit', 'Caja')->first();
        $this->assertNotNull($p1Caja);
        $this->assertEquals(2, $p1Caja->stock_quantity);

        $p2Kilo = InventoryWarehouse::where('product_id', $p2->id)->where('unit', 'Kilo')->first();
        $this->assertNotNull($p2Kilo);
        $this->assertEquals(20, $p2Kilo->stock_quantity);
        $this->assertEquals($supplier->id, $p2Kilo->supplier_id);
        $this->assertEquals($location->id, $p2Kilo->location_id);
    }

    public function test_bulk_purchase_validation_error(): void
    {
        // Empty items
        $res = $this->postJson('/testing/inventory-warehouses/bulk-purchase', ['items' => []]);
        $res->assertStatus(422);

        // Invalid product_id
        $res2 = $this->postJson('/testing/inventory-warehouses/bulk-purchase', [
            'items' => [
                ['product_id' => (string) Str::uuid(), 'quantity' => 5],
            ],
        ]);
        $res2->assertStatus(422);
    }

    public function test_warehouse_sale_price_handling(): void
    {
        $cat = $this->createCategory('Bebidas', 'bebidas');
        $product = $this->createProduct('Gaseosa Cola', $cat);

        // 1. Bulk purchase with sale_price
        $res = $this->postJson('/testing/inventory-warehouses/bulk-purchase', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'price' => 10.50,
                    'sale_price' => 15.00,
                    'quantity' => 20,
                    'unit' => 'Botella',
                ],
            ],
        ]);
        $res->assertStatus(201);

        $item = InventoryWarehouse::where('product_id', $product->id)->first();
        $this->assertNotNull($item);
        $this->assertEquals(10.50, $item->price);
        $this->assertEquals(15.00, $item->sale_price);

        // 2. Index returns sale_price
        $indexRes = $this->getJson('/testing/inventory-warehouses');
        $indexRes->assertStatus(200);
        $indexRes->assertJsonFragment([
            'sale_price' => 15.00,
        ]);

        // 3. Update sale_price
        $updateRes = $this->putJson('/testing/inventory-warehouses/' . $item->id, [
            'product_id' => $product->id,
            'price' => 11.00,
            'sale_price' => 18.50,
            'unit' => 'Botella',
        ]);
        $updateRes->assertStatus(200);

        $item->refresh();
        $this->assertEquals(18.50, $item->sale_price);
        $this->assertEquals(18.50, $item->saleprice);
    }
}
