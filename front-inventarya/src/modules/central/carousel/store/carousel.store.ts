import { create } from 'zustand';
import { centralApi } from '@/api';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { ICarousel } from '../interfaces/carousel.interface';

interface CarouselState {
  carousels: ICarousel[];
  isLoading: boolean;
  isSaving: boolean;
}

interface Actions {
  getCarousels: () => Promise<void>;
  createCarousel: (data: FormData) => Promise<boolean>;
  updateCarousel: (id: number, data: FormData) => Promise<boolean>;
  deleteCarousel: (id: number) => Promise<boolean>;
  reorderCarousels: (items: { id: number; display_order: number }[]) => Promise<boolean>;
}

export const useCarouselStore = create<CarouselState & Actions>((set, get) => ({
  carousels: [],
  isLoading: false,
  isSaving: false,

  getCarousels: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get<ICarousel[]>('/carousels');
      set({ carousels: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || 'Error al cargar el carrusel'
        : 'Error al cargar el carrusel';
      toast.error('Error', { description: msg });
    }
  },

  createCarousel: async (formData) => {
    set({ isSaving: true });
    try {
      const { data } = await centralApi.post<{ message: string; carousel: ICarousel }>(
        '/carousels',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      set((state) => ({
        carousels: [...state.carousels, data.carousel].sort(
          (a, b) => a.display_order - b.display_order
        ),
        isSaving: false,
      }));
      toast.success('Slide creado', { description: data.message });
      return true;
    } catch (error) {
      set({ isSaving: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || 'Error al crear el slide'
        : 'Error al crear el slide';
      toast.error('Error', { description: msg });
      return false;
    }
  },

  updateCarousel: async (id, formData) => {
    set({ isSaving: true });
    try {
      // Laravel requires POST with _method for multipart updates
      formData.append('_method', 'PUT');
      const { data } = await centralApi.post<{ message: string; carousel: ICarousel }>(
        `/carousels/${id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      set((state) => ({
        carousels: state.carousels
          .map((c) => (c.id === id ? data.carousel : c))
          .sort((a, b) => a.display_order - b.display_order),
        isSaving: false,
      }));
      toast.success('Slide actualizado', { description: data.message });
      return true;
    } catch (error) {
      set({ isSaving: false });
      const msg = isAxiosError(error)
        ? error.response?.data?.message || 'Error al actualizar el slide'
        : 'Error al actualizar el slide';
      toast.error('Error', { description: msg });
      return false;
    }
  },

  deleteCarousel: async (id) => {
    try {
      const { data } = await centralApi.delete<{ message: string }>(`/carousels/${id}`);
      set((state) => ({
        carousels: state.carousels.filter((c) => c.id !== id),
      }));
      toast.success('Slide eliminado', { description: data.message });
      return true;
    } catch (error) {
      const msg = isAxiosError(error)
        ? error.response?.data?.message || 'Error al eliminar el slide'
        : 'Error al eliminar el slide';
      toast.error('Error', { description: msg });
      return false;
    }
  },

  reorderCarousels: async (items) => {
    try {
      await centralApi.post('/carousels/reorder', { items });
      // Update local state order
      set((state) => {
        const orderMap = new Map(items.map((i) => [i.id, i.display_order]));
        return {
          carousels: state.carousels
            .map((c) => ({ ...c, display_order: orderMap.get(c.id) ?? c.display_order }))
            .sort((a, b) => a.display_order - b.display_order),
        };
      });
      return true;
    } catch {
      toast.error('Error al guardar el orden');
      return false;
    }
  },
}));
