import { create, StateCreator } from "zustand";
import { IListWarehouseResponse } from "@/interface";
import { tenantApi } from "@/api";
import { toast } from "sonner";
import { isAxiosError } from "axios";

export interface WarehouseSummary {
  total_products: number;
  total_stock: number;
  total_value: number;
  out_of_stock: number;
  low_stock: number;
  totalProducts?: number;
  totalStock?: number;
  totalValue?: number;
  outOfStock?: number;
  lowStock?: number;
}

export interface PurchaseCatalogProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  thumbnail: string | null;
  image: string | null;
  category_id: number | string | null;
  category: string;
  category_path: string;
  color: string;
  brand_id: number | string | null;
  brand: string;
  price: number;
  unit: string;
  is_in_warehouse: boolean;
  created_at?: string;
}

interface WarehouseState {
  warehouseProducts: IListWarehouseResponse[];
  categories: any[];
  registeredProductIds: (number | string)[];
  summary: WarehouseSummary | null;
  isLoadingSummary: boolean;
  isLoadingProducts: boolean;
  isLoadingMore: boolean;
  nextCursor: string | null;
  hasMore: boolean;

  // Purchase catalog (for ModalRegisterPurchase)
  purchaseProducts: PurchaseCatalogProduct[];
  purchaseNextCursor: string | null;
  purchaseHasMore: boolean;
  isLoadingPurchaseProducts: boolean;
  isLoadingMorePurchaseProducts: boolean;
}

interface Actions {
  getWarehouseProducts: (params?: Record<string, any>, token?: string) => Promise<void>;
  loadMoreWarehouseProducts: (params?: Record<string, any>) => Promise<void>;
  getSummary: (token?: string) => Promise<WarehouseSummary | null>;
  resetPagination: () => void;

  getPurchaseProducts: (params?: Record<string, any>) => Promise<void>;
  loadMorePurchaseProducts: (params?: Record<string, any>) => Promise<void>;
  resetPurchasePagination: () => void;

  getCategories: (token?: string) => Promise<void>;
  getRegisteredProductIds: () => Promise<(number | string)[]>;
  addWarehouseProduct: (product: Record<string, any>, token?: string) => Promise<boolean>;
  bulkPurchaseWarehouseProducts: (payload: any, token?: string) => Promise<boolean>;
  deleteWarehouseProduct: (id: number | string, token?: string) => Promise<void>;
  deleteAllWarehouseProducts: () => Promise<boolean>;
  deleteOutOfStockWarehouseProducts: () => Promise<boolean>;
  updatePriceQuantity: (id: number | string, data: Record<string, any>, token?: string) => Promise<boolean>;
}

