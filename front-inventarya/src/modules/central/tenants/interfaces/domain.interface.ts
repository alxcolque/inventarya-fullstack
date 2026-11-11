export interface IDomain {
  id: number;
  domain: string;
  tenant_id: string;
  is_primary: boolean;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  verified_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IDomainsResponse {
  domains: IDomain[];
  message?: string;
}
