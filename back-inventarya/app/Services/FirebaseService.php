<?php

namespace App\Services;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Exception\Messaging\NotFound;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\AndroidConfig;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;

class FirebaseService
{
    protected ?Messaging $messaging = null;

    protected bool $isConfigured = false;

    public function __construct()
    {
        $credentialsPath = config('firebase.credentials');

        // Si es una ruta relativa que comienza con storage/, resolver con storage_path
        if ($credentialsPath && ! str_starts_with($credentialsPath, '/') && ! preg_match('#^[A-Za-z]:#', $credentialsPath)) {
            $credentialsPath = base_path($credentialsPath);
        }

        if (! empty($credentialsPath) && file_exists($credentialsPath)) {
            try {
                $factory = (new Factory)
                    ->withServiceAccount($credentialsPath);

                $projectId = config('firebase.project_id');
                if (! empty($projectId)) {
                    $factory = $factory->withProjectId($projectId);
                }

                $this->messaging = $factory->createMessaging();
                $this->isConfigured = true;
            } catch (\Throwable $e) {
                Log::error('FirebaseService: Error al inicializar Firebase Admin SDK.', [
                    'exception' => $e::class,
                ]);
                $this->messaging = null;
                $this->isConfigured = false;
            }
        } else {
            Log::info('FirebaseService: Credenciales de Firebase no disponibles.');
        }
    }

    /**
     * Comprueba si Firebase está configurado con credenciales válidas.
     */
    public function isConfigured(): bool
    {
        return $this->isConfigured && $this->messaging !== null;
    }

    /**
     * Enviar mensaje Push a un token individual.
     *
     * @param  string  $token  Token de registro FCM
     * @param  string  $title  Título de la notificación
     * @param  string  $body  Mensaje/cuerpo de la notificación
     * @param  array  $data  Datos adicionales (clave/valor)
     * @param  string  $channelId  Canal de notificación de Android (ej: 'general', 'inventory', 'sales')
     *
     * @throws \Throwable
     */
    public function send(
        string $token,
        string $title,
        string $body,
        array $data = [],
        string $channelId = 'general'
    ): bool {
        if (! $this->isConfigured()) {
            Log::warning('FirebaseService: No se puede enviar Push a token porque Firebase no está configurado.');

            throw new \RuntimeException('PUSH_FIREBASE_NOT_CONFIGURED');
        }

        // FCM exige que todos los valores del array data sean strings
        $stringData = collect($data)
            ->map(function ($value) {
                if (is_bool($value)) {
                    return $value ? '1' : '0';
                }
                if (is_array($value) || is_object($value)) {
                    return json_encode($value);
                }

                return (string) $value;
            })
            ->toArray();

        // Configuración específica de Android
        $androidConfig = AndroidConfig::fromArray([
            'priority' => 'high',
            'notification' => [
                'channel_id' => $channelId,
                'sound' => 'default',
                'click_action' => 'FCM_PLUGIN_ACTIVITY',
            ],
        ]);

        $message = CloudMessage::withTarget('token', $token)
            ->withNotification(Notification::create($title, $body))
            ->withData($stringData)
            ->withAndroidConfig($androidConfig);

        try {
            $this->messaging->send($message);
            Log::info('FirebaseService: Push enviado correctamente.', [
                'notification_id' => $stringData['notification_id'] ?? null,
                'type' => $stringData['type'] ?? 'general',
                'channel' => 'fcm',
            ]);

            return true;
        } catch (NotFound $e) {
            if ($e->token() === $token) {
                Log::warning('FirebaseService: Token no registrado en FCM; se elimina del tenant actual.');
                DeviceToken::where('token', $token)->delete();

                return false;
            }

            throw new \RuntimeException('PUSH_FCM_SEND_FAILED: '.$e::class);
        } catch (\Throwable $e) {
            // Payload/configuration failures must not delete a valid device.
            // Do not chain the original exception: its message/request may contain the token.
            Log::error('FirebaseService: Error al enviar Push.', ['exception' => $e::class]);
            throw new \RuntimeException('PUSH_FCM_SEND_FAILED: '.$e::class);
        }
    }
}
