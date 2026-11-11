import { IPlan } from "../../plans/interfaces/plan.interface";

export interface ITenant {
  id: string;
  name: string;
  slug: string;
  status: 'trial' | 'active' | 'suspended' | 'expired';
  database: string;
  database_host?: string | null;
  database_port?: string | null;
  database_username?: string | null;
  database_password?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  logo?: string | null;
  data?: Record<string, any> | null;
  plan_id: number | null;
  current_subscription_id: number | null;
  trial_ends_at: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  domain?: string | null;
  domains?: any[] | null;
  plan?: IPlan;
  created_at?: string;
  updated_at?: string;
}

export interface ITenantsResponse {
  tenants: ITenant[];
}
