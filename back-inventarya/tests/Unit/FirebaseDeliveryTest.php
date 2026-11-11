<?php

namespace Tests\Unit;

use App\Jobs\SendPushNotificationJob;
use App\Services\FirebaseService;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Exception\Messaging\InvalidMessage;
use Kreait\Firebase\Exception\Messaging\MessagingError;
use Mockery;
use Tests\TestCase;

class FirebaseDeliveryTest extends TestCase
{
    private function service(?Messaging $messaging): FirebaseService
    {
        return new class($messaging) extends FirebaseService {
            public function __construct(?Messaging $messaging)
            {
                $this->messaging = $messaging;
                $this->isConfigured = $messaging !== null;
            }
        };
    }

    public function test_missing_credentials_fail_instead_of_marking_job_successful(): void
    {
        Log::spy();
        $job = new SendPushNotificationJob('test-device', 'Title', 'Body');
        $this->expectExceptionMessage('PUSH_FIREBASE_NOT_CONFIGURED');
        $job->handle($this->service(null));
    }

    public function test_fcm_acceptance_preserves_android_channel_and_data(): void
    {
        Log::spy();
        $messaging = Mockery::mock(Messaging::class);
        $messaging->shouldReceive('send')->once()->withArgs(function ($message) {
            $payload = $message->jsonSerialize();
            return $payload['android']['notification']['channel_id'] === 'sales'
                && $payload['android']['notification']['sound'] === 'default'
                && $payload['data']['notification_id'] === '123';
        })->andReturn(['name' => 'accepted-test-message']);
        $this->assertTrue($this->service($messaging)->send('test-device', 'Title', 'Body', ['notification_id' => '123'], 'sales'));
    }

    public function test_message_or_project_errors_do_not_delete_devices_or_leak_tokens(): void
    {
        Log::spy();
        foreach ([new InvalidMessage('secret-test-token'), new MessagingError('secret-test-token')] as $error) {
            $messaging = Mockery::mock(Messaging::class);
            $messaging->shouldReceive('send')->once()->andThrow($error);
            try {
                $this->service($messaging)->send('secret-test-token', 'Title', 'Body');
                $this->fail('Expected delivery failure');
            } catch (\RuntimeException $failure) {
                $this->assertStringContainsString('PUSH_FCM_SEND_FAILED', $failure->getMessage());
                $this->assertStringNotContainsString('secret-test-token', $failure->getMessage());
                $this->assertNull($failure->getPrevious());
            }
        }
    }

    public function test_job_serialization_keeps_tenant_and_retry_policy(): void
    {
        $job = unserialize(serialize(new SendPushNotificationJob('test-device', 'Title', 'Body', [], 'sales', 'demo')));
        $this->assertSame('demo', $job->tenantId);
        $this->assertSame(3, $job->tries);
        $this->assertSame([5, 30, 60], $job->backoff);
    }
}
