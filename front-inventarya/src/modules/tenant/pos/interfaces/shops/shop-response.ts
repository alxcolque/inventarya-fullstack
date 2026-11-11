export interface IShopResponse {
    id: number | any;
    name: string;
    slug: string;
    location: string;
    address: string;
    phone: string;
    front_image: string;
    storeFront?: string;
    is_active?: boolean;
    api_status?: boolean;
    api_key?: string | null;
    has_api_secret?: boolean;
    enable_customers?: boolean;
    enable_payment?: boolean;
    enable_observations?: boolean;
    enable_discount?: boolean;
    enable_electronic_invoicing?: boolean;
    sin_branch_code?: number | null;
    sin_point_of_sale_code?: number | null;
}
