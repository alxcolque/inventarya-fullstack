<?php

namespace App\Http\Controllers;

use App\Http\Requests\SendNotificationRequest;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Formatear notificación para entrega consistente a React.
     */
    protected function formatNotification($notification): array
    {
        $data = is_array($notification->data) ? $notification->data : (json_decode($notification->data, true) ?? []);

        return [
            'id' => (string) $notification->id,
            'type' => $data['type'] ?? 'general',
            'title' => $data['title'] ?? 'Notificación',
            'message' => $data['message'] ?? '',
            'severity' => $data['severity'] ?? 'info',
            'action_url' => $data['action_url'] ?? null,
            'data' => $data,
            'read_at' => $notification->read_at ? $notification->read_at->toIso8601String() : null,
            'created_at' => $notification->created_at ? $notification->created_at->toIso8601String() : now()->toIso8601String(),
        ];
    }

    /**
     * Listar notificaciones del usuario autenticado (paginado o lista completa).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $perPage = min(50, max(5, (int) $request->get('per_page', 25)));
        $paginator = $user->notifications()
            ->latest()
            ->paginate($perPage);

        $formatted = collect($paginator->items())->map(function ($item) {
            return $this->formatNotification($item);
        });

        return response()->json([
            'success' => true,
            'data' => $formatted,
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'unread_count' => $user->unreadNotifications()->count(),
            ],
            // Compatibilidad retroactiva con implementaciones previas
            'notifications' => $formatted,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    /**
     * Listar únicamente las notificaciones no leídas del usuario autenticado.
     */
    public function unread(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $notifications = $user->unreadNotifications()
            ->latest()
            ->limit(50)
            ->get();

        $formatted = $notifications->map(fn ($item) => $this->formatNotification($item));

        return response()->json([
            'success' => true,
            'data' => $formatted,
            'count' => $formatted->count(),
            'meta' => [
                'unread_count' => $formatted->count(),
            ],
            // Compatibilidad
            'notifications' => $formatted,
        ]);
    }

    /**
     * Marcar notificación específica como leída (validando que pertenezca al usuario autenticado).
     */
    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $notification = $user->notifications()->where('id', $id)->first();

        if (! $notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notificación no encontrada o no pertenece al usuario autenticado.',
            ], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Notificación marcada como leída.',
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    /**
     * Marcar todas las notificaciones del usuario como leídas.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $user->unreadNotifications->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Todas las notificaciones han sido marcadas como leídas.',
            'unread_count' => 0,
        ]);
    }

    /**
     * Eliminar una notificación del usuario autenticado.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $notification = $user->notifications()->where('id', $id)->first();

        if (! $notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notificación no encontrada.',
            ], 404);
        }

        $notification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Notificación eliminada correctamente.',
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    /**
     * Enviar notificación manual a un usuario específico (solo administradores).
     */
    public function sendToUser(SendNotificationRequest $request): JsonResponse
    {
        $user = User::query()
            ->where('status', 'active')
            ->find($request->user_id);

        if (! $user) {
            return response()->json([
                'message' => 'No se encontraron destinatarios válidos.',
            ], 422);
        }

        $this->notificationService->sendToUser(
            $user,
            $request->title,
            $request->message,
            $request->data ?? [],
            $request->type ?? 'general'
        );

        return response()->json([
            'success' => true,
            'message' => 'Notificación enviada correctamente.',
            'recipients_count' => 1,
        ]);
    }

    /**
     * Enviar notificación manual a múltiples usuarios.
     */
    public function sendToUsers(SendNotificationRequest $request): JsonResponse
    {
        $count = $this->notificationService->sendToUsers(
            $request->user_ids,
            $request->title,
            $request->message,
            $request->data ?? [],
            $request->type ?? 'general'
        );

        if ($count === 0) {
            return response()->json([
                'message' => 'No se encontraron destinatarios válidos.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Notificaciones enviadas correctamente.',
            'recipients_count' => $count,
        ]);
    }

    /**
     * Enviar notificación a administradores.
     */
    public function sendToAdmins(SendNotificationRequest $request): JsonResponse
    {
        $count = $this->notificationService->sendToAdmins(
            $request->title,
            $request->message,
            $request->data ?? [],
            $request->type ?? 'admin'
        );

        if ($count === 0) {
            return response()->json(['message' => 'No se encontraron destinatarios válidos.'], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Notificación enviada a los administradores.',
            'recipients_count' => $count,
        ]);
    }

    /**
     * Enviar notificación a todos los usuarios.
     */
    public function sendToAll(SendNotificationRequest $request): JsonResponse
    {
        $count = $this->notificationService->sendToAll(
            $request->title,
            $request->message,
            $request->data ?? [],
            $request->type ?? 'broadcast'
        );

        if ($count === 0) {
            return response()->json(['message' => 'No se encontraron destinatarios válidos.'], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Notificación transmitida a todos los usuarios.',
            'recipients_count' => $count,
        ]);
    }

    /**
     * Obtener el conteo rápido de notificaciones no leídas.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = $user ? $user->unreadNotifications()->count() : 0;

        return response()->json([
            'success' => true,
            'unread_count' => $count,
        ]);
    }

    /**
     * Endpoint protegido de prueba de envío Push FCM al usuario autenticado.
     */
    public function testPush(Request $request, \App\Services\PushNotificationService $pushService): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $title = $request->input('title', 'Prueba Inventarya');
        $body = $request->input('body', 'Las notificaciones Push funcionan correctamente.');
        $data = $request->input('data', [
            'type' => 'test',
            'notification_id' => (string) \Illuminate\Support\Str::uuid(),
            'resource' => 'system',
            'resource_id' => '0',
            'route' => '/notifications',
        ]);

        $enqueued = $pushService->sendToUser($user, $title, $body, $data, 'general');

        return response()->json([
            'success' => true,
            'message' => "Se encolaron {$enqueued} notificación(es) Push para tus dispositivos.",
            'devices_count' => $enqueued,
        ]);
    }
}
