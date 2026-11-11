<?php

namespace App\Http\Controllers;

use App\Models\CentralUser;
use App\Http\Requests\CentralUserRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class CentralUserController extends Controller
{
    public function index(Request $request)
    {
        if ($request->user()?->cannot('central-users:manage')) {
            return response()->json(['error' => 'No autorizado para ver administradores centrales'], 403);
        }

        return response()->json(CentralUser::all());
    }

    public function store(CentralUserRequest $request)
    {
        if ($request->user()?->cannot('central-users:manage')) {
            return response()->json(['error' => 'No autorizado para crear administradores centrales'], 403);
        }

        $data = $request->validated();
        $data['password'] = Hash::make($data['password']);
        
        $user = CentralUser::create($data);
        return response()->json(['message' => 'Usuario central creado', 'user' => $user], 201);
    }

    public function show(Request $request, $id)
    {
        if ($request->user()?->cannot('central-users:manage')) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $user = CentralUser::find($id);
        if (!$user) return response()->json(['message' => 'Usuario no encontrado'], 404);
        return response()->json($user);
    }

    public function update(CentralUserRequest $request, $id)
    {
        if ($request->user()?->cannot('central-users:manage')) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $user = CentralUser::find($id);
        if (!$user) return response()->json(['message' => 'Usuario no encontrado'], 404);
        
        $data = $request->validated();
        if (isset($data['password']) && !empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);
        return response()->json(['message' => 'Usuario actualizado', 'user' => $user], 200);
    }

    public function destroy(Request $request, $id)
    {
        if ($request->user()?->cannot('central-users:manage')) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $user = CentralUser::find($id);
        if (!$user) return response()->json(['message' => 'Usuario no encontrado'], 404);
        
        // Evitar que un superadmin se borre a sí mismo
        if ($request->user()?->id == $id) {
            return response()->json(['message' => 'No puedes eliminar tu propio usuario'], 403);
        }

        $user->delete();
        return response()->json(['message' => 'Usuario eliminado'], 200);
    }
}
