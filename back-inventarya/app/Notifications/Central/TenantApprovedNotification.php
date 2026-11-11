<?php

namespace App\Notifications\Central;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TenantApprovedNotification extends Notification implements ShouldQueue
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
        $ownerName = trim((string) ($this->payload['owner_name'] ?? ''));
        $ownerName = $ownerName !== '' ? $ownerName : 'Cliente';
        $businessName = $this->payload['business_name'] ?? 'Su Empresa';
        $domain = $this->payload['domain'] ?? '';
        $loginUrl = $this->payload['login_url'] ?? "https://{$domain}/login";

        return (new MailMessage)
            ->subject("¡Bienvenido a Inventarya! Su tienda ha sido activada")
            ->greeting("¡Felicidades, {$ownerName}!")
            ->line("Su cuenta para el negocio **{$businessName}** ha sido aprobada y activada con éxito.")
            ->line("Puede ingresar a su panel de administración a través de su dominio exclusivo:")
            ->action('Ingresar a mi Tienda', $loginUrl)
            ->line('Si tiene alguna duda o requiere asistencia técnica, nuestro equipo de soporte está a su entera disposición.');
    }
}
