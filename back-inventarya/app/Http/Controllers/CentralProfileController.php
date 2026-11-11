<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateCentralPasswordRequest;
use App\Http\Requests\UpdateCentralProfileRequest;
use App\Models\CentralUser;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CentralProfileController extends Controller
{
    private const AVATAR_FOLDER = 'central/users';

    public function show(Request $request): JsonResponse
    {
        /** @var CentralUser $user */
        $user = $request->user();

        return response()->json([
            'profile' => $this->profileData($user),
        ]);
    }

    public function update(UpdateCentralProfileRequest $request): JsonResponse
    {
        /** @var CentralUser $user */
        $user = $request->user();
        $data = $request->safe()->only(['name', 'email']);
        $oldAvatar = $user->getRawOriginal('avatar');
        $newAvatarPath = null;

        if ($request->has('avatar')) {
            $avatar = $request->input('avatar');

            if ($avatar === null || $avatar === 'delete') {
                $data['avatar'] = null;
            } elseif ($avatar !== $oldAvatar) {
                try {
                    $upload = FileStorageService::upload($avatar, self::AVATAR_FOLDER);
                    $data['avatar'] = $upload['path'];
                    $newAvatarPath = $upload['path'];
                } catch (\Throwable) {
                    throw ValidationException::withMessages([
                        'avatar' => 'No se pudo procesar el avatar. Intenta con otra imagen.',
                    ]);
                }
            }
        }

        try {
            $user->fill($data)->save();
        } catch (\Throwable $exception) {
            if ($newAvatarPath) {
                FileStorageService::delete($newAvatarPath);
            }

            throw $exception;
        }

        if ($oldAvatar && array_key_exists('avatar', $data) && $oldAvatar !== $data['avatar']) {
            FileStorageService::delete($oldAvatar);
        }

        return response()->json([
            'message' => 'Perfil actualizado correctamente.',
            'profile' => $this->profileData($user->fresh()),
        ]);
    }

    public function updatePassword(UpdateCentralPasswordRequest $request): JsonResponse
    {
        /** @var CentralUser $user */
        $user = $request->user();

        if (! Hash::check($request->string('current_password')->toString(), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'La contraseña actual no es correcta.',
            ]);
        }

        $user->password = $request->string('password')->toString();
        $user->save();

        $currentToken = $user->currentAccessToken();
        $tokens = $user->tokens();

        if ($currentToken) {
            $tokens->where('id', '<>', $currentToken->getKey());
        }

        $tokens->delete();

        return response()->json([
            'message' => 'Contraseña actualizada. Las demás sesiones fueron cerradas.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function profileData(CentralUser $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'status' => $user->status,
            'avatar' => $user->avatar,
            'last_login_at' => $user->last_login_at,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}
