<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Store;
use App\Models\Product;
use Illuminate\Support\Facades\Log;

class TenantLimitService
{
    /**
     * Check if a tenant can create a new user.
     *
     * @param Tenant $tenant
     * @return array{allowed: bool, current: int, limit: ?int, remaining: ?int, code?: string, message?: string}
     */
    public function canCreateUser(Tenant $tenant): array
    {
        return $this->checkResourceLimit(
            $tenant,
            'max_users',
            'usuarios',
            fn () => $this->getUserCount($tenant)
        );
    }

    /**
     * Check if a tenant can create a new store.
     *
     * @param Tenant $tenant
     * @return array{allowed: bool, current: int, limit: ?int, remaining: ?int, code?: string, message?: string}
     */
    public function canCreateStore(Tenant $tenant): array
    {
        return $this->checkResourceLimit(
            $tenant,
            'max_stores',
            'tiendas',
            fn () => $this->getStoreCount($tenant)
        );
    }

    /**
     * Check if a tenant can create a new product.
     *
     * @param Tenant $tenant
     * @return array{allowed: bool, current: int, limit: ?int, remaining: ?int, code?: string, message?: string}
     */
    public function canCreateProduct(Tenant $tenant): array
    {
        return $this->checkResourceLimit(
            $tenant,
            'max_products',
            'productos',
            fn () => $this->getProductCount($tenant)
        );
    }

    /**
     * Check if a feature is enabled on the tenant's current plan.
     */
    public function hasFeature(Tenant $tenant, string $feature): bool
    {
        $plan = $this->getActivePlan($tenant);
        if (!$plan) {
            return false;
        }

        return $plan->hasFeature($feature);
    }

    /**
     * Get the active subscription for the tenant.
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

        return $tenant->currentSubscription ?? $tenant->subscriptions()->latest('id')->first();
    }

    /**
     * Get the active plan for the tenant.
     */
    public function getActivePlan(Tenant $tenant): ?Plan
    {
        $sub = $this->getActiveSubscription($tenant);
        if ($sub && $sub->plan) {
            return $sub->plan;
        }

        return $tenant->plan;
    }

    /**
     * Get resource usage metrics compared to plan limits.
     */
    public function getUsage(Tenant $tenant): array
    {
        $plan = $this->getActivePlan($tenant);
        $counts = $this->getCounts($tenant);

        $usersLimit = $plan?->max_users;
        $storesLimit = $plan?->max_stores;
        $productsLimit = $plan?->max_products;

        return [
            'users' => [
                'current' => $counts['users'],
                'limit' => $usersLimit,
                'remaining' => is_null($usersLimit) ? null : max(0, $usersLimit - $counts['users']),
                'unlimited' => is_null($usersLimit),
                'percentage' => (is_null($usersLimit) || $usersLimit === 0) ? 0 : min(100, round(($counts['users'] / $usersLimit) * 100, 1)),
            ],
            'stores' => [
                'current' => $counts['stores'],
                'limit' => $storesLimit,
                'remaining' => is_null($storesLimit) ? null : max(0, $storesLimit - $counts['stores']),
                'unlimited' => is_null($storesLimit),
                'percentage' => (is_null($storesLimit) || $storesLimit === 0) ? 0 : min(100, round(($counts['stores'] / $storesLimit) * 100, 1)),
            ],
            'products' => [
                'current' => $counts['products'],
                'limit' => $productsLimit,
                'remaining' => is_null($productsLimit) ? null : max(0, $productsLimit - $counts['products']),
                'unlimited' => is_null($productsLimit),
                'percentage' => (is_null($productsLimit) || $productsLimit === 0) ? 0 : min(100, round(($counts['products'] / $productsLimit) * 100, 1)),
            ],
        ];
    }

    /**
     * Get plan limits summary.
     */
    public function getLimits(Tenant $tenant): array
    {
        $plan = $this->getActivePlan($tenant);

        return [
            'max_users' => $plan?->max_users,
            'max_stores' => $plan?->max_stores,
            'max_products' => $plan?->max_products,
            'custom_domain' => (bool) ($plan?->custom_domain ?? false),
            'multi_store' => (bool) ($plan?->multi_store ?? false),
            'reports' => (bool) ($plan?->reports ?? true),
            'features' => $plan?->features ?? [],
        ];
    }

