import { ITenant } from "../../tenants/interfaces/tenant.interface";
import { IPlan } from "../../plans/interfaces/plan.interface";

export interface IPayment {
  id: number;
  tenant_id: string;
  subscription_id: number;
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  method: 'qr' | 'card' | 'paypal' | 'bank_transfer' | 'cash' | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  reference?: string | null;
  receipt?: string | null;
  paid_at?: string | null;
  tenant?: ITenant;
  plan?: IPlan;
  created_at?: string;
  updated_at?: string;
}

export interface IPaymentsResponse {
  payments: IPayment[];
  message?: string;
}
