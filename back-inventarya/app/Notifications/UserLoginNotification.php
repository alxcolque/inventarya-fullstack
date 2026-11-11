<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use App\Models\User;

class UserLoginNotification extends Notification
{
    use Queueable;

    protected $user;
    protected $loginData;

    public function __construct(User $user, array $loginData = [])
    {
        $this->user = $user;
        $this->loginData = $loginData;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            'title' => 'Nuevo inicio de sesión',
            'message' => "El usuario {$this->user->name} ha iniciado sesión",
            'user_id' => $this->user->id,
            'user_name' => $this->user->name,
            'user_email' => $this->user->email,
            'login_time' => now()->toDateTimeString(),
            'ip_address' => $this->loginData['ip_address'] ?? null,
            'user_agent' => $this->loginData['user_agent'] ?? null,
            'type' => 'user_login'
        ];
    }

    public function toBroadcast($notifiable)
    {
        return new BroadcastMessage([
            'id' => $this->id,
            'title' => 'Nuevo inicio de sesión',
            'message' => "El usuario {$this->user->name} ha iniciado sesión",
            'user_id' => $this->user->id,
            'user_name' => $this->user->name,
            'user_email' => $this->user->email,
            'login_time' => now()->toDateTimeString(),
            'ip_address' => $this->loginData['ip_address'] ?? null,
            'user_agent' => $this->loginData['user_agent'] ?? null,
            'type' => 'user_login',
            'created_at' => now()->toDateTimeString()
        ]);
    }
}
