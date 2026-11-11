export interface IUser {
    id:       number;
    name:     string;
    email:    string;
    username: string | null;
    avatar:   string | null;
    role:     'superadmin' | 'support' | 'owner' | 'admin' | 'staff' | string;
    tenant_id?: string | null;
}
