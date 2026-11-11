import { create, StateCreator } from "zustand";

import { isAxiosError } from "axios";
import { toast } from "sonner";

//import { customers } from "@/api/systemdata";
import { ICustomerResponse } from "@/interface";
import { tenantApi } from "@/api";

interface CustomersState {
  customers: ICustomerResponse[];
  customer: ICustomerResponse;
}
interface Actions {
  getCustomers: (token?: string) => Promise<void>;
  getCustomer: (id: number, token?: string) => Promise<void>;
  createCustomer: (customer: any, token?: string) => Promise<boolean>;
  updateCustomer: (id: number, customer: any, token?: string) => Promise<boolean>;
  deleteCustomer: (id: number, token?: string) => Promise<boolean>;
}

const storeApi: StateCreator<CustomersState & Actions> = (set, get) => ({
  customers: [],
  customer: {} as ICustomerResponse,
  getCustomers: async () => {
    try {
      const response = await tenantApi.get('/customers');
      set({ customers: response.data as any });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al cargar clientes');
      }
    }
  },
  getCustomer: async (id: number) => {
    try {
      const response = await tenantApi.get(`/customers/${id}`);
      set({ customer: response.data as any });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al cargar cliente');
      }
    }
  },
  createCustomer: async (customer: any) => {
    try {
      const response = await tenantApi.post('/customers', customer);
      toast.success(response.data.message || 'Cliente registrado correctamente');
      await get().getCustomers();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(' ')
            : error.response?.data?.message || 'Error al crear cliente';
        toast.error(errorMsg);
      }
      return false;
    }
  },
  updateCustomer: async (id: number, customer: any) => {
    try {
      const response = await tenantApi.put(`/customers/${id}`, customer);
      toast.success(response.data.message || 'Cliente actualizado correctamente');
      await get().getCustomers();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(' ')
            : error.response?.data?.message || 'Error al actualizar cliente';
        toast.error(errorMsg);
      }
      return false;
    }
  },
  deleteCustomer: async (id: number) => {
    try {
      const response = await tenantApi.delete(`/customers/${id}`);
      toast.success(response.data.message || 'Cliente eliminado');
      await get().getCustomers();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al eliminar cliente');
      }
      return false;
    }
  },
});

export const useCustomerStore = create<CustomersState & Actions>()(storeApi);
