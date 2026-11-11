import { create, StateCreator } from "zustand";
import { IShopResponse } from "@/interface";
//import { shops } from "@/api/systemdata";
import { tenantApi } from "@/api";
import { isAxiosError } from "axios";
import { toast } from "sonner";



export interface IAssignment {
    id: number;
    name: string;
    email?: string;
    role?: string;
    store_id?: string | number;
    user_id?: number;
}

interface AssignmentsState {
    assignments: IAssignment[];
}

interface Actions {
    getAssignments: (id: string | number, token?: string) => Promise<void>;
    addAssignment: (shop: [] | any, token?: string) => Promise<void>;
    deleteAssignment: (id: number, shopId: string | number, token?: string) => Promise<void>;
}

const storeApi: StateCreator<AssignmentsState & Actions> = (set, get) => ({
    assignments: [],
    getAssignments: async (id: string | number) => {
        try {
            const response = await tenantApi.get(`/assignments-get-by-store-id/${id}`);
            set({ assignments: response.data.assignments as any });
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error("Error al obtener los trabajadores", {
                    description: error.response?.data.message
                });
            }
        }
    },
    addAssignment: async (shop: any) => {
        try {
            const response = await tenantApi.post('/assignments', shop);
            if (shop?.store_id) {
                await get().getAssignments(shop.store_id);
            }
            toast.success(response.data.message || 'Trabajador asignado exitosamente');
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Error al asignar trabajador');
            }
        }
    },
    deleteAssignment: async (id: number, shopId: string | number) => {
        try {
            const response = await tenantApi.delete(`/assignments/${id}`);
            get().getAssignments(shopId);
            toast.success(response.data.message);
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data.message);
            }
        }
    }
});

export const useAssignmentsStore = create<AssignmentsState & Actions>()(storeApi);

