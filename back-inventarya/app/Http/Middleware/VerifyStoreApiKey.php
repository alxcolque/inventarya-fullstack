<?php

namespace App\Http\Middleware;

use App\Models\Store;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class VerifyStoreApiKey
{
    /**
     * Valida encabezados X-API-KEY y X-API-SECRET para el consumo seguro de la API externa de productos por tienda.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->header('X-API-KEY') ?? $request->header('x-api-key');
        $apiSecret = $request->header('X-API-SECRET') ?? $request->header('x-api-secret');

        // Validar presencia de ambas cabeceras
        if (empty($apiKey) || empty($apiSecret)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Credenciales de autenticación faltantes. Envíe las cabeceras X-API-KEY y X-API-SECRET.',
            ], 401);
        }

        // Buscar tienda por api_key pública
        $store = Store::where('api_key', $apiKey)->first();

        if (!$store) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Credenciales de API inválidas.',
            ], 401);
        }

        // Regla 3: Control del interruptor api_status. Si es false => 403 Forbidden
        if (!$store->api_status) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Acceso denegado. La API externa de esta tienda se encuentra deshabilitada.',
            ], 403);
        }

        // Reglas 1 y 2: Verificar el api_secret contra el HASH almacenado
        if (empty($store->api_secret) || !Hash::check($apiSecret, $store->api_secret)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Credenciales de API inválidas.',
            ], 401);
        }

        // Adjuntar la tienda autorizada al request
        $request->attributes->set('authorized_store', $store);

        return $next($request);
    }
}
