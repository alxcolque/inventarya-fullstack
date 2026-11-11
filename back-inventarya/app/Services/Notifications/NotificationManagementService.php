<?php

namespace App\Services\Notifications;

use App\Models\Notification as NotificationModel;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationManagementService
{
    public function __construct(
        private readonly NotificationRecipientResolver $recipientResolver,
        private readonly NotificationService $notificationService,
    ) {}

    public function paginate(array $filters): LengthAwarePaginator
    {
        $perPage = min(50, max(5, (int) ($filters['per_page'] ?? 15)));

        return NotificationModel::query()
            ->with('notifiable:id,name,email,role')
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $term = '%'.strtolower(trim($search)).'%';
                $query->where(function ($nested) use ($term) {
                    $nested->whereRaw('LOWER(CAST(data AS TEXT)) LIKE ?', [$term])
                        ->orWhereHasMorph('notifiable', [User::class], function ($userQuery) use ($term) {
                            $userQuery->whereRaw('LOWER(name) LIKE ?', [$term])
                                ->orWhereRaw('LOWER(email) LIKE ?', [$term]);
                        });
                });
            })
            ->when($filters['type'] ?? null, fn ($query, string $type) => $query->where('data->type', $type))
            ->when($filters['severity'] ?? null, fn ($query, string $severity) => $query->where('data->severity', $severity))
            ->when(($filters['status'] ?? null) === 'read', fn ($query) => $query->whereNotNull('read_at'))
            ->when(($filters['status'] ?? null) === 'unread', fn ($query) => $query->whereNull('read_at'))
            ->when($filters['user_id'] ?? null, fn ($query, $userId) => $query->where('notifiable_id', $userId))
            ->latest()
            ->paginate($perPage);
    }

    public function create(array $data, User $sender): array
    {
        $recipients = $this->recipientResolver->manualTenantRecipients(
            $data['audience'],
            $data['user_ids'] ?? [],
            $data['recipient_roles'] ?? [],
        );

        if ($recipients->isEmpty()) {
            return ['sent_count' => 0, 'campaign_id' => null];
        }

        $campaignId = (string) Str::uuid();
        $metadata = [
            'severity' => $data['severity'],
            'action_url' => $data['action_url'] ?? null,
            'campaign_id' => $campaignId,
            'audience' => $data['audience'],
            'created_by' => [
                'id' => $sender->id,
                'name' => $sender->name,
            ],
        ];

        $sentCount = $this->notificationService->sendToRecipients(
            $recipients,
            $data['title'],
            $data['message'],
            $metadata,
            $data['type'],
        );

        return [
            'sent_count' => $sentCount,
            'campaign_id' => $campaignId,
        ];
    }

    public function update(NotificationModel $notification, array $data): NotificationModel
    {
        return DB::transaction(function () use ($notification, $data) {
            $payload = $notification->data ?? [];
            $nestedData = is_array($payload['data'] ?? null) ? $payload['data'] : [];

            foreach (['title', 'message', 'type', 'severity', 'action_url'] as $field) {
                if (array_key_exists($field, $data)) {
                    $payload[$field] = $data[$field];

                    if (in_array($field, ['severity', 'action_url'], true)) {
                        $nestedData[$field] = $data[$field];
                    }
                }
            }

            $payload['data'] = $nestedData;
            $notification->update(['data' => $payload]);

            return $notification->fresh('notifiable');
        });
    }

    public function delete(NotificationModel $notification): void
    {
        $notification->delete();
    }

    public function stats(): array
    {
        $base = NotificationModel::query();

        return [
            'total' => (clone $base)->count(),
            'unread' => (clone $base)->whereNull('read_at')->count(),
            'read' => (clone $base)->whereNotNull('read_at')->count(),
            'sent_today' => (clone $base)->whereDate('created_at', today())->count(),
        ];
    }
}
