<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceTokenController extends Controller
{
    /**
     * Registrar o actualizar el token FCM del dispositivo para el usuario autenticado.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token'       => ['required', 'string', 'max:512'],
            'platform'    => ['nullable', 'string', 'in:android,ios,web'],
            'app_version' => ['nullable', 'string', 'max:50'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $device = DeviceToken::updateOrCreate(
            [
                'token' => $validated['token'],
            ],
            [
                'user_id'      => $user->id,
                'platform'     => $validated['platform'] ?? 'android',
                'app_version'  => $validated['app_version'] ?? null,
                'last_used_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Dispositivo registrado correctamente para notificaciones Push.',
            'device'  => [
                'id'          => $device->id,
                'platform'    => $device->platform,
                'app_version' => $device->app_version,
            ],
        ], 200);
    }

    /**
     * Eliminar el token FCM del dispositivo actual al cerrar sesión.
     * Solo permite eliminar tokens asociados al usuario autenticado.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $deleted = DeviceToken::where('token', $validated['token'])
            ->where('user_id', $user->id)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => $deleted ? 'Dispositivo desregistrado correctamente.' : 'El dispositivo ya no estaba registrado.',
        ], 200);
    }
}
