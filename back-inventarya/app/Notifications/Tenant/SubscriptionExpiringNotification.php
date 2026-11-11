<?php

namespace App\Notifications\Tenant;

use App\Support\TenantFrontendUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class SubscriptionExpiringNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public array $payload;

    public function __construct(array $payload)
    {
        $this->id = (string) Str::uuid();
        $this->payload = $payload;
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        if (! empty($notifiable->email)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $daysLeft = $this->payload['days_left'] ?? 0;
        $planName = $this->payload['plan_name'] ?? 'Plan Actual';
        $renewalUrl = $this->payload['action_url'] ?? '/settings';
        $type = $this->payload['type'] ?? 'subscription_expiring';
        $isTrial = str_starts_with($type, 'trial_');
        $isExpired = str_ends_with($type, '_expired');

        return (new MailMessage)
            ->subject($isExpired
                ? ($isTrial ? 'Tu periodo de prueba ha terminado' : 'Tu suscripción ha vencido')
                : ($isTrial ? "Tu prueba termina en {$daysLeft} días" : "Tu suscripción vence en {$daysLeft} días"))
            ->greeting("Estimado(a) {$notifiable->name},")
            ->line($this->payload['message'] ?? "Tu plan {$planName} requiere atención.")
            ->action($isTrial ? 'Seleccionar un plan' : 'Renovar plan', TenantFrontendUrl::to($renewalUrl))
            ->line('Gracias por confiar en Inventarya.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            ...$this->payload,
            'title' => $this->payload['title'] ?? 'Suscripción por vencer',
            'message' => $this->payload['message'] ?? 'Su plan de suscripción vencerá próximamente.',
            'type' => $this->payload['type'] ?? 'subscription_expiring',
            'severity' => $this->payload['severity'] ?? 'warning',
            'action_url' => $this->payload['action_url'] ?? '/settings',
            'days_left' => $this->payload['days_left'] ?? 0,
            'plan_name' => $this->payload['plan_name'] ?? '',
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => $this->id,
            'title' => $this->payload['title'] ?? 'Suscripción por vencer',
            'message' => $this->payload['message'] ?? 'Su plan de suscripción vencerá próximamente.',
            'type' => $this->payload['type'] ?? 'subscription_expiring',
            'severity' => $this->payload['severity'] ?? 'warning',
            'action_url' => $this->payload['action_url'] ?? '/settings',
            'data' => $this->toArray($notifiable),
            'created_at' => now()->toIso8601String(),
        ]);
    }
}