const storeApi: StateCreator<WarehouseState & Actions> = (set, get) => ({
  categories: [],
  warehouseProducts: [],
  registeredProductIds: [],
  summary: null,
  isLoadingSummary: false,
  isLoadingProducts: false,
  isLoadingMore: false,
  nextCursor: null,
  hasMore: false,

  purchaseProducts: [],
  purchaseNextCursor: null,
  purchaseHasMore: false,
  isLoadingPurchaseProducts: false,
  isLoadingMorePurchaseProducts: false,

  resetPagination: () => set({ nextCursor: null, hasMore: false, isLoadingMore: false }),

  resetPurchasePagination: () =>
    set({
      purchaseProducts: [],
      purchaseNextCursor: null,
      purchaseHasMore: false,
      isLoadingMorePurchaseProducts: false,
    }),

  getWarehouseProducts: async (params?: Record<string, any>) => {
    set({ isLoadingProducts: true });
    try {
      const response = await tenantApi.get("/inventory-warehouses", {
        params: { per_page: 36, ...(params || {}) },
      });
      const products: IListWarehouseResponse[] = response.data.products || [];
      const pagination = response.data.pagination;

      set({
        warehouseProducts: products,
        categories: response.data.categories || [],
        nextCursor: pagination?.next_cursor ?? null,
        hasMore: pagination?.has_more ?? false,
      });

      // Extraer IDs existentes también de los productos retornados
      const ids: (number | string)[] = [];
      products.forEach((group: any) => {
        (group.products || []).forEach((p: any) => {
          if (p.id) ids.push(p.id);
        });
      });
      if (ids.length > 0) {
        set((state) => ({
          registeredProductIds: Array.from(new Set([...state.registeredProductIds, ...ids])),
        }));
      }
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al obtener los productos del almacén");
      }
    } finally {
      set({ isLoadingProducts: false });
    }
  },

  loadMoreWarehouseProducts: async (params?: Record<string, any>) => {
    const { hasMore, nextCursor, isLoadingMore } = get();
    if (!hasMore || isLoadingMore || !nextCursor) return;

    set({ isLoadingMore: true });

    try {
      const response = await tenantApi.get("/inventory-warehouses", {
        params: { per_page: 36, ...(params || {}), cursor: nextCursor },
      });

      const newGroups: any[] = response.data.products || [];
      const newCategories: any[] = response.data.categories || [];
      const pagination = response.data.pagination;

      set((state) => {
        const existingGroups: any[] = state.warehouseProducts;
        const mergedMap = new Map<string, any>();
        existingGroups.forEach((g) =>
          mergedMap.set(String(g.category_id), { ...g, products: [...(g.products || [])] })
        );

        newGroups.forEach((newGroup) => {
          const key = String(newGroup.category_id);
          if (mergedMap.has(key)) {
            const existing = mergedMap.get(key)!;
            const existingIds = new Set(existing.products.map((p: any) => p.inventory_id));
            const toAdd = (newGroup.products || []).filter(
              (p: any) => !existingIds.has(p.inventory_id)
            );
            mergedMap.set(key, { ...existing, products: [...existing.products, ...toAdd] });
          } else {
            mergedMap.set(key, newGroup);
          }
        });

        // Fusionar categorías
        const existingCatIds = new Set(state.categories.map((c: any) => String(c.id)));
        const toAddCats = newCategories.filter((c: any) => !existingCatIds.has(String(c.id)));

        return {
          warehouseProducts: Array.from(mergedMap.values()),
          categories: [...state.categories, ...toAddCats],
          nextCursor: pagination?.next_cursor ?? null,
          hasMore: pagination?.has_more ?? false,
        };
      });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al cargar más productos del almacén");
      }
    } finally {
      set({ isLoadingMore: false });
    }
  },

  getSummary: async () => {
    set({ isLoadingSummary: true });
    try {
      const response = await tenantApi.get<WarehouseSummary>("/inventory-warehouses/summary");
      set({ summary: response.data });
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al obtener métricas del almacén");
      }
      return null;
    } finally {
      set({ isLoadingSummary: false });
    }
  },

  getPurchaseProducts: async (params?: Record<string, any>) => {
    set({ isLoadingPurchaseProducts: true });
    try {
      const response = await tenantApi.get("/inventory-warehouses/purchase-products", {
        params: { per_page: 30, ...(params || {}) },
      });
      const products: PurchaseCatalogProduct[] = response.data.products || [];
      const pagination = response.data.pagination;

      set({
        purchaseProducts: products,
        purchaseNextCursor: pagination?.next_cursor ?? null,
        purchaseHasMore: pagination?.has_more ?? false,
      });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al obtener catálogo de compra");
      }
    } finally {
      set({ isLoadingPurchaseProducts: false });
    }
  },

  loadMorePurchaseProducts: async (params?: Record<string, any>) => {
    const { purchaseHasMore, purchaseNextCursor, isLoadingMorePurchaseProducts } = get();
    if (!purchaseHasMore || isLoadingMorePurchaseProducts || !purchaseNextCursor) return;

    set({ isLoadingMorePurchaseProducts: true });
    try {
      const response = await tenantApi.get("/inventory-warehouses/purchase-products", {
        params: { per_page: 30, ...(params || {}), cursor: purchaseNextCursor },
      });
      const newProducts: PurchaseCatalogProduct[] = response.data.products || [];
      const pagination = response.data.pagination;

      set((state) => {
        const existingIds = new Set(state.purchaseProducts.map((p) => p.id));
        const toAdd = newProducts.filter((p) => !existingIds.has(p.id));
        return {
          purchaseProducts: [...state.purchaseProducts, ...toAdd],
          purchaseNextCursor: pagination?.next_cursor ?? null,
          purchaseHasMore: pagination?.has_more ?? false,
        };
      });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al cargar más productos de compra");
      }
    } finally {
      set({ isLoadingMorePurchaseProducts: false });
    }
  },

  getCategories: async () => {},

  getRegisteredProductIds: async () => {
    try {
      const response = await tenantApi.get("/inventory-warehouses-product-ids");
      const ids = (response.data || []).map((id: any) => id);
      set({ registeredProductIds: ids });
      return ids;
    } catch (error) {
      console.error("Error al obtener IDs de productos en almacén:", error);
      return get().registeredProductIds;
    }
  },

  addWarehouseProduct: async (product: Record<string, any>) => {
    try {
      const response = await tenantApi.post("/inventory-warehouses", product);
      toast.success(response.data.message || "Compra registrada correctamente");
      await Promise.all([get().getWarehouseProducts(), get().getSummary()]);
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al registrar la compra");
      }
      return false;
    }
  },

  bulkPurchaseWarehouseProducts: async (payload: any) => {
    try {
      const response = await tenantApi.post("/inventory-warehouses/bulk-purchase", payload);
      toast.success(response.data.message || "Compra registrada correctamente");
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al registrar la compra");
      }
      return false;
    }
  },

  deleteWarehouseProduct: async (id: number | string) => {
    try {
      const response = await tenantApi.delete(`/inventory-warehouses/${id}`);
      toast.success(response.data.message || "Producto eliminado del almacén");
      await Promise.all([get().getWarehouseProducts(), get().getSummary()]);
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al eliminar el producto del almacén");
      }
    }
  },

  deleteAllWarehouseProducts: async () => {
    try {
      const response = await tenantApi.delete("/inventory-warehouses/destroy-all");
      toast.success(response.data.message || "Todos los productos del almacén fueron eliminados");
      await Promise.all([get().getWarehouseProducts(), get().getSummary()]);
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al eliminar los productos del almacén");
      }
      return false;
    }
  },

  deleteOutOfStockWarehouseProducts: async () => {
    try {
      const response = await tenantApi.delete("/inventory-warehouses/destroy-out-of-stock");
      toast.success(response.data.message || "Productos agotados eliminados del almacén");
      await Promise.all([get().getWarehouseProducts(), get().getSummary()]);
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al eliminar los productos agotados");
      }
      return false;
    }
  },

  updatePriceQuantity: async (id: number | string, data: Record<string, any>) => {
    try {
      const response = await tenantApi.put(`/inventory-warehouses/${id}`, data);
      toast.success(response.data.message || "Producto actualizado correctamente");
      await Promise.all([get().getWarehouseProducts(), get().getSummary()]);
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(
          error.response?.data?.message ||
            "Error al actualizar el precio o cantidad del producto del almacén"
        );
      }
      return false;
    }
  },
});

export const useWarehouseStore = create<WarehouseState & Actions>()(storeApi);