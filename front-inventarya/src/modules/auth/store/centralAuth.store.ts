import { create, StateCreator } from "zustand";
import { centralApi } from "@/api";
import { ILoginResponse, IUser } from "@/interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { persist } from "zustand/middleware";
import { canCentral, CentralPermission } from "@/utils/permissions";

interface AuthState {
    user: IUser | undefined;
    token: string | undefined;
    authStatus: 'pending' | 'auth' | 'not-auth';
}

interface Actions {
    logout: () => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    checkAuthStatus: () => Promise<void>;
    can: (permission: CentralPermission) => boolean;
    hasRole: (role: string) => boolean;
    clearSession: () => void;
    updateCurrentUser: (user: IUser) => void;
}

import { classifyApiError } from "@/utils/apiError";

const storeApi: StateCreator<AuthState & Actions> = (set, get) => ({
    user: undefined,
    token: undefined,
    authStatus: 'not-auth',

    login: async (email: string, password: string) => {
        try {
            const { data } = await centralApi.post<ILoginResponse>('/auth/login', { email, password });
            set({ user: data.user, token: data.token, authStatus: 'auth' });
            toast.success(`Bienvenido ${data.user.name}`);
        } catch (error) {
            set({ user: undefined, token: undefined, authStatus: 'not-auth' });
            const apiError = classifyApiError(error, 'No se pudo iniciar sesión.');
            toast.error('Error de Autenticación', {
                description: apiError.message
            });
        }
    },

    can: (permission: CentralPermission) => {
        return canCentral(get().user, permission);
    },

    hasRole: (role: string) => {
        return get().user?.role === role;
    },

    checkAuthStatus: async () => {
        const token = get().token;
        if (!token) {
            set({ user: undefined, token: undefined, authStatus: 'not-auth' });
            return;
        }
        try {
            const { data } = await centralApi.get<{ user: IUser }>('/auth/checkToken', {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ user: data.user, token, authStatus: 'auth' });
        } catch (error) {
            const apiError = classifyApiError(error);
            if (apiError.status === 401) {
                set({ user: undefined, token: undefined, authStatus: 'not-auth' });
            } else {
                console.warn('[centralAuth] No se pudo verificar el token debido a error de comunicación o servidor:', apiError.message);
            }
        }
    },

    logout: async () => {
        const token = get().token;
        try {
            if (token) {
                await centralApi.post('/auth/logout', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        } catch (error) {
            console.warn('[centralAuth] No se pudo cerrar la sesión en el servidor:', error);
        } finally {
            set({ user: undefined, token: undefined, authStatus: 'not-auth' });
        }
    },

    clearSession: () => {
        set({ user: undefined, token: undefined, authStatus: 'not-auth' });
    },

    updateCurrentUser: (user) => {
        set({ user });
    }
});

export const useCentralAuthStore = create<AuthState & Actions>()(
    persist(storeApi, {
        name: 'central-auth-store',
        version: 3,
        migrate: () => ({ user: undefined, token: undefined, authStatus: 'not-auth' as const }),
        onRehydrateStorage: () => (state) => {
            if (state) {
                state.authStatus = state.user ? 'auth' : 'not-auth';
            }
        },
    })
);
