<?php

namespace App\Notifications\Central;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PaymentReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public array $payload;

    public function __construct(array $payload)
    {
        $this->payload = $payload;
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tenantName = $this->payload['tenant_name'] ?? 'Inquilino';
        $amount = number_format($this->payload['amount'] ?? 0, 2);
        $currency = $this->payload['currency'] ?? 'BOB';
        $planName = $this->payload['plan_name'] ?? 'Plan';

        return (new MailMessage)
            ->subject("Nuevo Pago Registrado: {$tenantName} - {$currency} {$amount}")
            ->greeting("Hola, {$notifiable->name}")
            ->line("Se ha recibido un nuevo pago de suscripción para el negocio **{$tenantName}**.")
            ->line("Plan: **{$planName}**")
            ->line("Monto registrado: **{$currency} {$amount}**")
            ->action('Ver Pagos en Panel Central', url('/payments'))
            ->line('Verifique la acreditación en la cuenta bancaria si el método requiere validación manual.');
    }
}
