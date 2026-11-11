import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeFeatures } from "@/modules/central/plans/utils/plan.utils";
import { PlanFeatures } from "@/modules/central/plans/interfaces/plan.interface";

export interface TenantPlanLimit {
  current: number;
  max: number;
}

export interface TenantPlanState {
  planName: string;
  planSlug: string;
  features: PlanFeatures;
  limits: {
    users: TenantPlanLimit;
    stores: TenantPlanLimit;
    products: TenantPlanLimit;
  };
  customDomain: boolean;
  multiStore: boolean;
  reports: boolean;

  setPlanData: (data: Partial<TenantPlanState>) => void;
  updateUsage: (key: "users" | "stores" | "products", current: number) => void;
}

const PLAN_STORAGE_KEY = "inventarya-tenant-plan";
const PREVIOUS_PLAN_STORAGE_KEY = "stockly-tenant-plan";

if (typeof window !== "undefined") {
  try {
    const previous = localStorage.getItem(PREVIOUS_PLAN_STORAGE_KEY);
    if (previous !== null && localStorage.getItem(PLAN_STORAGE_KEY) === null) {
      localStorage.setItem(PLAN_STORAGE_KEY, previous);
    }
  } catch {
    // Storage may be unavailable; Zustand will continue with in-memory state.
  }
}

export const useTenantPlanStore = create<TenantPlanState>()(
  persist(
    (set, get) => ({
      planName: "Plan Estándar",
      planSlug: "standard",
      features: {
        inventory: true,
        stock_alerts: true,
        transfers: true,
        advanced_reports: true,
        api: false,
        barcode: true,
        notifications: true,
      },
      limits: {
        users: { current: 1, max: 10 },
        stores: { current: 1, max: 5 },
        products: { current: 0, max: 1000 },
      },
      customDomain: false,
      multiStore: true,
      reports: true,

      setPlanData: (data) =>
        set((state) => ({
          ...state,
          ...data,
          features: data.features ? normalizeFeatures(data.features) : state.features,
        })),

      updateUsage: (key, current) =>
        set((state) => ({
          ...state,
          limits: {
            ...state.limits,
            [key]: {
              ...state.limits[key],
              current,
            },
          },
        })),
    }),
    {
      name: PLAN_STORAGE_KEY,
    }
  )
);

/**
 * Checks if a specific feature is enabled in the current tenant's active plan (Section 28 of plans.md)
 * Usage: canFeature('transfers')
 */
export function canFeature(featureKey: string): boolean {
  const state = useTenantPlanStore.getState();

  // Core model column features
  if (featureKey === "custom_domain") return state.customDomain;
  if (featureKey === "multi_store") return state.multiStore;
  if (featureKey === "reports") return state.reports;

  // Dynamic JSON features
  const norm = normalizeFeatures(state.features);
  return Boolean(norm[featureKey]);
}

/**
 * Gets the current limit quota for users, stores, or products (Section 28 of plans.md)
 */
export function getLimit(limitKey: "users" | "stores" | "products"): TenantPlanLimit {
  const limits = useTenantPlanStore.getState().limits;
  return limits[limitKey] || { current: 0, max: 999999 };
}

/**
 * Checks if the tenant has reached their plan quota limit (Section 30 of plans.md)
 * Usage: hasReachedLimit('stores')
 */
export function hasReachedLimit(limitKey: "users" | "stores" | "products"): boolean {
  const quota = getLimit(limitKey);
  if (quota.max <= 0) return false; // 0 or negative can mean unlimited
  return quota.current >= quota.max;
}
