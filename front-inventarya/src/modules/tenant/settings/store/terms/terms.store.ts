import { create } from "zustand";
import { tenantApi } from "@/api";
import { StateCreator } from "zustand";
import axios from "axios";
import { toast } from "sonner";

interface TermsState {
    terms: string;
    policy: string;
}
interface Actions {
    updateTerms: (id: string, terms: string, policy: string, token?: string) => Promise<void>;
}
const storeApi: StateCreator<TermsState & Actions> = (set) => ({
    terms: '',
    policy: '',
    updateTerms: async (id, terms, policy) => {
        try {
            const { data } = await tenantApi.put(`/settings/${id}`, { terms, policy });
            toast.success('Términos y condiciones actualizados')
            set(() => ({
                terms: data.setting.terms,
                policy: data.setting.policy
            }));
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data.message)
            }
        }
    }
});
export const useTermsStore = create<TermsState & Actions>((...args) => storeApi(...args));
