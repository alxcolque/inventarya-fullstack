<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\GeneralNotification;
use App\Notifications\UserLoginNotification;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    protected PushNotificationService $pushService;

    public function __construct(PushNotificationService $pushService)
    {
        $this->pushService = $pushService;
    }

    /**
     * Enviar notificación a usuario específico
     */
    public function sendToUser(User $user, string $title, string $message, array $data = [], string $type = 'general')
    {
        $notification = new GeneralNotification($title, $message, $data, $type);

        // La base de datos es la fuente de verdad. Reverb se entrega de forma
        // independiente para que una caída del WebSocket no revierta ni
        // bloquee la operación que originó la notificación.
        $user->notifyNow($notification, ['database']);

        try {
            $user->notifyNow($notification, ['broadcast']);
        } catch (\Throwable $exception) {
            Log::error('No se pudo entregar el canal Reverb de una notificación.', [
                'notification_id' => (string) $notification->id,
                'type' => $type,
                'channel' => 'reverb',
                'user_id' => $user->id,
                'exception' => $exception->getMessage(),
            ]);
        }

        // Disparar Push a los dispositivos móviles del usuario
        $channelId = match ($type) {
            'stock_low', 'out_of_stock', 'stock_out' => 'inventory',
            'sale_created', 'sale_cancelled' => 'sales',
            'transfer_received', 'transfer_rejected', 'transfer_sent' => 'transfers',
            'subscription', 'subscription_expiring', 'subscription_expired',
            'trial_expiring', 'trial_expired', 'payment', 'payment_confirmed',
            'payment_rejected' => 'important',
            default => 'general',
        };
        try {
            $this->pushService->sendToUser($user, $title, $message, array_merge($data, [
                'type' => $type,
                'notification_id' => (string) $notification->id,
            ]), $channelId);
        } catch (\Throwable $exception) {
            Log::error('No se pudo encolar el canal Push de una notificación.', [
                'notification_id' => (string) $notification->id,
                'type' => $type,
                'channel' => 'fcm',
                'user_id' => $user->id,
                'exception' => $exception->getMessage(),
            ]);
        }

        return $notification;
    }

    /**
     * Enviar notificación a múltiples usuarios
     */
    public function sendToUsers(array $userIds, string $title, string $message, array $data = [], string $type = 'general')
    {
        $users = User::query()
            ->whereIn('id', array_values(array_unique($userIds)))
            ->where('status', 'active')
            ->get();

        return $this->sendToRecipients($users, $title, $message, $data, $type);
    }

    /**
     * Send one Laravel notification per already-resolved active tenant user.
     * Keeping the same id for database, Reverb and FCM lets clients de-duplicate it.
     */
    public function sendToRecipients(
        iterable $recipients,
        string $title,
        string $message,
        array $data = [],
        string $type = 'general'
    ): int {
        $sent = 0;

        foreach ($recipients as $user) {
            if (! $user instanceof User || $user->status !== 'active') {
                continue;
            }

            $this->sendToUser($user, $title, $message, $data, $type);
            $sent++;
        }

        return $sent;
    }

    /**
     * Enviar notificación solo a administradores
     */
    public function sendToAdmins(string $title, string $message, array $data = [], string $type = 'admin')
    {
        $admins = User::query()
            ->whereIn('role', ['owner', 'admin'])
            ->where('status', 'active')
            ->get();

        return $this->sendToRecipients($admins, $title, $message, $data, $type);
    }

    /**
     * Enviar notificación a todos los usuarios
     */
    public function sendToAll(string $title, string $message, array $data = [], string $type = 'broadcast')
    {
        $users = User::query()->where('status', 'active')->get();

        return $this->sendToRecipients($users, $title, $message, $data, $type);
    }

    /**
     * Notificar login a administradores
     */
    public function notifyAdminsUserLogin(User $user, array $loginData = [])
    {
        $admins = User::query()
            ->whereIn('role', ['owner', 'admin'])
            ->where('status', 'active')
            ->get();
        foreach ($admins as $admin) {
            $admin->notify(new UserLoginNotification($user, $loginData));
        }

        return $admins->count();
    }

    /**
     * Marcar notificación como leída
     */
    public function markAsRead(User $user, string $notificationId)
    {
        $notification = $user->notifications()->find($notificationId);

        if ($notification) {
            $notification->markAsRead();

            return true;
        }

        return false;
    }

    /**
     * Marcar todas las notificaciones como leídas
     */
    public function markAllAsRead(User $user)
    {
        $user->unreadNotifications->markAsRead();

        return true;
    }

    /**
     * Obtener notificaciones del usuario
     */
    public function getUserNotifications(User $user, int $limit = 50)
    {
        return $user->notifications()
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Obtener notificaciones no leídas del usuario
     */
    public function getUnreadNotifications(User $user)
    {
        return $user->unreadNotifications()
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /* Delete */
    public function destroy(User $user, string $notificationId)
    {
        $notification = $user->notifications()->find($notificationId);

        if ($notification) {
            $notification->delete();

            return true;
        }

        return false;
    }
}
