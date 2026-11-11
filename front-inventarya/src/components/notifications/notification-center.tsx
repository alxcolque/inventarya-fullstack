import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Chip,
  Spinner,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from '@nextui-org/react';
import {
  LuBell,
  LuCheckCheck,
  LuTrash2,
  LuAlertTriangle,
  LuInfo,
  LuShoppingBag,
  LuShieldAlert,
  LuCalendarClock,
  LuExternalLink,
  LuX,
} from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import useNotificationStore, { Notification } from "@/modules/shared/store/notifications/notifications.store";
import { isSafeInternalRoute } from '@/utils/safeRoute';
import { useAuthStore } from '@/stores';

export const NotificationCenter = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    isOpen,
    setIsOpen,
    toggleOpen,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
  } = useNotificationStore();

  // Detect mobile viewport (< 640px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cargar notificaciones al montar y al abrir
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Click outside to close (desktop dropdown)
  useEffect(() => {
    if (isMobile) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, setIsOpen]);

  // Bloqueo total del scroll del fondo mientras las notificaciones estén abiertas en móvil
  useEffect(() => {
    if (isOpen && isMobile) {
      const mainEl = (document.getElementById("pos-main") || document.querySelector("main")) as HTMLElement | null;
      const prevBodyOverflow = document.body.style.overflow;
      const prevMainOverflow = mainEl?.style.overflow;

      document.body.style.overflow = "hidden";
      if (mainEl) mainEl.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = prevBodyOverflow || "";
        if (mainEl) mainEl.style.overflow = prevMainOverflow || "";
      };
    }
  }, [isOpen, isMobile]);

  // Gesto táctil estilo Google Maps: arrastrar hacia abajo para cerrar
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  const handleDragTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }
    touchStartY.current = e.touches[0].clientY;
    setIsDraggingSheet(true);
  };

  const handleDragTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingSheet) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    } else {
      setDragOffsetY(0);
    }
  };

  const handleDragTouchEnd = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    if (dragOffsetY > 75) {
      setIsOpen(false);
    }
    setDragOffsetY(0);
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read_at)
    : notifications;
  const visibleNotifications = filteredNotifications;

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read_at) {
      await markNotificationAsRead(notification.id);
    }
    if (isSafeInternalRoute(notification.action_url)) {
      setIsOpen(false);
      navigate(notification.action_url);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: es
      });
    } catch {
      return 'Hace un momento';
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    const type = notification.type || '';
    const severity = notification.severity || '';

    if (type === 'stock_out' || severity === 'critical' || severity === 'danger') {
      return <LuShieldAlert size={18} className="text-danger shrink-0" />;
    }
    if (type === 'stock_low' || severity === 'warning') {
      return <LuAlertTriangle size={18} className="text-warning shrink-0" />;
    }
    if (type === 'sale_created') {
      return <LuShoppingBag size={18} className="text-success shrink-0" />;
    }
    if (type === 'product_expiring' || type === 'subscription_expiring') {
      return <LuCalendarClock size={18} className="text-amber-500 shrink-0" />;
    }
    return <LuInfo size={18} className="text-primary shrink-0" />;
  };

  // Render list of notifications
  const renderNotificationList = () => (
    <div className="flex flex-col overflow-y-auto max-h-[380px] divide-y divide-divider/40 scrollbar-thin overscroll-contain">
      {isLoading && notifications.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-default-400">
          <Spinner size="sm" color="primary" />
          <p className="text-xs">Cargando notificaciones...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-12 px-4 flex flex-col items-center justify-center gap-2 text-center text-default-400">
          <div className="w-12 h-12 rounded-full bg-default-100 flex items-center justify-center text-default-400 mb-1">
            <LuBell size={22} className="opacity-40" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {filter === 'unread' ? 'Sin notificaciones pendientes' : 'Bandeja al día'}
          </p>
          <p className="text-xs text-default-400 max-w-xs">
            {filter === 'unread'
              ? 'Has leído todas tus notificaciones. ¡Buen trabajo!'
              : 'No hay alertas ni notificaciones registradas en este momento.'}
          </p>
        </div>
      ) : (
        visibleNotifications.map((notification) => {
          const isUnread = !notification.read_at;
          return (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 group relative hover:bg-default-100/60 ${isUnread ? 'bg-primary-50/20 dark:bg-primary-950/20' : 'bg-transparent'
                }`}
            >
              {/* Severity Icon */}
              <div className="mt-0.5 p-2 rounded-xl bg-default-100 dark:bg-default-50/10 shrink-0">
                {getNotificationIcon(notification)}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 pr-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold truncate ${isUnread ? 'text-foreground' : 'text-default-700'}`}>
                    {notification.title}
                  </span>
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                  )}
                </div>

                <p className="text-xs text-default-500 line-clamp-2 leading-relaxed">
                  {notification.message}
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-default-400 font-mono">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                  {notification.action_url && (
                    <span className="text-[10px] text-primary flex items-center gap-0.5 font-semibold group-hover:underline">
                      Ver detalle <LuExternalLink size={10} />
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons (Delete) */}
              <Button
                size="sm"
                isIconOnly
                variant="light"
                color="danger"
                aria-label="Eliminar notificación"
                className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 min-w-7 text-default-400 hover:text-danger"
                onClick={(event) => event.stopPropagation()}
                onPress={() => {
                  deleteNotification(notification.id);
                }}
              >
                <LuTrash2 size={13} />
              </Button>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Badge
        color="danger"
        content={unreadCount > 99 ? '99+' : unreadCount}
        isInvisible={unreadCount === 0}
        shape="circle"
        size="sm"
        className="font-bold text-[10px]"
      >
        <Button
          isIconOnly
          variant="light"
          radius="full"
          size="sm"
          onPress={toggleOpen}
          aria-label="Abrir centro de notificaciones"
          className="text-default-700 hover:text-primary transition-transform active:scale-95"
        >
          <LuBell size={20} className={unreadCount > 0 ? "animate-pulse" : ""} />
        </Button>
      </Badge>

      {/* Desktop Dropdown */}
      {!isMobile && isOpen && (
        <div className="absolute right-0 mt-3 w-96 max-w-[95vw] bg-content1 border border-divider rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-divider flex items-center justify-between bg-default-50/50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <Chip size="sm" color="primary" variant="flat" className="h-5 text-[10px] font-bold">
                  {unreadCount} nuevas
                </Chip>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  startContent={<LuCheckCheck size={14} />}
                  onPress={() => markAllNotificationsAsRead()}
                  className="text-[11px] font-bold h-7 px-2"
                >
                  Marcar leídas
                </Button>
              )}
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                radius="full"
                aria-label="Cerrar notificaciones"
                onPress={() => setIsOpen(false)}
                className="h-7 w-7 min-w-7 bg-default-100 text-default-500 hover:text-foreground active:scale-95 transition-all"
              >
                <LuX size={14} />
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-3 pt-2 bg-default-50/20 border-b border-divider/60">
            <Tabs
              size="sm"
              variant="underlined"
              color="primary"
              selectedKey={filter}
              onSelectionChange={(key) => setFilter(key as 'all' | 'unread')}
              classNames={{
                tabList: "gap-4 p-0",
                cursor: "w-full bg-primary",
                tab: "max-w-fit px-1 h-8 text-xs font-semibold",
              }}
            >
              <Tab key="all" title={`Todas (${notifications.length})`} />
              <Tab key="unread" title={`No leídas (${unreadCount})`} />
            </Tabs>
          </div>

          {/* Body List */}
          {renderNotificationList()}
          {/* Only admin and owner */}
          {/* Render only if user has role 'admin' or 'owner' */}

          <div>
            {(user?.role === 'admin' || user?.role === 'owner') && (
              <div className="border-t border-divider p-2">
                <Button
                  fullWidth
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => {
                    setIsOpen(false);
                    navigate('/notifications');
                  }}
                >
                  Ver todas las notificaciones
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Drawer / Modal (Patrón Google Maps) */}
      {isMobile && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          placement="bottom"
          scrollBehavior="inside"
          hideCloseButton
          backdrop="opaque"
          motionProps={{
            variants: {
              enter: {
                y: 0,
                opacity: 1,
                transition: {
                  duration: 0.22,
                  ease: [0.16, 1, 0.3, 1],
                },
              },
              exit: {
                y: "100%",
                opacity: 0,
                transition: {
                  duration: 0.18,
                  ease: [0.7, 0, 0.84, 0],
                },
              },
            },
          }}
          classNames={{
            backdrop: "bg-black/60 backdrop-blur-sm",
            base: "m-0 rounded-t-[28px] rounded-b-none max-h-[85dvh] bg-background border-t border-divider shadow-2xl overflow-hidden",
            header: "py-2.5 px-4 border-b border-divider flex items-center justify-between shrink-0 bg-background",
            body: "p-0 overflow-y-auto overscroll-contain max-h-[65dvh] bg-background",
          }}
        >
          <ModalContent
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: isDraggingSheet ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {() => (
              <>
                {/* Indicador visual de bottom sheet (affordance estilo Google Maps) */}
                <div
                  className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none touch-none"
                  onTouchStart={handleDragTouchStart}
                  onTouchMove={handleDragTouchMove}
                  onTouchEnd={handleDragTouchEnd}
                  onClick={() => setIsOpen(false)}
                  title="Deslizar hacia abajo o tocar para cerrar"
                >
                  <div className="h-1.5 w-12 rounded-full bg-default-300 dark:bg-default-600 transition-colors active:bg-default-400" />
                </div>

                <ModalHeader
                  className="py-2.5 px-4 border-b border-divider flex items-center justify-between shrink-0 bg-background select-none"
                  onTouchStart={handleDragTouchStart}
                  onTouchMove={handleDragTouchMove}
                  onTouchEnd={handleDragTouchEnd}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                      Notificaciones
                    </span>
                    {unreadCount > 0 && (
                      <Chip size="sm" color="primary" variant="flat" className="text-[10px] font-bold h-5">
                        {unreadCount}
                      </Chip>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        startContent={<LuCheckCheck size={14} />}
                        onPress={() => markAllNotificationsAsRead()}
                        className="text-xs font-bold h-8"
                      >
                        Leídas
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      radius="full"
                      aria-label="Cerrar notificaciones"
                      onPress={() => setIsOpen(false)}
                      className="h-8 w-8 min-w-8 bg-default-100 dark:bg-default-100/50 text-default-500 hover:text-foreground active:scale-95 transition-all"
                    >
                      <LuX size={16} />
                    </Button>
                  </div>
                </ModalHeader>

                <ModalBody>
                  {/* Filter Tabs */}
                  <div className="px-4 pt-2 border-b border-divider/60">
                    <Tabs
                      size="sm"
                      variant="underlined"
                      color="primary"
                      selectedKey={filter}
                      onSelectionChange={(key) => setFilter(key as 'all' | 'unread')}
                      classNames={{
                        tabList: "gap-4 p-0",
                        cursor: "w-full bg-primary",
                        tab: "max-w-fit px-1 h-8 text-xs font-semibold",
                      }}
                    >
                      <Tab key="all" title={`Todas (${notifications.length})`} />
                      <Tab key="unread" title={`No leídas (${unreadCount})`} />
                    </Tabs>
                  </div>

                  {renderNotificationList()}
                  <div className="border-t border-divider p-3">
                    <Button
                      fullWidth
                      color="primary"
                      variant="flat"
                      onPress={() => {
                        setIsOpen(false);
                        navigate('/notifications');
                      }}
                    >
                      Ver todas las notificaciones
                    </Button>
                  </div>
                </ModalBody>
              </>
            )}
          </ModalContent>
        </Modal>
      )}
    </div>
  );
};
