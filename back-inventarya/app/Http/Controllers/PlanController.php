<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Http\Requests\PlanRequest;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    /**
     * Display a listing of plans.
     */
    public function index(Request $request)
    {
        if ($request->user()?->cannot('plans:view')) {
            return response()->json(['error' => 'No autorizado para ver planes'], 403);
        }

        $plans = Plan::withCount('tenants')->get();
        return response()->json($plans);
    }

    /**
     * Store a newly created plan.
     */
    public function store(PlanRequest $request)
    {
        if ($request->user()?->cannot('plans:manage')) {
            return response()->json(['error' => 'No autorizado para crear planes'], 403);
        }

        $plan = Plan::create($request->validated());
        return response()->json([
            'message' => 'Plan creado correctamente',
            'plan' => $plan
        ], 201);
    }

    /**
     * Display the specified plan.
     */
    public function show(Request $request, $id)
    {
        if ($request->user()?->cannot('plans:view')) {
            return response()->json(['error' => 'No autorizado para ver este plan'], 403);
        }

        $plan = Plan::withCount('tenants')->find($id);
        if (!$plan) {
            return response()->json(['message' => 'Plan no encontrado'], 404);
        }

        return response()->json($plan);
    }

    /**
     * Update the specified plan.
     */
    public function update(PlanRequest $request, $id)
    {
        if ($request->user()?->cannot('plans:manage')) {
            return response()->json(['error' => 'No autorizado para actualizar planes'], 403);
        }

        $plan = Plan::find($id);
        if (!$plan) {
            return response()->json(['message' => 'Plan no encontrado'], 404);
        }

        $plan->update($request->validated());
        return response()->json([
            'message' => 'Plan actualizado correctamente',
            'plan' => $plan
        ], 200);
    }

    /**
     * Toggle status between active and inactive.
     */
    public function toggleStatus(Request $request, $id)
    {
        if ($request->user()?->cannot('plans:manage')) {
            return response()->json(['error' => 'No autorizado para modificar el estado del plan'], 403);
        }

        $plan = Plan::find($id);
        if (!$plan) {
            return response()->json(['message' => 'Plan no encontrado'], 404);
        }

        $plan->status = ($plan->status === 'active') ? 'inactive' : 'active';
        $plan->save();

        return response()->json([
            'message' => "Plan {$plan->name} " . ($plan->status === 'active' ? 'activado' : 'desactivado') . ' correctamente',
            'plan' => $plan
        ], 200);
    }

    /**
     * Remove the specified plan from storage.
     * Validates that the plan is not being used by tenants or subscriptions.
     */
    public function destroy(Request $request, $id)
    {
        if ($request->user()?->cannot('plans:manage')) {
            return response()->json(['error' => 'No autorizado para eliminar planes'], 403);
        }

        $plan = Plan::find($id);
        if (!$plan) {
            return response()->json(['message' => 'Plan no encontrado'], 404);
        }

        if ($plan->tenants()->count() > 0 || $plan->subscriptions()->count() > 0) {
            return response()->json([
                'message' => 'Este plan está siendo utilizado por uno o más clientes y no puede eliminarse. Puedes desactivarlo en su lugar.'
            ], 422);
        }

        $plan->delete();
        return response()->json([
            'message' => 'Plan eliminado correctamente'
        ], 200);
    }
}
