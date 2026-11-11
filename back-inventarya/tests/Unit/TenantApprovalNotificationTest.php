<?php

namespace Tests\Unit;

use App\Events\Central\TenantApprovedEvent;
use App\Listeners\Central\SendTenantApprovedNotificationListener;
use App\Models\Domain;
use App\Models\Tenant;
use App\Notifications\Central\TenantApprovedNotification;
use App\Services\TenantService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class TenantApprovalNotificationTest extends TestCase
{
    private function payload(): array
    {
        return [
            'tenant_id' => 'farmacia',
            'owner_name' => 'Ana Pérez',
            'owner_email' => 'ana@example.com',
            'business_name' => 'Farmacia Ana',
            'domain' => 'farmacia.inventarya.com',
            'login_url' => 'https://farmacia.inventarya.com/login',
        ];
    }

    public function test_approval_event_contains_real_owner_and_login_data(): void
    {
        Event::fake([TenantApprovedEvent::class]);
        config(['invitations.tenant_frontend_url' => 'https://{tenant}.inventarya.com']);

        $tenant = new Tenant([
            'id' => 'farmacia',
            'slug' => 'farmacia',
            'name' => 'Farmacia Ana',
            'owner_name' => 'Ana Pérez',
            'owner_email' => 'ana@example.com',
        ]);
        $tenant->setRelation('domains', collect([
            new Domain([
                'domain' => 'farmacia.inventarya.com',
                'type' => 'subdomain',
                'is_primary' => true,
            ]),
        ]));

        app(TenantService::class)->dispatchTenantApproved($tenant);

        Event::assertDispatched(TenantApprovedEvent::class, function (TenantApprovedEvent $event): bool {
            return $event->data === $this->payload();
        });
    }

    public function test_event_uses_safe_owner_name_when_tenant_name_is_blank(): void
    {
        Event::fake([TenantApprovedEvent::class]);
        config(['invitations.tenant_frontend_url' => 'https://{tenant}.inventarya.com']);

        $tenant = new Tenant([
            'id' => 'farmacia',
            'slug' => 'farmacia',
            'name' => 'Farmacia Ana',
            'owner_name' => '',
            'owner_email' => 'ana@example.com',
        ]);
        $tenant->setRelation('domains', collect([
            new Domain([
                'domain' => 'farmacia.inventarya.com',
                'type' => 'subdomain',
                'is_primary' => true,
            ]),
        ]));

        app(TenantService::class)->dispatchTenantApproved($tenant);

        Event::assertDispatched(TenantApprovedEvent::class, function (TenantApprovedEvent $event): bool {
            return $event->data['owner_name'] === 'Cliente';
        });
    }

    public function test_approval_event_queues_existing_listener(): void
    {
        Queue::fake();

        event(new TenantApprovedEvent($this->payload()));

        $this->assertInstanceOf(ShouldQueue::class, new SendTenantApprovedNotificationListener);
        Queue::assertPushed(CallQueuedListener::class, function (CallQueuedListener $job): bool {
            return $job->class === SendTenantApprovedNotificationListener::class
                && $job->data[0] instanceof TenantApprovedEvent;
        });
    }

    public function test_listener_routes_mail_to_owner_email(): void
    {
        Notification::fake();

        (new SendTenantApprovedNotificationListener)->handle(new TenantApprovedEvent($this->payload()));

        Notification::assertSentOnDemand(
            TenantApprovedNotification::class,
            function (TenantApprovedNotification $notification, array $channels, AnonymousNotifiable $notifiable): bool {
                return $channels === ['mail']
                    && $notifiable->routeNotificationFor('mail') === 'ana@example.com'
                    && $notification->payload['owner_name'] === 'Ana Pérez';
            }
        );
    }

    public function test_listener_queues_notification_for_anonymous_owner(): void
    {
        Queue::fake();

        (new SendTenantApprovedNotificationListener)->handle(new TenantApprovedEvent($this->payload()));

        $this->assertInstanceOf(ShouldQueue::class, new TenantApprovedNotification($this->payload()));
        Queue::assertPushed(SendQueuedNotifications::class, function (SendQueuedNotifications $job): bool {
            $notifiable = $job->notifiables->first();

            return $notifiable instanceof AnonymousNotifiable
                && $notifiable->routeNotificationFor('mail') === 'ana@example.com'
                && $job->notification instanceof TenantApprovedNotification
                && $job->channels === ['mail'];
        });
    }

    public function test_mail_message_uses_payload_name_with_anonymous_notifiable(): void
    {
        $notifiable = (new AnonymousNotifiable)->route('mail', 'ana@example.com');
        $mail = (new TenantApprovedNotification($this->payload()))->toMail($notifiable);

        $this->assertSame('¡Felicidades, Ana Pérez!', $mail->greeting);
        $this->assertSame('https://farmacia.inventarya.com/login', $mail->actionUrl);
    }

    public function test_mail_message_falls_back_when_owner_name_is_missing(): void
    {
        $payload = $this->payload();
        unset($payload['owner_name']);
        $notifiable = (new AnonymousNotifiable)->route('mail', 'ana@example.com');

        $mail = (new TenantApprovedNotification($payload))->toMail($notifiable);

        $this->assertSame('¡Felicidades, Cliente!', $mail->greeting);
    }
}
