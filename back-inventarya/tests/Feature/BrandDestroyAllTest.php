<?php

namespace Tests\Feature;

use App\Http\Controllers\BrandController;
use App\Models\Brand;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BrandDestroyAllTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'database.connections.brand_testing' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
            'database.default' => 'brand_testing',
        ]);
        DB::purge('brand_testing');
        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('image')->nullable();
            $table->string('image_key')->nullable();
            $table->timestamps();
        });
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->nullable();
            $table->string('name');
        });

        Route::delete('/testing/brands/destroy-all', [BrandController::class, 'destroyAll']);
    }

    public function test_destroy_all_deletes_all_brands_and_nulls_product_references(): void
    {
        $b1 = Brand::create(['name' => 'NIKE', 'slug' => 'nike']);
        $b2 = Brand::create(['name' => 'ADIDAS', 'slug' => 'adidas']);

        DB::table('products')->insert([
            ['brand_id' => $b1->id, 'name' => 'Air Max'],
            ['brand_id' => $b2->id, 'name' => 'Ultraboost'],
        ]);

        $response = $this->deleteJson('/testing/brands/destroy-all');

        $response->assertOk()
            ->assertJsonPath('deleted_count', 2);

        $this->assertSame(0, Brand::count());
        $this->assertSame(2, DB::table('products')->count());
        $this->assertNull(DB::table('products')->first()->brand_id);
    }
}
