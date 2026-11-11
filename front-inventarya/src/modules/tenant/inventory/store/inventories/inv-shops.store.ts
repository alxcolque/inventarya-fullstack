import { create, StateCreator } from "zustand";
import { IStoreInventoriesResponse } from "@/interface";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";
import { getTenantSlug } from "@/utils/tenant";

// ─── Pagination state ───────────────────────────────────────────────────────
export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── State ───────────────────────────────────────────────────────────────────
interface ShopsState {
  shops: IStoreInventoriesResponse[];
  products: any[];
  storeProducts: any[];
  categories: any[];
  /** Cursor para la siguiente página del catálogo paginado */
  nextCursor: string | null;
  /** Indica si hay más páginas disponibles en el servidor */
  hasMore: boolean;
  /** True mientras se está cargando una página adicional (scroll) */
  isLoadingMore: boolean;
  /** Tienda actualmente activa en el store */
  activeStoreSlug: string | null;
  /** Contador de secuencia para evitar stale response overwrites */
  requestSeq: number;
}

// ─── Actions ─────────────────────────────────────────────────────────────────
interface Actions {
  /**
   * Carga (o recarga) el catálogo de la tienda con protección contra condiciones de carrera.
   * Si `perPage` está definido, activa paginación cursor-based.
   * Sin `perPage` descarga todos los registros (modo offline-first).
   */
  getStoreProducts: (slug: string, params?: Record<string, any>, token?: string) => Promise<void>;

  /**
   * Carga la siguiente página y AGREGA los productos al estado actual.
   * No afecta al carrito ni limpia los productos existentes.
   */
  loadMoreStoreProducts: (slug: string, params?: Record<string, any>) => Promise<void>;

  getProducts: (token?: string) => void;

  /* DB */
  createOutput: (data: any, token?: string) => void;
  inventoryDelete: (id: number | string, token?: string) => void;

  /** Reemplaza el catálogo completo con datos offline (IndexedDB) */
  setOfflineProducts: (products: any[], categories?: any[], slug?: string) => void;

  /** Decrementa el stock localmente tras una venta — evita un refetch completo */
  decrementLocalStock: (items: { inventory_id: number | string; quantity: number }[]) => void;

  /** Reinicia la paginación (útil al cambiar filtros) */
  resetPagination: () => void;

  /** Limpia el catálogo de la tienda activa */
  clearStoreProducts: () => void;
}

let globalRequestSeq = 0;

