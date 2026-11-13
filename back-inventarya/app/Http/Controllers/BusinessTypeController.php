<?php

namespace App\Http\Controllers;

use App\Http\Requests\BusinessTypeRequest;
use App\Services\BusinessTypeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessTypeController extends Controller
{
    public function __construct(private readonly BusinessTypeService $service) {}

    /**
     * Paginated listing with field / tenant counters.
     */
    public function index(Request $request): JsonResponse
    {
        if ($request->user()?->cannot('business-types:view')) {
            return response()->json(['error' => 'No autorizado para ver tipos de negocio'], 403);
        }

        $paginator = $this->service->paginate(
            $request->query('search'),
            (int) $request->query('per_page', 15),
        );

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    /**
     * Active types only (selector of the tenant forms).
     */
    public function options(Request $request): JsonResponse
    {
        if ($request->user()?->cannot('business-types:view')) {
            return response()->json(['error' => 'No autorizado para ver tipos de negocio'], 403);
        }

        return response()->json($this->service->activeOptions());
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if ($request->user()?->cannot('business-types:view')) {
            return response()->json(['error' => 'No autorizado para ver tipos de negocio'], 403);
        }

        $type = $this->service->find($id);
        if (! $type) {
            return response()->json(['message' => 'Tipo de negocio no encontrado'], 404);
        }

        return response()->json($type);
    }

    public function store(BusinessTypeRequest $request): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para crear tipos de negocio'], 403);
        }

        $type = $this->service->create($request->validated());

        return response()->json([
            'message' => 'Tipo de negocio creado correctamente',
            'business_type' => $type,
        ], 201);
    }

    public function update(BusinessTypeRequest $request, int $id): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para actualizar tipos de negocio'], 403);
        }

        $type = $this->service->find($id);
        if (! $type) {
            return response()->json(['message' => 'Tipo de negocio no encontrado'], 404);
        }

        return response()->json([
            'message' => 'Tipo de negocio actualizado correctamente',
            'business_type' => $this->service->update($type, $request->validated()),
        ]);
    }

    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para modificar el estado'], 403);
        }

        $type = $this->service->find($id);
        if (! $type) {
            return response()->json(['message' => 'Tipo de negocio no encontrado'], 404);
        }

        $type = $this->service->toggleStatus($type);

        return response()->json([
            'message' => "Tipo de negocio {$type->name} ".($type->is_active ? 'activado' : 'desactivado').' correctamente',
            'business_type' => $type,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para eliminar tipos de negocio'], 403);
        }

        $type = $this->service->find($id);
        if (! $type) {
            return response()->json(['message' => 'Tipo de negocio no encontrado'], 404);
        }

        $this->service->delete($type);

        return response()->json(['message' => 'Tipo de negocio eliminado correctamente']);
    }
}

