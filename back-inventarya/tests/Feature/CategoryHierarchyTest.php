<?php

namespace Tests\Feature;

use App\Http\Controllers\CategoryController;
use App\Models\Category;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CategoryHierarchyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'database.connections.category_testing' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true],
            'database.default' => 'category_testing',
        ]);
        DB::purge('category_testing');
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('color')->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('categories');
            $table->timestamps();
        });
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('categories');
            $table->string('name');
            $table->integer('stock');
        });
        // Exercise the real controller/request through HTTP, without production tenancy or databases.
        Route::delete('/testing/categories/destroy-all', [CategoryController::class, 'destroyAll']);
        Route::apiResource('/testing/categories', CategoryController::class);
    }

    private function category(string $name, ?int $parent = null): Category
    {
        return Category::create(['name' => $name, 'slug' => strtolower($name), 'parent_id' => $parent]);
    }

    public function test_root_becomes_child_without_changing_other_columns_or_products(): void
    {
        $parent = $this->category('Aguas');
        $category = $this->category('Chocolate');
        DB::table('products')->insert(['category_id' => $category->id, 'name' => 'Producto', 'stock' => 17]);
        $before = $category->fresh()->getAttributes();
        $products = DB::table('products')->get()->toJson();
        $this->patchJson('/testing/categories/'.$category->id, ['parent_id' => $parent->id])
            ->assertOk()->assertJsonPath('category.parent_id', $parent->id)->assertJsonPath('category.product_count', 1);
        $this->assertSame(array_replace($before, ['parent_id' => $parent->id]), $category->fresh()->getAttributes());
        $this->assertSame($products, DB::table('products')->get()->toJson());
        $this->assertNull($parent->fresh()->parent_id);
    }

    public function test_child_becomes_root_and_sibling_does_not_change(): void
    {
        $parent = $this->category('Aguas');
        $child = $this->category('Mineral', $parent->id);
        $sibling = $this->category('Natural', $parent->id);
        $this->patchJson('/testing/categories/'.$child->id, ['parent_id' => null])
            ->assertOk()->assertJsonPath('category.parent_id', null);
        $this->assertSame($parent->id, $sibling->fresh()->parent_id);
    }

    public function test_child_can_move_to_another_root(): void
    {
        $a = $this->category('Aguas');
        $b = $this->category('Bebidas');
        $child = $this->category('Mineral', $a->id);
        $this->patchJson('/testing/categories/'.$child->id, ['parent_id' => $b->id])
            ->assertOk()->assertJsonPath('category.parent_name', 'Bebidas');
    }

    public function test_self_parent_is_rejected(): void
    {
        $a = $this->category('Aguas');
        $this->patchJson('/testing/categories/'.$a->id, ['parent_id' => $a->id])->assertUnprocessable()->assertJsonValidationErrors('parent_id');
    }

    public function test_subcategory_can_be_a_parent_and_multi_level_is_allowed(): void
    {
        $a = $this->category('Aguas');
        $b = $this->category('Mineral', $a->id);
        $c = $this->category('Con Gas');
        $this->patchJson('/testing/categories/'.$c->id, ['parent_id' => $b->id])
            ->assertOk()->assertJsonPath('category.parent_id', $b->id);
        $this->assertSame($b->id, $c->fresh()->parent_id);
    }

    public function test_circular_reference_is_rejected(): void
    {
        $a = $this->category('Aguas');
        $b = $this->category('Mineral', $a->id);
        $c = $this->category('Con Gas', $b->id);
        // Trying to move $a into its descendant $c or $b must be rejected
        $this->patchJson('/testing/categories/'.$a->id, ['parent_id' => $c->id])
            ->assertUnprocessable()->assertJsonValidationErrors('parent_id');
        $this->patchJson('/testing/categories/'.$a->id, ['parent_id' => $b->id])
            ->assertUnprocessable()->assertJsonValidationErrors('parent_id');
    }

    public function test_root_with_children_can_become_child_of_another_category(): void
    {
        $a = $this->category('Aguas');
        $child = $this->category('Mineral', $a->id);
        $b = $this->category('Bebidas');
        $this->patchJson('/testing/categories/'.$a->id, ['parent_id' => $b->id])
            ->assertOk()->assertJsonPath('category.parent_id', $b->id);
        $this->assertSame($b->id, $a->fresh()->parent_id);
        $this->assertSame($a->id, $child->fresh()->parent_id);
    }

    public function test_unknown_parent_and_invalid_type_are_rejected(): void
    {
        $a = $this->category('Aguas');
        foreach ([999, 'invalid'] as $parent) {
            $this->patchJson('/testing/categories/'.$a->id, ['parent_id' => $parent])
                ->assertUnprocessable()->assertJsonValidationErrors('parent_id');
        }
        $this->patchJson('/testing/categories/999', ['parent_id' => null])->assertNotFound();
    }

    public function test_unchanged_parent_is_a_noop(): void
    {
        $a = $this->category('Aguas');
        $before = $a->fresh()->getAttributes();
        $this->patchJson('/testing/categories/'.$a->id, ['parent_id' => null])->assertOk();
        $this->assertSame($before, $a->fresh()->getAttributes());
    }

    public function test_create_under_subcategory_is_allowed(): void
    {
        $a = $this->category('Aguas');
        $b = $this->category('Mineral', $a->id);
        $this->postJson('/testing/categories', ['name' => 'Gas', 'parent_id' => $b->id])
            ->assertCreated()->assertJsonPath('category.parent_id', $b->id);
        $this->assertSame(3, Category::count());
    }

    public function test_destroy_all_removes_categories_and_nulls_products(): void
    {
        $a = $this->category('Aguas');
        $b = $this->category('Mineral', $a->id);
        \Illuminate\Support\Facades\DB::table('products')->insert([
            ['category_id' => $a->id, 'name' => 'Prod 1', 'stock' => 5],
            ['category_id' => $b->id, 'name' => 'Prod 2', 'stock' => 10],
        ]);

        $this->deleteJson('/testing/categories/destroy-all')
            ->assertOk()
            ->assertJsonPath('deleted_count', 2);

        $this->assertSame(0, Category::count());
        $this->assertSame(2, \Illuminate\Support\Facades\DB::table('products')->count());
        $this->assertNull(\Illuminate\Support\Facades\DB::table('products')->first()->category_id);
    }

    public function test_creating_category_without_color_assigns_a_random_light_color(): void
    {
        $response = $this->postJson('/testing/categories', ['name' => 'Lácteos']);
        $response->assertCreated();
        $color = $response->json('category.color');
        $this->assertNotNull($color);
        $this->assertContains($color, Category::LIGHT_COLORS);
    }

    public function test_model_creating_hook_always_assigns_light_color_if_empty(): void
    {
        $cat = Category::create(['name' => 'Frutas', 'slug' => 'frutas']);
        $this->assertNotNull($cat->color);
        $this->assertContains($cat->color, Category::LIGHT_COLORS);
    }
}
