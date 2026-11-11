<?php

namespace App\Http\Controllers;

use App\Http\Requests\CategoryRequest;
use App\Models\Category;
use App\Services\CategoryHierarchyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    /**
     * Paleta curada de colores para asignación interna.
     */
    public const LIGHT_COLORS = [
        '#38BDF8', '#34D399', '#FBBF24', '#FB923C',
        '#FB7185', '#C084FC', '#A78BFA', '#818CF8',
        '#2DD4BF', '#F472B6', '#A3E635', '#22D3EE',
        '#E879F9', '#F87171', '#4ADE80', '#60A5FA',
    ];

    /**
     * Obtener un color aleatorio de la paleta interna.
     */
    public static function randomLightColor(): string
    {
        return self::LIGHT_COLORS[array_rand(self::LIGHT_COLORS)];
    }

    /**
     * Display a listing of categories with hierarchy and product counts.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Category::with(['parent:id,name,slug', 'children:id,name,slug,parent_id'])
            ->withCount('products')
            ->orderBy('name', 'asc');

        if ($request->boolean('roots_only')) {
            $query->roots();
        }

        $categories = $query->get()->map(function ($category) {
            $category->parent_name = $category->parent?->name;
            $category->product_count = $category->products_count;
            return $category;
        });

        return response()->json($categories);
    }

    /**
     * Store a newly created category.
     */
    public function store(CategoryRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Asignar un color de manera aleatoria si el usuario no especificó uno
        if (empty($data['color'])) {
            $data['color'] = self::randomLightColor();
        }

        // Evitar categorías con nombre duplicado en el mismo nivel
        $existingQuery = Category::where('name', $data['name']);
        if (!empty($data['parent_id'])) {
            $existingQuery->where('parent_id', $data['parent_id']);
        } else {
            $existingQuery->whereNull('parent_id');
        }

        if ($existingQuery->exists()) {
            return response()->json([
                'message' => 'Ya existe una categoría con este nombre en este mismo nivel jerárquico.',
            ], 422);
        }

        $data['slug'] = $this->uniqueSlug($data['name']);
        $category = app(CategoryHierarchyService::class)->save($data);
        $category->load(['parent:id,name,slug']);

        return response()->json([
            'message' => 'Categoría creada correctamente',
            'category' => $category,
        ], 201);
    }

    /**
     * Display the specified category with hierarchy.
     */
    public function show(string $id): JsonResponse
    {
        $category = Category::with(['parent', 'children', 'products'])->withCount('products')->find($id);

        if (!$category) {
            return response()->json(['message' => 'Categoría no encontrada'], 404);
        }

        $category->product_count = $category->products_count;
        $category->parent_name = $category->parent?->name;

        return response()->json($category);
    }

    /**
     * Update the specified category.
     */
    public function update(CategoryRequest $request, string $id): JsonResponse
    {
        $category = Category::find($id);
        if (!$category) {
            return response()->json(['message' => 'Categoría no encontrada'], 404);
        }

        $data = $request->validated();

        if (array_key_exists('name', $data)) {
            $data['slug'] = $this->uniqueSlug($data['name'], (int) $category->id);
        }
        $category = app(CategoryHierarchyService::class)->save($data, (int) $category->id);
        $category->load(['parent:id,name,slug', 'children:id,name,slug,parent_id']);
        $category->loadCount('products');
        $category->parent_name = $category->parent?->name;
        $category->product_count = $category->products_count;

        return response()->json([
            'message' => $request->isMethod('PATCH') && array_keys($data) === ['parent_id']
                ? 'Jerarquía de categoría actualizada correctamente.'
                : 'Categoría actualizada correctamente',
            'category' => $category,
        ], 200);
    }

    /**
     * Remove the specified category.
     */
    public function destroy(string $id): JsonResponse
    {
        $category = Category::withCount(['products', 'children'])->find($id);
        if (!$category) {
            return response()->json(['message' => 'Categoría no encontrada'], 404);
        }

        if ($category->products_count > 0) {
            return response()->json([
                'message' => "No se puede eliminar la categoría porque tiene {$category->products_count} productos asociados.",
            ], 422);
        }

        if ($category->children_count > 0) {
            return response()->json([
                'message' => "No se puede eliminar la categoría porque tiene {$category->children_count} subcategorías asociadas. Reasigna o elimina sus hijas primero.",
            ], 422);
        }

        $category->delete();

        return response()->json([
            'message' => 'Categoría eliminada correctamente',
        ], 200);
    }

    /**
     * Remove all categories from storage.
     */
    public function destroyAll(): JsonResponse
    {
        $connection = (new Category)->getConnection();
        return $connection->transaction(function () use ($connection) {
            // Desvincular productos asociados poniendo category_id en null
            $connection->table('products')->whereNotNull('category_id')->update(['category_id' => null]);
            // Desvincular jerarquías parent_id para evitar conflictos de clave foránea
            $connection->table('categories')->whereNotNull('parent_id')->update(['parent_id' => null]);
            $deletedCount = $connection->table('categories')->delete();

            return response()->json([
                'message' => "Se eliminaron {$deletedCount} categorías correctamente",
                'deleted_count' => $deletedCount,
            ], 200);
        });
    }

    /**
     * Generar un slug único para la categoría.
     */
    protected function uniqueSlug(string $name, ?int $exceptId = null): string
    {
        $baseSlug = Str::slug($name);
        $slug = $baseSlug;
        $counter = 1;

        while (true) {
            $query = Category::where('slug', $slug);
            if ($exceptId !== null) {
                $query->where('id', '!=', $exceptId);
            }

            if (!$query->exists()) {
                break;
            }

            $counter++;
            $slug = "{$baseSlug}-{$counter}";
        }

        return $slug;
    }

}
