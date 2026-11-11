<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\Plan;
use App\Http\Requests\SubscriptionRequest;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    protected SubscriptionService $subscriptionService;

    public function __construct(SubscriptionService $subscriptionService)
    {
        $this->subscriptionService = $subscriptionService;
    }

    public function index()
    {
        $subscriptions = Subscription::with(['tenant', 'plan'])
            ->orderBy('id', 'desc')
            ->get();

        return response()->json($subscriptions);
    }

    public function stats()
    {
        $total = Subscription::count();
        $active = Subscription::where('status', 'active')->count();
        $trialing = Subscription::where('status', 'trialing')->count();
        $expired = Subscription::where('status', 'expired')->count();
        $cancelled = Subscription::whereIn('status', ['cancelled', 'canceled'])->count();
        $monthlyRevenue = Subscription::where('status', 'active')->sum('price');

        return response()->json([
            'total' => $total,
            'active' => $active,
            'trialing' => $trialing,
            'expired' => $expired,
            'cancelled' => $cancelled,
            'monthly_revenue' => (float) $monthlyRevenue,
        ]);
    }

    public function store(SubscriptionRequest $request)
    {
        $subscription = Subscription::create($request->validated());
        return response()->json(['message' => 'Suscripción creada', 'subscription' => $subscription->load(['tenant', 'plan'])], 201);
    }

    public function show($id)
    {
        $subscription = Subscription::with(['tenant', 'plan'])->find($id);
        if (!$subscription) {
            return response()->json(['message' => 'No encontrado'], 404);
        }
        return response()->json($subscription);
    }

    public function update(SubscriptionRequest $request, $id)
    {
        $subscription = Subscription::find($id);
        if (!$subscription) {
            return response()->json(['message' => 'No encontrado'], 404);
        }
        $subscription->update($request->validated());
        return response()->json(['message' => 'Suscripción actualizada', 'subscription' => $subscription->load(['tenant', 'plan'])], 200);
    }

    public function destroy($id)
    {
        $subscription = Subscription::find($id);
        if (!$subscription) {
            return response()->json(['message' => 'No encontrado'], 404);
        }
        $subscription->delete();
        return response()->json(['message' => 'Eliminada correctamente'], 200);
    }

    /**
     * Direct plan assignment to a tenant.
     */
    public function assignPlan(Request $request)
    {
        $validated = $request->validate([
            'tenant_id' => 'required|string|exists:tenants,id',
            'plan_id' => 'required|integer|exists:plans,id',
            'billing_cycle' => 'nullable|string|in:monthly,yearly',
        ]);

        $tenant = Tenant::findOrFail($validated['tenant_id']);
        $plan = Plan::findOrFail($validated['plan_id']);
        $billingCycle = $validated['billing_cycle'] ?? 'monthly';

        $subscription = $this->subscriptionService->assignPlan($tenant, $plan, $billingCycle);

        return response()->json([
            'message' => "Plan '{$plan->name}' asignado correctamente al tenant.",
            'subscription' => $subscription,
        ], 200);
    }

    /**
     * Activate a free trial for a tenant.
     */
    public function activateTrial(Request $request)
    {
        $validated = $request->validate([
            'tenant_id' => 'required|string|exists:tenants,id',
            'plan_id' => 'required|integer|exists:plans,id',
            'trial_days' => 'nullable|integer|min:1|max:365',
        ]);

        $tenant = Tenant::findOrFail($validated['tenant_id']);
        $plan = Plan::findOrFail($validated['plan_id']);
        $trialDays = $validated['trial_days'] ?? null;

        $subscription = $this->subscriptionService->activateTrial($tenant, $plan, $trialDays);

        return response()->json([
            'message' => "Prueba de '{$plan->name}' activada correctamente.",
            'subscription' => $subscription,
        ], 200);
    }

    /**
     * Change plan on an existing subscription.
     */
    public function changePlan(Request $request, $id)
    {
        $validated = $request->validate([
            'plan_id' => 'required|integer|exists:plans,id',
            'billing_cycle' => 'nullable|string|in:monthly,yearly',
        ]);

        $subscription = Subscription::with('tenant')->findOrFail($id);
        $newPlan = Plan::findOrFail($validated['plan_id']);
        $billingCycle = $validated['billing_cycle'] ?? $subscription->billing_cycle ?? 'monthly';

        $newSubscription = $this->subscriptionService->changePlan($subscription->tenant, $newPlan, $billingCycle);

        return response()->json([
            'message' => "Plan modificado correctamente a '{$newPlan->name}'.",
            'subscription' => $newSubscription,
        ], 200);
    }

    /**
     * Cancel a subscription.
     */
    public function cancelSubscription($id)
    {
        $subscription = Subscription::findOrFail($id);
        $cancelledSubscription = $this->subscriptionService->cancelSubscription($subscription);

        return response()->json([
            'message' => 'Suscripción cancelada correctamente.',
            'subscription' => $cancelledSubscription,
        ], 200);
    }
}
