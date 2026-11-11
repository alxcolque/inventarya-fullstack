import { create, StateCreator } from "zustand";
import { IShopResponse } from "@/interface";
//import { shops } from "@/api/systemdata";
import { tenantApi } from "@/api";
import { isAxiosError } from "axios";
import { toast } from "sonner";



interface ShopsState {
    shops: IShopResponse[];
    shop: IShopResponse;
}

interface Actions {
    getShops: (token?: string) => Promise<void>;
    getShop: (id: number | string, token?: string) => Promise<void>;
    getShopBySlug: (slug: string, token?: string) => Promise<any>;
    addShop: (shop: [] | any, token?: string) => Promise<any>;
    updateShop: (shop: [] | any, id: number | string, token?: string) => Promise<boolean>;
    deleteShop: (id: number | string, token?: string) => Promise<void>;
    setOfflineShop: (shop: IShopResponse) => void;
    getStoreApiCredentials: (storeId: number | string) => Promise<{ api_status: boolean; api_key: string | null; has_api_secret: boolean } | null>;
    generateStoreApiCredentials: (storeId: number | string) => Promise<{ status: string; api_key: string; api_secret: string; api_status: boolean } | null>;
    toggleStoreApiStatus: (storeId: number | string, api_status: boolean) => Promise<boolean>;
    clearStorePosInventory: (storeId: number | string) => Promise<{ success: boolean; deletedCount?: number; message?: string }>;
}

const storeApi: StateCreator<ShopsState & Actions> = (set, get) => ({
    shops: [],
    shop: {} as IShopResponse,
    setOfflineShop: (shop: IShopResponse) => set({ shop }),
    getShops: async () => {
        try {
            const response = await tenantApi.get('/stores');
            set({ shops: response.data as any });
        } catch (error) {
            set({ shops: [] });
        }
    },
    getShop: async (id: number | string) => {
        try {
            const response = await tenantApi.get(`/stores/${id}`);
            set({ shop: response.data.shop as any });
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data.message);
            }
        }
    },
    getShopBySlug: async (slug: string) => {
        try {
            const response = await tenantApi.get(`/store-get-by-slug/${slug}`);
            set({ shop: response.data.store as any });
            return response.data.store as any;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data.message);
            }
        }
    },
    addShop: async (shop: any) => {
        try {
            const response = await tenantApi.post('/stores', shop);
            await get().getShops();
            const created = response.data.store;
            toast.success(response.data.message || 'Tienda creada correctamente');
            return created;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data.message || 'Error al crear tienda');
            }
            return null;
        }
    },
    updateShop: async (shop: any, id: number | string) => {
        try {
            const response = await tenantApi.put(`/stores/${id}`, shop);
            await get().getShops();
            toast.success(response.data.message || 'Tienda actualizada correctamente');
            return true;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data.message || 'Error al actualizar tienda');
            }
            return false;
        }
    },
    deleteShop: async (id: number | string) => {
        try {
            const response = await tenantApi.delete(`/stores/${id}`);
            get().getShops();
            toast.success(response.data.message);
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data.message);
            }
        }
    },
    getStoreApiCredentials: async (storeId: number | string) => {
        try {
            const response = await tenantApi.get(`/stores/${storeId}/api-credentials`);
            return response.data;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al obtener credenciales de API');
            }
            return null;
        }
    },
    generateStoreApiCredentials: async (storeId: number | string) => {
        try {
            const response = await tenantApi.post(`/stores/${storeId}/generate-api-credentials`);
            // Actualizar lista local de tiendas
            set((state) => ({
                shops: state.shops.map((s) =>
                    s.id === storeId
                        ? { ...s, api_status: true, api_key: response.data.api_key, has_api_secret: true }
                        : s
                ),
                shop: state.shop?.id === storeId
                    ? { ...state.shop, api_status: true, api_key: response.data.api_key, has_api_secret: true }
                    : state.shop,
            }));
            toast.success(response.data.message || 'Credenciales generadas correctamente');
            return response.data;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al generar credenciales');
            }
            return null;
        }
    },
    toggleStoreApiStatus: async (storeId: number | string, api_status: boolean) => {
        try {
            const response = await tenantApi.put(`/stores/${storeId}/toggle-api-status`, { api_status });
            // Actualizar estado local
            set((state) => ({
                shops: state.shops.map((s) =>
                    s.id === storeId ? { ...s, api_status } : s
                ),
                shop: state.shop?.id === storeId ? { ...state.shop, api_status } : state.shop,
            }));
            toast.success(response.data.message || (api_status ? 'API externa habilitada' : 'API externa deshabilitada'));
            return true;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al cambiar estado de API');
            }
            return false;
        }
    },
    clearStorePosInventory: async (storeId: number | string) => {
        try {
            const response = await tenantApi.delete(`/inventory-stores/clear-by-store/${storeId}`);
            toast.success(response.data.message || 'Se vaciaron los productos del POS correctamente');
            return { success: true, deletedCount: response.data.deleted_count, message: response.data.message };
        } catch (error) {
            let msg = 'Error al vaciar los productos del POS';
            if (isAxiosError(error)) {
                msg = error.response?.data?.message || msg;
            }
            toast.error(msg);
            return { success: false, message: msg };
        }
    }
});

export const useShopsStore = create<ShopsState & Actions>()(storeApi);

