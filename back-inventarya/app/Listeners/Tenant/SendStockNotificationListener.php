<?php

namespace App\Listeners\Tenant;

use App\Events\Tenant\StockOutEvent;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class SendStockNotificationListener implements ShouldQueue
{
    use InteractsWithQueue;

    public function __construct(
        private readonly NotificationRecipientResolver $resolver,
        private readonly NotificationService $notificationService,
    ) {}

    /**
     * Handle the event.
     */
    public function handle(object $event): void
    {
        $data = $event->data;
        $productId = $data['product_id'] ?? null;
        $storeId = $data['store_id'] ?? null;
        $isStockOut = $event instanceof StockOutEvent;

        if (! $productId) {
            return;
        }

        $type = $isStockOut ? 'stock_out' : 'stock_low';
        $recipients = $this->resolver->tenantInventoryRecipients($storeId);

        if ($recipients->isEmpty()) {
            return;
        }

        $this->notificationService->sendToRecipients(
            $recipients,
            $data['title'] ?? ($isStockOut ? 'Producto agotado' : 'Stock bajo'),
            $data['message'] ?? 'El inventario alcanzó un nivel crítico.',
            [
                ...$data,
                'severity' => $isStockOut ? 'critical' : 'warning',
                'action_url' => $data['action_url'] ?? '/inventories',
                'resource' => 'product',
                'resource_id' => (string) $productId,
            ],
            $type,
        );
    }
}
