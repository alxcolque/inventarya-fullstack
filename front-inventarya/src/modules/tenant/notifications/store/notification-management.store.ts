import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { tenantApi } from '@/api';
import {
  ManagedNotification,
  NotificationFilters,
  NotificationFormData,
  NotificationPagination,
  NotificationRecipient,
  NotificationStats,
  NotificationUpdateData,
} from '../interfaces/notification-management.interface';

interface NotificationManagementState {
  notifications: ManagedNotification[];
  recipients: NotificationRecipient[];
  stats: NotificationStats;
  pagination: NotificationPagination;
  activeFilters: NotificationFilters;
  isLoading: boolean;
  isSaving: boolean;
}

interface NotificationManagementActions {
  fetchNotifications: (filters?: NotificationFilters) => Promise<void>;
  fetchRecipients: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createNotification: (data: NotificationFormData) => Promise<boolean>;
  updateNotification: (id: string, data: NotificationUpdateData) => Promise<boolean>;
  deleteNotification: (id: string) => Promise<boolean>;
}

const emptyStats: NotificationStats = { total: 0, unread: 0, read: 0, sent_today: 0 };
const emptyPagination: NotificationPagination = {
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
};

const errorMessage = (error: unknown, fallback: string) => {
  if (!isAxiosError(error)) return fallback;
  const errors = error.response?.data?.errors;
  const firstError = errors ? Object.values(errors).flat()[0] : null;
  return String(firstError || error.response?.data?.message || fallback);
};

export const useNotificationManagementStore = create<
  NotificationManagementState & NotificationManagementActions
>((set, get) => ({
  notifications: [],
  recipients: [],
  stats: emptyStats,
  pagination: emptyPagination,
  activeFilters: {},
  isLoading: false,
  isSaving: false,

  fetchNotifications: async (filters = {}) => {
    set({ isLoading: true, activeFilters: filters });
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value && value !== 'all')
      );
      const { data } = await tenantApi.get('/notification-management', { params });
      set({ notifications: data.data, pagination: data.meta });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron cargar las notificaciones.'));
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRecipients: async () => {
    try {
      const { data } = await tenantApi.get('/notification-management/recipients');
      set({ recipients: data.data });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron cargar los destinatarios.'));
    }
  },

  fetchStats: async () => {
    try {
      const { data } = await tenantApi.get('/notification-management/stats');
      set({ stats: data.data });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron cargar las métricas.'));
    }
  },

  createNotification: async (payload) => {
    set({ isSaving: true });
    try {
      const { data } = await tenantApi.post('/notification-management', payload);
      toast.success(data.message);
      await Promise.all([
        get().fetchNotifications(get().activeFilters),
        get().fetchStats(),
      ]);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo enviar la notificación.'));
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  updateNotification: async (id, payload) => {
    set({ isSaving: true });
    try {
      const { data } = await tenantApi.put('/notification-management/' + id, payload);
      set((state) => ({
        notifications: state.notifications.map((item) =>
          item.id === id ? data.data : item
        ),
      }));
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo actualizar la notificación.'));
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteNotification: async (id) => {
    set({ isSaving: true });
    try {
      const { data } = await tenantApi.delete('/notification-management/' + id);
      set((state) => ({
        notifications: state.notifications.filter((item) => item.id !== id),
      }));
      toast.success(data.message);
      await get().fetchStats();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo eliminar la notificación.'));
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
}));
