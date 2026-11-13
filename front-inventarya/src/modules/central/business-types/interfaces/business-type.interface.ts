export type BusinessTypeFieldDataType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'select';

export interface IBusinessTypeFieldValidation {
  min_length?: number | null;
  max_length?: number | null;
  min?: number | null;
  max?: number | null;
  decimals?: number | null;
}

export interface IBusinessTypeField {
  id: number;
  business_type_id: number;
  key: string;
  label: string;
  type: BusinessTypeFieldDataType;
  is_required: boolean;
  is_active: boolean;
  options?: string[] | null;
  validation?: IBusinessTypeFieldValidation | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface IBusinessType {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  fields_count?: number;
  tenants_count?: number;
  fields?: IBusinessTypeField[];
  created_at?: string;
  updated_at?: string;
}

export interface IBusinessTypeOption {
  id: number;
  name: string;
  slug: string;
}

export interface IBusinessTypesPaginatedResponse {
  data: IBusinessType[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

