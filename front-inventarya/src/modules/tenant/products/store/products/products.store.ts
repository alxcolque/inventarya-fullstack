import { isAxiosError } from "axios";
import { toast } from "sonner";
import { create, StateCreator } from "zustand";
import { IProductResponse } from "@/interface";
import { tenantApi } from "@/api";

interface ProductState {
    products: IProductResponse[];
    product: IProductResponse | null;
    isLoading: boolean;
    productImages: any[];
    productInventoryStore: any[];
    productInventoryWarehouse: any[];
}

export interface ProductImportResult {
    success: boolean;
    message: string;
    resumen: {
        total_filas: number;
        importados: number;
        no_importados: number;
    };
    errores: Array<{
        fila: number;
        nombre: string;
        motivo: string;
    }>;
    importados_lista: Array<{
        id: number | string;
        fila: number;
        nombre: string;
        slug: string;
        sku: string;
        barcode?: string;
        categoria: string;
        marca: string;
        unidad?: string;
        tipo?: string;
    }>;
}

interface Action {
    getProducts: (token?: string) => Promise<void>;
    getProduct: (id: number | string, token?: string) => Promise<IProductResponse | null>;
    getProductBySlug: (slug: string, token?: string) => Promise<any>;
    createProduct: (product: any, token?: string) => Promise<boolean>;
    updateProduct: (id: number | string, product: {}, token?: string) => Promise<boolean>;
    deleteProduct: (id: number | string, token?: string) => Promise<boolean>;
    deleteAllProducts: (token?: string) => Promise<boolean>;
    downloadTemplate: (format?: "xlsx" | "csv") => Promise<void>;
    exportProducts: (format?: "xlsx" | "csv") => Promise<void>;
    importProducts: (file: File) => Promise<{ success: boolean; data?: ProductImportResult; error?: string }>;
}

const triggerBlobDownload = (blobData: any, defaultFilename: string) => {
    const blob = new Blob([blobData]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", defaultFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

const storeApi: StateCreator<ProductState & Action> = (set, get) => ({
    products: [],
    product: null,
    isLoading: false,
    productImages: [],
    productInventoryStore: [],
    productInventoryWarehouse: [],

    getProducts: async () => {
        set({ isLoading: true });
        try {
            const response = await tenantApi.get('/products');
            set({ products: response.data as IProductResponse[], isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al obtener productos');
            }
        }
    },

    getProductBySlug: async (slug: string) => {
        try {
            const response = await tenantApi.get(`/products-get-by-slug/${slug}`);
            return response.data;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al obtener producto');
            }
            return null;
        }
    },

    getProduct: async (id: number | string) => {
        try {
            const cleanId = String(id ?? '').trim();
            if (!cleanId || cleanId === 'NaN' || cleanId === 'undefined' || cleanId === 'null') {
                return null;
            }
            const response = await tenantApi.get(`/products/${cleanId}`);
            const prod = response.data;
            set({ product: prod });
            return prod;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al obtener detalle del producto');
            }
            return null;
        }
    },

    createProduct: async (product: any) => {
        try {
            const response = await tenantApi.post('/products', product);
            toast.success(response.data.message || 'Producto registrado correctamente');
            await get().getProducts();
            return true;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al registrar producto');
            }
            return false;
        }
    },

    updateProduct: async (id: number | string, product: {}) => {
        try {
            const cleanId = String(id ?? '').trim();
            if (!cleanId || cleanId === 'NaN' || cleanId === 'undefined' || cleanId === 'null') {
                toast.error('Identificador de producto no válido');
                return false;
            }
            const response = await tenantApi.put(`/products/${cleanId}`, product);
            toast.success(response.data.message || 'Producto actualizado correctamente');
            await get().getProduct(cleanId);
            await get().getProducts();
            return true;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al actualizar producto');
            }
            return false;
        }
    },

    deleteProduct: async (id: number | string) => {
        try {
            const cleanId = String(id ?? '').trim();
            if (!cleanId || cleanId === 'NaN' || cleanId === 'undefined' || cleanId === 'null') {
                toast.error('Identificador de producto no válido');
                return false;
            }
            const response = await tenantApi.delete(`/products/${cleanId}`);
            toast.success(response.data.message || 'Producto eliminado correctamente');
            await get().getProducts();
            return true;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al eliminar producto');
            }
            return false;
        }
    },

    deleteAllProducts: async () => {
        try {
            const response = await tenantApi.delete('/products/destroy-all');
            toast.success(response.data?.message || 'Todos los productos fueron eliminados correctamente');
            await get().getProducts();
            return true;
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al eliminar todos los productos');
            }
            return false;
        }
    },

    downloadTemplate: async (format = "xlsx") => {
        try {
            const response = await tenantApi.get("/products/template", {
                params: { format },
                responseType: "blob",
            });
            const filename = `plantilla_productos.${format}`;
            triggerBlobDownload(response.data, filename);
            toast.success("Plantilla descargada correctamente");
        } catch (error) {
            toast.error("Error al descargar la plantilla");
        }
    },

    exportProducts: async (format = "xlsx") => {
        try {
            const response = await tenantApi.get("/products/export", {
                params: { format },
                responseType: "blob",
            });
            const filename = `productos_${new Date().toISOString().slice(0, 10)}.${format}`;
            triggerBlobDownload(response.data, filename);
            toast.success("Productos exportados correctamente");
        } catch (error) {
            toast.error("Error al exportar productos");
        }
    },

    importProducts: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await tenantApi.post("/products/import", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            await get().getProducts();
            return {
                success: true,
                data: response.data as ProductImportResult,
            };
        } catch (error) {
            let errorMsg = "Error al importar el archivo";
            if (isAxiosError(error)) {
                errorMsg = error.response?.data?.message || errorMsg;
            }
            return {
                success: false,
                error: errorMsg,
            };
        }
    },
});

export const useProductsStore = create<ProductState & Action>()(storeApi);
