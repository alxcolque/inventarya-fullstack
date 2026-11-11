import { ITenant } from "../../tenants/interfaces/tenant.interface";
import { IPlan } from "../../plans/interfaces/plan.interface";

export type SubscriptionStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'canceled'
  | 'cancelled'
  | 'expired'
  | 'trialing'
  | 'past_due'
  | 'suspended';

export interface ISubscription {
  id: number;
  tenant_id: string;
  plan_id: number;
  status: SubscriptionStatus;
  billing_cycle: 'monthly' | 'yearly' | string;
  price: number;
  starts_at: string | null;
  ends_at: string | null;
  trial_ends_at?: string | null;
  cancelled_at?: string | null;
  tenant?: ITenant;
  plan?: IPlan;
  created_at?: string;
  updated_at?: string;
}

export interface ISubscriptionStats {
  total: number;
  active: number;
  trialing: number;
  expired: number;
  cancelled: number;
  monthly_revenue: number;
}

export interface ISubscriptionsResponse {
  subscriptions: ISubscription[];
  message?: string;
}
