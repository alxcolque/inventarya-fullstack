import { create, StateCreator } from "zustand";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";

interface OrdersState {
    sale: {};
    detailSales: [];
}
interface Actions {
    getDetailSale: (id: string, token?: string) => void;
}

const storeApi: StateCreator<OrdersState & Actions> = (set) => ({
    sale: {},
    detailSales: [],
    getDetailSale: async (id: string) => {
        try {
            const response = await tenantApi.get(`/detail-sales-get-by-sale-id/${id}`);
            set({ detailSales: response.data.detailSales });
            set({ sale: response.data.sale });
        } catch (error) {
            if (isAxiosError(error)) {
                toast.error(error.response?.data.message);
            }
        }
    }
});

export const useDetailSalesStore = create<OrdersState & Actions>()(storeApi);
