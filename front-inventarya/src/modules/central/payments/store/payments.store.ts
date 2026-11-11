import { create } from "zustand";
import { centralApi } from "@/api";
import { IPayment } from "@/interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";

interface PaymentsState {
  payments: IPayment[];
  isLoading: boolean;
}

interface Actions {
  getPayments: () => Promise<void>;
  refundPayment: (id: number, reason?: string) => Promise<boolean>;
  confirmPayment: (paymentId: number, receipt?: string | null, meta?: any) => Promise<boolean>;
}

export const usePaymentsStore = create<PaymentsState & Actions>((set, get) => ({
  payments: [],
  isLoading: false,

  getPayments: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get<IPayment[]>("/payments");
      set({ payments: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al obtener pagos", {
          description: error.response?.data.message,
        });
      }
    }
  },

  refundPayment: async (id, reason) => {
    set({ isLoading: true });
    try {
      await centralApi.post(`/payments/${id}/refund`, { reason });
      toast.success("Pago reembolsado correctamente");
      await get().getPayments();
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al reembolsar pago", {
          description: error.response?.data?.message || "No se pudo procesar el reembolso",
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
      await get().getPayments();
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
}));
