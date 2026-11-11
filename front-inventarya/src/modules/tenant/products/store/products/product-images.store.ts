import { isAxiosError } from "axios";
import { toast } from "sonner";
import { create, StateCreator } from "zustand";
import { tenantApi } from "@/api";


interface ProductImageState {
    productImages: [];
    productImage: {} | any;
}
interface Action {
    getProductImages: (productId: number | string, token?: string) => Promise<void>;
    createProductImage: (data: any, token?: string) => Promise<void>;
    deleteProductImage: (productId: number | string, id: number | string, token?: string) => Promise<void>;
}

const storeApi: StateCreator<ProductImageState & Action> = (set, get) => ({
    productImages: [],
    productImage: {},
    getProductImages: async (id: number | string) => {  
        try {
            const cleanId = String(id ?? '').trim();
            if (!cleanId || cleanId === 'NaN' || cleanId === 'undefined' || cleanId === 'null') {
                return;
            }
            const response = await tenantApi.get(`/product-images/${cleanId}`);
            set({ productImages: response.data as any });
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al obtener imágenes');
            }
        }
    },
    
    createProductImage: async (data: any) => {
        try {
            const response = await tenantApi.post(`/product-images`, data);
            toast.success(response.data.message);
            if (data?.product_id) {
                get().getProductImages(data.product_id);
            }
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al guardar imagen');
            }
        }
    },

    deleteProductImage: async (productId: number | string, id: number | string) => {
        try {
            const cleanId = String(id ?? '').trim();
            if (!cleanId || cleanId === 'NaN' || cleanId === 'undefined' || cleanId === 'null') {
                return;
            }
            const response = await tenantApi.delete(`/product-images/${cleanId}`);
            toast.success(response.data.message);
            if (productId) {
                get().getProductImages(productId);
            }
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al eliminar imagen');
            }
        }
    }
});

export const useProductImagesStore = create<ProductImageState & Action>()(storeApi);
