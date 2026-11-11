<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\InventoryStore;
use App\Models\InventoryWarehouse;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\Store;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TenantDashboardController extends Controller
{
    /**
     * Resumen general para el Dashboard del Tenant
     */
    public function summary(Request $request)
    {
        $period = $request->query('period', '30days');
        $storeFilter = $request->query('store_id', 'all');
        $customStart = $request->query('start_date');
        $customEnd = $request->query('end_date');

        // 1. Determinar rango de fechas actual y previo para comparativa
        $now = Carbon::now();
        switch ($period) {
            case 'today':
                $startDate = $now->copy()->startOfDay();
                $endDate = $now->copy()->endOfDay();
                $prevStartDate = $startDate->copy()->subDay();
                $prevEndDate = $endDate->copy()->subDay();
                $groupByHour = true;
                break;
            case 'yesterday':
                $startDate = $now->copy()->subDay()->startOfDay();
                $endDate = $now->copy()->subDay()->endOfDay();
                $prevStartDate = $startDate->copy()->subDay();
                $prevEndDate = $endDate->copy()->subDay();
                $groupByHour = true;
                break;
            case '7days':
                $startDate = $now->copy()->subDays(6)->startOfDay();
                $endDate = $now->copy()->endOfDay();
                $prevStartDate = $startDate->copy()->subDays(7);
                $prevEndDate = $startDate->copy()->subSecond();
                $groupByHour = false;
                break;
            case 'this_month':
                $startDate = $now->copy()->startOfMonth();
                $endDate = $now->copy()->endOfDay();
                $daysDiff = $startDate->diffInDays($endDate) + 1;
                $prevStartDate = $startDate->copy()->subMonth();
                $prevEndDate = $prevStartDate->copy()->addDays($daysDiff - 1)->endOfDay();
                $groupByHour = false;
                break;
            case 'custom':
                $startDate = $customStart ? Carbon::parse($customStart)->startOfDay() : $now->copy()->subDays(29)->startOfDay();
                $endDate = $customEnd ? Carbon::parse($customEnd)->endOfDay() : $now->copy()->endOfDay();
                $daysDiff = max(1, $startDate->diffInDays($endDate));
                $prevStartDate = $startDate->copy()->subDays($daysDiff);
                $prevEndDate = $startDate->copy()->subSecond();
                $groupByHour = $daysDiff <= 2;
                break;
            case '30days':
            default:
                $startDate = $now->copy()->subDays(29)->startOfDay();
                $endDate = $now->copy()->endOfDay();
                $prevStartDate = $startDate->copy()->subDays(30);
                $prevEndDate = $startDate->copy()->subSecond();
                $groupByHour = false;
                break;
        }

        // Helper para aplicar filtro de sucursal
        $applyStore = function ($query, $column = 'store_id') use ($storeFilter) {
            if ($storeFilter && $storeFilter !== 'all') {
                $query->where($column, $storeFilter);
            }
            return $query;
        };

        // 2. Métricas de Ventas en el Periodo
        $salesQuery = Sale::whereBetween('created_at', [$startDate, $endDate]);
        $salesQuery = $applyStore($salesQuery);

        $totalSales = (float) $salesQuery->sum('total');
        $ordersCount = (int) $salesQuery->count();
        $totalDiscount = (float) $salesQuery->sum('discount');
        $netSales = max(0, $totalSales - $totalDiscount);
        $avgTicket = $ordersCount > 0 ? round($netSales / $ordersCount, 2) : 0.00;

        // Métricas de ventas en el periodo previo (para calcular % de crecimiento)
        $prevSalesQuery = Sale::whereBetween('created_at', [$prevStartDate, $prevEndDate]);
        $prevSalesQuery = $applyStore($prevSalesQuery);
        $prevNetSales = max(0, (float) $prevSalesQuery->sum('total') - (float) $prevSalesQuery->sum('discount'));
        $prevOrdersCount = (int) $prevSalesQuery->count();

        $salesGrowth = 0.0;
        if ($prevNetSales > 0) {
            $salesGrowth = round((($netSales - $prevNetSales) / $prevNetSales) * 100, 1);
        } elseif ($netSales > 0) {
            $salesGrowth = 100.0;
        }

        $ordersGrowth = 0.0;
        if ($prevOrdersCount > 0) {
            $ordersGrowth = round((($ordersCount - $prevOrdersCount) / $prevOrdersCount) * 100, 1);
        } elseif ($ordersCount > 0) {
            $ordersGrowth = 100.0;
        }

        // 3. Valorización de Inventario
        $warehouseQuery = InventoryWarehouse::query();
        $warehouseCostValuation = (float) $warehouseQuery->selectRaw('COALESCE(SUM(stock_quantity * price), 0) as val')->value('val');
        $warehouseItemsCount = (int) $warehouseQuery->sum('stock_quantity');

        $storesQuery = InventoryStore::query();
        $storesQuery = $applyStore($storesQuery);
        $storesCostValuation = (float) $storesQuery->selectRaw('COALESCE(SUM(stock_quantity * price), 0) as val')->value('val');
        $storesRetailValuation = (float) $storesQuery->selectRaw('COALESCE(SUM(stock_quantity * sale_price), 0) as val')->value('val');
        $storesItemsCount = (int) $storesQuery->sum('stock_quantity');

        $totalInventoryCost = ($storeFilter === 'all')
            ? round($warehouseCostValuation + $storesCostValuation, 2)
            : round($storesCostValuation, 2);

        $potentialProfit = round(max(0, $storesRetailValuation - $storesCostValuation), 2);

        // 4. Alertas de Stock Crítico (Agotados o <= min_stock)
        $storeAlertsQuery = InventoryStore::with(['product.category', 'store'])
            ->whereRaw('stock_quantity <= min_stock');
        $storeAlertsQuery = $applyStore($storeAlertsQuery);
        $storeAlerts = $storeAlertsQuery->get()->map(function ($item) {
            return [
                'id' => $item->id,
                'location_type' => 'store',
                'location_name' => $item->store?->name ?? 'Tienda',
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name ?? 'Producto',
                'sku' => $item->product?->sku ?? '-',
                'image' => $item->product?->image,
                'thumbnail' => $item->product?->thumbnail,
                'category' => $item->product?->category?->name,
                'stock_quantity' => (float) $item->stock_quantity,
                'min_stock' => (float) $item->min_stock,
                'status' => $item->stock_quantity <= 0 ? 'out_of_stock' : 'low_stock',
            ];
        });

        $warehouseAlerts = collect();
        if ($storeFilter === 'all') {
            $warehouseAlerts = InventoryWarehouse::with(['product.category'])
                ->whereRaw('stock_quantity <= min_stock')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'location_type' => 'warehouse',
                        'location_name' => 'Almacén Central',
                        'product_id' => $item->product_id,
                        'product_name' => $item->product?->name ?? 'Producto',
                        'sku' => $item->product?->sku ?? '-',
                        'image' => $item->product?->image,
                        'thumbnail' => $item->product?->thumbnail,
                        'category' => $item->product?->category?->name,
                        'stock_quantity' => (float) $item->stock_quantity,
                        'min_stock' => (float) $item->min_stock,
                        'status' => $item->stock_quantity <= 0 ? 'out_of_stock' : 'low_stock',
                    ];
                });
        }

        $allCriticalAlerts = $storeAlerts->concat($warehouseAlerts)
            ->sortBy('stock_quantity')
            ->values();

        $criticalStockCount = $allCriticalAlerts->count();
        $outOfStockCount = $allCriticalAlerts->where('status', 'out_of_stock')->count();

        // 5. Timeline para Gráfico de Ventas (Evolución)
        $timelineData = [];
        if ($groupByHour) {
            // Horas 07:00 a 22:00
            for ($h = 7; $h <= 22; $h++) {
                $hourLabel = sprintf('%02d:00', $h);
                $hStart = $startDate->copy()->setHour($h)->setMinute(0)->setSecond(0);
                $hEnd = $startDate->copy()->setHour($h)->setMinute(59)->setSecond(59);

                $hSales = Sale::whereBetween('created_at', [$hStart, $hEnd]);
                $hSales = $applyStore($hSales);

                $timelineData[] = [
                    'key' => $hourLabel,
                    'label' => $hourLabel,
                    'sales' => round((float) $hSales->sum('total'), 2),
                    'orders' => (int) $hSales->count(),
                ];
            }
        } else {
            // Agrupar por días
            $cursor = $startDate->copy();
            while ($cursor->lte($endDate)) {
                $dayKey = $cursor->format('Y-m-d');
                $dayLabel = $cursor->format('d M');
                $dStart = $cursor->copy()->startOfDay();
                $dEnd = $cursor->copy()->endOfDay();

                $dSales = Sale::whereBetween('created_at', [$dStart, $dEnd]);
                $dSales = $applyStore($dSales);

                $timelineData[] = [
                    'key' => $dayKey,
                    'label' => $dayLabel,
                    'sales' => round((float) $dSales->sum('total'), 2),
                    'orders' => (int) $dSales->count(),
                ];
                $cursor->addDay();
            }
        }

        // 6. Métodos de Pago
        $paymentMethodsRaw = Sale::whereBetween('created_at', [$startDate, $endDate]);
        $paymentMethodsRaw = $applyStore($paymentMethodsRaw);
        $paymentMethods = $paymentMethodsRaw
            ->selectRaw("COALESCE(payment_method, 'efectivo') as method, COUNT(*) as count, SUM(total) as total")
            ->groupBy('payment_method')
            ->get()
            ->map(function ($pm) use ($totalSales) {
                $tot = (float) $pm->total;
                return [
                    'method' => strtolower($pm->method),
                    'label' => ucfirst($pm->method),
                    'count' => (int) $pm->count,
                    'total' => round($tot, 2),
                    'percentage' => $totalSales > 0 ? round(($tot / $totalSales) * 100, 1) : 0,
                ];
            });

        // 7. Rendimiento por Sucursal / Tienda
        $storesPerformance = Store::all()->map(function ($store) use ($startDate, $endDate, $totalSales) {
            $stSales = Sale::where('store_id', $store->id)
                ->whereBetween('created_at', [$startDate, $endDate]);

            $tot = (float) $stSales->sum('total');
            $cnt = (int) $stSales->count();

            return [
                'store_id' => $store->id,
                'name' => $store->name,
                'slug' => $store->slug,
                'address' => $store->address,
                'total' => round($tot, 2),
                'count' => $cnt,
                'avg_ticket' => $cnt > 0 ? round($tot / $cnt, 2) : 0.00,
                'percentage' => $totalSales > 0 ? round(($tot / $totalSales) * 100, 1) : 0,
            ];
        })->sortByDesc('total')->values();

        // 8. Top Productos Más Vendidos
        $topProductsQuery = SaleDetail::join('sales', 'sale_details.sale_id', '=', 'sales.id')
            ->whereBetween('sales.created_at', [$startDate, $endDate]);
        if ($storeFilter && $storeFilter !== 'all') {
            $topProductsQuery->where('sales.store_id', $storeFilter);
        }

        $topProducts = $topProductsQuery
            ->select(
                'sale_details.product_id',
                DB::raw('SUM(sale_details.quantity) as total_quantity'),
                DB::raw('SUM(sale_details.quantity * sale_details.price) as total_revenue')
            )
            ->groupBy('sale_details.product_id')
            ->orderByDesc('total_quantity')
            ->limit(8)
            ->get()
            ->map(function ($item) {
                $product = Product::with('category')->find($item->product_id);
                return [
                    'product_id' => $item->product_id,
                    'name' => $product?->name ?? "Producto #{$item->product_id}",
                    'sku' => $product?->sku ?? '-',
                    'image' => $product?->image,
                    'thumbnail' => $product?->thumbnail,
                    'category' => $product?->category?->name,
                    'quantity_sold' => (float) $item->total_quantity,
                    'revenue' => round((float) $item->total_revenue, 2),
                ];
            });

        // 9. Ventas Recientes en Vivo (Últimas 8)
        $recentSalesQuery = Sale::with(['user', 'customer'])
            ->orderByDesc('id')
            ->limit(8);
        $recentSalesQuery = $applyStore($recentSalesQuery);

        $storesMap = Store::pluck('name', 'id')->all();

        $recentSales = $recentSalesQuery->get()->map(function ($s) use ($storesMap) {
            $customerName = $s->customer ? $s->customer->name : ($s->name ?: 'Cliente');
            return [
                'id' => $s->id,
                'order_date' => $s->order_date ?? $s->created_at,
                'formatted_time' => Carbon::parse($s->created_at)->format('H:i d/m'),
                'customer_name' => $customerName,
                'seller_name' => $s->user?->name ?? 'Personal de Ventas',
                'store_id' => $s->store_id,
                'store_name' => $storesMap[$s->store_id] ?? "Sucursal #{$s->store_id}",
                'total' => (float) $s->total,
                'payment_method' => $s->payment_method ?? 'efectivo',
                'status' => $s->status ?? 'completado',
            ];
        });

        // 10. Conteo Global de Recursos
        $totalCustomers = Customer::count();
        $totalProducts = Product::count();
        $totalStores = Store::count();

        return response()->json([
            'meta' => [
                'period' => $period,
                'start_date' => $startDate->toDateTimeString(),
                'end_date' => $endDate->toDateTimeString(),
                'store_id' => $storeFilter,
            ],
            'kpis' => [
                'net_sales' => $netSales,
                'total_sales' => $totalSales,
                'total_discount' => $totalDiscount,
                'sales_growth' => $salesGrowth,
                'orders_count' => $ordersCount,
                'orders_growth' => $ordersGrowth,
                'avg_ticket' => $avgTicket,
                'inventory_cost_valuation' => $totalInventoryCost,
                'warehouse_cost' => round($warehouseCostValuation, 2),
                'stores_cost' => round($storesCostValuation, 2),
                'stores_retail' => round($storesRetailValuation, 2),
                'potential_profit' => $potentialProfit,
                'warehouse_items' => $warehouseItemsCount,
                'stores_items' => $storesItemsCount,
                'critical_stock_count' => $criticalStockCount,
                'out_of_stock_count' => $outOfStockCount,
                'total_products' => $totalProducts,
                'total_customers' => $totalCustomers,
                'total_stores' => $totalStores,
            ],
            'timeline' => $timelineData,
            'payment_methods' => $paymentMethods,
            'stores_performance' => $storesPerformance,
            'top_products' => $topProducts,
            'critical_alerts' => $allCriticalAlerts->take(10),
            'recent_sales' => $recentSales,
        ], 200);
    }
}
