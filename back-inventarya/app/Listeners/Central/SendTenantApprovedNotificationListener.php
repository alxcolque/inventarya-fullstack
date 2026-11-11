<?php

namespace App\Listeners\Central;

use App\Events\Central\TenantApprovedEvent;
use App\Notifications\Central\TenantApprovedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Notification;

class SendTenantApprovedNotificationListener implements ShouldQueue
{
    use InteractsWithQueue;

    public function handle(TenantApprovedEvent $event): void
    {
        $data = $event->data;
        $ownerEmail = $data['owner_email'] ?? null;

        if (!$ownerEmail) {
            return;
        }

        // Crear objeto anónimo notifiable para enviar correo a la dirección del dueño
        Notification::route('mail', $ownerEmail)
            ->notify(new TenantApprovedNotification($data));
    }
}
