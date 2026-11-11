<?php

namespace App\Jobs;

use App\Services\FirebaseService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Número máximo de intentos antes de fallar.
     */
    public int $tries = 3;

    /**
     * Segundos de espera entre reintentos progresivos (backoff exponencial).
     */
    public array $backoff = [5, 30, 60];

    /**
     * @param  string  $token  Token de registro FCM
     * @param  string  $title  Título de la notificación
     * @param  string  $body  Mensaje
     * @param  array  $data  Metadatos adicionales
     * @param  string  $channelId  Canal de notificación Android
     * @param  string|null  $tenantId  Identificador del tenant para inicializar la conexión tenant en el worker
     */
    public function __construct(
        public string $token,
        public string $title,
        public string $body,
        public array $data = [],
        public string $channelId = 'general',
        public ?string $tenantId = null
    ) {
        if ($this->tenantId === null && function_exists('tenant') && tenant('id')) {
            $this->tenantId = (string) tenant('id');
        }
    }

    /**
     * Ejecuta el trabajo de envío de notificación Push.
     */
    public function handle(FirebaseService $firebase): void
    {
        // Si se especificó tenant y estamos en un worker de colas, inicializar el tenant correspondiente
        if ($this->tenantId && function_exists('tenancy') && (! tenant('id') || tenant('id') !== $this->tenantId)) {
            tenancy()->initialize($this->tenantId);
        }

        try {
            $firebase->send(
                $this->token,
                $this->title,
                $this->body,
                $this->tenantId ? array_merge($this->data, ['tenant_id' => $this->tenantId]) : $this->data,
                $this->channelId
            );
        } catch (\Throwable $e) {
            Log::warning('Falló un intento de envío Push.', [
                'notification_id' => $this->data['notification_id'] ?? null,
                'type' => $this->data['type'] ?? 'general',
                'channel' => 'fcm',
                'attempt' => $this->attempts(),
                'exception' => $e::class,
            ]);

            // Si es el último intento, registrar el fallo final
            if ($this->attempts() >= $this->tries) {
                Log::error('Se agotaron los reintentos de una notificación Push.', [
                    'notification_id' => $this->data['notification_id'] ?? null,
                    'type' => $this->data['type'] ?? 'general',
                    'channel' => 'fcm',
                ]);
            }

            throw $e;
        }
    }
}
