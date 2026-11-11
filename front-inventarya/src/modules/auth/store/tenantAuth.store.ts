import { create, StateCreator } from "zustand";
import { tenantApi } from "@/api";
import { ILoginResponse, IUser } from "@/interface";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { persist } from "zustand/middleware";
import { canTenant, TenantPermission } from "@/utils/permissions";

interface AuthState {
    user: IUser | undefined;
    token: string | undefined;
    authStatus: 'pending' | 'auth' | 'not-auth';
}

interface Actions {
    logout: () => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    checkAuthStatus: () => Promise<void>;
    can: (permission: TenantPermission) => boolean;
    hasRole: (role: string) => boolean;
    clearSession: () => void;
}

import { initializePushNotifications, unregisterPushNotifications } from '@/services/pushNotificationService';
import { getTenantSlug } from '@/utils/tenant';
import { getTenantRootDomain } from '@/utils/apiConfig';
import { classifyApiError } from '@/utils/apiError';

const pushSession = (user: IUser, token: string) => {
    const slug = getTenantSlug() || '';
    const rootDomain = getTenantRootDomain();
    const domain = slug.includes('.') ? slug : (slug ? `${slug}.${rootDomain}` : '');
    return {
        tenantDomain: domain,
        tenantId: String(user.tenant_id || ''),
        userId: String(user.id),
        authToken: token,
    };
};
const storeApi: StateCreator<AuthState & Actions> = (set, get) => ({
    user: undefined,
    token: undefined,
    authStatus: 'not-auth',

    login: async (email: string, password: string) => {
        try {
            const { data } = await tenantApi.post<ILoginResponse>('/auth/login', { email, password });
            set({ user: data.user, token: data.token, authStatus: 'auth' });
            toast.success(`Bienvenido ${data.user.name}`);
            initializePushNotifications(pushSession(data.user, data.token)).catch((err) => {
                console.warn('[tenantAuth] No se pudo inicializar notificaciones push:', err);
            });
        } catch (error) {
            set({ user: undefined, token: undefined, authStatus: 'not-auth' });
            const apiError = classifyApiError(error, 'No se pudo iniciar sesión.');
            toast.error('Error de Autenticación', {
                description: apiError.message
            });
        }
    },

    can: (permission: TenantPermission) => {
        return canTenant(get().user, permission);
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
            const { data } = await tenantApi.get<{ user: IUser }>('/auth/checkToken', {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ user: data.user, token, authStatus: 'auth' });
            initializePushNotifications(pushSession(data.user, token), false).catch((err) => {
                console.warn('[tenantAuth] No se pudo actualizar notificaciones push:', err);
            });
        } catch (error) {
            const apiError = classifyApiError(error);
            if (apiError.status === 401) {
                set({ user: undefined, token: undefined, authStatus: 'not-auth' });
            } else {
                console.warn('[tenantAuth] No se pudo verificar el token debido a error de comunicación o servidor:', apiError.message);
            }
        }
    },

    logout: async () => {
        const token = get().token;
        try {
            await unregisterPushNotifications().catch((err) => {
                console.warn('[tenantAuth] No se pudo desuscribir notificaciones push:', err);
            });
            if (token) {
                await tenantApi.post('/auth/logout', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        } catch (error) {
            console.warn('[tenantAuth] No se pudo cerrar la sesión en el servidor:', error);
        } finally {
            set({ user: undefined, token: undefined, authStatus: 'not-auth' });
        }
    },

    clearSession: () => {
        void unregisterPushNotifications().catch(() => {});
        set({ user: undefined, token: undefined, authStatus: 'not-auth' });
    }
});

export const useTenantAuthStore = create<AuthState & Actions>()(
    persist(storeApi, {
        name: 'tenant-auth-store',
        version: 3,
        migrate: () => ({ user: undefined, token: undefined, authStatus: 'not-auth' as const }),
        onRehydrateStorage: () => (state) => {
            if (state) {
                state.authStatus = state.user ? 'auth' : 'not-auth';
            }
        },
    })
);
