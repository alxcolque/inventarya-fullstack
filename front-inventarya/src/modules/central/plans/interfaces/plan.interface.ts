export type PlanStatus = 'active' | 'inactive';

export interface PlanFeatures {
  inventory?: boolean;
  stock_alerts?: boolean;
  transfers?: boolean;
  advanced_reports?: boolean;
  api?: boolean;
  barcode?: boolean;
  notifications?: boolean;
  [key: string]: boolean | undefined;
}

export interface IPlan {
  id?: number;
  name: string;
  slug: string;

  price: number;
  yearly_price: number;

  max_users: number;
  max_stores: number;
  max_products: number;

  features: PlanFeatures | null;

  custom_domain: boolean;
  multi_store: boolean;
  reports: boolean;

  trial_days: number;

  status: PlanStatus;

  description?: string | null;

  tenants_count?: number;

  created_at?: string;
  updated_at?: string;
}

export interface IPlansResponse {
  plans: IPlan[];
  message?: string;
}
