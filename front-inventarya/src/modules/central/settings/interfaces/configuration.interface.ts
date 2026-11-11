export interface IConfiguration {
  id: number;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  favicon: string | null;
  privacy: string | null;
  terms: string | null;
  about_us: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IFaqItem {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}
