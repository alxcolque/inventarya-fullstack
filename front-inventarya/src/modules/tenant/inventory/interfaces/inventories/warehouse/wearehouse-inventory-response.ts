export interface IWarehouseInventoryResponse {
    id: number | string,
    productId: number | string,
    supplierId: number,
    price: number,
    quantity: number,
    stockQuantity: number,
    unit: string,
    restockDate: Date,
}