// ─── Store ────────────────────────────────────────────────────────────────────
const storeApi: StateCreator<ShopsState & Actions> = (set, get) => ({
  shops: [],
  products: [],
  storeProducts: [],
  categories: [],
  nextCursor: null,
  hasMore: false,
  isLoadingMore: false,
  activeStoreSlug: null,
  requestSeq: 0,

  // ── Reemplazar catálogo desde IndexedDB ──────────────────────────────────
  setOfflineProducts: (products: any[], categories?: any[], slug?: string) =>
    set({
      storeProducts: products as any,
      categories: (categories || []) as any,
      activeStoreSlug: slug ?? get().activeStoreSlug,
      nextCursor: null,
      hasMore: false,
      isLoadingMore: false,
    }),

  // ── Reiniciar paginación ─────────────────────────────────────────────────
  resetPagination: () => set({ nextCursor: null, hasMore: false }),

  // ── Limpiar productos de la tienda activa ────────────────────────────────
  clearStoreProducts: () =>
    set({
      storeProducts: [],
      categories: [],
      nextCursor: null,
      hasMore: false,
      isLoadingMore: false,
    }),

  // ── Decremento local de stock ────────────────────────────────────────────
  decrementLocalStock: (items) =>
    set((state) => {
      const updated = (state.storeProducts as any[]).map((group: any) => ({
        ...group,
        products: group.products.map((p: any) => {
          const sold = items.find(
            (i) => String(i.inventory_id) === String(p.inventory_id)
          );
          if (!sold) return p;
          const newStock = Math.max(0, Number(p.stock_quantity ?? p.stock ?? 0) - sold.quantity);
          return { ...p, stock_quantity: newStock, stock: newStock };
        }),
      }));
      return { storeProducts: updated as any };
    }),

  // ── Carga inicial (reset + primera página o todo) con Race Condition Guard ──
  getStoreProducts: async (slug, params = {}) => {
    const seq = ++globalRequestSeq;
    const initialTenant = getTenantSlug();
    const previousSlug = get().activeStoreSlug;

    // Si cambia la tienda, limpiar inmediatamente productos y paginación para evitar stale render
    if (previousSlug !== slug) {
      set({
        activeStoreSlug: slug,
        storeProducts: [],
        categories: [],
        nextCursor: null,
        hasMore: false,
        isLoadingMore: false,
        requestSeq: seq,
      });
    } else {
      set({ requestSeq: seq });
    }

    try {
      const response = await tenantApi.get(
        `/inventory-stores-get-by-store-slug/${slug}`,
        { params }
      );

      // Verificación estricta de carrera:
      // 1. Debe ser la secuencia más reciente solicitada
      // 2. La tienda activa debe seguir siendo la misma
      // 3. El tenant activo debe seguir siendo el mismo
      const state = get();
      if (
        state.requestSeq !== seq ||
        state.activeStoreSlug !== slug ||
        getTenantSlug() !== initialTenant
      ) {
        // Respuesta obsoleta o contexto cambiado: descartar sin modificar estado
        return;
      }

      const pagination = response.data.pagination;

      set({
        categories: response.data.categories,
        storeProducts: response.data.products,
        nextCursor: pagination?.next_cursor ?? null,
        hasMore: pagination?.has_more ?? false,
      });
    } catch (error) {
      const state = get();
      if (
        state.requestSeq !== seq ||
        state.activeStoreSlug !== slug ||
        getTenantSlug() !== initialTenant
      ) {
        return;
      }
      if (isAxiosError(error)) {
        toast.error(
          error.response?.data.message || "Error al obtener los productos de la tienda"
        );
      }
    }
  },

  // ── Carga adicional (infinite scroll) con protección atómica ─────────────
  loadMoreStoreProducts: async (slug, params = {}) => {
    const { hasMore, nextCursor, isLoadingMore, activeStoreSlug } = get();

    // Guardia estricta:
    // - Debe ser la misma tienda activa
    // - No debe estar ya cargando otra página
    // - Debe haber más páginas disponibles
    // - Debe existir un cursor válido
    if (!hasMore || isLoadingMore || !nextCursor || activeStoreSlug !== slug) return;

    const initialTenant = getTenantSlug();
    const seq = get().requestSeq;

    set({ isLoadingMore: true });

    try {
      const response = await tenantApi.get(
        `/inventory-stores-get-by-store-slug/${slug}`,
        { params: { ...params, cursor: nextCursor } }
      );

      const state = get();
      if (
        state.activeStoreSlug !== slug ||
        state.requestSeq !== seq ||
        getTenantSlug() !== initialTenant
      ) {
        set({ isLoadingMore: false });
        return;
      }

      const newGroups: any[] = response.data.products ?? [];
      const newCategories: any[] = response.data.categories ?? [];
      const pagination = response.data.pagination;

      set((currentState) => {
        // ── Fusionar grupos de productos (por category_id) asegurando unicidad de items ──
        const existingGroups: any[] = currentState.storeProducts as any[];
        const mergedMap = new Map<string, any>();
        existingGroups.forEach((g) => mergedMap.set(String(g.category_id), g));
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

        // ── Fusionar categorías (por id) ──────────────────────────────────
        const existingCats: any[] = currentState.categories as any[];
        const catMap = new Map<string, any>();
        existingCats.forEach((c) => catMap.set(String(c.id), c));
        newCategories.forEach((c) => catMap.set(String(c.id), c));

        return {
          storeProducts: Array.from(mergedMap.values()) as any,
          categories: Array.from(catMap.values()) as any,
          nextCursor: pagination?.next_cursor ?? null,
          hasMore: pagination?.has_more ?? false,
          isLoadingMore: false,
        };
      });
    } catch (error) {
      set({ isLoadingMore: false });
      if (isAxiosError(error)) {
        toast.error(
          error.response?.data.message || "Error al cargar más productos"
        );
      }
    }
  },

  // ── Productos del almacén (vista de warehouse) ───────────────────────────
  getProducts: async () => {
    try {
      const response = await tenantApi.get("/inventory-stores");
      set({ products: response.data.products });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  },

  // ── Crear salida de inventario ───────────────────────────────────────────
  createOutput: async (data: any) => {
    try {
      const response = await tenantApi.post("/inventory-stores", data);
      toast.success(response.data.message);
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  },

  // ── Eliminar item de inventario ──────────────────────────────────────────
  inventoryDelete: async (id: number | string) => {
    try {
      const response = await tenantApi.delete(`/inventory-stores/${id}`);
      toast.success(response.data.message);
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message);
      }
    }
  },
});

export const useStockStore = create<ShopsState & Actions>()(storeApi);
