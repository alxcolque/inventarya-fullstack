<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SubscriptionService
{
    /**
     * Assign a plan directly to a tenant with active status.
     *
     * @param Tenant $tenant
     * @param Plan $plan
     * @param string $billingCycle 'monthly' or 'yearly'
     * @return Subscription
     */
    public function assignPlan(Tenant $tenant, Plan $plan, string $billingCycle = 'monthly'): Subscription
    {
        return DB::transaction(function () use ($tenant, $plan, $billingCycle) {
            // Expire or supersede prior active/trialing subscriptions
            $tenant->subscriptions()
                ->whereIn('status', ['active', 'trialing', 'pending'])
                ->update([
                    'status' => 'expired',
                    'ends_at' => now(),
                ]);

            $price = ($billingCycle === 'yearly') ? (float) $plan->yearly_price : (float) $plan->price;
            $endsAt = ($billingCycle === 'yearly') ? now()->addYear() : now()->addMonth();

            $subscription = $tenant->subscriptions()->create([
                'plan_id' => $plan->id,
                'starts_at' => now(),
                'ends_at' => $endsAt,
                'trial_ends_at' => null,
                'status' => 'active',
                'billing_cycle' => $billingCycle,
                'price' => $price,
            ]);

            // Sync quick reference fields on tenant
            $tenant->update([
                'current_subscription_id' => $subscription->id,
                'plan_id' => $plan->id,
                'status' => 'active',
            ]);

            Log::info("Plan '{$plan->name}' assigned to tenant '{$tenant->id}'", [
                'subscription_id' => $subscription->id,
                'billing_cycle' => $billingCycle,
                'price' => $price,
            ]);

            return $subscription->load(['plan', 'tenant']);
        });
    }

    /**
     * Activate a free trial period for a tenant using the specified plan.
     *
     * @param Tenant $tenant
     * @param Plan $plan
     * @param int|null $customTrialDays
     * @return Subscription
     */
    public function activateTrial(Tenant $tenant, Plan $plan, ?int $customTrialDays = null): Subscription
    {
        return DB::transaction(function () use ($tenant, $plan, $customTrialDays) {
            $trialDays = $customTrialDays ?? ($plan->trial_days > 0 ? $plan->trial_days : 14);

            // Invalidate old active/trialing subscriptions
            $tenant->subscriptions()
                ->whereIn('status', ['active', 'trialing', 'pending'])
                ->update([
                    'status' => 'expired',
                    'ends_at' => now(),
                ]);

            $trialEndsAt = now()->addDays($trialDays);

            $subscription = $tenant->subscriptions()->create([
                'plan_id' => $plan->id,
                'starts_at' => now(),
                'ends_at' => $trialEndsAt,
                'trial_ends_at' => $trialEndsAt,
                'status' => 'trialing',
                'billing_cycle' => 'monthly',
                'price' => 0,
            ]);

            $tenant->update([
                'current_subscription_id' => $subscription->id,
                'plan_id' => $plan->id,
                'status' => 'trial',
            ]);

            Log::info("Trial activated for tenant '{$tenant->id}' with plan '{$plan->name}' for {$trialDays} days", [
                'subscription_id' => $subscription->id,
                'trial_ends_at' => $trialEndsAt->toIso8601String(),
            ]);

            return $subscription->load(['plan', 'tenant']);
        });
    }

    /**
     * Change a tenant's plan (upgrade or downgrade).
     *
     * @param Tenant $tenant
     * @param Plan $newPlan
     * @param string $billingCycle
     * @return Subscription
     */
    public function changePlan(Tenant $tenant, Plan $newPlan, string $billingCycle = 'monthly'): Subscription
    {
        return $this->assignPlan($tenant, $newPlan, $billingCycle);
    }

    /**
     * Cancel an active or trialing subscription.
     *
     * @param Subscription $subscription
     * @return Subscription
     */
    public function cancelSubscription(Subscription $subscription): Subscription
    {
        $subscription->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        Log::info("Subscription '{$subscription->id}' cancelled for tenant '{$subscription->tenant_id}'");

        return $subscription->load(['plan', 'tenant']);
    }

    /**
     * Get the active or trialing subscription for a tenant.
     *
     * @param Tenant $tenant
     * @return Subscription|null
     */
    public function getActiveSubscription(Tenant $tenant): ?Subscription
    {
        $sub = $tenant->subscriptions()
            ->with('plan')
            ->whereIn('status', ['active', 'trialing'])
            ->latest('id')
            ->first();

        if ($sub && $sub->isActive()) {
            return $sub;
        }

        return $tenant->currentSubscription ?? $tenant->subscriptions()->with('plan')->latest('id')->first();
    }
}
