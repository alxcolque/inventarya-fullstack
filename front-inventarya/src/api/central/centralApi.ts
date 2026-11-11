import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';

import { getApiBaseUrl } from '@/utils/apiConfig';

export const centralApi = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

centralApi.interceptors.request.use((config) => {
    const token = useCentralAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor: automatically close session on 401 / Unauthenticated
centralApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.message;

            const isUnauthenticated =
                status === 401 ||
                (typeof message === 'string' && (
                    message.toLowerCase().includes('unauthenticated') ||
                    message.toLowerCase().includes('no autenticado') ||
                    message.toLowerCase().includes('no autorizado')
                ));

            const isLoginRequest = error.config?.url?.includes('/auth/login');

            if (isUnauthenticated && !isLoginRequest) {
                const store = useCentralAuthStore.getState();
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
