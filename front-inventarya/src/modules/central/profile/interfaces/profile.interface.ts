export interface CentralProfile {
  id: number;
  name: string;
  email: string;
  role: "superadmin" | "support" | string;
  status: "active" | "inactive" | "suspended" | string;
  avatar: string | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UpdateCentralProfilePayload {
  name: string;
  email: string;
  avatar?: string | null;
}

export interface UpdateCentralPasswordPayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export interface CentralProfileResponse {
  message?: string;
  profile: CentralProfile;
}
