<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\User;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        if ($request->user()?->cannot('assignments:manage')) {
            return response()->json(['error' => 'No autorizado.'], 403);
        }

        $assignments = Assignment::all();
        return response()->json($assignments);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        if ($request->user()?->cannot('assignments:manage')) {
            return response()->json(['error' => 'No autorizado. Solo el propietario puede asignar personal a tiendas.'], 403);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'store_id' => 'required|exists:stores,id',
        ]);

        $user = User::find($request->user_id);
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado: ' . $request->user_id], 404);
        }

        // Only staff users who work via assignments can be assigned
        if ($user->role !== 'staff') {
            return response()->json(['message' => 'Solo los usuarios con rol staff pueden ser asignados a una tienda específica.'], 422);
        }

        // Prevent duplicate assignment to the same store
        $exists = Assignment::where('user_id', $request->user_id)
            ->where('store_id', $request->store_id)
            ->first();

        if ($exists) {
            return response()->json(['message' => 'Este usuario ya se encuentra asignado a esta tienda.'], 422);
        }

        $assignment = Assignment::create($request->all());
        return response()->json([
            'message'    => 'Asignación creada exitosamente',
            'assignment' => $assignment
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Assignment $assignment)
    {
        return response()->json($assignment);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Assignment $assignment)
    {
        if ($request->user()?->cannot('assignments:manage')) {
            return response()->json(['error' => 'No autorizado para modificar asignaciones.'], 403);
        }

        $request->validate([
            'user_id'  => 'required|exists:users,id',
            'store_id' => 'required|exists:stores,id',
        ]);

        $assignment->update($request->all());
        return response()->json($assignment);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, $id)
    {
        if ($request->user()?->cannot('assignments:manage')) {
            return response()->json(['error' => 'No autorizado para eliminar asignaciones.'], 403);
        }

        $assignment = Assignment::find($id);
        if (!$assignment) {
            return response()->json(['message' => 'Asignación no encontrada.'], 404);
        }

        $assignment->delete();
        return response()->json(['message' => 'Asignación eliminada exitosamente']);
    }

    /**
     * Get assignments by store ID
     */
    public function getAssignmentsByStoreId($store_id)
    {
        if (empty($store_id) || $store_id === 'NaN') {
            return response()->json([
                'assignments' => []
            ]);
        }

        $assignmentsQuery = Assignment::where('store_id', $store_id)->get();
        $assignments = $assignmentsQuery->map(function ($assignment) {
            $user = User::find($assignment->user_id);
            return [
                'id'    => $assignment->id,
                'name'  => $user?->name,
                'email' => $user?->email,
                'role'  => $user?->role,
            ];
        });

        return response()->json([
            'assignments' => $assignments
        ]);
    }
}
