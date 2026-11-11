import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Tabs,
  Tab,
  Skeleton,
} from '@nextui-org/react';
import {
  LuBell,
  LuCheckCheck,
  LuTrash2,
  LuAlertTriangle,
  LuInfo,
  LuShoppingBag,
  LuShieldAlert,
  LuExternalLink,
  LuSparkles,
  LuSmartphone,
  LuRefreshCw,
} from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';

import useNotificationStore, { Notification } from '@/modules/shared/store/notifications/notifications.store';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { usePushStore } from '@/stores/pushStore';
import { retryPushRegistration } from '@/services/pushNotificationService';
import { sendTestPush } from '@/services/deviceTokenApi';
import { isSafeInternalRoute } from '@/utils/safeRoute';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useTenantAuthStore();
  const { token: fcmToken, isRegistered, isSupported, isInitializing, lastError } = usePushStore();

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications(user?.id);
  }, [user?.id, fetchNotifications]);

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read_at;
    return true;
  });

  const getSeverityIcon = (type: string, severity?: string) => {
    switch (type) {
      case 'stock_low':
      case 'out_of_stock':
      case 'stock_out':
        return <LuAlertTriangle className="w-5 h-5 text-warning" />;
      case 'sale_created':
        return <LuShoppingBag className="w-5 h-5 text-success" />;
      case 'subscription':
      case 'payment':
        return <LuShieldAlert className="w-5 h-5 text-danger" />;
      default:
        return severity === 'critical' || severity === 'danger' ? (
          <LuShieldAlert className="w-5 h-5 text-danger" />
        ) : severity === 'warning' ? (
          <LuAlertTriangle className="w-5 h-5 text-warning" />
        ) : (
          <LuInfo className="w-5 h-5 text-primary" />
        );
    }
  };

  const handleNotificationClick = async (item: Notification) => {
    if (!item.read_at) {
      await markNotificationAsRead(item.id, user?.id);
    }
    const targetUrl = item.action_url || item.data?.route;
    if (isSafeInternalRoute(targetUrl)) {
      navigate(targetUrl);
    }
  };

  const handleSendTestPush = async () => {
    setIsSendingTest(true);
    try {
      const res = await sendTestPush(
        'Prueba Inventarya',
        'Las notificaciones Push funcionan correctamente desde tu panel.'
      );
      toast.success(res.data.message || 'Push encolado para tus dispositivos.');
    } catch (error: unknown) {
      toast.error('Error al enviar Push de prueba', {
        description: isAxiosError(error)
          ? error.response?.data?.message || 'Verifica que tengas un dispositivo registrado.'
          : 'Verifica que tengas un dispositivo registrado.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-divider pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LuBell className="text-primary" /> Centro de Notificaciones
          </h1>
          <p className="text-sm text-default-500">
            Historial de alertas de stock, ventas, transferencias y avisos del sistema.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="flat"
            color="secondary"
            startContent={<LuSmartphone />}
            isLoading={isSendingTest}
            onPress={handleSendTestPush}
          >
            Probar Push FCM
          </Button>

          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<LuCheckCheck />}
              onPress={() => markAllNotificationsAsRead(user?.id)}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* Dispositivos Status Banner */}
      {isSupported && (
        <Card className="bg-default-50 border border-default-200">
          <CardBody className="py-3 px-4 flex flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRegistered ? 'bg-success' : 'bg-warning'}`} />
              <span className="font-medium text-default-700">
                Dispositivo móvil {isRegistered ? 'conectado a Firebase Push (FCM)' : 'no registrado'}
              </span>
            </div>
            {lastError && <p role="status" className="text-xs text-danger">{lastError.message} ({lastError.code})</p>}
            {!isRegistered && (
              <Button size="sm" variant="flat" isLoading={isInitializing} onPress={async () => {
                if (!await retryPushRegistration()) {
                  toast.error(usePushStore.getState().lastError?.message ?? 'No se confirmó el registro Push. Vuelve a intentar.');
                }
              }}>
                Activar notificaciones
              </Button>
            )}
            {fcmToken && (
              <Chip size="sm" variant="flat" color="success">
                Token activo
              </Chip>
            )}
          </CardBody>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(k as 'all' | 'unread')}
          color="primary"
          variant="underlined"
        >
          <Tab
            key="all"
            title={
              <div className="flex items-center gap-2">
                <span>Todas</span>
                <Chip size="sm" variant="flat">{notifications.length}</Chip>
              </div>
            }
          />
          <Tab
            key="unread"
            title={
              <div className="flex items-center gap-2">
                <span>No leídas</span>
                {unreadCount > 0 && (
                  <Chip size="sm" color="danger" variant="solid">
                    {unreadCount}
                  </Chip>
                )}
              </div>
            }
          />
        </Tabs>
      </div>

      {/* Content List */}
      {isLoading && notifications.length === 0 ? (
        <div className="space-y-3" aria-label="Cargando notificaciones">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="border border-divider">
              <CardBody className="p-4 flex flex-row gap-3">
                <Skeleton className="rounded-xl w-10 h-10 shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-3 w-1/3 rounded-lg" />
                  <Skeleton className="h-3 w-4/5 rounded-lg" />
                  <Skeleton className="h-2 w-20 rounded-lg" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 px-4 space-y-4">
          <LuAlertTriangle className="w-10 h-10 text-danger mx-auto" />
          <div>
            <h3 className="font-semibold text-lg">No pudimos cargar tus notificaciones</h3>
            <p className="text-sm text-default-500 mt-1">{error}</p>
          </div>
          <Button
            color="primary"
            variant="flat"
            startContent={<LuRefreshCw />}
            onPress={() => fetchNotifications(user?.id)}
          >
            Reintentar
          </Button>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-16 px-4 space-y-3">
          <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto text-default-400">
            <LuSparkles className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-lg text-default-700">No hay notificaciones</h3>
          <p className="text-sm text-default-500 max-w-sm mx-auto">
            {activeTab === 'unread'
              ? 'Has leído todas tus notificaciones.'
              : 'Aquí aparecerán las alertas operativas y avisos importantes de tu negocio.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const isUnread = !item.read_at;
            return (
              <Card
                key={item.id}
                isHoverable
                isPressable
                onPress={() => handleNotificationClick(item)}
                className={`w-full transition-all border ${
                  isUnread
                    ? 'bg-primary-50/20 border-primary-200 dark:border-primary-900/40'
                    : 'border-default-100 dark:border-default-800'
                }`}
              >
                <CardBody className="p-4 flex flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-default-100 dark:bg-default-800 shrink-0">
                      {getSeverityIcon(item.type, item.severity)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-default-900 truncate">
                          {item.title}
                        </h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-default-600 line-clamp-2">
                        {item.message}
                      </p>
                      <p className="text-xs text-default-400 pt-1">
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {(item.action_url || item.data?.route) && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => handleNotificationClick(item)}
                        title="Ir al recurso"
                      >
                        <LuExternalLink className="w-4 h-4 text-default-500" />
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => deleteNotification(item.id)}
                      title="Eliminar notificación"
                    >
                      <LuTrash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
