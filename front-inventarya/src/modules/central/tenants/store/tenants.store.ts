import { create } from "zustand";
import { centralApi } from "@/api";
import { ITenant } from "@/interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface TenantsState {
  tenants: ITenant[];
  isLoading: boolean;
}

interface Actions {
  getTenants: () => Promise<void>;
  createTenant: (payload: any) => Promise<boolean>;
  updateTenant: (id: string, tenant: Partial<ITenant>) => Promise<boolean>;
  deleteTenant: (id: string) => Promise<boolean>;
  confirmPayment: (paymentId: number, receipt?: string | null, meta?: any) => Promise<boolean>;
  getTenantDatabaseInfo: (id: string) => Promise<{ database: string; host: string; tables: { name: string; rows: number }[] } | null>;
  getTablePreview: (id: string, table: string) => Promise<{ table: string; columns: any[]; rows: any[] } | null>;
  clearTableData: (id: string, table: string) => Promise<boolean>;
  checkUnique: (field: 'database' | 'slug' | 'domain' | 'email', value: string) => Promise<{ available: boolean; message?: string }>;
}

export const useTenantsStore = create<TenantsState & Actions>((set, get) => ({
  tenants: [],
  isLoading: false,

  getTenants: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get<ITenant[]>("/tenants");
      set({ tenants: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al obtener tenants", {
          description: error.response?.data.message,
        });
      }
    }
  },

  createTenant: async (payload) => {
    set({ isLoading: true });
    try {
      await centralApi.post("/tenants", payload);
      toast.success("Tenant registrado e iniciado correctamente");
      await get().getTenants();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al crear tenant", {
          description: error.response?.data.message || "Verifique los datos e intente de nuevo",
        });
      }
      return false;
    }
  },

  updateTenant: async (id, tenant) => {
    set({ isLoading: true });
    try {
      await centralApi.put(`/tenants/${id}`, tenant);
      toast.success("Tenant actualizado correctamente");
      await get().getTenants();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al actualizar tenant", {
          description: error.response?.data.message,
        });
      }
      return false;
    }
  },

  deleteTenant: async (id) => {
    try {
      await centralApi.delete(`/tenants/${id}`);
      toast.success("Tenant eliminado correctamente");
      await get().getTenants();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error("Error al eliminar tenant", {
          description: error.response?.data.message,
        });
      }
      return false;
    }
  },

  confirmPayment: async (paymentId, receipt = null, meta = {}) => {
    set({ isLoading: true });
    try {
      await centralApi.post(`/payments/${paymentId}/confirm`, { receipt, meta });
      toast.success("Pago confirmado y tenant activado correctamente");
      await get().getTenants();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al confirmar pago", {
          description: error.response?.data.message || "No se pudo activar el tenant",
        });
      }
      return false;
    }
  },

  getTenantDatabaseInfo: async (id) => {
    try {
      const { data } = await centralApi.get(`/tenants/${id}/database`);
      return data;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error("Error al obtener base de datos", {
          description: error.response?.data.message,
        });
      }
      return null;
    }
  },

  getTablePreview: async (id, table) => {
    try {
      const { data } = await centralApi.get(`/tenants/${id}/database/tables/${table}`);
      return data;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error("Error al obtener registros de la tabla", {
          description: error.response?.data.message,
        });
      }
      return null;
    }
  },

  clearTableData: async (id, table) => {
    try {
      await centralApi.delete(`/tenants/${id}/database/tables/${table}/clear`);
      toast.success(`Tabla ${table} vaciada correctamente`);
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error("Error al vaciar tabla", {
          description: error.response?.data.message || "No se pudo realizar la operación",
        });
      }
      return false;
    }
  },

  checkUnique: async (field, value) => {
    try {
      const { data } = await centralApi.post<{ available: boolean; message: string }>("/tenants/check-unique", {
        field,
        value,
      });
      return data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.data?.message) {
        return { available: false, message: error.response.data.message };
      }
      return { available: true };
    }
  },
}));
