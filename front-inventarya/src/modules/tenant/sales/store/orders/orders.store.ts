import { create, StateCreator } from "zustand";
import { ISaleResponse } from "@/interface";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";

interface OrdersState {
  sales: any[];
  isLoading: boolean;
}

interface Actions {
  getSales: (params?: { store_id?: string; from_date?: string; to_date?: string }, token?: string) => Promise<void>;
  getSalesInStore: (slug: string, paramsOrToken?: { from_date?: string; to_date?: string } | string, token?: string) => Promise<void>;
  createSale: (data: any, token?: string) => Promise<any>;
}

const storeApi: StateCreator<OrdersState & Actions> = (set) => ({
  sales: [],
  isLoading: false,

  getSales: async (params) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.get('/sales', { params: params || {} });
      set({ sales: response.data.sales || [], isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al obtener ventas');
      }
    }
  },

  getSalesInStore: async (slug: string, paramsOrToken?: any) => {
    set({ isLoading: true });
    try {
      const params = typeof paramsOrToken === 'object' && paramsOrToken !== null ? paramsOrToken : {};
      const response = await tenantApi.get(`/sales-get-by-store-id/${slug}`, { params });
      set({ sales: response.data.sales || [], isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al obtener ventas de la tienda');
      }
    }
  },

  createSale: async (data: any, _token?: string) => {
    try {
        const response = await tenantApi.post('/sales', data);
        toast.success(response.data.message || 'Venta registrada con éxito');
        return response.data;
    } catch (error) {
        if (isAxiosError(error)) {
          toast.error(error.response?.data?.message || 'Error al registrar la venta');
        }
        throw error;
    }
  }
});

export const useOrdersStore = create<OrdersState & Actions>()(storeApi);
