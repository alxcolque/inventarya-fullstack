export interface ICentralUser {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'support';
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string | null;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
  password?: string; // Solo para envíos en formularios
}

export interface ICentralUsersResponse {
  users: ICentralUser[];
  message?: string;
}
