<?php

namespace App\Notifications\Tenant;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class SaleCreatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public array $payload;

    public function __construct(array $payload)
    {
        $this->payload = $payload;
    }

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title'       => $this->payload['title'] ?? 'Nueva venta realizada',
            'message'     => $this->payload['message'] ?? 'Se ha completado una venta en el punto de venta.',
            'type'        => 'sale_created',
            'severity'    => 'success',
            'action_url'  => $this->payload['action_url'] ?? '/sales',
            'sale_id'     => $this->payload['sale_id'] ?? null,
            'total'       => $this->payload['total'] ?? 0,
            'store_name'  => $this->payload['store_name'] ?? '',
            'seller_name' => $this->payload['seller_name'] ?? '',
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id'         => $this->id,
            'title'      => $this->payload['title'] ?? 'Nueva venta realizada',
            'message'    => $this->payload['message'] ?? 'Se ha completado una venta en el punto de venta.',
            'type'       => 'sale_created',
            'severity'   => 'success',
            'action_url' => $this->payload['action_url'] ?? '/sales',
            'data'       => $this->toArray($notifiable),
            'created_at' => now()->toIso8601String(),
        ]);
    }
}
