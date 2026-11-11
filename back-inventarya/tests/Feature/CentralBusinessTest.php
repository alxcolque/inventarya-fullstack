<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\Subscription;
use App\Models\Payment;
use App\Models\CentralUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

class CentralBusinessTest extends TestCase
{
    protected CentralUser $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        // Create or find a central superadmin
        $this->adminUser = CentralUser::firstOrCreate(
            ['email' => 'admin_test@inventarya.com'],
            [
                'name' => 'Admin Tester',
                'password' => bcrypt('password'),
                'role' => 'superadmin',
                'status' => 'active',
            ]
        );
    }

    public function test_plans_endpoint_can_be_listed_and_created(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/plans');
        $response->assertStatus(200);

        $uniqueSlug = 'test-plan-' . uniqid();
        $createResponse = $this->postJson('/api/plans', [
            'name' => 'Automated Test Plan',
            'slug' => $uniqueSlug,
            'price' => 19.99,
            'yearly_price' => 199.99,
            'max_users' => 5,
            'max_stores' => 2,
            'max_products' => 2000,
            'features' => ['inventory' => true, 'barcode' => true],
            'custom_domain' => false,
            'multi_store' => false,
            'reports' => true,
            'trial_days' => 7,
            'status' => 'active',
        ]);

        $createResponse->assertStatus(201);
        $planId = $createResponse->json('plan.id');

        // Toggle status
        $toggleResponse = $this->patchJson("/api/plans/{$planId}/toggle-status");
        $toggleResponse->assertStatus(200);
        $this->assertEquals('inactive', $toggleResponse->json('plan.status'));

        // Clean up
        $this->deleteJson("/api/plans/{$planId}")->assertStatus(200);
    }

    public function test_subscriptions_stats_and_assignment(): void
    {
        Sanctum::actingAs($this->adminUser);

        $statsResponse = $this->getJson('/api/subscriptions/stats');
        $statsResponse->assertStatus(200);
        $statsResponse->assertJsonStructure([
            'total', 'active', 'trialing', 'expired', 'cancelled', 'monthly_revenue'
        ]);

        $tenant = Tenant::first();
        $plan = Plan::first();

        if ($tenant && $plan) {
            $assignResponse = $this->postJson('/api/subscriptions/assign', [
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'billing_cycle' => 'monthly',
            ]);

            $assignResponse->assertStatus(200);
            $this->assertEquals('active', $assignResponse->json('subscription.status'));
        }
    }

    public function test_payments_listing_confirmation_and_refund(): void
    {
        Sanctum::actingAs($this->adminUser);

        $listResponse = $this->getJson('/api/payments');
        $listResponse->assertStatus(200);

        $tenant = Tenant::first();
        $plan = Plan::first();

        if ($tenant && $plan) {
            $sub = $tenant->getActiveSubscription() ?? $tenant->subscriptions()->first();

            // Create test payment
            $payment = Payment::create([
                'tenant_id' => $tenant->id,
                'subscription_id' => $sub?->id,
                'plan_id' => $plan->id,
                'amount' => 50.00,
                'currency' => 'USD',
                'billing_cycle' => 'monthly',
                'method' => 'bank_transfer',
                'reference' => 'TEST-REF-' . uniqid(),
                'status' => 'pending',
            ]);

            // Confirm payment
            $confirmResponse = $this->postJson("/api/payments/{$payment->id}/confirm", [
                'receipt' => 'receipts/test.pdf',
                'meta' => ['tested' => true],
            ]);
            $confirmResponse->assertStatus(200);
            $this->assertEquals('paid', $confirmResponse->json('payment.status'));

            // Refund payment
            $refundResponse = $this->postJson("/api/payments/{$payment->id}/refund", [
                'reason' => 'Prueba de reembolso automático',
            ]);
            $refundResponse->assertStatus(200);
            $this->assertEquals('refunded', $refundResponse->json('payment.status'));
            $this->assertNotNull($refundResponse->json('payment.meta.refunded_at'));

            // Clean up test payment
            $payment->delete();
        }
    }
}
