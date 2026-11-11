import { create } from "zustand";
import { centralApi } from "@/api";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface MonitoringState {
  logs: any[];
  isLoading: boolean;
}

interface Actions {
  getLogs: () => Promise<void>;
}

export const useMonitoringStore = create<MonitoringState & Actions>((set) => ({
  logs: [],
  isLoading: false,

  getLogs: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get("/monitoring/logs");
      set({ logs: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al obtener logs de monitoreo", {
          description: error.response?.data.message,
        });
      }
    }
  },
}));
