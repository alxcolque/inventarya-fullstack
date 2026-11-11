export interface IListWarehouseResponse {
    id: number | string;
    name: string;
    slug: string;
    category: string;
    products: IProduct[];
}

export interface IProduct {
    id: number | string;
    name: string;
    slug: string;
    price: number;
    description: string;
    thumbnail: string;
    quantity: number;
    unit: string;
    restockDate: Date;
    brand: string;
    inventory_id: number | string;
}
