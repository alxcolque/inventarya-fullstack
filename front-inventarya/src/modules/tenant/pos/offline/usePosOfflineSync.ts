import { getTenantSlug } from '@/utils/tenant';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { posDb, getOfflineQueueSummary } from './pos-db';
import {
  syncPendingSalesForStore,
  isStoreSyncing,
  checkBackendReachability,
  getBackendReachability,
  deriveConnectivityState,
  type ConnectivityState,
} from './offlineSyncCoordinator';

/**
 * Hook reactivo para estado de red del cliente.
 * Se basa en eventos nativos del navegador ('online' y 'offline')
 * sin hacer polling innecesario ni generar falsos positivos.
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export interface ManualRetryContext {
  storeSlug?: string | null;
  tenantKey?: string | null;
}

export interface ManualRetryResult {
  success: boolean;
  error?: string;
}

/**
 * Validador autoritativo y ejecutor de reintento manual para ventas offline (Fase 6B.4D.1 FIX-2).
 * Exige estrictamente contexto activo y de venta verificables antes de cualquier mutación local o llamada POST.
 */
export async function executeManualRetryPendingSale(
  saleId: string,
  context: ManualRetryContext
): Promise<ManualRetryResult> {
  const sale = await posDb.pos_pending_sales.get(saleId);
  if (!sale) {
    return { success: false, error: 'Venta no encontrada en la cola offline.' };
  }

  // 1. Guard de empresa activa (Fase 6B.4D.1 FIX-2 - Sección 3)
  if (!context.tenantKey) {
    toast.error('No se puede reintentar la venta porque no se pudo determinar la empresa activa.', {
      id: 'pos-active-tenant-missing-retry-blocked',
    });
    return { success: false, error: 'Empresa activa no determinada.' };
  }

  // 2. Guard de empresa en la venta (Fase 6B.4D.1 FIX-2 - Sección 4)
  if (!sale.tenant_key) {
    toast.error('Esta venta no tiene un contexto de empresa verificable y requiere revisión manual.', {
      id: 'pos-sale-tenant-missing-retry-blocked',
    });
    return { success: false, error: 'Venta sin tenant_key.' };
  }

  // 3. Guard de sucursal activa (Fase 6B.4D.1 FIX-2 - Sección 5)
  if (!context.storeSlug) {
    toast.error('No se puede reintentar la venta porque no se pudo determinar la sucursal activa.', {
      id: 'pos-active-store-missing-retry-blocked',
    });
    return { success: false, error: 'Sucursal activa no determinada.' };
  }

  // 4. Guard de sucursal en la venta (Fase 6B.4D.1 FIX-2 - Sección 6)
  if (!sale.store_slug) {
    toast.error('Esta venta no tiene una sucursal verificable y requiere revisión manual.', {
      id: 'pos-sale-store-missing-retry-blocked',
    });
    return { success: false, error: 'Venta sin store_slug.' };
  }

  // 5. Comparar tenant (Aislamiento cross-tenant - Sección 17)
  if (sale.tenant_key !== context.tenantKey) {
    toast.error('No se puede reintentar una venta perteneciente a otra empresa/tenant.', {
      id: 'pos-tenant-mismatch-retry-blocked',
    });
    return { success: false, error: 'Venta perteneciente a otro tenant.' };
  }

  // 6. Comparar store (Aislamiento cross-store - Sección 18)
  if (sale.store_slug !== context.storeSlug) {
    toast.error('No se puede reintentar una venta perteneciente a otra sucursal.', {
      id: 'pos-store-mismatch-retry-blocked',
    });
    return { success: false, error: 'Venta perteneciente a otra sucursal.' };
  }

  // 7. Guard server_accepted: ventas aceptadas por backend jamás hacen repost ni pasan a pending (Fase 6B.4D.1 FIX-2 - Sección 10 y 20)
  if (sale.server_accepted) {
    toast.error('Esta venta ya fue aceptada por el servidor. Use la acción de actualizar datos locales para completar su registro.', {
      id: 'pos-server-accepted-retry-blocked',
    });
    return { success: false, error: 'Venta ya fue aceptada por el servidor.' };
  }

  // 8. Guard conflict: conflictos comerciales requieren resolución previa (Fase 6B.4D.1 FIX-2 - Sección 11 y 21)
  if (sale.status === 'conflict') {
    toast.error('Las ventas con conflicto comercial requieren resolución previa y no pueden reintentarse automáticamente.', {
      id: 'pos-conflict-retry-blocked',
    });
    return { success: false, error: 'Venta con conflicto comercial.' };
  }

  // 9. Mutación atómica en Dexie SÓLO tras superar todos los guards previos
  await posDb.pos_pending_sales.update(saleId, {
    status: 'pending',
    last_error_message: undefined,
    error_message: undefined,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos-offline-sales-changed'));
  }

  return { success: true };
}

interface UsePosOfflineSyncOptions {
  storeSlug?: string;
  onSyncComplete?: () => void;
}

export function usePosOfflineSync({ storeSlug, onSyncComplete }: UsePosOfflineSyncOptions = {}) {
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [isBackendReachable, setIsBackendReachable] = useState<boolean>(() => {
    const cached = getBackendReachability();
    return cached !== null ? cached : true;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(() => {
    return storeSlug ? isStoreSyncing(storeSlug) : false;
  });

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);

  // Solo se marca true si al inicio REALMENTE no hay conexión (navigator.onLine === false)
  const wasOfflineRef = useRef<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Actualizar contador y resumen de la cola en IndexedDB (Aislado estrictamente por store y tenant)
  const updatePendingCount = useCallback(async () => {
    try {
      const tenantKey = getTenantSlug() ?? undefined;
      const summary = await getOfflineQueueSummary({ storeSlug, tenantKey });
      setPendingCount(summary.pending);
      setConflictCount(summary.conflict);
      setFailedCount(summary.failed);
      return summary.pending;
    } catch {
      setPendingCount(0);
      setConflictCount(0);
      setFailedCount(0);
      return 0;
    }
  }, [storeSlug]);

  // Sincronizar cola de ventas pendientes usando el Single Sync Owner compartido (Fase 6B.4D.1 - Secciones 10, 11)
  const syncPendingSales = useCallback(async () => {
    if (!storeSlug) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      const tenantKey = getTenantSlug() ?? undefined;
      const res = await syncPendingSalesForStore(storeSlug, tenantKey, {
        onSyncComplete: () => {
          updatePendingCount();
          onSyncComplete?.();
        },
      });

      if (res.syncedCount > 0) {
        toast.success(`¡${res.syncedCount} venta(s) sincronizada(s) con éxito en la nube!`, {
          id: 'sync-pos-sales-success',
          duration: 5000,
        });
      }

      if (res.conflictCount > 0) {
        toast.error('Se detectaron conflictos comerciales en la cola offline. Revise las ventas afectadas; no se eliminarán silenciosamente.', {
          id: 'sync-pos-sales-conflict',
          duration: 6000,
        });
      }

      await updatePendingCount();
    } catch (err) {
      console.error('[Sync] Error al sincronizar ventas offline:', err);
    }
  }, [storeSlug, updatePendingCount, onSyncComplete]);

  // Reintento manual controlado para ventas fallidas/retryable (Fase 6B.4D.1 FIX-2)
  const retryPendingSale = useCallback(async (saleId: string) => {
    const effectiveTenant = getTenantSlug();
    const result = await executeManualRetryPendingSale(saleId, {
      storeSlug,
      tenantKey: effectiveTenant,
    });

    if (result.success) {
      await syncPendingSales();
    }
  }, [storeSlug, syncPendingSales]);

  useEffect(() => {
    // 1. Verificación inicial de conectividad y conteo
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      checkBackendReachability().then((reachable) => {
        setIsBackendReachable(reachable);
      });
    }

    updatePendingCount().then((count) => {
      if (count > 0 && typeof navigator !== 'undefined' && navigator.onLine && storeSlug) {
        syncPendingSales();
      }
    });

    // 2. Trigger automático cuando REALMENTE se corte la conexión
    const handleOffline = () => {
      setIsNetworkOnline(false);
      setIsBackendReachable(false);
      wasOfflineRef.current = true;
      toast.warning('Modo Offline: Sin conexión a internet. Las ventas se guardarán localmente.', {
        id: 'pos-offline-banner-toast',
        duration: 5000,
      });
    };

    // 3. Trigger automático cuando se restablezca la red (Fase 6B.4D.1 - Sección 22)
    // NO asumir ONLINE inmediatamente: verificar backend de forma segura
    const handleOnline = async () => {
      setIsNetworkOnline(true);
      const isReachable = await checkBackendReachability(true);
      setIsBackendReachable(isReachable);

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        if (isReachable) {
          toast.success('Conexión con el servidor restablecida. Sincronizando ventas pendientes...', {
            id: 'pos-online-banner-toast',
            duration: 4000,
          });
          syncPendingSales();
        } else {
          toast.warning('Conexión de red disponible, pero el servidor aún no responde.', {
            id: 'pos-server-waiting-toast',
            duration: 4000,
          });
        }
      }
    };

    // 4. Al volver a la pestaña (visibilidad activa)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && typeof navigator !== 'undefined' && navigator.onLine) {
        setIsNetworkOnline(true);
        checkBackendReachability().then((reachable) => {
          setIsBackendReachable(reachable);
        });
        updatePendingCount().then((count) => {
          if (count > 0 && storeSlug) {
            syncPendingSales();
          }
        });
      }
    };

    const handleSalesChanged = () => {
      updatePendingCount();
    };

    const handleReachabilityChanged = (e: any) => {
      if (typeof e.detail?.reachable === 'boolean') {
        setIsBackendReachable(e.detail.reachable);
      }
    };

    const handleSyncStatusChanged = (e: any) => {
      if (e.detail?.storeSlug === storeSlug) {
        setIsSyncing(e.detail?.isSyncing ?? false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pos-offline-sales-changed', handleSalesChanged);
    window.addEventListener('pos-reachability-changed', handleReachabilityChanged);
    window.addEventListener('pos-sync-status-changed', handleSyncStatusChanged);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pos-offline-sales-changed', handleSalesChanged);
      window.removeEventListener('pos-reachability-changed', handleReachabilityChanged);
      window.removeEventListener('pos-sync-status-changed', handleSyncStatusChanged);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [storeSlug, syncPendingSales, updatePendingCount]);

  const connectivityState: ConnectivityState = deriveConnectivityState(
    isNetworkOnline,
    storeSlug,
    getTenantSlug() ?? undefined
  );

  return {
    isOnline: isNetworkOnline && isBackendReachable,
    isNetworkOnline,
    isBackendReachable,
    isSyncing,
    connectivityState,
    pendingCount,
    conflictCount,
    failedCount,
    syncPendingSales,
    updatePendingCount,
    retryPendingSale,
  };
}
