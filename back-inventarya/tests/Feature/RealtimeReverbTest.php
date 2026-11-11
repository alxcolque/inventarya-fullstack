<?php

namespace Tests\Feature;

use App\Models\CentralUser;
use App\Models\User;
use App\Notifications\Tenant\SaleCreatedNotification;
use App\Notifications\UserLoginNotification;
use App\Support\TenantBroadcastChannel;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RealtimeReverbTest extends TestCase
{
    public function test_reverb_server_configuration_integrity(): void
    {
        $this->assertEquals('reverb', config('reverb.default'));

        $server = config('reverb.servers.reverb');
        $this->assertIsArray($server);
        $this->assertFalse($server['scaling']['enabled'], 'Reverb scaling must remain false to protect against CVE-2026-23524');
        $this->assertEquals(8080, $server['port']);
        $this->assertEquals('reverb', config('broadcasting.connections.reverb.driver'));
    }

    public function test_tenant_broadcast_channel_builders(): void
    {
        $this->assertEquals('tenants.t1.users.10', TenantBroadcastChannel::user(10, 't1'));
        $this->assertEquals('tenants.t1.admins', TenantBroadcastChannel::admins('t1'));
    }

    public function test_channel_authorization_definitions(): void
    {
        $user = new User(['id' => 1]);
        $user->id = 1;

        $channels = Broadcast::getChannels();
        $this->assertArrayHasKey('tenants.{tenantId}.users.{id}', $channels);
        $this->assertArrayHasKey('tenants.{tenantId}.admins', $channels);
        $this->assertArrayHasKey('App.Models.CentralUser.{id}', $channels);
    }

    public function test_broadcast_notifications_payload_and_queuing(): void
    {
        Notification::fake();

        $user = new User(['name' => 'Admin']);
        $user->id = 1;

        $notif = new UserLoginNotification($user, ['ip_address' => '127.0.0.1']);
        $this->assertContains('broadcast', $notif->via($user));

        $broadcastMsg = $notif->toBroadcast($user);
        $this->assertInstanceOf(BroadcastMessage::class, $broadcastMsg);

        $saleNotif = new SaleCreatedNotification(['title' => 'Venta', 'sale_id' => 'abc-123']);
        $this->assertContains('broadcast', $saleNotif->via($user));
        $this->assertInstanceOf(BroadcastMessage::class, $saleNotif->toBroadcast($user));

        Notification::send($user, $notif);
        Notification::assertSentTo($user, UserLoginNotification::class);
    }
}
