export interface ICategoryResponse {
    id: number | string;
    name: string;
    slug: string;
    color?: string | null;
    parent_id?: number | null;
    parent?: { id: number; name: string; slug: string } | null;
    parent_name?: string | null;
    children?: ICategoryResponse[];
    full_path?: string;
    product_count?: number;
    created_at?: string;
    updated_at?: string;
}
