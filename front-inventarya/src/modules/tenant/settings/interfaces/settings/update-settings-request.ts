import { IListSettings } from "./list-response";

/**
 * Credenciales y secretos permitidos EXCLUSIVAMENTE al enviar actualizaciones hacia el backend.
 * Nunca forman parte del contrato de respuesta del servidor (IListSettings).
 */
export interface IUpdateSiatSettings {
    siat_api_token?: string;
    siat_certificate_password?: string;
}

/**
 * Contrato de payload para actualizar la configuración de settings desde el frontend.
 */
export type IUpdateSettingPayload = Partial<
    Omit<
        IListSettings,
        | 'siat_token_configured'
        | 'siat_certificate_password_configured'
        | 'electronic_invoicing_status'
        | 'created_at'
        | 'updated_at'
    >
> & IUpdateSiatSettings;
