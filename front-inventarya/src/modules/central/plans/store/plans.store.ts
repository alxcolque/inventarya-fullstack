import { create } from "zustand";
import { centralApi } from "@/api";
import { IPlan } from "../interfaces/plan.interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface PlansState {
  plans: IPlan[];
  selectedPlan: IPlan | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface Actions {
  getPlans: () => Promise<void>;
  getPlan: (id: number) => Promise<IPlan | null>;
  createPlan: (plan: Partial<IPlan>) => Promise<boolean>;
  updatePlan: (id: number, plan: Partial<IPlan>) => Promise<boolean>;
  deletePlan: (id: number) => Promise<{ success: boolean; message?: string }>;
  togglePlanStatus: (id: number) => Promise<boolean>;
  setSelectedPlan: (plan: IPlan | null) => void;
  clearError: () => void;
}

export const usePlansStore = create<PlansState & Actions>((set, get) => ({
  plans: [],
  selectedPlan: null,
  isLoading: false,
  isSaving: false,
  error: null,

  setSelectedPlan: (plan) => set({ selectedPlan: plan }),
  clearError: () => set({ error: null }),

  getPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await centralApi.get<IPlan[]>("/plans");
      set({ plans: data, isLoading: false });
    } catch (error) {
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "No se pudieron cargar los planes."
        : "No se pudieron cargar los planes.";
      set({ isLoading: false, error: msg });
      toast.error("Error", { description: msg });
    }
  },

  getPlan: async (id: number) => {
    try {
      const { data } = await centralApi.get<IPlan>(`/plans/${id}`);
      return data;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error("Error al cargar el plan", {
          description: error.response?.data?.message || "Plan no encontrado",
        });
      }
      return null;
    }
  },

  createPlan: async (plan) => {
    set({ isSaving: true, error: null });
    try {
      await centralApi.post("/plans", plan);
      toast.success("Plan creado correctamente");
      await get().getPlans();
      set({ isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "No se pudo guardar el plan."
        : "No se pudo guardar el plan.";
      set({ error: msg });
      toast.error("Error al crear plan", { description: msg });
      return false;
    }
  },

  updatePlan: async (id, plan) => {
    set({ isSaving: true, error: null });
    try {
      await centralApi.put(`/plans/${id}`, plan);
      toast.success("Plan actualizado correctamente");
      await get().getPlans();
      set({ isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "No se pudo actualizar el plan."
        : "No se pudo actualizar el plan.";
      set({ error: msg });
      toast.error("Error al actualizar plan", { description: msg });
      return false;
    }
  },

  deletePlan: async (id) => {
    try {
      const { data } = await centralApi.delete(`/plans/${id}`);
      toast.success("Plan eliminado correctamente");
      await get().getPlans();
      return { success: true, message: data.message };
    } catch (error) {
      let msg = "No se pudo eliminar el plan.";
      if (isAxiosError(error)) {
        msg = error.response?.data?.message || msg;
      }
      toast.error("No se pudo eliminar", {
        description: msg,
        duration: 6000,
      });
      return { success: false, message: msg };
    }
  },

  togglePlanStatus: async (id) => {
    try {
      const { data } = await centralApi.patch(`/plans/${id}/toggle-status`);
      toast.success(data.message || "Estado actualizado");
      await get().getPlans();
      return true;
    } catch (error) {
      let msg = "Error al cambiar el estado del plan.";
      if (isAxiosError(error)) {
        msg = error.response?.data?.message || msg;
      }
      toast.error("Error", { description: msg });
      return false;
    }
  },
}));
