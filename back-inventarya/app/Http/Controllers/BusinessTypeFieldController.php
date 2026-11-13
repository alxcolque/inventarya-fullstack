<?php

namespace App\Http\Controllers;

use App\Http\Requests\BusinessTypeFieldRequest;
use App\Models\BusinessType;
use App\Models\BusinessTypeField;
use App\Services\BusinessTypeFieldService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessTypeFieldController extends Controller
{
    public function __construct(private readonly BusinessTypeFieldService $service) {}

    public function index(Request $request, int $businessType): JsonResponse
    {
        if ($request->user()?->cannot('business-types:view')) {
            return response()->json(['error' => 'No autorizado para ver campos'], 403);
        }

        $type = BusinessType::find($businessType);
        if (! $type) {
            return response()->json(['message' => 'Tipo de negocio no encontrado'], 404);
        }

        return response()->json([
            'is_locked' => $this->service->isLocked($type),
            'fields' => $type->fields()->get(),
        ]);
    }

    public function store(BusinessTypeFieldRequest $request, int $businessType): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para crear campos'], 403);
        }

        $type = BusinessType::find($businessType);
        if (! $type) {
            return response()->json(['message' => 'Tipo de negocio no encontrado'], 404);
        }

        return response()->json([
            'message' => 'Campo creado correctamente',
            'field' => $this->service->create($type, $request->validated()),
        ], 201);
    }

    public function update(BusinessTypeFieldRequest $request, int $businessType, int $field): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para actualizar campos'], 403);
        }

        [$type, $model] = $this->resolve($businessType, $field);
        if (! $type || ! $model) {
            return response()->json(['message' => 'Campo no encontrado'], 404);
        }

        return response()->json([
            'message' => 'Campo actualizado correctamente',
            'field' => $this->service->update($type, $model, $request->validated()),
        ]);
    }

    public function toggleStatus(Request $request, int $businessType, int $field): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para modificar el estado'], 403);
        }

        [, $model] = $this->resolve($businessType, $field);
        if (! $model) {
            return response()->json(['message' => 'Campo no encontrado'], 404);
        }

        $model = $this->service->toggleStatus($model);

        return response()->json([
            'message' => 'Campo '.($model->is_active ? 'activado' : 'desactivado').' correctamente',
            'field' => $model,
        ]);
    }

    public function destroy(Request $request, int $businessType, int $field): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para eliminar campos'], 403);
        }

        [$type, $model] = $this->resolve($businessType, $field);
        if (! $type || ! $model) {
            return response()->json(['message' => 'Campo no encontrado'], 404);
        }

        $this->service->delete($type, $model);

        return response()->json(['message' => 'Campo eliminado correctamente']);
    }

    public function reorder(Request $request, int $businessType): JsonResponse
    {
        if ($request->user()?->cannot('business-types:manage')) {
            return response()->json(['error' => 'No autorizado para ordenar campos'], 403);
        }

        $type = BusinessType::find($businessType);
        if (! $type) {
            return response()->json(['message' => 'Tipo de negocio no encontrado'], 404);
        }

        $data = $request->validate([
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['integer', 'distinct'],
        ]);

        $this->service->reorder($type, $data['order']);

        return response()->json([
            'message' => 'Orden actualizado correctamente',
            'fields' => $type->fields()->get(),
        ]);
    }

    /**
     * @return array{0: BusinessType|null, 1: BusinessTypeField|null}
     */
    private function resolve(int $businessType, int $field): array
    {
        $type = BusinessType::find($businessType);

        return [$type, $type?->fields()->whereKey($field)->first()];
    }
}

