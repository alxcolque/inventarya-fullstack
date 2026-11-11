import axios from 'axios';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { PushNotifications, type PushNotificationSchema, type Channel } from '@capacitor/push-notifications';
import { toast } from 'sonner';
import { usePushStore, type PushErrorCode } from '@/stores/pushStore';
import { registerDeviceToken, removeDeviceToken, type DeviceSession } from './deviceTokenApi';
import useNotificationStore from '@/modules/shared/store/notifications/notifications.store';
import { isSafeInternalRoute } from '@/utils/safeRoute';
import { getNativeTenant } from '@/utils/nativeTenant';

export const ANDROID_CHANNELS: Channel[] = [
  { id: 'general', name: 'General', importance: 3, visibility: 0 },
  { id: 'inventory', name: 'Inventario', importance: 3, visibility: 0 },
  { id: 'sales', name: 'Ventas', importance: 3, visibility: 0 },
  { id: 'transfers', name: 'Transferencias', importance: 3, visibility: 0 },
  { id: 'important', name: 'Importantes', importance: 4, visibility: 0 },
];
const messages: Record<PushErrorCode, string> = {
  PUSH_PERMISSION_DENIED: 'No se concedió permiso para notificaciones. Puedes habilitarlo en ajustes de Android.',
  PUSH_FCM_REGISTRATION_FAILED: 'Android no pudo obtener el registro FCM. Vuelve a intentar.',
  PUSH_BACKEND_REGISTRATION_FAILED: 'No se pudo registrar el dispositivo en el tenant.',
  PUSH_NETWORK_ERROR: 'No se pudo conectar con la API. Comprueba tu conexión e intenta nuevamente.',
  PUSH_UNEXPECTED_ERROR: 'No se pudo preparar Push en este dispositivo.',
};
/** Never log raw plugin/Axios errors: they can contain credentials and tokens. */
export function reportPushError(error: unknown, stage: PushErrorCode = 'PUSH_UNEXPECTED_ERROR') {
  const httpStatus = axios.isAxiosError(error) ? error.response?.status : undefined;
  const code = stage === 'PUSH_BACKEND_REGISTRATION_FAILED' && axios.isAxiosError(error) && !error.response
    ? 'PUSH_NETWORK_ERROR' : stage;
  const failure = { code, message: messages[code], httpStatus };
  usePushStore.getState().setLastError(failure);
  if (import.meta.env.DEV) console.warn('[Push]', { code, httpStatus });
}

let active: DeviceSession | null = null;
let token: string | null = null;
let registered: { token: string; session: DeviceSession } | null = null;
let listeners: Promise<void> | null = null;
let operations: Promise<void> = Promise.resolve();
let initialization: Promise<boolean> | null = null;
let navigator: ((route: string) => void) | null = null;
let pending: { route: string; domain: string | null; tenantId?: string } | null = null;

const android = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const sameSession = (a: DeviceSession, b: DeviceSession) =>
  a.tenantId === b.tenantId && a.tenantDomain === b.tenantDomain && a.userId === b.userId && a.authToken === b.authToken;
const enqueue = (task: () => Promise<void>) => {
  const result = operations.then(task);
  operations = result.catch((error: unknown) => reportPushError(error));
  return result;
};

