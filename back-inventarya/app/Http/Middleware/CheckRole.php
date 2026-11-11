<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     * Supports both role strings ('owner-admin-staff') and ability checks ('stores:view').
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $rolesOrAbilities): Response
    {
        $items = explode('-', $rolesOrAbilities);
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        $hasAccess = false;
        foreach ($items as $item) {
            // Check capability via Gate / can()
            if ($user->can($item)) {
                $hasAccess = true;
                break;
            }

            // Fallback check for exact role name
            if (isset($user->role) && strtolower($user->role) === strtolower($item)) {
                $hasAccess = true;
                break;
            }
        }

        if (!$hasAccess) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        return $next($request);
    }
}
