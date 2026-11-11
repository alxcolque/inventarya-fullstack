<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Laravel\Sanctum\PersonalAccessToken;

class ValidateExternalToken
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */

    public function handle($request, Closure $next)
    {
        // Obtener el token del encabezado Authorization
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Token not provided'], 401);
        }

        // Buscar el token en la tabla personal_access_tokens
        $accessToken = PersonalAccessToken::findToken($token);

        if (!$accessToken /*|| !$accessToken->tokenable*/) {
            return response()->json(['message' => 'Token Inválido'], 401);
        }

        // Autenticar al usuario manualmente
        //$request->user = $accessToken->tokenable;

        return $next($request);
    }
}
