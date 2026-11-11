<?php

namespace App\Http\Controllers;

use App\Http\Requests\LocationRequest;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LocationController extends Controller
{
    /**
     * Display a listing of locations with hierarchy.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Location::with(['parent:id,name,slug', 'children:id,name,slug,parent_id'])
            ->orderBy('name', 'asc');

        if ($request->boolean('roots_only')) {
            $query->roots();
        }

        $locations = $query->get()->map(function ($loc) {
            $loc->parent_name = $loc->parent?->name;
            return $loc;
        });

        return response()->json($locations);
    }

    /**
     * Store a newly created location.
     */
    public function store(LocationRequest $request): JsonResponse
    {
        $data = $request->validated();

        $existingQuery = Location::where('name', $data['name']);
        if (!empty($data['parent_id'])) {
            $existingQuery->where('parent_id', $data['parent_id']);
        } else {
            $existingQuery->whereNull('parent_id');
        }

        if ($existingQuery->exists()) {
            return response()->json([
                'message' => 'Ya existe una ubicación con este nombre en este mismo nivel.',
            ], 422);
        }

        $data['slug'] = $this->uniqueSlug($data['name']);
        $location = Location::create($data);
        $location->load(['parent:id,name,slug']);

        return response()->json([
            'message' => 'Ubicación creada correctamente',
            'location' => $location,
        ], 201);
    }

    /**
     * Display the specified location.
     */
    public function show(string $id): JsonResponse
    {
        $location = Location::with(['parent', 'children', 'inventoryWarehouses', 'inventoryStores'])->find($id);

        if (!$location) {
            return response()->json(['message' => 'Ubicación no encontrada'], 404);
        }

        $location->parent_name = $location->parent?->name;

        return response()->json($location);
    }

    /**
     * Update the specified location.
     */
    public function update(LocationRequest $request, string $id): JsonResponse
    {
        $location = Location::find($id);
        if (!$location) {
            return response()->json(['message' => 'Ubicación no encontrada'], 404);
        }

        $data = $request->validated();

        if (!empty($data['parent_id'])) {
            if ((int)$data['parent_id'] === (int)$location->id) {
                return response()->json([
                    'message' => 'Una ubicación no puede ser contenedora de sí misma.',
                ], 422);
            }

            if ($this->isDescendant($location, (int)$data['parent_id'])) {
                return response()->json([
                    'message' => 'No puedes seleccionar como ubicación superior a una sub-ubicación hija.',
                ], 422);
            }
        }

        $data['slug'] = $this->uniqueSlug($data['name'], (int)$location->id);
        $location->update($data);
        $location->load(['parent:id,name,slug', 'children']);

        return response()->json([
            'message' => 'Ubicación actualizada correctamente',
            'location' => $location,
        ], 200);
    }

    /**
     * Remove the specified location.
     */
    public function destroy(string $id): JsonResponse
    {
        $location = Location::withCount(['children', 'inventoryWarehouses', 'inventoryStores'])->find($id);
        if (!$location) {
            return response()->json(['message' => 'Ubicación no encontrada'], 404);
        }

        $totalItems = $location->inventory_warehouses_count + $location->inventory_stores_count;
        if ($totalItems > 0) {
            return response()->json([
                'message' => "No se puede eliminar la ubicación porque tiene {$totalItems} registros de inventario asignados.",
            ], 422);
        }

        if ($location->children_count > 0) {
            return response()->json([
                'message' => "No se puede eliminar la ubicación porque contiene {$location->children_count} sub-ubicaciones. Reasigna o elimina sus hijas primero.",
            ], 422);
        }

        $location->delete();

        return response()->json([
            'message' => 'Ubicación eliminada correctamente',
        ], 200);
    }

    /**
     * Generar un slug único para la ubicación.
     */
    protected function uniqueSlug(string $name, ?int $exceptId = null): string
    {
        $baseSlug = Str::slug($name);
        $slug = $baseSlug;
        $counter = 1;

        while (true) {
            $query = Location::where('slug', $slug);
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

    /**
     * Verifica si un ID dado pertenece a los descendientes de la ubicación.
     */
    protected function isDescendant(Location $location, int $targetParentId): bool
    {
        $children = Location::where('parent_id', $location->id)->get();
        foreach ($children as $child) {
            if ((int)$child->id === $targetParentId) {
                return true;
            }
            if ($this->isDescendant($child, $targetParentId)) {
                return true;
            }
        }
        return false;
    }
}
