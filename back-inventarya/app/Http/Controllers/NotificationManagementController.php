<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreManagedNotificationRequest;
use App\Http\Requests\UpdateManagedNotificationRequest;
use App\Models\Notification;
use App\Models\User;
use App\Services\Notifications\NotificationManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationManagementController extends Controller
{
    public function __construct(
        private readonly NotificationManagementService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->service->paginate($request->only([
            'search', 'type', 'severity', 'status', 'user_id', 'per_page',
        ]));

        return response()->json([
            'data' => collect($paginator->items())->map(
                fn (Notification $notification) => $this->format($notification)
            ),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(StoreManagedNotificationRequest $request): JsonResponse
    {
        $result = $this->service->create($request->validated(), $request->user());

        if ($result['sent_count'] === 0) {
            return response()->json([
                'message' => 'No se encontraron destinatarios válidos.',
            ], 422);
        }

        return response()->json([
            'message' => 'Notificación enviada a '.$result['sent_count'].' destinatario(s).',
            'recipients_count' => $result['sent_count'],
            'data' => $result,
        ], 201);
    }

    public function show(Notification $notification): JsonResponse
    {
        $notification->load('notifiable');

        return response()->json(['data' => $this->format($notification)]);
    }

    public function update(
        UpdateManagedNotificationRequest $request,
        Notification $notification
    ): JsonResponse {
        $updated = $this->service->update($notification, $request->validated());

        return response()->json([
            'message' => 'Notificación actualizada correctamente.',
            'data' => $this->format($updated),
        ]);
    }

    public function destroy(Notification $notification): JsonResponse
    {
        $this->service->delete($notification);

        return response()->json(['message' => 'Notificación eliminada correctamente.']);
    }

    public function recipients(): JsonResponse
    {
        $users = User::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role']);

        return response()->json(['data' => $users]);
    }

    public function stats(): JsonResponse
    {
        return response()->json(['data' => $this->service->stats()]);
    }

    private function format(Notification $notification): array
    {
        $payload = $notification->data ?? [];
        $metadata = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $recipient = $notification->notifiable;

        return [
            'id' => (string) $notification->id,
            'title' => $payload['title'] ?? 'Notificación',
            'message' => $payload['message'] ?? '',
            'type' => $payload['type'] ?? 'general',
            'severity' => $payload['severity'] ?? $metadata['severity'] ?? 'info',
            'action_url' => $payload['action_url'] ?? $metadata['action_url'] ?? null,
            'campaign_id' => $payload['campaign_id'] ?? $metadata['campaign_id'] ?? null,
            'recipient' => $recipient ? [
                'id' => $recipient->id,
                'name' => $recipient->name,
                'email' => $recipient->email,
                'role' => $recipient->role,
            ] : null,
            'read_at' => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at?->toIso8601String(),
            'updated_at' => $notification->updated_at?->toIso8601String(),
        ];
    }
}
