import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { getTenantRequestHeader } from '@/utils/tenant';

import { getApiBaseUrl } from '@/utils/apiConfig';

export const tenantApi = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

tenantApi.interceptors.request.use((config) => {
    const token = useTenantAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const tenantHeader = getTenantRequestHeader();
    if (tenantHeader) {
        config.headers[tenantHeader.name] = tenantHeader.value;
    }
    return config;
});

// Response interceptor: automatically close session on 401 / Unauthenticated
tenantApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.message;

            const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';

            const isUnauthenticated =
                status === 401 ||
                normalizedMessage.includes('unauthenticated') ||
                normalizedMessage.includes('no autenticado') ||
                normalizedMessage.includes('no autorizado');

            // Tenant access can also be revoked while a persisted session is still
            // present (deleted/inactive user, inactive/suspended store or tenant).
            // Only treat 403/404 as session-invalidating when the backend message
            // explicitly describes an authentication/account/store state.
            const isRevokedTenantSession =
                (status === 403 || status === 404) && [
                    'user not found',
                    'usuario no encontrado',
                    'user inactive',
                    'usuario inactivo',
                    'inactive user',
                    'store inactive',
                    'inactive store',
                    'tienda inactiva',
                    'sucursal inactiva',
                    'tenant inactive',
                    'tenant suspended',
                    'tenant inactivo',
                    'tenant suspendido',
                    'suspended',
                    'suspendido',
                ].some((reason) => normalizedMessage.includes(reason));

            const isLoginRequest = error.config?.url?.includes('/auth/login');

            if ((isUnauthenticated || isRevokedTenantSession) && !isLoginRequest) {
                const store = useTenantAuthStore.getState();
                const hasSession = store.authStatus === 'auth' || !!store.token;

                if (hasSession) {
                    store.clearSession();

                    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                        if (Capacitor.isNativePlatform()) {
                            window.history.replaceState(null, '', '/login');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                        } else {
                            window.location.href = '/login';
                        }
                    }
                }
            }
        }
        return Promise.reject(error);
    }
);
