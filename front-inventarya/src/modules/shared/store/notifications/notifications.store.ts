import { create } from 'zustand';
import { tenantApi } from "@/api";
import { isAxiosError } from 'axios';

export interface NotificationData {
  route?: string;
  action_url?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'critical' | 'danger';
  action_url?: string | null;
  data?: NotificationData;
  read_at: string | null;
  created_at: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;

  // UI state
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => boolean;
  addRealtimeNotification: (notification: Notification) => boolean;
  hasNotification: (notificationId: string) => boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  
  // API Calls (no require userId param - token Sanctum handles it)
  fetchNotifications: (userId?: number | string) => Promise<void>;
  fetchUnreadNotifications: (userId?: number | string) => Promise<void>;
  markNotificationAsRead: (notificationId: string, userId?: number | string) => Promise<void>;
  markAllNotificationsAsRead: (userId?: number | string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  
  clearError: () => void;
  playNotificationSound: (notification?: Partial<Notification> | string) => void;
}

export const isSaleNotification = (notification?: Partial<Notification> | string): boolean => {
  if (!notification) return false;
  if (typeof notification === 'string') {
    return /(?:venta|ventas|sale|sales)/i.test(notification);
  }
  const type = notification.type || '';
  const title = notification.title || '';
  const message = notification.message || '';
  const dataType = typeof notification.data?.type === 'string' ? notification.data.type : '';
  const dataModule = typeof notification.data?.module === 'string' ? notification.data.module : '';

  const saleRegex = /(?:venta|ventas|sale|sales)/i;
  return (
    saleRegex.test(type) ||
    saleRegex.test(title) ||
    saleRegex.test(message) ||
    saleRegex.test(dataType) ||
    saleRegex.test(dataModule)
  );
};

export const getNotificationSoundUrl = (notification?: Partial<Notification> | string): string => {
  return isSaleNotification(notification) ? '/sounds/cash.mp3' : '/sounds/notification.mp3';
};

const useNotificationStore = create<NotificationStore>()(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      isOpen: false,

      setIsOpen: (open) => set({ isOpen: open }),
      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

      setNotifications: (notifications) => {
        const unreadCount = notifications.filter(n => !n.read_at).length;
        set({ notifications, unreadCount });
      },

      addNotification: (notification) => {
        const current = get().notifications;
        const exists = current.some(n => n.id === notification.id);

        if (!exists) {
          const updated = [notification, ...current];
          const unreadCount = updated.filter(n => !n.read_at).length;
          set({ notifications: updated, unreadCount });
          get().playNotificationSound(notification);
          return true;
        }

        return false;
      },

      addRealtimeNotification: (notification) => {
        return get().addNotification(notification);
      },

      hasNotification: (notificationId) =>
        get().notifications.some((notification) => notification.id === notificationId),

      markAsRead: (notificationId) => {
        const updated = get().notifications.map(n =>
          n.id === notificationId
            ? { ...n, read_at: n.read_at || new Date().toISOString() }
            : n
        );
        const unreadCount = updated.filter(n => !n.read_at).length;
        set({ notifications: updated, unreadCount });
      },

      markAllAsRead: () => {
        const now = new Date().toISOString();
        const updated = get().notifications.map(n => ({
          ...n,
          read_at: n.read_at || now,
        }));
        set({ notifications: updated, unreadCount: 0 });
      },

      removeNotification: (notificationId) => {
        const updated = get().notifications.filter(n => n.id !== notificationId);
        const unreadCount = updated.filter(n => !n.read_at).length;
        set({ notifications: updated, unreadCount });
      },

      fetchNotifications: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await tenantApi.get('/notifications');
          const list = response.data.data || response.data.notifications || [];
          const count = typeof response.data.meta?.unread_count === 'number'
            ? response.data.meta.unread_count
            : (typeof response.data.unread_count === 'number'
                ? response.data.unread_count
                : list.filter((item: { read_at?: string | null }) => !item.read_at).length);

          // Normalizar items
          const normalized: Notification[] = list.map((item: Notification & { data?: Record<string, unknown> }) => {
            const innerData = item.data || {};
            return {
              id: String(item.id),
              type: item.type || innerData.type || 'general',
              title: item.title || innerData.title || 'Notificación',
              message: item.message || innerData.message || '',
              severity: item.severity || innerData.severity || 'info',
              action_url: item.action_url || innerData.action_url || null,
              data: innerData,
              read_at: item.read_at || null,
              created_at: item.created_at || new Date().toISOString(),
            };
          });

          set({ notifications: normalized, unreadCount: count });
        } catch (error: unknown) {
          set({
            error: isAxiosError(error)
              ? error.response?.data?.message || 'No pudimos cargar tus notificaciones.'
              : 'No pudimos cargar tus notificaciones.',
          });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchUnreadNotifications: async () => {
        try {
          const response = await tenantApi.get('/notifications/unread');
          const count = response.data.count ?? response.data.meta?.unread_count ?? response.data.unread_count ?? 0;
          set({ unreadCount: count });
        } catch (error: unknown) {
          console.error('Error fetching unread notifications:', error);
        }
      },

      markNotificationAsRead: async (notificationId) => {
        // Optimista
        get().markAsRead(notificationId);
        try {
          await tenantApi.post(`/notifications/${notificationId}/read`);
        } catch (error: unknown) {
          console.warn('Error syncing markAsRead with server:', error);
          await get().fetchNotifications();
        }
      },

      markAllNotificationsAsRead: async () => {
        // Optimista
        get().markAllAsRead();
        try {
          await tenantApi.post('/notifications/mark-all-read');
        } catch (error: unknown) {
          console.warn('Error syncing markAllAsRead with server:', error);
          await get().fetchNotifications();
        }
      },

      deleteNotification: async (notificationId) => {
        get().removeNotification(notificationId);
        try {
          await tenantApi.delete(`/notifications/${notificationId}`);
        } catch (error: unknown) {
          console.warn('Error deleting notification on server:', error);
          await get().fetchNotifications();
        }
      },

      clearError: () => set({ error: null }),

      playNotificationSound: (notification?: Partial<Notification> | string) => {
        const soundUrl = getNotificationSoundUrl(notification);
        try {
          if (typeof Audio !== 'undefined') {
            const audio = new Audio(soundUrl);
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {
                // Autoplay policy or no user gesture yet
              });
            }
            return;
          }

          // Fallback en entornos sin Audio nativo
          const AudioContextClass = window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AudioContextClass) return;
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
          
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch {
          // Audio bloqueado o no soportado
        }
      },
    })
);

export default useNotificationStore;
