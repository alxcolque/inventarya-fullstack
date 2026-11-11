import { useState, useEffect, useCallback, useRef } from 'react';
import { getTenantSlug } from '@/utils/tenant';
import { posDb, PosPendingSale, PosCatalogMeta, retryLocalAuthoritativeReconciliation } from '../pos-db';
import { usePosOfflineSync } from '../usePosOfflineSync';
import { getOfflineCatalogMeta, refreshCompleteOfflineCatalog } from '../offlineCatalog';
import { toast } from 'sonner';

export type ConnectivityState = 'online' | 'offline' | 'server_unavailable' | 'reconnecting';

export interface CatalogFreshnessInfo {
  status: 'refreshing' | 'complete' | 'stale' | 'incomplete' | 'error';
  isComplete: boolean;
  isStale: boolean;
  label: string;
  hasDeficit: boolean;
  deficitCount: number;
  productCount: number;
  cachedAt?: number;
}

export interface UseOfflineSalesStatusOptions {
  storeSlug?: string;
  onSyncComplete?: () => void;
}

export function useOfflineSalesStatus({ storeSlug, onSyncComplete }: UseOfflineSalesStatusOptions = {}) {
  const [sales, setSales] = useState<PosPendingSale[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<PosCatalogMeta | null>(null);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const isRefreshingCatalogRef = useRef(false);

  const {
    isOnline,
    isNetworkOnline,
    isBackendReachable,
    isSyncing,
    connectivityState,
    syncPendingSales: rawSyncPendingSales,
    retryPendingSale: rawRetryPendingSale,
  } = usePosOfflineSync({
    storeSlug,
    onSyncComplete: () => {
      loadSalesAndMeta();
      onSyncComplete?.();
    },
  });

  // Carga reactiva y aislada de ventas y metadata desde IndexedDB (Sección 25, 26, 33)
  const loadSalesAndMeta = useCallback(async () => {
    try {
      const tenantKey = getTenantSlug();
      let allSales = await posDb.pos_pending_sales.toArray();

      // Aislamiento estricto por tenant y store (Sección 25)
      if (tenantKey) {
        allSales = allSales.filter((s) => s.tenant_key === tenantKey);
      }
      if (storeSlug) {
        allSales = allSales.filter((s) => s.store_slug === storeSlug);
      }

      // Ordenar cronológicamente (más recientes primero)
      allSales.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      setSales(allSales);

      // Cargar metadata de catálogo
      if (storeSlug) {
        const meta = await getOfflineCatalogMeta(tenantKey || undefined, storeSlug);
        setCatalogMeta(meta || null);
      }
    } catch (err) {
      console.error('[useOfflineSalesStatus] Error al cargar ventas offline:', err);
    }
  }, [storeSlug]);

  useEffect(() => {
    loadSalesAndMeta();

    const handleSalesChanged = () => {
      loadSalesAndMeta();
    };

    window.addEventListener('pos-offline-sales-changed', handleSalesChanged);
    window.addEventListener('online', handleSalesChanged);
    window.addEventListener('offline', handleSalesChanged);

    return () => {
      window.removeEventListener('pos-offline-sales-changed', handleSalesChanged);
      window.removeEventListener('online', handleSalesChanged);
      window.removeEventListener('offline', handleSalesChanged);
    };
  }, [loadSalesAndMeta]);

  // Derivación de contadores centralizados (Sección 27)
  const pendingCount = sales.filter(
    (s) => s.status === 'pending' && s.last_error_code !== 'LOCAL_RECONCILIATION_FAILED'
  ).length;

  const syncingCount = sales.filter((s) => s.status === 'syncing').length;

  const conflictCount = sales.filter((s) => s.status === 'conflict').length;

  const reconciliationCount = sales.filter(
    (s) => s.server_accepted === true && s.last_error_code === 'LOCAL_RECONCILIATION_FAILED'
  ).length;

  const totalAttention = conflictCount + reconciliationCount;

  // Derivación de frescura de catálogo (Sección 20 y 24)
  const catalogFreshness: CatalogFreshnessInfo = (() => {
    const isComplete = Boolean(catalogMeta?.catalog_complete);
    const cachedAt = catalogMeta?.cached_at;
    const now = Date.now();
    const ageMs = cachedAt ? now - cachedAt : Infinity;
    const isStale = ageMs > 3600000 || catalogMeta?.status === 'stale'; // > 1 hora o marcado stale
    const deficitCount = Number(catalogMeta?.reservation_deficit || 0);
    const hasDeficit = deficitCount > 0;
    const productCount = Number(catalogMeta?.product_count || 0);

    let status: CatalogFreshnessInfo['status'] = 'incomplete';
    let label = 'No hay un catálogo offline completo disponible';

    if (isRefreshingCatalog || catalogMeta?.status === 'refreshing') {
      status = 'refreshing';
      label = 'Actualizando catálogo…';
    } else if (isComplete) {
      if (isStale) {
        status = 'stale';
        const hoursAgo = Math.floor(ageMs / 3600000);
        label = `Usando catálogo guardado · actualizado hace ${hoursAgo}h (${productCount} prods)`;
      } else {
        status = 'complete';
        const minutesAgo = Math.max(1, Math.floor(ageMs / 60000));
        label = `Catálogo al día · hace ${minutesAgo} min (${productCount} prods)`;
      }
    } else if (catalogMeta?.status === 'error') {
      status = 'error';
      label = 'Error al descargar catálogo · no disponible offline';
    }

    return {
      status,
      isComplete,
      isStale,
      label,
      hasDeficit,
      deficitCount,
      productCount,
      cachedAt,
    };
  })();

  // Sincronización manual protegida con Mutex de doble click (Sección 35)
  const syncPendingSales = useCallback(async () => {
    if (isSyncing) {
      return;
    }
    await rawSyncPendingSales();
    await loadSalesAndMeta();
  }, [isSyncing, rawSyncPendingSales, loadSalesAndMeta]);

  // Reintento de una venta individual
  const retrySale = useCallback(
    async (saleId: string) => {
      if (isSyncing) return;
      await rawRetryPendingSale(saleId);
      await loadSalesAndMeta();
    },
    [isSyncing, rawRetryPendingSale, loadSalesAndMeta]
  );

  // Reintento de reconciliación local para venta ya aceptada en servidor (Fase 6B.4D.1 - Secciones 16, 17, 35, 36, 37)
  const retryLocalReconciliation = useCallback(
    async (saleId: string) => {
      const tenantKey = getTenantSlug() ?? undefined;
      const res = await retryLocalAuthoritativeReconciliation(saleId, {
        tenantKey,
        storeSlug,
      });
      if (res.success) {
        toast.success('Datos locales actualizados con éxito para la venta.');
      } else {
        toast.error(res.error || 'No se pudo completar la reconciliación local.');
      }
      await loadSalesAndMeta();
      return res;
    },
    [storeSlug, loadSalesAndMeta]
  );

  // Refresco manual del catálogo
  const refreshCatalog = useCallback(async () => {
    if (!storeSlug || !navigator.onLine || isRefreshingCatalogRef.current) return;
    try {
      isRefreshingCatalogRef.current = true;
      setIsRefreshingCatalog(true);
      const tenantKey = getTenantSlug();
      const res = await refreshCompleteOfflineCatalog(storeSlug, {
        tenantKey: tenantKey || undefined,
      });
      if (res.success) {
        toast.success(`Catálogo offline actualizado con éxito (${res.productCount} productos).`);
      } else {
        toast.warning(res.error || 'No se pudo actualizar el catálogo offline.');
      }
      await loadSalesAndMeta();
    } finally {
      isRefreshingCatalogRef.current = false;
      setIsRefreshingCatalog(false);
    }
  }, [storeSlug, loadSalesAndMeta]);

  return {
    sales,
    pendingCount,
    syncingCount,
    conflictCount,
    reconciliationCount,
    totalAttention,
    totalCount: sales.length,
    connectivityState,
    isOnline,
    isNetworkOnline,
    isBackendReachable,
    isSyncing,
    catalogMeta,
    catalogFreshness,
    isRefreshingCatalog,
    syncPendingSales,
    retrySale,
    retryLocalReconciliation,
    refreshCatalog,
    reloadStatus: loadSalesAndMeta,
  };
}
