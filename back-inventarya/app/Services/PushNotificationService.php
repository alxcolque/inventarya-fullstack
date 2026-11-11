<?php

namespace App\Services;

use App\Jobs\SendPushNotificationJob;
use App\Models\User;

class PushNotificationService
{
    /**
     * Envía una notificación Push asíncrona a todos los dispositivos registrados del usuario.
     *
     * @param  array  $data  Metadatos (type, resource, resource_id, route, etc.)
     * @param  string  $channelId  Canal Android (general, inventory, sales, transfers, important)
     * @return int Cantidad de trabajos Push encolados
     */
    public function sendToUser(
        User $user,
        string $title,
        string $body,
        array $data = [],
        string $channelId = 'general'
    ): int {
        $tokens = $user->relationLoaded('deviceTokens')
            ? $user->getRelation('deviceTokens')->pluck('token')
            : $user->deviceTokens()->pluck('token');

        if ($tokens->isEmpty()) {
            return 0;
        }

        $tenantId = function_exists('tenant') && tenant('id') ? (string) tenant('id') : null;
        $count = 0;

        foreach ($tokens as $token) {
            SendPushNotificationJob::dispatch(
                $token,
                $title,
                $body,
                $data,
                $channelId,
                $tenantId
            )->afterCommit();
            $count++;
        }

        return $count;
    }

    /**
     * Envía notificaciones Push a una lista o colección de usuarios.
     *
     * @return int Total de notificaciones Push encoladas
     */
    public function sendToUsers(
        iterable $users,
        string $title,
        string $body,
        array $data = [],
        string $channelId = 'general'
    ): int {
        $total = 0;

        foreach ($users as $user) {
            if ($user instanceof User) {
                $total += $this->sendToUser($user, $title, $body, $data, $channelId);
            }
        }

        return $total;
    }

    /**
     * Envía notificación Push a todos los administradores y propietarios del tenant.
     */
    public function sendToAdmins(
        string $title,
        string $body,
        array $data = [],
        string $channelId = 'important'
    ): int {
        $admins = User::whereIn('role', ['owner', 'admin'])->get();

        return $this->sendToUsers($admins, $title, $body, $data, $channelId);
    }
}
