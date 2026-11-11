import { create } from "zustand";
import { tenantApi } from "@/api/tenant/tenantApi";
import { ITenantPlanInfo, IAvailablePlan } from "../interfaces/tenant-plan.interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface TenantPlanState {
  planInfo: ITenantPlanInfo | null;
  availablePlans: IAvailablePlan[];
  isLoading: boolean;
  isLoadingPlans: boolean;
}

interface TenantPlanActions {
  getMyPlan: () => Promise<void>;
  getAvailablePlans: () => Promise<void>;
}

export const useTenantPlanStore = create<TenantPlanState & TenantPlanActions>((set) => ({
  planInfo: null,
  availablePlans: [],
  isLoading: false,
  isLoadingPlans: false,

  getMyPlan: async () => {
    set({ isLoading: true });
    try {
      const { data } = await tenantApi.get<ITenantPlanInfo>("/my-plan");
      set({ planInfo: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        console.error("Error al cargar plan de tenant:", error.response?.data);
      }
    }
  },

  getAvailablePlans: async () => {
    set({ isLoadingPlans: true });
    try {
      const { data } = await tenantApi.get<IAvailablePlan[]>("/available-plans");
      set({ availablePlans: data, isLoadingPlans: false });
    } catch (error) {
      set({ isLoadingPlans: false });
      if (isAxiosError(error)) {
        console.error("Error al cargar planes disponibles:", error.response?.data);
      }
    }
  },
}));
