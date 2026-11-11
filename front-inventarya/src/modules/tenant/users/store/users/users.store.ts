import { create } from "zustand";
import { tenantApi } from "@/api";
import { IUsersResponse, UserRole, UserStatus } from "../../interfaces/users/users-response";
import { toast } from "sonner";
import { isAxiosError } from "axios";

export interface UserFormData {
  name: string;
  email: string;
  username?: string | null;
  password?: string;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
  ci?: string | null;
  avatar?: string | null;
}

export type CreateEmployeeData = Omit<UserFormData, 'password' | 'status'>;

interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
}

interface UserState {
  users: IUsersResponse[];
  user: IUsersResponse | null;
  isLoading: boolean;
  isSaving: boolean;
}

interface Actions {
  getUsers: (filters?: UserFilters) => Promise<void>;
  getUser: (id: number) => Promise<IUsersResponse | null>;
  createUser: (data: CreateEmployeeData) => Promise<boolean>;
  updateUser: (id: number, data: Partial<UserFormData>) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
  updateRole: (id: number, data: { role?: UserRole; status?: UserStatus }) => Promise<boolean>;
  resendInvitation: (id: number) => Promise<boolean>;
}

export const useUsersStore = create<UserState & Actions>((set, get) => ({
  users: [],
  user: null,
  isLoading: false,
  isSaving: false,

  getUsers: async (filters) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.role && filters.role !== "all") params.append("role", filters.role);
      if (filters?.status && filters.status !== "all") params.append("status", filters.status);

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await tenantApi.get<IUsersResponse[]>(`/users${queryString}`);
      set({ users: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al cargar usuarios", {
          description: error.response?.data?.message || error.response?.data?.error || error.message,
        });
      }
    }
  },

  getUser: async (id: number) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.get<IUsersResponse>(`/users/${id}`);
      set({ user: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al cargar usuario", {
          description: error.response?.data?.message || error.message,
        });
      }
      return null;
    }
  },

  createUser: async (data: CreateEmployeeData) => {
    set({ isSaving: true });
    try {
      const response = await tenantApi.post<{
        message: string;
        user: IUsersResponse;
        invitation_sent: boolean;
      }>("/users", data);
      if (response.data.invitation_sent) {
        toast.success(response.data.message);
      } else {
        toast.warning(response.data.message);
      }
      set({ isSaving: false });
      await get().getUsers();
      return true;
    } catch (error) {
      set({ isSaving: false });
      if (isAxiosError(error)) {
        const errorData = error.response?.data;
        const msg = errorData?.message || errorData?.error || "Error al crear el usuario";
        const validationErrors = errorData?.errors;
        if (validationErrors) {
          const firstKey = Object.keys(validationErrors)[0];
          const firstDetail = validationErrors[firstKey]?.[0];
          toast.error(msg, { description: firstDetail });
        } else {
          toast.error(msg);
        }
      }
      return false;
    }
  },

  updateUser: async (id: number, data: Partial<UserFormData>) => {
    set({ isSaving: true });
    try {
      const response = await tenantApi.put<{
        message: string;
        user: IUsersResponse;
        invitation_sent?: boolean | null;
      }>(`/users/${id}`, data);
      if (response.data.invitation_sent === false) {
        toast.warning(response.data.message);
      } else {
        toast.success(response.data.message || "Usuario actualizado correctamente");
      }
      set({ isSaving: false });
      await get().getUsers();
      return true;
    } catch (error) {
      set({ isSaving: false });
      if (isAxiosError(error)) {
        const errorData = error.response?.data;
        const msg = errorData?.message || errorData?.error || "Error al actualizar el usuario";
        const validationErrors = errorData?.errors;
        if (validationErrors) {
          const firstKey = Object.keys(validationErrors)[0];
          const firstDetail = validationErrors[firstKey]?.[0];
          toast.error(msg, { description: firstDetail });
        } else {
          toast.error(msg);
        }
      }
      return false;
    }
  },

  deleteUser: async (id: number) => {
    set({ isSaving: true });
    try {
      const response = await tenantApi.delete<{ message: string }>(`/users/${id}`);
      toast.success(response.data.message || "Usuario eliminado correctamente");
      set({ isSaving: false });
      await get().getUsers();
      return true;
    } catch (error) {
      set({ isSaving: false });
      if (isAxiosError(error)) {
        toast.error("Error al eliminar el usuario", {
          description: error.response?.data?.message || error.response?.data?.error || error.message,
        });
      }
      return false;
    }
  },

  updateRole: async (id: number, data: { role?: UserRole; status?: UserStatus }) => {
    try {
      const response = await tenantApi.put<{ message: string; user: IUsersResponse }>(`/user-update-role/${id}`, data);
      toast.success(response.data.message || "Rol / Estado actualizado correctamente");
      await get().getUsers();
      return true;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error("Error al actualizar rol", {
          description: error.response?.data?.message || error.response?.data?.error || error.message,
        });
      }
      return false;
    }
  },

  resendInvitation: async (id: number) => {
    set({ isSaving: true });
    try {
      const response = await tenantApi.post<{
        message: string;
        invitation_sent: boolean;
      }>(`/users/${id}/resend-invitation`);
      if (response.data.invitation_sent) {
        toast.success(response.data.message);
      } else {
        toast.warning(response.data.message);
      }
      await get().getUsers();
      return response.data.invitation_sent;
    } catch (error) {
      if (isAxiosError(error)) {
        toast.error("No se pudo reenviar la invitación", {
          description: error.response?.data?.message || error.response?.data?.error || error.message,
        });
      }
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
}));
