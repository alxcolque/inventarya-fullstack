import { create } from "zustand";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { centralApi } from "@/api";
import { useCentralAuthStore } from "@/modules/auth/store/centralAuth.store";
import type {
  CentralProfile,
  CentralProfileResponse,
  UpdateCentralPasswordPayload,
  UpdateCentralProfilePayload,
} from "../interfaces/profile.interface";

interface ProfileState {
  profile: CentralProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  isChangingPassword: boolean;
  error: string | null;
}

interface ProfileActions {
  getProfile: () => Promise<boolean>;
  updateProfile: (payload: UpdateCentralProfilePayload) => Promise<boolean>;
  changePassword: (payload: UpdateCentralPasswordPayload) => Promise<boolean>;
}

type ErrorPayload = {
  message?: string;
  errors?: Record<string, string[]>;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError<ErrorPayload>(error)) return fallback;

  const firstValidationError = Object.values(error.response?.data?.errors ?? {})[0]?.[0];
  return firstValidationError || error.response?.data?.message || fallback;
};

const syncAuthenticatedUser = (profile: CentralProfile) => {
  useCentralAuthStore.getState().updateCurrentUser({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    username: null,
    avatar: profile.avatar,
    role: profile.role,
  });
};

export const useCentralProfileStore = create<ProfileState & ProfileActions>((set) => ({
  profile: null,
  isLoading: false,
  isSaving: false,
  isChangingPassword: false,
  error: null,

  getProfile: async () => {
    const authenticatedUserId = useCentralAuthStore.getState().user?.id;
    set((state) => ({
      profile: state.profile?.id === authenticatedUserId ? state.profile : null,
      isLoading: true,
      error: null,
    }));

    try {
      const { data } = await centralApi.get<CentralProfileResponse>("/auth/profile");
      set({ profile: data.profile, isLoading: false });
      syncAuthenticatedUser(data.profile);
      return true;
    } catch (error) {
      const message = getErrorMessage(error, "No se pudo cargar el perfil.");
      set({ isLoading: false, error: message });
      toast.error("Error al obtener el perfil", { description: message });
      return false;
    }
  },

  updateProfile: async (payload) => {
    set({ isSaving: true });

    try {
      const { data } = await centralApi.put<CentralProfileResponse>("/auth/profile", payload);
      set({ profile: data.profile, isSaving: false, error: null });
      syncAuthenticatedUser(data.profile);
      toast.success(data.message || "Perfil actualizado correctamente.");
      return true;
    } catch (error) {
      const message = getErrorMessage(error, "No se pudo actualizar el perfil.");
      set({ isSaving: false });
      toast.error("No se guardaron los cambios", { description: message });
      return false;
    }
  },

  changePassword: async (payload) => {
    set({ isChangingPassword: true });

    try {
      const { data } = await centralApi.put<{ message: string }>(
        "/auth/profile/password",
        payload,
      );
      set({ isChangingPassword: false });
      toast.success(data.message || "Contraseña actualizada correctamente.");
      return true;
    } catch (error) {
      const message = getErrorMessage(error, "No se pudo actualizar la contraseña.");
      set({ isChangingPassword: false });
      toast.error("No se cambió la contraseña", { description: message });
      return false;
    }
  },
}));
