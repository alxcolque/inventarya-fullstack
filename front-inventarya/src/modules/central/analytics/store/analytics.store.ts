import { create } from "zustand";
import { centralApi } from "@/api";

export interface RecentTenant {
  id: string;
  name: string;
  domain: string;
  status: string;
  owner_name?: string;
  owner_email?: string;
  plan_name?: string;
  created_at: string;
}

export interface PlanSubscriptionStat {
  name: string;
  count: number;
  percentage: number;
  price?: number;
}

export interface BusinessStats {
  total_tenants: number;
  new_tenants_this_month: number;
  tenants_growth: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  monthly_revenue: number;
  growth_rate: number;
  active_users: number;
  churn_rate: number;
  recent_tenants: RecentTenant[];
  subscriptions_by_plan: PlanSubscriptionStat[];
}

interface AnalyticsState {
  stats: BusinessStats | null;
  isLoading: boolean;
  error: string | null;
}

interface Actions {
  getBusinessStats: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState & Actions>((set) => ({
  stats: null,
  isLoading: false,
  error: null,

  getBusinessStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await centralApi.get<BusinessStats>("/analytics/business-stats");
      set({ stats: data, isLoading: false, error: null });
    } catch (err: any) {
      console.error("Error al cargar estadísticas reales de analytics:", err);
      set({ 
        isLoading: false, 
        error: err?.response?.data?.message || "No se pudieron obtener las métricas reales del servidor." 
      });
    }
  },
}));
