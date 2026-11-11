<?php

namespace Tests\Feature;

use App\Events\Central\PaymentReceivedEvent;
use App\Events\Central\TenantApprovedEvent;
use App\Http\Controllers\TenantController;
use App\Services\DomainRegistrationService;
use App\Services\TenantService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class TenantApprovalFlowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.central' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
            ],
            'database.default' => 'central',
            'cache.default' => 'array',
            'invitations.tenant_frontend_url' => 'https://{tenant}.inventarya.com',
        ]);
        DB::purge('central');

        Schema::connection('central')->create('tenants', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('slug');
            $table->string('status');
            $table->string('owner_name')->nullable();
            $table->string('owner_email')->nullable();
            $table->json('data')->nullable();
            $table->timestamps();
        });

        Schema::connection('central')->create('domains', function (Blueprint $table): void {
            $table->id();
            $table->string('tenant_id');
            $table->string('domain');
            $table->string('type');
            $table->string('status');
            $table->boolean('is_primary');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        Schema::connection('central')->create('plans', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        Schema::connection('central')->create('subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('plan_id');
            $table->string('billing_cycle');
            $table->string('status');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
        });

        Schema::connection('central')->create('payments', function (Blueprint $table): void {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('subscription_id');
            $table->unsignedBigInteger('plan_id');
            $table->string('status');
            $table->decimal('amount', 10, 2);
            $table->string('currency');
            $table->string('receipt')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        DB::connection('central')->table('tenants')->insert([
            'id' => 'farmacia',
            'name' => 'Farmacia Ana',
            'slug' => 'farmacia',
            'status' => 'pending',
            'owner_name' => 'Ana Pérez',
            'owner_email' => 'ana@example.com',
        ]);
        DB::connection('central')->table('domains')->insert([
            'tenant_id' => 'farmacia',
            'domain' => 'farmacia.inventarya.com',
            'type' => 'subdomain',
            'status' => 'active',
            'is_primary' => true,
        ]);
    }

    public function test_payment_confirmation_dispatches_approval_only_on_first_activation(): void
    {
        DB::connection('central')->table('plans')->insert(['id' => 1, 'name' => 'Pro']);
        DB::connection('central')->table('subscriptions')->insert([
            'id' => 1,
            'tenant_id' => 'farmacia',
            'plan_id' => 1,
            'billing_cycle' => 'monthly',
            'status' => 'pending',
        ]);
        DB::connection('central')->table('payments')->insert([
            'id' => 1,
            'tenant_id' => 'farmacia',
            'subscription_id' => 1,
            'plan_id' => 1,
            'status' => 'pending',
            'amount' => 20,
            'currency' => 'BOB',
        ]);

        Event::fake([TenantApprovedEvent::class, PaymentReceivedEvent::class]);
        $service = Mockery::mock(TenantService::class, [app(DomainRegistrationService::class)])->makePartial();
        $service->shouldReceive('notifyTenantOwnersOfPayment')->once();

        $service->confirmTenantPayment(1);
        $this->assertSame('paid', DB::connection('central')->table('payments')->value('status'));
        Event::assertDispatched(TenantApprovedEvent::class, function (TenantApprovedEvent $event): bool {
            return $event->data['owner_name'] === 'Ana Pérez'
                && $event->data['owner_email'] === 'ana@example.com';
        });

        $service->confirmTenantPayment(1);
        Event::assertDispatchedTimes(TenantApprovedEvent::class, 1);
    }

    public function test_central_approval_dispatches_owner_payload_once(): void
    {
        Event::fake([TenantApprovedEvent::class]);
        $controller = app(TenantController::class);
        $request = Request::create('/api/tenants/farmacia', 'PUT', ['status' => 'active']);
        $request->setUserResolver(fn () => new class {
            public function cannot(string $ability): bool
            {
                return false;
            }
        });

        $response = $controller->update($request, 'farmacia');
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('active', DB::connection('central')->table('tenants')->value('status'));

        Event::assertDispatched(TenantApprovedEvent::class, function (TenantApprovedEvent $event): bool {
            return $event->data['tenant_id'] === 'farmacia'
                && $event->data['owner_name'] === 'Ana Pérez'
                && $event->data['owner_email'] === 'ana@example.com'
                && $event->data['business_name'] === 'Farmacia Ana'
                && $event->data['domain'] === 'farmacia.inventarya.com'
                && $event->data['login_url'] === 'https://farmacia.inventarya.com/login';
        });

        $controller->update($request, 'farmacia');
        Event::assertDispatchedTimes(TenantApprovedEvent::class, 1);
    }
}
