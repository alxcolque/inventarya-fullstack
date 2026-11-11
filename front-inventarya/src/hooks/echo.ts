import { useEffect, useRef, useState } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { toast } from 'sonner';

import useNotificationStore, {
  Notification,
} from '@/modules/shared/store/notifications/notifications.store';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { getTenantRequestHeader, getTenantSlug, isCentral } from '@/utils/tenant';

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo<'reverb'>;
  }
}

interface ReverbConnection {
  state?: string;
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string, callback: () => void) => void;
}

interface ReverbConnector {
  pusher: {
    connection: ReverbConnection;
  };
}

import { getApiBaseUrl } from '@/utils/apiConfig';
import { Capacitor } from '@capacitor/core';

const initializeEcho = (
  token: string,
  tenantHeader: ReturnType<typeof getTenantRequestHeader>
) => {
  window.Pusher = Pusher;

  const isNative = Capacitor.isNativePlatform();
  const configuredHost = (import.meta.env.VITE_REVERB_HOST || '').trim();
  const wsHost = configuredHost || (isNative ? new URL(getApiBaseUrl()).hostname : window.location.hostname);
  const configuredScheme = (import.meta.env.VITE_REVERB_SCHEME || '').trim();
  const isHttps = configuredScheme ? configuredScheme === 'https' : (isNative ? true : window.location.protocol === 'https:');

  return new Echo<'reverb'>({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
    forceTLS: isHttps,
    enabledTransports: ['ws', 'wss'],
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(tenantHeader ? { [tenantHeader.name]: tenantHeader.value } : {}),
      },
    },
    authEndpoint: `${getApiBaseUrl()}/broadcasting/auth`,
  });
};

const parseNotification = (raw: Record<string, unknown>): Notification => {
  const nested = typeof raw.data === 'object' && raw.data !== null
    ? raw.data as Record<string, unknown>
    : raw;

  const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: String(raw.id || nested.id || generatedId),
    type: String(raw.type || nested.type || 'general'),
    title: String(raw.title || nested.title || 'Nueva notificación'),
    message: String(raw.message || nested.message || ''),
    severity: (raw.severity || nested.severity || 'info') as Notification['severity'],
    action_url: String(raw.action_url || nested.action_url || '') || null,
    data: nested,
    read_at: null,
    created_at: String(raw.created_at || nested.created_at || new Date().toISOString()),
  };
};

export const useEcho = () => {
  const centralUser = useCentralAuthStore((state) => state.user);
  const centralToken = useCentralAuthStore((state) => state.token);
  const tenantUser = useTenantAuthStore((state) => state.user);
  const tenantToken = useTenantAuthStore((state) => state.token);
  const central = isCentral();
  const userId = central ? centralUser?.id : tenantUser?.id;
  const tenantId = central ? null : tenantUser?.tenant_id;
  const token = central ? centralToken : tenantToken;
  const setStatus = useRealtimeStore((state) => state.setStatus);
  const status = useRealtimeStore((state) => state.status);
  const addRealtimeNotification = useNotificationStore(
    (state) => state.addRealtimeNotification
  );
  const [echo, setEcho] = useState<Echo<'reverb'> | null>(null);
  const activeConnection = useRef<Echo<'reverb'> | null>(null);

  useEffect(() => {
    const tenantHeader = central ? null : getTenantRequestHeader();
    if (userId == null || !token || (!central && (!tenantId || !getTenantSlug() || !tenantHeader))) {
      setStatus('disconnected');
      setEcho(null);
      return;
    }

    setStatus('connecting');

    let instance: Echo<'reverb'> | null = null;
    let connection: ReverbConnection | null = null;

    const handlers = {
      connecting: () => setStatus('connecting'),
      connected: () => setStatus('connected'),
      disconnected: () => setStatus('disconnected'),
      unavailable: () => setStatus('failed'),
      failed: () => setStatus('failed'),
      error: () => setStatus('failed'),
    };

    try {
      instance = initializeEcho(token, tenantHeader);
      activeConnection.current = instance;
      window.Echo = instance;
      connection = (instance.connector as unknown as ReverbConnector).pusher.connection;

      Object.entries(handlers).forEach(([event, handler]) => {
        connection?.bind(event, handler);
      });

      if (connection.state === 'connected') {
        setStatus('connected');
      }

      setEcho(instance);
    } catch {
      if (activeConnection.current === instance) {
        activeConnection.current = null;
      }
      instance?.disconnect();
      if (window.Echo === instance) {
        delete window.Echo;
      }
      setStatus('failed');
    }

    return () => {
      if (connection) {
        Object.entries(handlers).forEach(([event, handler]) => {
          connection?.unbind(event, handler);
        });
      }
      instance?.disconnect();
      if (activeConnection.current === instance) {
        activeConnection.current = null;
      }
      if (window.Echo === instance) {
        delete window.Echo;
      }
      setStatus('disconnected');
    };
  }, [central, userId, tenantId, token, setStatus]);

  useEffect(() => {
    if (central || !echo || activeConnection.current !== echo || userId == null || !tenantId) return;

    const channelName = `tenants.${tenantId}.users.${userId}`;
    const channel = echo.private(channelName);

    channel.notification((raw: Record<string, unknown>) => {
      const notification = parseNotification(raw);
      const added = addRealtimeNotification(notification);

      if (added) {
        toast.info(notification.title, {
          description: notification.message,
        });
      }
    });

    return () => {
      echo.leave(channelName);
    };
  }, [echo, central, userId, tenantId, addRealtimeNotification]);

  return {
    echo,
    status,
    isConnected: status === 'connected',
  };
};
