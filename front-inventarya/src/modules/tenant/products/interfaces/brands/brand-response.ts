export interface IBrandResponse {
  id: string | number;
  name: string;
  image?: string | null;
  image_key?: string | null;
  slug: string;
  logo?: string | null;
  created_at?: string;
  updated_at?: string;
  products_count?: number;
}

