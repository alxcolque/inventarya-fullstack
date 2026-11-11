<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class GeneralNotification extends Notification
{
    use Queueable;

    protected $title;

    protected $message;

    protected $data;

    protected $type;

    public function __construct(string $title, string $message, array $data = [], string $type = 'general')
    {
        $this->id = (string) Str::uuid();
        $this->title = $title;
        $this->message = $message;
        $this->data = $data;
        $this->type = $type;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable)
    {
        return [
            ...$this->data,
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type,
            'severity' => $this->data['severity'] ?? 'info',
            'action_url' => $this->data['action_url'] ?? null,
            'campaign_id' => $this->data['campaign_id'] ?? null,
            'data' => $this->data,
        ];
    }

    public function toBroadcast($notifiable)
    {
        return new BroadcastMessage([
            ...$this->data,
            'id' => $this->id,
            'title' => $this->title,
            'message' => $this->message,
            'type' => $this->type,
            'severity' => $this->data['severity'] ?? 'info',
            'action_url' => $this->data['action_url'] ?? null,
            'data' => $this->data,
            'created_at' => now()->toDateTimeString(),
        ]);
    }
}
