import { create, StateCreator } from "zustand";
import { IBrandResponse } from "@/interface";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";

interface BrandsState {
  brands: IBrandResponse[];
  brand: IBrandResponse | null;
  isLoading: boolean;
}

export interface BrandImportResult {
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
  }>;
}

interface Actions {
  getBrands: (token?: string) => Promise<void>;
  getBrand: (id: number | string, token?: string) => Promise<void>;
  createBrand: (brand: Partial<IBrandResponse>, token?: string) => Promise<boolean>;
  updateBrand: (id: number | string, brand: Partial<IBrandResponse>, token?: string) => Promise<boolean>;
  deleteBrand: (id: number | string, token?: string) => Promise<boolean>;
  deleteAllBrands: () => Promise<boolean>;
  downloadTemplate: (format?: "xlsx" | "csv") => Promise<void>;
  exportBrands: (format?: "xlsx" | "csv") => Promise<void>;
  importBrands: (file: File) => Promise<{ success: boolean; data?: BrandImportResult; error?: string }>;
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

const storeApi: StateCreator<BrandsState & Actions> = (set, get) => ({
  brands: [],
  brand: null,
  isLoading: false,

  getBrands: async () => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.get("/brands");
      set({ brands: response.data as IBrandResponse[] });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al cargar marcas");
      }
    } finally {
      set({ isLoading: false });
    }
  },

  getBrand: async (id: number | string) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.get(`/brands/${id}`);
      set({ brand: response.data as IBrandResponse });
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al obtener marca");
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createBrand: async (brand: Partial<IBrandResponse>) => {
    try {
      const response = await tenantApi.post("/brands", brand);
      toast.success(response.data.message || "Marca creada correctamente");
      await get().getBrands();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(" ")
            : error.response?.data?.message || "Error al crear marca";
        toast.error(errorMsg);
      }
      return false;
    }
  },

  updateBrand: async (id: number | string, brand: Partial<IBrandResponse>) => {
    try {
      const response = await tenantApi.put(`/brands/${id}`, brand);
      toast.success(response.data.message || "Marca actualizada correctamente");
      await get().getBrands();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(" ")
            : error.response?.data?.message || "Error al actualizar marca";
        toast.error(errorMsg);
      }
      return false;
    }
  },

  deleteBrand: async (id: number | string) => {
    try {
      const response = await tenantApi.delete(`/brands/${id}`);
      toast.success(response.data.message || "Marca eliminada correctamente");
      await get().getBrands();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al eliminar marca");
      }
      return false;
    }
  },

  deleteAllBrands: async () => {
    try {
      const response = await tenantApi.delete<{ message: string; deleted_count: number }>("/brands/destroy-all");
      toast.success(response.data.message || "Todas las marcas han sido eliminadas");
      set({ brands: [] });
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al eliminar todas las marcas");
      }
      return false;
    }
  },

  downloadTemplate: async (format = "xlsx") => {
    try {
      const response = await tenantApi.get("/brands/template", {
        params: { format },
        responseType: "blob",
      });
      const filename = `plantilla_marcas.${format}`;
      triggerBlobDownload(response.data, filename);
      toast.success("Plantilla descargada correctamente");
    } catch (error) {
      toast.error("Error al descargar la plantilla");
    }
  },

  exportBrands: async (format = "xlsx") => {
    try {
      const response = await tenantApi.get("/brands/export", {
        params: { format },
        responseType: "blob",
      });
      const filename = `marcas_${new Date().toISOString().slice(0, 10)}.${format}`;
      triggerBlobDownload(response.data, filename);
      toast.success("Marcas exportadas correctamente");
    } catch (error) {
      toast.error("Error al exportar marcas");
    }
  },

  importBrands: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await tenantApi.post("/brands/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      await get().getBrands();
      return {
        success: true,
        data: response.data as BrandImportResult,
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

export const useBrandsStore = create<BrandsState & Actions>()(storeApi);


