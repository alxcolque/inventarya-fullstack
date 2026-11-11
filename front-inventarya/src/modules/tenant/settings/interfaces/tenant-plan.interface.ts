export interface IResourceUsage {
  current: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  percentage: number;
}

export interface ITenantPlanInfo {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  plan: {
    id: number;
    name: string;
    slug: string;
    price: number;
    yearly_price: number;
    description?: string;
    trial_days: number;
    status: string;
  } | null;
  subscription: {
    id: number;
    status: string;
    billing_cycle: string;
    price: number;
    starts_at: string | null;
    ends_at: string | null;
    trial_ends_at: string | null;
    cancelled_at: string | null;
    is_active: boolean;
    is_trialing: boolean;
    is_expired: boolean;
    days_remaining: number | null;
  } | null;
  trial: {
    is_trial: boolean;
    days_remaining: number | null;
    ends_at: string | null;
  };
  usage: {
    users: IResourceUsage;
    stores: IResourceUsage;
    products: IResourceUsage;
  };
  limits: {
    max_users: number | null;
    max_stores: number | null;
    max_products: number | null;
    custom_domain: boolean;
    multi_store: boolean;
    reports: boolean;
    features: any;
  };
  features: any;
}

export interface IAvailablePlan {
  id: number;
  name: string;
  slug: string;
  price: number;
  yearly_price: number;
  max_users: number | null;
  max_stores: number | null;
  max_products: number | null;
  custom_domain: boolean;
  multi_store: boolean;
  reports: boolean;
  features: any;
  trial_days: number;
  description?: string;
  status: string;
}
