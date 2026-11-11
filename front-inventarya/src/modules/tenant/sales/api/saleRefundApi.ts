import { tenantApi } from '@/api/tenant/tenantApi';
import {
    ICancelSalePayload,
    ICreateRefundPayload,
    IRefundableResponse,
    ISaleCancellationResponse,
    ISaleRefund,
} from '../interfaces/saleRefund';

export const saleRefundApi = {
    /**
     * Consulta la información de cantidades y montos autoritativamente reembolsables.
     */
    async getRefundable(saleId: string): Promise<IRefundableResponse> {
        const { data } = await tenantApi.get<IRefundableResponse>(`/sales/${saleId}/refundable`);
        return data;
    },

    /**
     * Registra una devolución comercial (online-only).
     */
    async createRefund(
        saleId: string,
        payload: ICreateRefundPayload
    ): Promise<{ message: string; refund: ISaleRefund; id: string; is_duplicate?: boolean }> {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            throw new Error('Las devoluciones comerciales requieren conexión activa con el servidor. Operación no disponible en modo offline.');
        }
        const { data } = await tenantApi.post<{
            message: string;
            refund: ISaleRefund;
            id: string;
            is_duplicate?: boolean;
        }>(`/sales/${saleId}/refunds`, payload);
        return data;
    },

    /**
     * Cancela comercialmente una venta de forma total y compensatoria (online-only).
     */
    async cancelSale(
        saleId: string,
        payload: ICancelSalePayload = {}
    ): Promise<ISaleCancellationResponse> {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            throw new Error('La cancelación comercial requiere conexión activa con el servidor. Operación no disponible en modo offline.');
        }
        const { data } = await tenantApi.post<ISaleCancellationResponse>(
            `/sales/${saleId}/cancel`,
            payload
        );
        return data;
    },

    /**
     * Lista todas las devoluciones asociadas a una venta específica.
     */
    async getRefundsBySale(saleId: string): Promise<{ sale_id: string; refunds: ISaleRefund[] }> {
        const { data } = await tenantApi.get<{ sale_id: string; refunds: ISaleRefund[] }>(
            `/sales/${saleId}/refunds`
        );
        return data;
    },

    /**
     * Obtiene los detalles completos de una devolución comercial.
     */
    async getRefundDetail(refundId: string): Promise<ISaleRefund> {
        const { data } = await tenantApi.get<ISaleRefund>(`/sale-refunds/${refundId}`);
        return data;
    },
};
