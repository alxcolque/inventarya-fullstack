import { create } from "zustand";
import { centralApi } from "@/api";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface DeveloperState {
  systemInfo: any;
  isLoading: boolean;
}

interface Actions {
  getSystemInfo: () => Promise<void>;
}

export const useDeveloperStore = create<DeveloperState & Actions>((set) => ({
  systemInfo: null,
  isLoading: false,

  getSystemInfo: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get("/developer/system-info");
      set({ systemInfo: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al obtener información del sistema", {
          description: error.response?.data.message,
        });
      }
    }
  },
}));
