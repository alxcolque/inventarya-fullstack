import { create } from "zustand";
import { centralApi } from "@/api";
import { ISubscription, ISubscriptionStats } from "../interfaces/subscription.interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface SubscriptionsState {
  subscriptions: ISubscription[];
  stats: ISubscriptionStats | null;
  isLoading: boolean;
}

interface Actions {
  getSubscriptions: () => Promise<void>;
  getStats: () => Promise<void>;
  assignPlan: (tenantId: string, planId: number, billingCycle?: string) => Promise<boolean>;
  activateTrial: (tenantId: string, planId: number, trialDays?: number) => Promise<boolean>;
  changePlan: (subscriptionId: number, planId: number, billingCycle?: string) => Promise<boolean>;
  cancelSubscription: (subscriptionId: number) => Promise<boolean>;
  updateSubscription: (id: number, subscription: Partial<ISubscription>) => Promise<boolean>;
}

export const useSubscriptionsStore = create<SubscriptionsState & Actions>((set, get) => ({
  subscriptions: [],
  stats: null,
  isLoading: false,

  getSubscriptions: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get<ISubscription[]>("/subscriptions");
      set({ subscriptions: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al obtener suscripciones", {
          description: error.response?.data?.message,
        });
      }
    }
  },

  getStats: async () => {
    try {
      const { data } = await centralApi.get<ISubscriptionStats>("/subscriptions/stats");
      set({ stats: data });
    } catch (error) {
      // Non-critical, fail silently or with console log
      console.error("Error al obtener estadísticas de suscripciones", error);
    }
  },

  assignPlan: async (tenantId: string, planId: number, billingCycle = "monthly") => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.post("/subscriptions/assign", {
        tenant_id: tenantId,
        plan_id: planId,
        billing_cycle: billingCycle,
      });
      toast.success(data.message || "Plan asignado correctamente");
      await get().getSubscriptions();
      await get().getStats();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al asignar plan", {
          description: error.response?.data?.message || "Ocurrió un error al procesar la solicitud.",
        });
      }
      return false;
    }
  },

  activateTrial: async (tenantId: string, planId: number, trialDays?: number) => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.post("/subscriptions/activate-trial", {
        tenant_id: tenantId,
        plan_id: planId,
        trial_days: trialDays,
      });
      toast.success(data.message || "Prueba activada correctamente");
      await get().getSubscriptions();
      await get().getStats();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al activar período de prueba", {
          description: error.response?.data?.message || "Ocurrió un error al procesar la solicitud.",
        });
      }
      return false;
    }
  },

  changePlan: async (subscriptionId: number, planId: number, billingCycle = "monthly") => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.post(`/subscriptions/${subscriptionId}/change-plan`, {
        plan_id: planId,
        billing_cycle: billingCycle,
      });
      toast.success(data.message || "Plan actualizado correctamente");
      await get().getSubscriptions();
      await get().getStats();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al cambiar plan", {
          description: error.response?.data?.message || "Ocurrió un error al cambiar de plan.",
        });
      }
      return false;
    }
  },

  cancelSubscription: async (subscriptionId: number) => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.post(`/subscriptions/${subscriptionId}/cancel`);
      toast.success(data.message || "Suscripción cancelada correctamente");
      await get().getSubscriptions();
      await get().getStats();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al cancelar suscripción", {
          description: error.response?.data?.message || "Ocurrió un error al cancelar la suscripción.",
        });
      }
      return false;
    }
  },

  updateSubscription: async (id, subscription) => {
    set({ isLoading: true });
    try {
      await centralApi.put(`/subscriptions/${id}`, subscription);
      toast.success("Suscripción actualizada correctamente");
      await get().getSubscriptions();
      await get().getStats();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al actualizar suscripción", {
          description: error.response?.data?.message,
        });
      }
      return false;
    }
  },
}));