function flushAction() {
  if (!pending || !navigator || !active) return;
  const action = pending;
  pending = null;
  if (action.domain !== active.tenantDomain ||
    (action.tenantId && action.tenantId !== active.tenantId)) return;
  navigator(action.route);
}
export function setPushNavigator(navigate: ((route: string) => void) | null) {
  navigator = navigate;
  flushAction();
}
function action(notification: PushNotificationSchema) {
  const data = notification.data || {};
  const route: unknown = data.route ?? data.action_url;
  if (!isSafeInternalRoute(route)) return;
  pending = {
    route, domain: active?.tenantDomain ?? getNativeTenant(),
    tenantId: typeof data.tenant_id === 'string' ? data.tenant_id : undefined
  };
  flushAction();
}
function foreground(notification: PushNotificationSchema) {
  if (!active) return;
  const data = notification.data || {};
  if (data.tenant_id && String(data.tenant_id) !== active.tenantId) return;
  const route = isSafeInternalRoute(data.route ?? data.action_url) ? (data.route ?? data.action_url) as string : null;
  const id = String(data.notification_id || notification.id);
  const title = notification.title || 'Nueva notificación';
  const severity = ['info', 'success', 'warning', 'critical', 'danger'].includes(data.severity) ? data.severity : 'info';
  const added = useNotificationStore.getState().addRealtimeNotification({
    id, type: String(data.type || 'general'), title, message: notification.body || '',
    severity, action_url: route, data, read_at: null, created_at: new Date().toISOString(),
  });
  if (added) toast.info(title, {
    description: notification.body,
    action: route ? { label: 'Ver', onClick: () => action(notification) } : undefined
  });
}
async function syncToken() {
  const session = active;
  const value = token;
  if (!session || !value) return;
  await enqueue(async () => {
    if (active !== session) return;
    if (registered?.token === value && sameSession(registered.session, session)) return;
    const previous = registered;
    try {
      const info = await NativeApp.getInfo();
      await registerDeviceToken(value, session, info.version);
      if (active !== session) {
        await removeDeviceToken(value, session).catch((error: unknown) => reportPushError(error, 'PUSH_BACKEND_REGISTRATION_FAILED'));
        return;
      }
      registered = { token: value, session };
      usePushStore.getState().setIsRegistered(true);
      usePushStore.getState().setLastError(null);
      if (previous && previous.token !== value) {
        await removeDeviceToken(previous.token, previous.session).catch((error: unknown) => reportPushError(error, 'PUSH_BACKEND_REGISTRATION_FAILED'));
      }
    } catch (error) {
      usePushStore.getState().setIsRegistered(false);
      reportPushError(error, 'PUSH_BACKEND_REGISTRATION_FAILED');
    }
  });
}
/** Installed before authentication so cold-start notification taps are retained. */
export function preparePushNotifications(): Promise<void> {
  if (!android()) return Promise.resolve();
  if (listeners) return listeners;
  const handles: PluginListenerHandle[] = [];
  listeners = (async () => {
    handles.push(await PushNotifications.addListener('registration', (result) => {
      token = result.value;
      usePushStore.getState().setToken(token);
      void syncToken();
    }));
    handles.push(await PushNotifications.addListener('registrationError', (error) => {
      usePushStore.getState().setIsRegistered(false);
      reportPushError(error, 'PUSH_FCM_REGISTRATION_FAILED');
    }));
    handles.push(await PushNotifications.addListener('pushNotificationReceived', foreground));
    handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', (result) => action(result.notification)));
    handles.push(await NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && active && usePushStore.getState().permission !== 'denied') {
        void initializePushNotifications(active, false);
      }
    }));
  })().catch(async (error: unknown) => {
    for (const handle of handles) {
      try { await handle.remove(); } catch (cleanupError) { reportPushError(cleanupError); }
    }
    listeners = null;
    throw error;
  });
  return listeners;
}
export async function initializePushNotifications(session: DeviceSession, requestPermission = true): Promise<boolean> {
  if (!android() || !session.tenantDomain || !session.authToken) return false;
  if (active && !sameSession(active, session)) await unregisterPushNotifications();
  if (!active || !sameSession(active, session)) active = session;
  if (initialization) return initialization;
  const current = active;
  initialization = (async () => {
    const state = usePushStore.getState();
    state.setIsSupported(true);
    state.setIsInitializing(true);
    state.setLastError(null);
    try {
      await preparePushNotifications();
      flushAction();
      for (const channel of ANDROID_CHANNELS) await PushNotifications.createChannel(channel);
      let permission = await PushNotifications.checkPermissions();
      if (requestPermission && ['prompt', 'prompt-with-rationale'].includes(permission.receive)) {
        permission = await PushNotifications.requestPermissions();
      }
      state.setPermission(permission.receive === 'prompt-with-rationale' ? 'prompt' : permission.receive);
      if (active !== current) return false;
      if (permission.receive !== 'granted') {
        state.setIsRegistered(false);
        reportPushError(undefined, 'PUSH_PERMISSION_DENIED');
        return false;
      }
      try {
        await PushNotifications.register();
      } catch (error) {
        reportPushError(error, 'PUSH_FCM_REGISTRATION_FAILED');
        return false;
      }
      if (token) await syncToken();
      flushAction();
      return true;
    } catch (error) { reportPushError(error); return false; }
    finally { state.setIsInitializing(false); initialization = null; }
  })();
  return initialization;
}
export async function unregisterPushNotifications(): Promise<void> {
  const old = registered;
  const oldSession = active;
  const oldToken = token;
  active = null;
  pending = null;
  registered = null;
  token = null;
  await initialization;
  await enqueue(async () => {
    const session = old?.session ?? oldSession;
    const value = old?.token ?? oldToken;
    if (session && value) await removeDeviceToken(value, session).catch((error: unknown) => reportPushError(error, 'PUSH_BACKEND_REGISTRATION_FAILED'));
    if (android()) {
      await PushNotifications.unregister().catch((error: unknown) => reportPushError(error));
      await PushNotifications.removeAllDeliveredNotifications().catch((error: unknown) => reportPushError(error));
    }
  });
  usePushStore.getState().reset();
}

/** Explicit user action after permission refusal or a temporary network failure. */
export async function retryPushRegistration(): Promise<boolean> {
  return active ? initializePushNotifications(active, true) : false;
}
