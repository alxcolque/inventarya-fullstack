import { create } from "zustand";
import { tenantApi } from "@/api";

export type DynamicFieldType =
  | "text"
  | "textarea"
  | "number"
  | "decimal"
  | "boolean"
  | "date"
  | "select";

export interface IDynamicProductField {
  id: number;
  key: string;
  label: string;
  type: DynamicFieldType;
  is_required: boolean;
  is_active: boolean;
  options?: string[] | null;
  validation?: {
    min_length?: number | null;
    max_length?: number | null;
    min?: number | null;
    max?: number | null;
    decimals?: number | null;
  } | null;
  sort_order: number;
}

export interface ITenantBusinessTypeContract {
  business_type: {
    id: number;
    name: string;
    slug: string;
  } | null;
  fields: IDynamicProductField[];
}

interface BusinessTypeFieldsState {
  businessType: ITenantBusinessTypeContract["business_type"];
  fields: IDynamicProductField[];
  hasLoaded: boolean;
  isLoading: boolean;
  fetchFields: (force?: boolean) => Promise<void>;
  reset: () => void;
}

export const useTenantBusinessTypeFieldsStore = create<BusinessTypeFieldsState>((set, get) => ({
  businessType: null,
  fields: [],
  hasLoaded: false,
  isLoading: false,

  fetchFields: async (force = false) => {
    if (get().isLoading) return;
    if (get().hasLoaded && !force) return;

    set({ isLoading: true });
    try {
      const { data } = await tenantApi.get<ITenantBusinessTypeContract>("/business-type/product-fields");
      const sorted = Array.isArray(data?.fields)
        ? [...data.fields].filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order)
        : [];
      set({
        businessType: data?.business_type ?? null,
        fields: sorted,
        hasLoaded: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  reset: () =>
    set({
      businessType: null,
      fields: [],
      hasLoaded: false,
      isLoading: false,
    }),
}));

