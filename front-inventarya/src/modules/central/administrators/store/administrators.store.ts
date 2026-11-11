import { create } from "zustand";
import { centralApi } from "@/api";
import { ICentralUser } from "../interfaces/central-user.interface";
import { toast } from "sonner";

interface AdministratorsState {
  users: ICentralUser[];
  isLoading: boolean;
}

interface Actions {
  getUsers: () => Promise<void>;
  createUser: (data: Partial<ICentralUser>) => Promise<boolean>;
  updateUser: (id: number, data: Partial<ICentralUser>) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
}

export const useAdministratorsStore = create<AdministratorsState & Actions>((set, get) => ({
  users: [],
  isLoading: false,

  getUsers: async () => {
    set({ isLoading: true });
    try {
      const { data } = await centralApi.get<ICentralUser[]>("/central-users");
      set({ users: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error("Error al cargar administradores");
    }
  },

  createUser: async (data) => {
    set({ isLoading: true });
    try {
      await centralApi.post("/central-users", data);
      toast.success("Administrador creado correctamente");
      get().getUsers();
      return true;
    } catch (error: any) {
      set({ isLoading: false });
      const message = error.response?.data?.message || "Error al crear administrador";
      toast.error(message);
      return false;
    }
  },

  updateUser: async (id, data) => {
    set({ isLoading: true });
    try {
      await centralApi.put(`/central-users/${id}`, data);
      toast.success("Administrador actualizado correctamente");
      get().getUsers();
      return true;
    } catch (error: any) {
      set({ isLoading: false });
      const message = error.response?.data?.message || "Error al actualizar administrador";
      toast.error(message);
      return false;
    }
  },

  deleteUser: async (id) => {
    set({ isLoading: true });
    try {
      await centralApi.delete(`/central-users/${id}`);
      toast.success("Administrador eliminado");
      get().getUsers();
      return true;
    } catch (error: any) {
      set({ isLoading: false });
      const message = error.response?.data?.message || "Error al eliminar administrador";
      toast.error(message);
      return false;
    }
  },
}));
