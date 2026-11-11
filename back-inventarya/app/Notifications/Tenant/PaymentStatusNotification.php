<?php

namespace App\Notifications\Tenant;

use App\Support\TenantFrontendUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class PaymentStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly array $payload)
    {
        $this->id = (string) Str::uuid();
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->payload['title'])
            ->greeting("Hola, {$notifiable->name}")
            ->line($this->payload['message'])
            ->action('Ver suscripción', TenantFrontendUrl::to($this->payload['action_url'] ?? '/settings'))
            ->line('Gracias por confiar en Inventarya.');
    }

    public function toArray(object $notifiable): array
    {
        return $this->payload;
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => $this->id,
            ...$this->payload,
            'data' => $this->payload,
            'created_at' => now()->toIso8601String(),
        ]);
    }
}
