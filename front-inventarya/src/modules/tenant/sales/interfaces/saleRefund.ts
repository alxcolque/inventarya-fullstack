export interface ISaleRefundItem {
    id: string;
    sale_refund_id: string;
    sale_detail_id: string;
    product_id?: string | null;
    product_name?: string | null;
    product_sku?: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    created_at?: string;
    updated_at?: string;
}

export interface ISaleRefundPayment {
    id: string;
    sale_refund_id: string;
    payment_method: string;
    amount: number;
    reference?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ISaleRefund {
    id: string;
    sale_id: string;
    store_id: string;
    user_id: number;
    status: 'completed' | string;
    reason?: string | null;
    notes?: string | null;
    total: number;
    items?: ISaleRefundItem[];
    payments?: ISaleRefundPayment[];
    created_at: string;
    updated_at: string;
    is_duplicate?: boolean;
}

export interface IRefundableItem {
    sale_detail_id: string;
    product_id?: string | null;
    product_name: string;
    product_sku?: string | null;
    sold_quantity: number;
    refunded_quantity: number;
    refundable_quantity: number;
    unit_price: number;
    effective_unit_price: number;
    refundable_amount: number;
}

export interface IRefundablePaymentMethod {
    payment_method: string;
    original_amount: number;
    refunded_amount: number;
    remaining_amount: number;
}

export interface IRefundableResponse {
    sale_id: string;
    sale_total: number;
    total_refunded: number;
    remaining_refundable_amount: number;
    refund_status: 'none' | 'partially_refunded' | 'refunded';
    has_electronic_invoice: boolean;
    items: IRefundableItem[];
    payment_methods: IRefundablePaymentMethod[];
}

export interface ICreateRefundItemPayload {
    sale_detail_id: string;
    quantity: number;
}

export interface ICreateRefundPaymentPayload {
    payment_method: string;
    amount: number;
    reference?: string | null;
}

export interface ICreateRefundPayload {
    id?: string;
    reason?: string;
    notes?: string;
    items: ICreateRefundItemPayload[];
    payments?: ICreateRefundPaymentPayload[];
}

export interface ICancelSalePayload {
    id?: string;
    reason?: string;
    notes?: string;
}

export interface ISaleCancellationResponse {
    message: string;
    sale_id: string;
    status: string;
    cancelled_at: string;
    cancelled_by: number;
    cancellation_reason?: string | null;
    cancellation_refund_id: string;
    refund: ISaleRefund;
    has_electronic_invoice: boolean;
    fiscal_action_performed: boolean;
    is_duplicate?: boolean;
}