    /**
     * Core limit evaluator for any numeric resource.
     *
     * @param Tenant $tenant
     * @param string $limitField Column on Plan model (e.g. 'max_users')
     * @param string $resourceName Human label (e.g. 'usuarios')
     * @param callable $countCallback Returns current count
     * @return array
     */
    protected function checkResourceLimit(Tenant $tenant, string $limitField, string $resourceName, callable $countCallback): array
    {
        $subscription = $this->getActiveSubscription($tenant);

        // Verify if subscription exists and is in a valid state
        if ($subscription) {
            if ($subscription->isExpired()) {
                $current = (int) $countCallback();
                return [
                    'allowed' => false,
                    'current' => $current,
                    'limit' => null,
                    'remaining' => 0,
                    'code' => 'SUBSCRIPTION_EXPIRED',
                    'message' => 'Tu suscripción ha expirado. Por favor renueva tu plan para continuar agregando ' . $resourceName . '.',
                ];
            }

            if ($subscription->status === 'suspended') {
                $current = (int) $countCallback();
                return [
                    'allowed' => false,
                    'current' => $current,
                    'limit' => null,
                    'remaining' => 0,
                    'code' => 'SUBSCRIPTION_SUSPENDED',
                    'message' => 'Tu cuenta se encuentra temporalmente suspendida.',
                ];
            }
        }

        $plan = $this->getActivePlan($tenant);
        $current = (int) $countCallback();

        if (!$plan) {
            // If no plan configured, allow action by default to avoid deadlock
            return [
                'allowed' => true,
                'current' => $current,
                'limit' => null,
                'remaining' => null,
                'unlimited' => true,
            ];
        }

        $limit = $plan->{$limitField};

        // NULL means unlimited
        if (is_null($limit)) {
            return [
                'allowed' => true,
                'current' => $current,
                'limit' => null,
                'remaining' => null,
                'unlimited' => true,
            ];
        }

        if ($current < $limit) {
            return [
                'allowed' => true,
                'current' => $current,
                'limit' => $limit,
                'remaining' => max(0, $limit - $current),
                'unlimited' => false,
            ];
        }

        return [
            'allowed' => false,
            'current' => $current,
            'limit' => $limit,
            'remaining' => 0,
            'code' => 'PLAN_LIMIT_REACHED',
            'message' => "Has alcanzado el límite de {$resourceName} ({$limit}) permitido en tu plan actual.",
            'unlimited' => false,
        ];
    }

    protected function getUserCount(Tenant $tenant): int
    {
        if (tenancy()->initialized && tenant('id') === $tenant->id) {
            return User::count();
        }

        try {
            return $tenant->run(fn () => User::count());
        } catch (\Throwable $e) {
            Log::warning("Could not count users for tenant {$tenant->id}: " . $e->getMessage());
            return 0;
        }
    }

    protected function getStoreCount(Tenant $tenant): int
    {
        if (tenancy()->initialized && tenant('id') === $tenant->id) {
            return Store::count();
        }

        try {
            return $tenant->run(fn () => Store::count());
        } catch (\Throwable $e) {
            Log::warning("Could not count stores for tenant {$tenant->id}: " . $e->getMessage());
            return 0;
        }
    }

    protected function getProductCount(Tenant $tenant): int
    {
        if (tenancy()->initialized && tenant('id') === $tenant->id) {
            return Product::count();
        }

        try {
            return $tenant->run(fn () => Product::count());
        } catch (\Throwable $e) {
            Log::warning("Could not count products for tenant {$tenant->id}: " . $e->getMessage());
            return 0;
        }
    }

    protected function getCounts(Tenant $tenant): array
    {
        if (tenancy()->initialized && tenant('id') === $tenant->id) {
            return [
                'users' => User::count(),
                'stores' => Store::count(),
                'products' => Product::count(),
            ];
        }

        try {
            return $tenant->run(fn () => [
                'users' => User::count(),
                'stores' => Store::count(),
                'products' => Product::count(),
            ]);
        } catch (\Throwable $e) {
            Log::warning("Could not count metrics for tenant {$tenant->id}: " . $e->getMessage());
            return [
                'users' => 0,
                'stores' => 0,
                'products' => 0,
            ];
        }
    }
}
