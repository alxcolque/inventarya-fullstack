
// Polyfill process and global for Vite / browser environments
if (typeof window !== 'undefined') {
  (window as any).global = (window as any).global || window;
  (window as any).process = (window as any).process || { env: { NODE_ENV: import.meta.env.MODE || 'development' } };
}

import { createRoot } from 'react-dom/client'
import './index.css'
import { Providers } from './layouts';
import { registerServiceWorker } from './serviceWorkerRegistration';
import { initDecimalInputInterceptor } from '@/utils/decimal-input';

initDecimalInputInterceptor();

import { Capacitor } from '@capacitor/core';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { preparePushNotifications, reportPushError } from '@/services/pushNotificationService';
if (!Capacitor.isNativePlatform()) registerServiceWorker();
void preparePushNotifications().catch(reportPushError).then(async () => {
  if (Capacitor.isNativePlatform() && useTenantAuthStore.getState().token) {
    await useTenantAuthStore.getState().checkAuthStatus();
  }
});

createRoot(document.getElementById('root')!).render(
    <Providers/>
);

