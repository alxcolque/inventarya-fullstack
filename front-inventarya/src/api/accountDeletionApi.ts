import { centralApi } from './central/centralApi';
import { tenantApi } from './tenant/tenantApi';
import { isCentral } from '@/utils/tenant';

export interface PublicDeletionRequestPayload {
  email: string;
  tenant: string;
  reason?: string;
}

export interface DeletionRequestResponse {
  success: boolean;
  message: string;
  ticket?: string;
  is_owner?: boolean;
  user_role?: string;
}

export interface DeletionStatusResponse {
  success: boolean;
  ticket: string;
  status: 'pending_verification' | 'verified_employee_deleted' | 'verified_owner_review' | 'expired';
  status_label: string;
  email: string;
  tenant_name: string;
  requested_at: string;
  expires_at: string;
  completed_at?: string | null;
  notes?: string;
  message?: string;
}

export interface DeletionConfirmResponse {
  success: boolean;
  message: string;
  status: string;
  ticket: string;
  user_type: 'employee' | 'owner';
  details?: string;
}

export interface TenantMyStatusItem {
  ticket: string;
  status: string;
  is_owner: boolean;
  requested_at: string;
  expires_at: string;
  completed_at?: string | null;
}

export interface TenantMyStatusResponse {
  success: boolean;
  requests: TenantMyStatusItem[];
}

export const accountDeletionApi = {
  /**
   * Enviar solicitud pública de eliminación de cuenta.
   * Cuenta con protección anti-enumeración tanto en backend como frontend.
   */
  requestPublicDeletion: async (payload: PublicDeletionRequestPayload): Promise<DeletionRequestResponse> => {
    if (isCentral()) {
      const { data } = await centralApi.post<DeletionRequestResponse>(
        '/public/account-deletion/request',
        payload
      );
      return data;
    } else {
      const { data } = await tenantApi.post<DeletionRequestResponse>(
        '/account-deletion/public-request',
        payload
      );
      return data;
    }
  },

  /**
   * Consultar el estado de una solicitud mediante su ticket único (DEL-XXXXXXXX).
   */
  checkStatus: async (ticket: string): Promise<DeletionStatusResponse> => {
    const cleanTicket = ticket.trim().toUpperCase();
    if (isCentral()) {
      const { data } = await centralApi.get<DeletionStatusResponse>(
        `/public/account-deletion/status?ticket=${encodeURIComponent(cleanTicket)}`
      );
      return data;
    } else {
      const { data } = await tenantApi.get<DeletionStatusResponse>(
        `/account-deletion/status?ticket=${encodeURIComponent(cleanTicket)}`
      );
      return data;
    }
  },

  /**
   * Confirmar la eliminación mediante el token criptográfico enviado al correo.
   */
  confirmDeletion: async (token: string): Promise<DeletionConfirmResponse> => {
    if (isCentral()) {
      const { data } = await centralApi.post<DeletionConfirmResponse>(
        '/public/account-deletion/confirm',
        { token }
      );
      return data;
    } else {
      const { data } = await tenantApi.post<DeletionConfirmResponse>(
        '/account-deletion/confirm',
        { token }
      );
      return data;
    }
  },

  /**
   * Solicitar eliminación desde la sesión autenticada del tenant (empleado o propietario).
   */
  requestAuthenticatedTenantDeletion: async (reason?: string): Promise<DeletionRequestResponse> => {
    const { data } = await tenantApi.post<DeletionRequestResponse>(
      '/account-deletion/request',
      { reason }
    );
    return data;
  },

  /**
   * Consultar estado de solicitudes activas para el usuario autenticado del tenant.
   */
  getMyTenantStatus: async (): Promise<TenantMyStatusResponse> => {
    const { data } = await tenantApi.get<TenantMyStatusResponse>(
      '/account-deletion/my-status'
    );
    return data;
  },
};
