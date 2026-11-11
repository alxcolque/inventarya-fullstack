import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  native: true,
  callbacks: {} as Record<string, (value: any) => void>,
  register: vi.fn(), unregister: vi.fn(), post: vi.fn(), remove: vi.fn(),
  state: { setToken: vi.fn(), setPermission: vi.fn(), setIsRegistered: vi.fn(),
    setIsSupported: vi.fn(), setIsInitializing: vi.fn(), reset: vi.fn(), setLastError: vi.fn() },
  checkPermissions: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: {
  isNativePlatform: () => mocks.native, getPlatform: () => mocks.native ? 'android' : 'web',
} }));
vi.mock('@capacitor/app', () => ({ App: {
  getInfo: async () => ({ version: '1.0' }), addListener: async () => ({ remove: async () => {} }),
} }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {
  addListener: async (name: string, cb: (value: any) => void) => {
    mocks.callbacks[name] = cb; return { remove: async () => {} };
  },
  checkPermissions: mocks.checkPermissions,
  requestPermissions: async () => ({ receive: 'granted' }),
  register: mocks.register, unregister: mocks.unregister,
  createChannel: async () => {}, removeAllDeliveredNotifications: async () => {},
} }));
vi.mock('@/stores/pushStore', () => ({ usePushStore: { getState: () => mocks.state } }));
vi.mock('@/services/deviceTokenApi', () => ({ registerDeviceToken: mocks.post, removeDeviceToken: mocks.remove }));
vi.mock('@/utils/nativeTenant', () => ({ getNativeTenant: () => 'demo.inventarya.com' }));
vi.mock('@/modules/shared/store/notifications/notifications.store', () => ({
  default: { getState: () => ({ addRealtimeNotification: () => true }) },
}));
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));

const session = { tenantDomain: 'demo.inventarya.com', tenantId: 'demo', userId: '1', authToken: 'test-token' };
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.native = true;
  mocks.callbacks = {};
  mocks.post.mockResolvedValue({});
  mocks.remove.mockResolvedValue({});
  mocks.register.mockResolvedValue(undefined);
  mocks.unregister.mockResolvedValue(undefined);
  mocks.checkPermissions.mockResolvedValue({ receive: 'granted' });
});
describe('existing push service mobile lifecycle', () => {
  it('does nothing on web', async () => {
    mocks.native = false;
    const service = await import('./pushNotificationService');
    expect(await service.initializePushNotifications(session)).toBe(false);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('registers after auth, deduplicates callbacks and replaces renewed tokens', async () => {
    const service = await import('./pushNotificationService');
    await service.preparePushNotifications();
    mocks.callbacks.registration({ value: 'first' });
    expect(mocks.post).not.toHaveBeenCalled();
    await service.initializePushNotifications(session);
    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith('first', session, '1.0');
    mocks.callbacks.registration({ value: 'first' });
    await service.initializePushNotifications(session, false);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.callbacks.registration({ value: 'second' });
    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('first', session));
    await service.unregisterPushNotifications();
    expect(mocks.remove).toHaveBeenCalledWith('second', session);
    expect(mocks.unregister).toHaveBeenCalled();
  });
  it('retains cold-start taps and refuses external routes', async () => {
    const service = await import('./pushNotificationService');
    const navigate = vi.fn();
    service.setPushNavigator(navigate);
    await service.preparePushNotifications();
    mocks.callbacks.pushNotificationActionPerformed({ notification: { data: { route: '/sales/123' } } });
    expect(navigate).not.toHaveBeenCalled();
    await service.initializePushNotifications(session);
    expect(navigate).toHaveBeenCalledWith('/sales/123');
    mocks.callbacks.pushNotificationActionPerformed({ notification: { data: { route: '//evil.test' } } });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it('does not attach a late token registration to a logged-out session', async () => {
    const service = await import('./pushNotificationService');
    await service.initializePushNotifications(session);
    await service.unregisterPushNotifications();
    mocks.callbacks.registration({ value: 'late' });
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('does not register when permission is denied, or throw on backend failure', async () => {
    const service = await import('./pushNotificationService');
    mocks.checkPermissions.mockResolvedValue({ receive: 'denied' });
    expect(await service.initializePushNotifications(session)).toBe(false);
    expect(mocks.register).not.toHaveBeenCalled();
    mocks.checkPermissions.mockResolvedValue({ receive: 'granted' });
    mocks.post.mockRejectedValue(new Error('offline'));
    await service.initializePushNotifications(session);
    mocks.callbacks.registration({ value: 'offline-token' });
    await vi.waitFor(() => expect(mocks.state.setIsRegistered).toHaveBeenCalledWith(false));
  });
});
