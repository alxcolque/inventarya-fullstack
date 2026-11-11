<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\User;
use App\Services\EmployeeInvitationService;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    private const FOLDER_PATH = 'inventory/users';

    public function __construct(
        private readonly EmployeeInvitationService $invitationService,
    ) {}

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        if ($request->user()?->cannot('users:view')) {
            return response()->json(['error' => 'No autorizado para ver usuarios'], 403);
        }

        $query = User::query()->with('latestInvitation:id,user_id,expires_at,accepted_at,revoked_at');

        // Search filter
        if ($request->filled('search')) {
            $search = '%'.strtolower(trim($request->search)).'%';
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(name) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(username) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(phone) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(ci) LIKE ?', [$search]);
            });
        }

        // Role filter
        if ($request->filled('role') && in_array($request->role, ['owner', 'admin', 'staff'])) {
            $query->where('role', $request->role);
        }

        // Status filter
        if ($request->filled('status') && in_array($request->status, ['active', 'inactive', 'pending_activation'])) {
            $query->where('status', $request->status);
        }

        $users = $query->orderBy('id', 'desc')->get();

        return response()->json($users);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(UserRequest $request)
    {
        if ($request->user()?->cannot('users:create')) {
            return response()->json([
                'error' => 'No autorizado para crear usuarios.',
            ], 403);
        }

        $tenant = tenant();
        if ($tenant) {
            $check = app(\App\Services\TenantLimitService::class)->canCreateUser($tenant);
            if (! $check['allowed']) {
                return response()->json([
                    'code' => $check['code'] ?? 'PLAN_LIMIT_REACHED',
                    'message' => $check['message'] ?? 'Has alcanzado el límite de usuarios de tu plan.',
                    'limit' => $check['limit'] ?? null,
                    'current' => $check['current'] ?? null,
                ], 422);
            }
        }

        $data = $request->validated();
        // Handle avatar upload (optional)
        $newAvatarPath = null;
        if (! empty($data['avatar']) && FileStorageService::isNewUpload($data['avatar'])) {
            try {
                $upload = FileStorageService::upload($data['avatar'], self::FOLDER_PATH);
                $newAvatarPath = $upload['path'];
                $data['avatar'] = $newAvatarPath;
                $data['avatar_key'] = $newAvatarPath;
            } catch (\Throwable $exception) {
                return response()->json(['message' => 'No se pudo subir el avatar: '.$exception->getMessage()], 422);
            }
        } elseif (! empty($data['avatar']) && FileStorageService::isManagedReference($data['avatar'])) {
            $data['avatar'] = FileStorageService::normalizePath($data['avatar']);
            $data['avatar_key'] = $data['avatar'];
        } elseif (empty($data['avatar'])) {
            $data['avatar'] = null;
            $data['avatar_key'] = null;
        }

        try {
            $result = $this->invitationService->createEmployee($data, $request->user());
        } catch (\Throwable $exception) {
            if ($newAvatarPath) {
                FileStorageService::delete($newAvatarPath);
            }
            throw $exception;
        }
        $user = $result['user']->load('latestInvitation:id,user_id,expires_at,accepted_at,revoked_at');

        return response()->json([
            'message' => $result['invitation_sent']
                ? 'Usuario creado. Enviamos la invitación a su correo.'
                : 'Usuario creado, pero el correo no pudo enviarse. Puedes reenviar la invitación.',
            'user' => $user,
            'invitation_sent' => $result['invitation_sent'],
            'invitation_expires_at' => $result['invitation']->expires_at->toIso8601String(),
        ], 201);
    }

    public function resendInvitation(Request $request, User $user)
    {
        if ($request->user()?->cannot('users:create')) {
            return response()->json(['error' => 'No autorizado para reenviar invitaciones.'], 403);
        }

        $result = $this->invitationService->resend($user, $request->user());

        return response()->json([
            'message' => $result['invitation_sent']
                ? 'Invitación reenviada correctamente.'
                : 'La invitación fue renovada, pero el correo no pudo enviarse.',
            'invitation_sent' => $result['invitation_sent'],
            'invitation_expires_at' => $result['invitation']->expires_at->toIso8601String(),
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, string $id)
    {
        if ($request->user()?->cannot('users:view')) {
            return response()->json(['error' => 'No autorizado para ver este usuario'], 403);
        }

        $user = User::with('latestInvitation:id,user_id,expires_at,accepted_at,revoked_at')->find($id);
        if (! $user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        return response()->json($user);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UserRequest $request, string $id)
    {
        if ($request->user()?->cannot('users:update')) {
            return response()->json(['error' => 'No autorizado para actualizar usuarios'], 403);
        }

        $data = $request->validated();
        $user = User::find($id);
        if (! $user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        if ($user->status === 'pending_activation' && array_key_exists('status', $data)) {
            return response()->json([
                'message' => 'Una cuenta pendiente sólo puede activarse mediante su enlace de invitación.',
            ], 422);
        }

        if ($user->status === 'pending_activation' && ! empty($data['password'])) {
            return response()->json([
                'message' => 'La contraseña de una cuenta pendiente sólo puede definirla el usuario desde su invitación.',
            ], 422);
        }

        $pendingEmailChanged = $user->status === 'pending_activation'
            && isset($data['email'])
            && $data['email'] !== $user->email;

        $removesActiveOwner = ($data['role'] ?? $user->role) !== 'owner'
            || ($data['status'] ?? $user->status) !== 'active';

        if ($removesActiveOwner && $this->isLastActiveOwner($user)) {
            return response()->json([
                'message' => 'No se puede cambiar el rol o desactivar al único propietario activo de la tienda.',
            ], 422);
        }

        // Non-owner cannot grant owner role
        if (isset($data['role']) && $data['role'] === 'owner' && $request->user()?->role !== 'owner') {
            return response()->json([
                'error' => 'Solo un propietario puede asignar el rol de propietario.',
            ], 403);
        }

        // Password update
        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        // Avatar update or deletion
        $oldAvatarPath = $user->avatar_key ?: $user->getRawOriginal('avatar');
        $newAvatarPath = null;
        $replaceAvatar = false;

        if (array_key_exists('avatar', $data)) {
            $avatarInput = $data['avatar'];
            unset($data['avatar']);

            if (empty($avatarInput) || $avatarInput === 'delete' || $avatarInput === 'null') {
                $data['avatar'] = null;
                $data['avatar_key'] = null;
                $replaceAvatar = true;
            } elseif (FileStorageService::isNewUpload($avatarInput)) {
                try {
                    $upload = FileStorageService::upload($avatarInput, self::FOLDER_PATH);
                    $newAvatarPath = $upload['path'];
                    $data['avatar'] = $newAvatarPath;
                    $data['avatar_key'] = $newAvatarPath;
                    $replaceAvatar = true;
                } catch (\Throwable $exception) {
                    return response()->json(['message' => 'No se pudo subir el avatar: '.$exception->getMessage()], 422);
                }
            } elseif (FileStorageService::isManagedReference($avatarInput)
                && ! FileStorageService::referencesMatch($avatarInput, $oldAvatarPath)) {
                $data['avatar'] = FileStorageService::normalizePath($avatarInput);
                $data['avatar_key'] = $data['avatar'];
                $replaceAvatar = true;
            } elseif (filter_var($avatarInput, FILTER_VALIDATE_URL) && $avatarInput !== $user->avatar) {
                $data['avatar'] = $avatarInput;
                $data['avatar_key'] = null;
                $replaceAvatar = true;
            }
        }
        try {
            $user->update($data);
        } catch (\Throwable $exception) {
            if ($newAvatarPath) {
                FileStorageService::delete($newAvatarPath);
            }
            throw $exception;
        }

        if ($replaceAvatar && $oldAvatarPath && ! FileStorageService::referencesMatch($oldAvatarPath, $newAvatarPath)) {
            FileStorageService::delete($oldAvatarPath);
        }

        $invitationResult = null;
        if ($pendingEmailChanged) {
            $invitationResult = $this->invitationService->resend($user->fresh(), $request->user());
        }

        if (($data['status'] ?? null) === 'inactive') {
            $user->tokens()->delete();
        }

        return response()->json([
            'message' => $invitationResult
                ? ($invitationResult['invitation_sent']
                    ? 'Usuario actualizado y nueva invitación enviada al correo corregido.'
                    : 'Usuario actualizado, pero no se pudo enviar la nueva invitación. Intenta reenviarla.')
                : 'Usuario actualizado correctamente',
            'user' => $user->fresh()->load('latestInvitation:id,user_id,expires_at,accepted_at,revoked_at'),
            'invitation_sent' => $invitationResult['invitation_sent'] ?? null,
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, string $id)
    {
        if ($request->user()?->cannot('users:delete')) {
            return response()->json([
                'error' => 'No autorizado. Solo el propietario puede eliminar usuarios.',
            ], 403);
        }

        $user = User::find($id);
        if (! $user) {
            return response()->json(['message' => 'El usuario no existe'], 404);
        }

        // Cannot delete self
        if ($request->user()?->id == $user->id) {
            return response()->json(['message' => 'No puedes eliminar tu propia cuenta de usuario'], 400);
        }

        // Cannot delete last user
        if (User::count() <= 1) {
            return response()->json(['message' => 'No se puede eliminar el último usuario de la tienda'], 400);
        }

        // Cannot delete last owner
        if ($this->isLastActiveOwner($user)) {
            return response()->json(['message' => 'No se puede eliminar al único propietario activo de la tienda'], 422);
        }

        try {
            if ($user->avatar_key || $user->avatar) {
                FileStorageService::delete($user->getRawOriginal('avatar'), $user->avatar_key);
            }
            $user->delete();

            return response()->json(['message' => 'Usuario eliminado correctamente']);
        } catch (\Exception $e) {
            report($e);

            return response()->json(['message' => 'No se pudo eliminar el usuario.'], 500);
        }
    }

    /**
     * Quick role and status update.
     */
    public function updateRole(Request $request, string $id)
    {
        if ($request->user()?->cannot('users:manage-roles') && $request->user()?->cannot('users:update')) {
            return response()->json([
                'error' => 'No autorizado para cambiar roles o estado de usuarios.',
            ], 403);
        }

        $user = User::find($id);
        if (! $user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        if ($request->filled('role')) {
            if (! in_array($request->role, ['owner', 'admin', 'staff'])) {
                return response()->json(['message' => 'Rol inválido'], 422);
            }
            if ($request->role === 'owner' && $request->user()?->role !== 'owner') {
                return response()->json(['message' => 'Solo un propietario puede asignar el rol de propietario'], 403);
            }
            if ($request->role !== 'owner' && $this->isLastActiveOwner($user)) {
                return response()->json(['message' => 'No se puede cambiar el rol del único propietario activo'], 422);
            }
            $user->role = $request->role;
        }

        if ($request->filled('status')) {
            if ($user->status === 'pending_activation') {
                return response()->json([
                    'message' => 'Una cuenta pendiente sólo puede activarse mediante su enlace de invitación.',
                ], 422);
            }

            if (! in_array($request->status, ['active', 'inactive'])) {
                return response()->json(['message' => 'Estado inválido'], 422);
            }
            if ($request->status === 'inactive' && $this->isLastActiveOwner($user)) {
                return response()->json(['message' => 'No se puede desactivar al único propietario activo'], 422);
            }
            $user->status = $request->status;

            if ($request->status === 'inactive') {
                $user->tokens()->delete();
            }
        }

        $user->save();

        return response()->json([
            'message' => 'Usuario actualizado correctamente',
            'user' => $user->fresh(),
        ], 200);
    }

    private function isLastActiveOwner(User $user): bool
    {
        if ($user->role !== 'owner' || $user->status !== 'active') {
            return false;
        }

        return ! User::query()
            ->where('role', 'owner')
            ->where('status', 'active')
            ->where($user->getKeyName(), '!=', $user->getKey())
            ->exists();
    }
}
