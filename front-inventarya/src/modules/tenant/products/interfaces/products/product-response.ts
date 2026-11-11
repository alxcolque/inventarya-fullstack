export interface IProductResponse {
    id: string | number;
    name: string;
    slug: string;
    description?: string;
    price?: number;
    thumbnail?: string;
    image?: string;
    image_thumb?: string;
    image_medium?: string;
    category_id?: number | string;
    category?: string;
    category_path?: string;
    color?: string;
    brand_id?: number | string;
    brand?: string;
    sku?: string;
    barcode?: string;
    created_at?: string;
    updated_at?: string;
}
