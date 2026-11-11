import { create, StateCreator } from "zustand";
import { ILocationResponse } from "@/interface";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";

interface LocationsState {
  locations: ILocationResponse[];
  location: ILocationResponse | null;
  isLoading: boolean;
}

interface Actions {
  getLocations: (rootsOnly?: boolean) => Promise<void>;
  getLocation: (id: number) => Promise<void>;
  createLocation: (data: Partial<ILocationResponse>) => Promise<boolean>;
  updateLocation: (id: number, data: Partial<ILocationResponse>) => Promise<boolean>;
  deleteLocation: (id: number) => Promise<boolean>;
}

const storeApi: StateCreator<LocationsState & Actions> = (set, get) => ({
  locations: [],
  location: null,
  isLoading: false,
  getLocations: async (rootsOnly = false) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.get("/locations", {
        params: rootsOnly ? { roots_only: 1 } : {},
      });
      set({ locations: response.data as ILocationResponse[] });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al cargar ubicaciones");
      }
    } finally {
      set({ isLoading: false });
    }
  },
  getLocation: async (id: number) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.get(`/locations/${id}`);
      set({ location: response.data as ILocationResponse });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al obtener ubicación");
      }
    } finally {
      set({ isLoading: false });
    }
  },
  createLocation: async (data: Partial<ILocationResponse>) => {
    try {
      const response = await tenantApi.post("/locations", data);
      toast.success(response.data.message || "Ubicación creada correctamente");
      await get().getLocations();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(" ")
            : error.response?.data?.message || "Error al crear ubicación";
        toast.error(errorMsg);
      }
      return false;
    }
  },
  updateLocation: async (id: number, data: Partial<ILocationResponse>) => {
    try {
      const response = await tenantApi.put(`/locations/${id}`, data);
      toast.success(response.data.message || "Ubicación actualizada correctamente");
      await get().getLocations();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(" ")
            : error.response?.data?.message || "Error al actualizar ubicación";
        toast.error(errorMsg);
      }
      return false;
    }
  },
  deleteLocation: async (id: number) => {
    try {
      const response = await tenantApi.delete(`/locations/${id}`);
      toast.success(response.data.message || "Ubicación eliminada correctamente");
      await get().getLocations();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al eliminar ubicación");
      }
      return false;
    }
  },
});

export const useLocationsStore = create<LocationsState & Actions>()(storeApi);
