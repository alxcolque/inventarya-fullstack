<?php

namespace Tests\Feature;

use App\Http\Requests\ProductRequest;
use App\Models\Product;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class ProductBarcodeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'database.connections.product_bc_test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
            'database.default' => 'product_bc_test',
        ]);
        DB::purge('product_bc_test');

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

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable()->unique();
            $table->string('sku')->nullable();
            $table->string('barcode', 100)->nullable()->index();
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->foreignId('category_id')->nullable();
            $table->foreignId('brand_id')->nullable();
            $table->timestamps();
        });
    }

    public function test_product_request_allows_alphanumeric_barcode_such_as_00n1(): void
    {
        $request = new ProductRequest();

        $validator = Validator::make([
            'name' => 'Tinta Epson T664 Negro',
            'barcode' => '00N1',
        ], $request->rules(), $request->messages());

        $this->assertFalse($validator->fails(), 'Validation should pass for alphanumeric barcode 00N1');
        $this->assertSame('00N1', $validator->validated()['barcode']);
    }

    public function test_product_request_rejects_barcode_exceeding_100_chars(): void
    {
        $request = new ProductRequest();

        $validator = Validator::make([
            'name' => 'Tinta Epson T664 Negro',
            'barcode' => str_repeat('A', 101),
        ], $request->rules(), $request->messages());

        $this->assertTrue($validator->fails(), 'Validation should fail when barcode exceeds 100 characters');
        $this->assertArrayHasKey('barcode', $validator->errors()->toArray());
    }

    public function test_product_can_store_and_search_by_alphanumeric_barcode(): void
    {
        $product = Product::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Tinta Epson T504 Negro 00N1',
            'barcode' => '00N1',
            'sku' => 'EPS-00N1',
        ]);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'barcode' => '00N1',
        ]);

        $found = Product::where('barcode', '00N1')->first();
        $this->assertNotNull($found);
        $this->assertSame('Tinta Epson T504 Negro 00N1', $found->name);
    }
}
