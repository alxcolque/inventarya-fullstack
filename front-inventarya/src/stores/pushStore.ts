import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PushErrorCode = 'PUSH_PERMISSION_DENIED' | 'PUSH_FCM_REGISTRATION_FAILED' |
  'PUSH_BACKEND_REGISTRATION_FAILED' | 'PUSH_NETWORK_ERROR' | 'PUSH_UNEXPECTED_ERROR';
export interface PushFailure { code: PushErrorCode; message: string; httpStatus?: number }
export interface PushState {
  lastError: PushFailure | null;
  setLastError: (error: PushFailure | null) => void;
  token: string | null;
  permission: 'granted' | 'denied' | 'prompt' | 'default';
  isRegistered: boolean;
  isSupported: boolean;
  isInitializing: boolean;

  setToken: (token: string | null) => void;
  setPermission: (permission: 'granted' | 'denied' | 'prompt' | 'default') => void;
  setIsRegistered: (registered: boolean) => void;
  setIsSupported: (supported: boolean) => void;
  setIsInitializing: (initializing: boolean) => void;
  reset: () => void;
}

export const usePushStore = create<PushState>()(
  persist(
    (set) => ({
      lastError: null,
      setLastError: (lastError) => set({ lastError }),
      token: null,
      permission: 'default',
      isRegistered: false,
      isSupported: false,
      isInitializing: false,

      setToken: (token) => set({ token }),
      setPermission: (permission) => set({ permission }),
      setIsRegistered: (isRegistered) => set({ isRegistered }),
      setIsSupported: (isSupported) => set({ isSupported }),
      setIsInitializing: (isInitializing) => set({ isInitializing }),

      reset: () =>
        set({
          lastError: null,
          token: null,
          isRegistered: false,
          isInitializing: false,
        }),
    }),
    {
      name: 'inventarya-push-store',
      version: 1,
      migrate: () => ({ permission: 'default' as const }),
      partialize: (state) => ({
        permission: state.permission,
      }),
    }
  )
);
