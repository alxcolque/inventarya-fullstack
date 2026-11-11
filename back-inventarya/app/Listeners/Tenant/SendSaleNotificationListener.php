<?php

namespace App\Listeners\Tenant;

use App\Events\Tenant\SaleCompletedEvent;
use App\Notifications\Tenant\SaleCreatedNotification;
use App\Services\Notifications\NotificationRecipientResolver;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Notification;

class SendSaleNotificationListener implements ShouldQueue
{
    use InteractsWithQueue;

    protected NotificationRecipientResolver $resolver;

    public function __construct(NotificationRecipientResolver $resolver)
    {
        $this->resolver = $resolver;
    }

    public function handle(SaleCompletedEvent $event): void
    {
        $data = $event->data;
        $storeId = $data['store_id'] ?? null;

        // Dueños y administradores son notificados de la venta
        $recipients = $this->resolver->tenantSaleRecipients($storeId);

        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, new SaleCreatedNotification($data));
    }
}
