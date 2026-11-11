export type UserRole = 'owner' | 'admin' | 'staff';
export type UserStatus = 'active' | 'inactive' | 'pending_activation';

export interface IUserInvitationSummary {
    id: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
}

export interface IUsersResponse {
    id: number;
    name: string;
    email: string;
    username?: string | null;
    avatar?: string | null;
    avatar_key?: string | null;
    role: UserRole;
    status: UserStatus;
    latest_invitation?: IUserInvitationSummary | null;
    phone?: string | null;
    ci?: string | null;
    created_at?: string;
    updated_at?: string;
}

