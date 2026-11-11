export interface IConfiguration {
  id: number;
  logo: string | null;
  favicon: string | null;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  privacy: string | null;
  terms: string | null;
  about_us: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ILandingPlan {
  id: number;
  name: string;
  slug: string;
  price: string | number;
  yearly_price: string | number;
  max_users: number | null;
  max_stores: number | null;
  max_products: number | null;
  features: any;
  custom_domain: boolean;
  multi_store: boolean;
  reports: boolean;
  trial_days: number;
  status: string;
  description: string | null;
}

export interface IFaq {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface IPublicTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  logo: string | null;
  primary_domain?: string;
}

export interface IResolveTenantResponse {
  found: boolean;
  message?: string;
  tenant?: IPublicTenant;
}

export interface ICarousel {
  id: number;
  title: string;
  link: string | null;
  description: string | null;
  visible_btn: boolean;
  title_btn: string | null;
  color_btn: string | null;
  position_btn: 'left' | 'center' | 'right' | null;
  image: string | null;
  image_key: string | null;
  display_order: number;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface ILandingDataResponse {
  configuration: IConfiguration;
  plans: ILandingPlan[];
  faqs: IFaq[];
  carousels: ICarousel[];
}
