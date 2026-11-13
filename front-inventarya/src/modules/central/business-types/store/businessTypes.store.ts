import { create } from "zustand";
import { centralApi } from "@/api";
import {
  IBusinessType,
  IBusinessTypeField,
  IBusinessTypeOption,
  IBusinessTypesPaginatedResponse,
} from "../interfaces/business-type.interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface BusinessTypesState {
  businessTypes: IBusinessType[];
  options: IBusinessTypeOption[];
  currentType: IBusinessType | null;
  fields: IBusinessTypeField[];
  isLocked: boolean;
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
  isLoading: boolean;
  isSaving: boolean;
}

interface BusinessTypesActions {
  getBusinessTypes: (params?: { search?: string; page?: number; per_page?: number }) => Promise<void>;
  getActiveOptions: () => Promise<IBusinessTypeOption[]>;
  getBusinessTypeDetail: (id: number) => Promise<IBusinessType | null>;
  createBusinessType: (payload: Partial<IBusinessType>) => Promise<boolean>;
  updateBusinessType: (id: number, payload: Partial<IBusinessType>) => Promise<boolean>;
  toggleBusinessTypeStatus: (id: number) => Promise<boolean>;
  deleteBusinessType: (id: number) => Promise<{ success: boolean; message?: string }>;
  createField: (typeId: number, payload: Partial<IBusinessTypeField>) => Promise<boolean>;
  updateField: (typeId: number, fieldId: number, payload: Partial<IBusinessTypeField>) => Promise<boolean>;
  toggleFieldStatus: (typeId: number, fieldId: number) => Promise<boolean>;
  deleteField: (typeId: number, fieldId: number) => Promise<boolean>;
  reorderFields: (typeId: number, order: number[]) => Promise<boolean>;
}

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError(error)) return fallback;
  const data = error.response?.data;
  if (data?.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors).flat()[0];
    if (typeof first === "string") return first;
  }
  return data?.message || data?.error || fallback;
};

