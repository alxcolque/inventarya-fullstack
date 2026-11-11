export interface IStoreInventoryResponse {
    id: number | string,
    productId: number | string,
    storeId: number | string,
    price: number,
    salePrice: number,
    quantity: number,
    stockQuantity: number,
    unit: string,
    restockDate: Date,

}
