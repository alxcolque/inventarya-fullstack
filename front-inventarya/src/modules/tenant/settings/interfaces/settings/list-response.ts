export interface IListSettings {
    id: number;
    business_name: string;
    logo?: string | null;
    favicon?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    theme?: 'light' | 'dark';
    primary_color?: string | null;
    terms?: string | null;
    policy?: string | null;
    currency?: string;
    timezone?: string;
    social?: {
        facebook?: string;
        instagram?: string;
        tiktok?: string;
        whatsapp?: string;
    } | null;
    created_at?: string;
    updated_at?: string;
    enable_customers?: boolean;
    enable_suppliers?: boolean;
    enable_locations?: boolean;
    electronic_invoicing_enabled?: boolean;
    tax_nit?: string | null;
    tax_business_name?: string | null;
    siat_environment?: number | null;
    siat_modality?: number | null;
    siat_system_code?: string | null;
    siat_token_configured?: boolean;
    siat_certificate_password_configured?: boolean;
    siat_certificate_path?: string | null;
    electronic_invoicing_status?: 'disabled' | 'incomplete' | 'configured';
    // Backward compatibility
    name?: string;
    description?: string;
    header?: string;
    contact?: string;
    support?: string;
    footer?: string;
}
