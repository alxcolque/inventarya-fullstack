export interface ICustomerResponse {
    id: string | number;
    name: string;
    document_type?: number | null;
    document_number?: string | null;
    document_complement?: string | null;
    cinit?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    ci?: number;
    created_at?: string;
    updated_at?: string;
}
