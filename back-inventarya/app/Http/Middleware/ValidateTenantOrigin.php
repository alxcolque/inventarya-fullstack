<?php

namespace App\Http\Middleware;

use App\Tenancy\TenantOriginAuthorizer;
use Closure;
use Illuminate\Http\Request;

class ValidateTenantOrigin
{
    public function __construct(private readonly TenantOriginAuthorizer $authorizer) {}

    public function handle(Request $request, Closure $next)
    {
        if (app()->environment('local', 'testing') || ! $this->isCorsPath($request)) {
            return $next($request);
        }

        $origin = $request->headers->get('Origin');
        if (! is_string($origin) || $origin === '') {
            return $next($request);
        }

        $authorization = $this->authorizer->authorize($origin);
        if (! $authorization['allowed']) {
            return response()->json([
                'code' => $authorization['code'] ?? 'CORS_ORIGIN_NOT_AUTHORIZED',
                'message' => 'El origen de la solicitud no está autorizado.',
            ], 403);
        }

        // HandleCors reads its configuration after this middleware. Adding only
        // the exact, registry-approved origin lets custom domains receive the
        // correct response headers without granting a wildcard.
        $allowedOrigins = config('cors.allowed_origins', []);
        $allowedOrigins[] = $authorization['origin'];
        config(['cors.allowed_origins' => array_values(array_unique($allowedOrigins))]);

        return $next($request);
    }

    private function isCorsPath(Request $request): bool
    {
        return $request->is('api/*')
            || $request->is('auth/*')
            || $request->is('broadcasting/auth');
    }
}
