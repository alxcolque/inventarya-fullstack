import { create } from "zustand";
import { centralApi } from "@/api";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { IConfiguration, IFaqItem } from "../interfaces/configuration.interface";

interface SettingsState {
  configuration: IConfiguration | null;
  faqs: IFaqItem[];
  isLoading: boolean;
  isSaving: boolean;
  isLoadingFaqs: boolean;
  isSavingFaq: boolean;
}

interface Actions {
  getConfiguration: () => Promise<void>;
  updateConfiguration: (payload: FormData | Partial<IConfiguration>) => Promise<boolean>;
  getFaqs: () => Promise<void>;
  createFaq: (data: Partial<IFaqItem>) => Promise<boolean>;
  updateFaq: (id: number, data: Partial<IFaqItem>) => Promise<boolean>;
  deleteFaq: (id: number) => Promise<boolean>;
  toggleFaqPublished: (faq: IFaqItem) => Promise<boolean>;
}

export const useCentralSettingsStore = create<SettingsState & Actions>((set, get) => ({
  configuration: null,
  faqs: [],
  isLoading: false,
  isSaving: false,
  isLoadingFaqs: false,
  isSavingFaq: false,

  getConfiguration: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get<IConfiguration>("/configurations");
      set({ configuration: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "Error al cargar configuración"
        : "Error al cargar configuración";
      toast.error("Error", { description: msg });
    }
  },

  updateConfiguration: async (payload) => {
    set({ isSaving: true });
    try {
      const headers = payload instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined;
      const { data } = await centralApi.post<{ message: string; configuration: IConfiguration }>(
        "/configurations",
        payload,
        { headers }
      );
      set({ configuration: data.configuration, isSaving: false });
      toast.success("Configuración actualizada", {
        description: data.message || "Los cambios se aplicaron exitosamente.",
      });
      return true;
    } catch (error) {
      set({ isSaving: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "Error al actualizar configuración"
        : "Error al actualizar configuración";
      toast.error("Error al guardar", { description: msg });
      return false;
    }
  },

  getFaqs: async () => {
    set({ isLoadingFaqs: true });
    try {
      const { data } = await centralApi.get<IFaqItem[]>("/faqs");
      set({ faqs: data, isLoadingFaqs: false });
    } catch (error) {
      set({ isLoadingFaqs: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "Error al cargar preguntas frecuentes"
        : "Error al cargar preguntas frecuentes";
      toast.error("Error", { description: msg });
    }
  },

  createFaq: async (faqData) => {
    set({ isSavingFaq: true });
    try {
      const { data } = await centralApi.post<{ message: string; faq: IFaqItem }>("/faqs", faqData);
      set((state) => ({
        faqs: [...state.faqs, data.faq].sort((a, b) => a.sort_order - b.sort_order),
        isSavingFaq: false,
      }));
      toast.success("Pregunta creada", { description: data.message });
      return true;
    } catch (error) {
      set({ isSavingFaq: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "Error al crear la pregunta"
        : "Error al crear la pregunta";
      toast.error("Error", { description: msg });
      return false;
    }
  },

  updateFaq: async (id, faqData) => {
    set({ isSavingFaq: true });
    try {
      const { data } = await centralApi.put<{ message: string; faq: IFaqItem }>(`/faqs/${id}`, faqData);
      set((state) => ({
        faqs: state.faqs
          .map((f) => (f.id === id ? data.faq : f))
          .sort((a, b) => a.sort_order - b.sort_order),
        isSavingFaq: false,
      }));
      toast.success("Pregunta actualizada", { description: data.message });
      return true;
    } catch (error) {
      set({ isSavingFaq: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "Error al actualizar la pregunta"
        : "Error al actualizar la pregunta";
      toast.error("Error", { description: msg });
      return false;
    }
  },

  deleteFaq: async (id) => {
    try {
      const { data } = await centralApi.delete<{ message: string }>(`/faqs/${id}`);
      set((state) => ({
        faqs: state.faqs.filter((f) => f.id !== id),
      }));
      toast.success("Pregunta eliminada", { description: data.message });
      return true;
    } catch (error) {
      const msg = isAxiosError(error)
        ? error.response?.data?.message || "Error al eliminar la pregunta"
        : "Error al eliminar la pregunta";
      toast.error("Error", { description: msg });
      return false;
    }
  },

  toggleFaqPublished: async (faq) => {
    const updatedStatus = !faq.is_published;
    return get().updateFaq(faq.id, { is_published: updatedStatus });
  },
}));
