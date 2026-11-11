import { create, StateCreator } from "zustand";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";

export interface DashboardKpis {
    net_sales: number;
    total_sales: number;
    total_discount: number;
    sales_growth: number;
    orders_count: number;
    orders_growth: number;
    avg_ticket: number;
    inventory_cost_valuation: number;
    warehouse_cost: number;
    stores_cost: number;
    stores_retail: number;
    potential_profit: number;
    warehouse_items: number;
    stores_items: number;
    critical_stock_count: number;
    out_of_stock_count: number;
    total_products: number;
    total_customers: number;
    total_stores: number;
}

export interface TimelinePoint {
    key: string;
    label: string;
    sales: number;
    orders: number;
}

export interface PaymentMethodItem {
    method: string;
    label: string;
    count: number;
    total: number;
    percentage: number;
}

export interface StorePerformanceItem {
    store_id: string | number;
    name: string;
    slug: string;
    address?: string;
    total: number;
    count: number;
    avg_ticket: number;
    percentage: number;
}

export interface TopProductItem {
    product_id: string | number;
    name: string;
    sku: string;
    image?: string;
    thumbnail?: string;
    category: string;
    quantity_sold: number;
    revenue: number;
}

export interface CriticalAlertItem {
    id: string | number;
    location_type: 'store' | 'warehouse';
    location_name: string;
    product_id: string | number;
    product_name: string;
    sku: string;
    image?: string;
    thumbnail?: string;
    category: string;
    stock_quantity: number;
    min_stock: number;
    status: 'out_of_stock' | 'low_stock';
}

export interface RecentSaleItem {
    id: string | number;
    order_date: string;
    formatted_time: string;
    customer_name: string;
    seller_name: string;
    store_id: string | number;
    store_name: string;
    total: number;
    payment_method: string;
    status: string;
}

export interface DashboardSummary {
    meta: {
        period: string;
        start_date: string;
        end_date: string;
        store_id: string;
    };
    kpis: DashboardKpis;
    timeline: TimelinePoint[];
    payment_methods: PaymentMethodItem[];
    stores_performance: StorePerformanceItem[];
    top_products: TopProductItem[];
    critical_alerts: CriticalAlertItem[];
    recent_sales: RecentSaleItem[];
}

interface DashboardState {
    summary: DashboardSummary | null;
    isLoading: boolean;
    isRefreshing: boolean;
    period: string;
    storeFilter: string;
    startDate: string | null;
    endDate: string | null;
    backup: any;
}

interface DashboardActions {
    fetchSummary: (opts?: {
        period?: string;
        store_id?: string;
        start_date?: string;
        end_date?: string;
        silent?: boolean;
    }) => Promise<void>;
    setPeriod: (period: string) => void;
    setStoreFilter: (storeId: string) => void;
    setDateRange: (start: string | null, end: string | null) => void;
    getBackup: (token?: string) => Promise<void>;
}

const storeApi: StateCreator<DashboardState & DashboardActions> = (set, get) => ({
    summary: null,
    isLoading: true,
    isRefreshing: false,
    period: "30days",
    storeFilter: "all",
    startDate: null,
    endDate: null,
    backup: {},

    fetchSummary: async (opts) => {
        const { period, storeFilter, startDate, endDate, summary } = get();
        const activePeriod = opts?.period ?? period;
        const activeStore = opts?.store_id ?? storeFilter;
        const activeStart = opts?.start_date ?? startDate;
        const activeEnd = opts?.end_date ?? endDate;

        const isFirstLoad = !summary;
        if (isFirstLoad) {
            set({ isLoading: true });
        } else {
            set({ isRefreshing: true });
        }

        try {
            const params: Record<string, string> = {
                period: activePeriod,
                store_id: activeStore,
            };
            if (activeStart) params.start_date = activeStart;
            if (activeEnd) params.end_date = activeEnd;

            const response = await tenantApi.get<DashboardSummary>('/dashboard/summary', { params });
            set({
                summary: response.data,
                period: activePeriod,
                storeFilter: activeStore,
                startDate: activeStart,
                endDate: activeEnd,
                isLoading: false,
                isRefreshing: false,
            });
        } catch (error) {
            set({ isLoading: false, isRefreshing: false });
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || "Error al cargar datos del dashboard");
            }
        }
    },

    setPeriod: (period: string) => {
        set({ period });
        get().fetchSummary({ period });
    },

    setStoreFilter: (storeFilter: string) => {
        set({ storeFilter });
        get().fetchSummary({ store_id: storeFilter });
    },

    setDateRange: (start: string | null, end: string | null) => {
        set({ startDate: start, endDate: end, period: "custom" });
        get().fetchSummary({
            period: "custom",
            start_date: start || undefined,
            end_date: end || undefined,
        });
    },

    getBackup: async () => {
        try {
            const response = await tenantApi.get('/download-backup');
            if (response.data.message === "404") {
                toast.error(response.data.message);
            } else {
                toast.success("Copia de seguridad generada correctamente");
                set({ backup: response.data });
            }
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || "Error al generar copia de seguridad");
            }
        }
    },
});

export const useHomeStore = create<DashboardState & DashboardActions>()(storeApi);
