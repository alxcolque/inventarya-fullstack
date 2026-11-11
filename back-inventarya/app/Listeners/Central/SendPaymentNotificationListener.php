<?php

namespace App\Listeners\Central;

use App\Events\Central\PaymentReceivedEvent;
use App\Notifications\Central\PaymentReceivedNotification;
use App\Services\Notifications\NotificationRecipientResolver;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Notification;

class SendPaymentNotificationListener implements ShouldQueue
{
    use InteractsWithQueue;

    protected NotificationRecipientResolver $resolver;

    public function __construct(NotificationRecipientResolver $resolver)
    {
        $this->resolver = $resolver;
    }

    public function handle(PaymentReceivedEvent $event): void
    {
        $admins = $this->resolver->centralAdmins();

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send($admins, new PaymentReceivedNotification($event->data));
    }
}
