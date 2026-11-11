import { create, StateCreator } from "zustand";
import { ICategoryResponse } from "@/interface";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";

import { categoryMoveError, sameId, withCategoryParent } from '../../utils/categoryHierarchy';

interface CategoriesState {
  isMoving: boolean;
  categories: ICategoryResponse[];
  category: ICategoryResponse;
}
interface Actions {
  moveCategory: (id: number, parentId: number | null) => Promise<boolean>;
  getCategories: (token?: string) => Promise<void>;
  getCategory: (id: number, token?: string) => Promise<void>;
  createCategory: (data: any, token?: string) => Promise<boolean>;
  updateCategory: (id: number, data: any, token?: string) => Promise<boolean>;
  deleteCategory: (id: number, token?: string) => Promise<boolean>;
  deleteAllCategories: () => Promise<boolean>;
}

const storeApi: StateCreator<CategoriesState & Actions> = (set, get) => ({
  categories: [],
  isMoving: false,
  moveCategory: async (id, parentId) => {
    if (get().isMoving) return false;
    const current = get().categories.find((item) => sameId(item.id, id));
    if (!current) return false;
    if (sameId(current.parent_id, parentId)) return true;
    const error = categoryMoveError(get().categories, id, parentId);
    if (error) { toast.error(error); return false; }
    const previousParent = current.parent_id ?? null;
    set({ isMoving: true, categories: withCategoryParent(get().categories, id, parentId) });
    try {
      const response = await tenantApi.patch<{ message: string; category: ICategoryResponse }>('/categories/' + id, { parent_id: parentId });
      const updated = response.data.category;
      set((state) => ({
        categories: withCategoryParent(state.categories.map((item) => sameId(item.id, id) ? { ...item, ...updated } : item), id, updated.parent_id ?? null),
        category: sameId(state.category.id, id) ? { ...state.category, ...updated } : state.category,
      }));
      toast.success(response.data.message || 'Jerarquía de categoría actualizada correctamente.');
      return true;
    } catch (error) {
      set((state) => ({ categories: withCategoryParent(state.categories, id, previousParent) }));
      const message = isAxiosError(error)
        ? Object.values(error.response?.data?.errors ?? {}).flat().join(' ') || error.response?.data?.message
        : null;
      toast.error(message || 'No se pudo actualizar la jerarquía. Se restauró la categoría.');
      return false;
    } finally {
      set({ isMoving: false });
    }
  },
  category: {} as ICategoryResponse,
  getCategories: async () => {
    try {
      const response = await tenantApi.get('/categories');
      set({ categories: response.data as any });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al cargar categorías');
      }
    }
  },
  getCategory: async (id: number) => {
    try {
      const response = await tenantApi.get(`/categories/${id}`);
      set({ category: response.data as ICategoryResponse });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al cargar categoría');
      }
    }
  },
  createCategory: async (data: any) => {
    try {
      const response = await tenantApi.post('/categories', data);
      toast.success(response.data.message || 'Categoría creada correctamente');
      await get().getCategories();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(' ')
            : error.response?.data?.message || 'Error al crear categoría';
        toast.error(errorMsg);
      }
      return false;
    }
  },
  updateCategory: async (id: number, data: any) => {
    try {
      const response = await tenantApi.put(`/categories/${id}`, data);
      toast.success(response.data.message || 'Categoría actualizada correctamente');
      await get().getCategories();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(' ')
            : error.response?.data?.message || 'Error al actualizar categoría';
        toast.error(errorMsg);
      }
      return false;
    }
  },
  deleteCategory: async (id: number) => {
    try {
      const response = await tenantApi.delete(`/categories/${id}`);
      toast.success(response.data.message || 'Categoría eliminada');
      await get().getCategories();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al eliminar categoría');
      }
      return false;
    }
  },
  deleteAllCategories: async () => {
    try {
      const response = await tenantApi.delete<{ message: string; deleted_count: number }>('/categories/destroy-all');
      toast.success(response.data.message || 'Todas las categorías han sido eliminadas');
      set({ categories: [] });
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Error al eliminar todas las categorías');
      }
      return false;
    }
  },
});

export const useCategoriesStore = create<CategoriesState & Actions>()(storeApi);
