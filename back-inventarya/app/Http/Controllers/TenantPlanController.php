<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Services\TenantLimitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantPlanController extends Controller
{
    protected TenantLimitService $limitService;

    public function __construct(TenantLimitService $limitService)
    {
        $this->limitService = $limitService;
    }

    /**
     * Get current tenant's plan, subscription, limits and real-time usage.
     */
    public function myPlan(): JsonResponse
    {
        $tenant = tenant();

        if (!$tenant) {
            return response()->json(['message' => 'No se detectó contexto de tenant.'], 400);
        }

        $plan = $this->limitService->getActivePlan($tenant);
        $subscription = $this->limitService->getActiveSubscription($tenant);
        $usage = $this->limitService->getUsage($tenant);
        $limits = $this->limitService->getLimits($tenant);

        $isTrial = $subscription ? $subscription->isTrialing() : false;
        $trialDaysRemaining = $subscription ? $subscription->trialDaysRemaining() : null;

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'status' => $tenant->status,
            ],
            'plan' => $plan ? [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'price' => (float) $plan->price,
                'yearly_price' => (float) $plan->yearly_price,
                'description' => $plan->description,
                'trial_days' => $plan->trial_days,
                'status' => $plan->status,
            ] : null,
            'subscription' => $subscription ? [
                'id' => $subscription->id,
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
                'price' => (float) $subscription->price,
                'starts_at' => $subscription->starts_at?->toIso8601String(),
                'ends_at' => $subscription->ends_at?->toIso8601String(),
                'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
                'cancelled_at' => $subscription->cancelled_at?->toIso8601String(),
                'is_active' => $subscription->isActive(),
                'is_trialing' => $subscription->isTrialing(),
                'is_expired' => $subscription->isExpired(),
                'days_remaining' => $trialDaysRemaining,
            ] : null,
            'trial' => [
                'is_trial' => $isTrial,
                'days_remaining' => $trialDaysRemaining,
                'ends_at' => $subscription?->trial_ends_at?->toIso8601String(),
            ],
            'usage' => $usage,
            'limits' => $limits,
            'features' => $plan?->features ?? [],
        ]);
    }

    /**
     * Get all active plans available for upgrading/changing.
     */
    public function availablePlans(): JsonResponse
    {
        $plans = Plan::where('status', 'active')
            ->orderBy('price', 'asc')
            ->get();

        return response()->json($plans);
    }
}
