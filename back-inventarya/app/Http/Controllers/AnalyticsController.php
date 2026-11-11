<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\Subscription;
use App\Models\Plan;
use App\Models\Payment;
use App\Models\CentralUser;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    /**
     * Retorna estadísticas comerciales y operativas reales del SaaS Central
     */
    public function businessStats(Request $request)
    {
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();
        $startOfLastMonth = $now->copy()->subMonth()->startOfMonth();
        $endOfLastMonth = $now->copy()->subMonth()->endOfMonth();

        // 1. Tenants totales y crecimiento
        $totalTenants = Tenant::count();
        $newTenantsThisMonth = Tenant::where('created_at', '>=', $startOfMonth)->count();
        $newTenantsLastMonth = Tenant::whereBetween('created_at', [$startOfLastMonth, $endOfLastMonth])->count();
        
        $tenantsGrowth = 0;
        if ($newTenantsLastMonth > 0) {
            $tenantsGrowth = round((($newTenantsThisMonth - $newTenantsLastMonth) / $newTenantsLastMonth) * 100, 1);
        } elseif ($newTenantsThisMonth > 0) {
            $tenantsGrowth = 100;
        }

        // 2. Suscripciones
        $totalSubscriptions = Subscription::count();
        $activeSubscriptions = Subscription::where('status', 'active')->count();
        $trialingSubscriptions = Subscription::where('status', 'trialing')->count();
        $cancelledSubscriptions = Subscription::whereIn('status', ['cancelled', 'canceled'])->count();

        // 3. Ingresos Mensuales Recurrentes (MRR)
        $activeMmr = (float) Subscription::where('status', 'active')->sum('price');
        $paymentsThisMonth = (float) Payment::where('status', 'completed')
            ->where('created_at', '>=', $startOfMonth)
            ->sum('amount');
        
        $monthlyRevenue = $activeMmr > 0 ? $activeMmr : $paymentsThisMonth;

        // 4. Usuarios centrales activos
        $totalCentralUsers = CentralUser::count();
        $activeUsers = CentralUser::where('status', 'active')->count();
        if ($activeUsers === 0) {
            $activeUsers = $totalCentralUsers;
        }

        // 5. Tenants recientes con dominios y planes reales
        $recentTenants = Tenant::with(['domains', 'currentSubscription.plan'])
            ->orderBy('created_at', 'desc')
            ->take(8)
            ->get()
            ->map(function ($tenant) {
                $primaryDomain = $tenant->domains->firstWhere('is_primary', true)?->domain 
                    ?? $tenant->domains->first()?->domain 
                    ?? ($tenant->slug ? $tenant->slug . '.localhost' : 'localhost');

                $currentSub = $tenant->currentSubscription;
                $planName = $currentSub?->plan?->name ?? 'Sin Plan';

                return [
                    'id' => (string) $tenant->id,
                    'name' => $tenant->name ?: $tenant->id,
                    'domain' => $primaryDomain,
                    'status' => $tenant->status ?: 'active',
                    'owner_name' => $tenant->owner_name ?: 'Administrador',
                    'owner_email' => $tenant->owner_email ?: '',
                    'plan_name' => $planName,
                    'created_at' => $tenant->created_at ? $tenant->created_at->toISOString() : now()->toISOString(),
                ];
            });

        // 6. Suscripciones agrupadas por plan real
        $plans = Plan::all();
        $subscriptionsByPlan = [];
        $totalCountForCalc = $totalSubscriptions > 0 ? $totalSubscriptions : ($activeSubscriptions > 0 ? $activeSubscriptions : 1);

        foreach ($plans as $plan) {
            $count = Subscription::where('plan_id', $plan->id)->count();
            $percentage = round(($count / $totalCountForCalc) * 100);
            $subscriptionsByPlan[] = [
                'name' => $plan->name,
                'count' => $count,
                'percentage' => $percentage,
                'price' => (float) $plan->price,
            ];
        }

        // 7. Churn rate (tasa de cancelación)
        $churnRate = $totalSubscriptions > 0 
            ? round(($cancelledSubscriptions / $totalSubscriptions) * 100, 1) 
            : 0.0;

        return response()->json([
            'total_tenants' => $totalTenants,
            'new_tenants_this_month' => $newTenantsThisMonth,
            'tenants_growth' => $tenantsGrowth,
            'active_subscriptions' => $activeSubscriptions,
            'trialing_subscriptions' => $trialingSubscriptions,
            'monthly_revenue' => $monthlyRevenue,
            'growth_rate' => $tenantsGrowth,
            'active_users' => $activeUsers,
            'churn_rate' => $churnRate,
            'recent_tenants' => $recentTenants,
            'subscriptions_by_plan' => $subscriptionsByPlan,
        ]);
    }
}