export const useBusinessTypesStore = create<BusinessTypesState & BusinessTypesActions>((set, get) => ({
  businessTypes: [],
  options: [],
  currentType: null,
  fields: [],
  isLocked: false,
  meta: {
    total: 0,
    per_page: 15,
    current_page: 1,
    last_page: 1,
  },
  isLoading: false,
  isSaving: false,

  getBusinessTypes: async (params = {}) => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get<IBusinessTypesPaginatedResponse>("/business-types", {
        params,
      });
      set({
        businessTypes: data.data ?? [],
        meta: data.meta ?? { total: 0, per_page: 15, current_page: 1, last_page: 1 },
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      toast.error("Error al cargar tipos de negocio", {
        description: extractErrorMessage(error, "No se pudieron obtener los tipos de negocio."),
      });
    }
  },

  getActiveOptions: async () => {
    try {
      const { data } = await centralApi.get<IBusinessTypeOption[]>("/business-types/options");
      set({ options: Array.isArray(data) ? data : [] });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  getBusinessTypeDetail: async (id: number) => {
    set({ isLoading: true });
    try {
      const [typeRes, fieldsRes] = await Promise.all([
        centralApi.get<IBusinessType>(`/business-types/${id}`),
        centralApi.get<{ is_locked: boolean; fields: IBusinessTypeField[] }>(`/business-types/${id}/fields`),
      ]);
      set({
        currentType: typeRes.data,
        fields: fieldsRes.data.fields ?? [],
        isLocked: Boolean(fieldsRes.data.is_locked),
        isLoading: false,
      });
      return typeRes.data;
    } catch (error) {
      set({ isLoading: false });
      toast.error("Error al cargar tipo de negocio", {
        description: extractErrorMessage(error, "No se encontró el tipo de negocio."),
      });
      return null;
    }
  },

  createBusinessType: async (payload) => {
    set({ isSaving: true });
    try {
      await centralApi.post("/business-types", payload);
      toast.success("Tipo de negocio creado correctamente");
      set({ isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("No se pudo crear", {
        description: extractErrorMessage(error, "Verifica los datos ingresados."),
      });
      return false;
    }
  },

  updateBusinessType: async (id, payload) => {
    set({ isSaving: true });
    try {
      const { data } = await centralApi.put<{ business_type: IBusinessType }>(`/business-types/${id}`, payload);
      toast.success("Tipo de negocio actualizado correctamente");
      if (get().currentType?.id === id) {
        set({ currentType: { ...get().currentType!, ...data.business_type } });
      }
      set({ isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("No se pudo actualizar", {
        description: extractErrorMessage(error, "Verifica los datos ingresados."),
      });
      return false;
    }
  },

  toggleBusinessTypeStatus: async (id) => {
    set({ isSaving: true });
    try {
      const { data } = await centralApi.patch<{ message: string; business_type: IBusinessType }>(
        `/business-types/${id}/toggle-status`
      );
      toast.success(data.message || "Estado actualizado");
      set((state) => ({
        businessTypes: state.businessTypes.map((t) =>
          t.id === id ? { ...t, is_active: data.business_type.is_active } : t
        ),
        currentType:
          state.currentType?.id === id
            ? { ...state.currentType, is_active: data.business_type.is_active }
            : state.currentType,
        isSaving: false,
      }));
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("Error", {
        description: extractErrorMessage(error, "No se pudo cambiar el estado."),
      });
      return false;
    }
  },

  deleteBusinessType: async (id) => {
    set({ isSaving: true });
    try {
      const { data } = await centralApi.delete<{ message: string }>(`/business-types/${id}`);
      toast.success(data.message || "Tipo de negocio eliminado correctamente");
      set({ isSaving: false });
      return { success: true, message: data.message };
    } catch (error) {
      set({ isSaving: false });
      const msg = extractErrorMessage(error, "No se pudo eliminar el tipo de negocio.");
      toast.error("No se pudo eliminar", { description: msg, duration: 6000 });
      return { success: false, message: msg };
    }
  },

  createField: async (typeId, payload) => {
    set({ isSaving: true });
    try {
      await centralApi.post(`/business-types/${typeId}/fields`, payload);
      toast.success("Campo agregado correctamente");
      await get().getBusinessTypeDetail(typeId);
      set({ isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("Error al crear campo", {
        description: extractErrorMessage(error, "Verifica los datos del campo."),
      });
      return false;
    }
  },

  updateField: async (typeId, fieldId, payload) => {
    set({ isSaving: true });
    try {
      await centralApi.put(`/business-types/${typeId}/fields/${fieldId}`, payload);
      toast.success("Campo actualizado correctamente");
      await get().getBusinessTypeDetail(typeId);
      set({ isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("Error al actualizar campo", {
        description: extractErrorMessage(error, "No se pudo actualizar el campo."),
      });
      return false;
    }
  },

  toggleFieldStatus: async (typeId, fieldId) => {
    set({ isSaving: true });
    try {
      const { data } = await centralApi.patch<{ message: string; field: IBusinessTypeField }>(
        `/business-types/${typeId}/fields/${fieldId}/toggle-status`
      );
      toast.success(data.message || "Estado del campo actualizado");
      set((state) => ({
        fields: state.fields.map((f) => (f.id === fieldId ? data.field : f)),
        isSaving: false,
      }));
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("Error", {
        description: extractErrorMessage(error, "No se pudo cambiar el estado del campo."),
      });
      return false;
    }
  },

  deleteField: async (typeId, fieldId) => {
    set({ isSaving: true });
    try {
      await centralApi.delete(`/business-types/${typeId}/fields/${fieldId}`);
      toast.success("Campo eliminado correctamente");
      await get().getBusinessTypeDetail(typeId);
      set({ isSaving: false });
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("No se pudo eliminar", {
        description: extractErrorMessage(error, "No se pudo eliminar el campo."),
      });
      return false;
    }
  },

  reorderFields: async (typeId, order) => {
    set({ isSaving: true });
    try {
      const { data } = await centralApi.post<{ fields: IBusinessTypeField[] }>(
        `/business-types/${typeId}/fields/reorder`,
        { order }
      );
      set({ fields: data.fields ?? [], isSaving: false });
      toast.success("Orden actualizado");
      return true;
    } catch (error) {
      set({ isSaving: false });
      toast.error("Error al reordenar", {
        description: extractErrorMessage(error, "No se pudo actualizar el orden."),
      });
      return false;
    }
  },
}));

