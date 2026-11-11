export interface IUserRoleResponse {
    roleUsers:     RoleUser[];
    id:      number;
    role_id: number;
    role_name: string;
    status:  string;
    user:    User;
    totalRoleUser: number;
}

export interface RoleUser {
    id:      number;
    role_id: number;
    status:  string;
    user:    User;
}

export interface User {
    id:   number;
    name: string;
}
