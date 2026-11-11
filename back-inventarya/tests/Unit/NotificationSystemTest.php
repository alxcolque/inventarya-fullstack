<?php

namespace Tests\Unit;

use App\Http\Requests\StoreManagedNotificationRequest;
use App\Jobs\SendPushNotificationJob;
use App\Models\DeviceToken;
use App\Models\User;
use App\Notifications\GeneralNotification;
use App\Notifications\Tenant\PaymentStatusNotification;
use App\Services\Notifications\StockAlertService;
use App\Services\PushNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class NotificationSystemTest extends TestCase
{
    public function test_all_audience_does_not_require_or_validate_empty_user_ids(): void
    {
        $validator = $this->manualNotificationValidator([
            'title' => 'Mantenimiento',
            'message' => 'El sistema tendrá mantenimiento.',
            'type' => 'system',
            'severity' => 'info',
            'audience' => 'all',
            'user_ids' => [],
            'recipient_roles' => [],
        ]);

        $this->assertFalse($validator->fails());
        $this->assertArrayNotHasKey('user_ids', $validator->validated());
        $this->assertArrayNotHasKey('recipient_roles', $validator->validated());
    }

    public function test_roles_audience_requires_roles_but_not_user_ids(): void
    {
        $valid = $this->manualNotificationValidator([
            'title' => 'Inventario',
            'message' => 'Revisar productos.',
            'type' => 'inventory',
            'severity' => 'warning',
            'audience' => 'roles',
            'recipient_roles' => ['admin', 'staff'],
            'user_ids' => [],
        ]);
        $invalid = $this->manualNotificationValidator([
            'title' => 'Inventario',
            'message' => 'Revisar productos.',
            'type' => 'inventory',
            'severity' => 'warning',
            'audience' => 'roles',
            'recipient_roles' => [],
        ]);

        $this->assertFalse($valid->fails());
        $this->assertTrue($invalid->fails());
        $this->assertArrayHasKey('recipient_roles', $invalid->errors()->toArray());
    }

    public function test_users_audience_requires_at_least_one_user(): void
    {
        $validator = $this->manualNotificationValidator([
            'title' => 'Mensaje',
            'message' => 'Revisa el inventario.',
            'type' => 'general',
            'severity' => 'info',
            'audience' => 'users',
            'user_ids' => [],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('user_ids', $validator->errors()->toArray());
    }

    public function test_stock_alerts_only_fire_when_crossing_a_threshold(): void
    {
        $service = new StockAlertService;

        $this->assertNull($service->transitionType(10, 8, 5));
        $this->assertSame('stock_low', $service->transitionType(6, 5, 5));
        $this->assertNull($service->transitionType(5, 4, 5));
        $this->assertSame('stock_out', $service->transitionType(1, 0, 5));
        $this->assertNull($service->transitionType(0, 10, 5));
        $this->assertSame('stock_low', $service->transitionType(10, 5, 5));
    }

    public function test_general_notification_uses_database_and_reverb_with_stable_id(): void
    {
        $notification = new GeneralNotification('Stock bajo', 'Quedan 4 unidades.', [
            'severity' => 'warning',
            'resource_id' => '123',
        ], 'stock_low');

        $this->assertSame(['database', 'broadcast'], $notification->via(new User));
        $this->assertNotEmpty($notification->id);
        $this->assertSame($notification->id, $notification->toBroadcast(new User)->data['id']);
        $this->assertSame('123', $notification->toArray(new User)['resource_id']);
    }

    public function test_push_skips_users_without_tokens_and_queues_every_registered_device(): void
    {
        Queue::fake();
        $service = app(PushNotificationService::class);
        $user = new User(['name' => 'Ana', 'email' => 'ana@example.com', 'status' => 'active']);
        $user->id = 10;
        $user->setRelation('deviceTokens', collect());

        $this->assertSame(0, $service->sendToUser($user, 'Aviso', 'Mensaje'));
        Queue::assertNothingPushed();

        $user->setRelation('deviceTokens', collect([
            new DeviceToken(['token' => 'token-one']),
            new DeviceToken(['token' => 'token-two']),
        ]));

        $this->assertSame(2, $service->sendToUser($user, 'Aviso', 'Mensaje'));
        Queue::assertPushed(SendPushNotificationJob::class, 2);
    }

    public function test_payment_notification_queues_database_reverb_and_mail(): void
    {
        $notification = new PaymentStatusNotification([
            'title' => 'Pago confirmado',
            'message' => 'Pago recibido.',
            'type' => 'payment_confirmed',
            'severity' => 'success',
        ]);

        $this->assertInstanceOf(ShouldQueue::class, $notification);
        $this->assertSame(['database', 'broadcast', 'mail'], $notification->via(new User));
    }

    private function manualNotificationValidator(array $data): \Illuminate\Validation\Validator
    {
        $request = StoreManagedNotificationRequest::create('/notification-management', 'POST', $data);

        return Validator::make($data, $request->rules());
    }
}
