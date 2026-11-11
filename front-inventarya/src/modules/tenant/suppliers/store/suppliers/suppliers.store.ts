import { create, StateCreator } from "zustand";

import { isAxiosError } from "axios";
import { toast } from "sonner";

//import { suppliers } from "@/api/systemdata";

import { ISupplierResponse } from "@/interface";
import { tenantApi } from "@/api";

interface SuppliersState {
  suppliers: ISupplierResponse[];
  supplier: ISupplierResponse;
}
interface Actions {
  getSuppliers: (token?: string) => void;
  getSupplier: (id: number, token?: string) => Promise<void>;
  createSupplier: (supplier: ISupplierResponse, token?: string) => Promise<void>;
  updateSupplier: (id: number, supplier: ISupplierResponse, token?: string) => Promise<void>;
  deleteSupplier: (id: number, token?: string) => Promise<void>;
}

const storeApi: StateCreator<SuppliersState & Actions> = (set, get) => ({
  suppliers: [],
  supplier: {} as ISupplierResponse,
  getSuppliers: async () => {
    try {
      const response = await tenantApi.get('/suppliers');
      set({ suppliers: response.data as any });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  },
  getSupplier: async (id: number)=> {
    try {
      const response = await tenantApi.get(`/suppliers/${id}`);
      set({ supplier: response.data as ISupplierResponse });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  },
  createSupplier: async (supplier: ISupplierResponse) => {
    try {
      const response = await tenantApi.post('/suppliers', supplier);
      toast.success(response.data.message);
      get().getSuppliers();
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  },
  updateSupplier: async (id: number, supplier: ISupplierResponse) => {
    try {
      const response = await tenantApi.put(`/suppliers/${id}`, supplier);
      toast.success(response.data.message); 
      get().getSuppliers();
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  },
  deleteSupplier: async (id: number) => {
    try {
      const response = await tenantApi.delete(`/suppliers/${id}`);
      toast.success(response.data.message);
      get().getSuppliers();
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  } 
});

export const useSupplierStore = create<SuppliersState & Actions>()(storeApi);