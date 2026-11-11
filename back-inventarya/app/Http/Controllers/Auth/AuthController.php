<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AuthLoginRequest;
use App\Models\CentralUser;
use App\Models\Tenant;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    protected $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    public function login(AuthLoginRequest $request)
    {
        $credentials = $request->validated();

        // Header/query tenant selection is retained only for local/testing.
        // In production the middleware resolves an exact authorized domain.
        if (! tenant() && app()->environment('local', 'testing')) {
            $tenantHeader = $request->header('X-Tenant')
                ?? $request->header('X-Tenant-Domain')
                ?? $request->query('tenant');
            if ($tenantHeader && is_string($tenantHeader)) {
                $t = Tenant::find($tenantHeader) ?? Tenant::where('slug', $tenantHeader)->first();
                if (! $t) {
                    $domain = \App\Models\Domain::where('domain', $tenantHeader)->first();
                    if ($domain) {
                        $t = $domain->tenant;
                    }
                }
                if ($t) {
                    tenancy()->initialize($t);
                }
            }
        }

        if (tenant()) {
            $user = User::where('email', $credentials['email'])->first();

            if (! $user || empty($user->password) || ! Hash::check($credentials['password'], $user->password)) {
                return response()->json([
                    'message' => 'Correo o contraseña inválidos',
                ], 422);
            }

            if ($user->status !== 'active') {
                return response()->json([
                    'code' => 'ACCOUNT_INACTIVE',
                    'message' => 'Tu cuenta está inactiva. Contacta al administrador de la tienda.',
                ], 403);
            }

            $token = $user->createToken('token')->plainTextToken;
        } else {
            $user = CentralUser::where('email', $credentials['email'])->first();

            if (! $user || ! Hash::check($credentials['password'], $user->password)) {
                return response()->json([
                    'message' => 'Correo o contraseña inválidos',
                ], 422);
            }

            if ($user->status !== 'active') {
                return response()->json([
                    'code' => 'ACCOUNT_INACTIVE',
                    'message' => 'Tu cuenta de Central no está activa. Contacta a un superadministrador.',
                ], 403);
            }

            $user->forceFill(['last_login_at' => now()])->save();

            $token = $user->createToken('token')->plainTextToken;
        }

        return response()->json([
            'user' => $this->authenticatedUserPayload($user),
            'token' => $token,
        ]);
    }

    public function checkAuthToken(Request $request)
    {

        try {
            $user = $request->user();

            return response()->json([
                'user' => $this->authenticatedUserPayload($user),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'No autorizado.',
            ]);
        }

    }

    public function logout(Request $request)
    {
        // Stateless logout (Sanctum)
        if ($request->user()) {
            $request->user()->currentAccessToken()->delete();
        }

        return response()->json([
            'message' => 'Sesión cerrada exitosamente.',
        ]);
    }

    public function createToken(Request $request)
    {

        $token = PersonalAccessToken::create([
            'id' => $request->id,
            'tokenable_type' => User::class,
            'tokenable_id' => $request->tokenable_id,
            'name' => $request->name,
            'token' => $request->token,
            'abilities' => ['*'],
            'last_used_at' => now(),
        ]);

        return $token;
    }

    public function deleteToken($id)
    {

        $token = PersonalAccessToken::find($id);
        if ($token) {
            $token->delete();

            return response()->json(['message' => 'Token eliminado exitosamente.'], 200);
        }

        return response()->json(['message' => 'Token no encontrado.'], 404);
    }

    private function authenticatedUserPayload($user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username ?? null,
            'avatar' => $user->avatar,
            'email' => $user->email,
            'role' => $user->role,
            'tenant_id' => tenant() ? (string) tenant('id') : null,
        ];
    }
}
