import { posDb, type PosPendingSale, recoverStaleSyncingSales } from './pos-db';
import { reconcileAuthoritativeSale } from './offlineSaleReconciliation';
import { classifyOfflineSyncError } from './offlineErrorClassifier';
import { tenantApi } from '@/api/tenant/tenantApi';
import { getTenantSlug } from '@/utils/tenant';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  error?: string;
}

export type ConnectivityState = 'online' | 'offline' | 'server_unavailable' | 'reconnecting';

// Mutex compartido a nivel de módulo con alcance estricto por [tenantKey:storeSlug]
// Fase 6B.4D.1 — Secciones 10, 11, 12, 13, 32, 34
const activeSyncPromises = new Map<string, Promise<SyncResult>>();

// Estado compartido de verificabilidad del backend (Secciones 19, 20, 21, 22)
interface ReachabilityState {
  isBackendReachable: boolean | null; // null = checking / unknown
  lastCheckedAt: number;
  isChecking: boolean;
}

const reachability: ReachabilityState = {
  isBackendReachable: null,
  lastCheckedAt: 0,
  isChecking: false,
};

export function getSyncKey(tenantKey: string, storeSlug: string): string {
  return `${tenantKey}:${storeSlug}`;
}

export function isStoreSyncing(storeSlug: string, tenantKey?: string): boolean {
  const effectiveTenant = tenantKey || getTenantSlug();
  if (!effectiveTenant || !storeSlug) {
    return false;
  }
  return activeSyncPromises.has(getSyncKey(effectiveTenant, storeSlug));
}

export function getBackendReachability(): boolean | null {
  return reachability.isBackendReachable;
}

export function markBackendReachable(reachable: boolean): void {
  reachability.isBackendReachable = reachable;
  reachability.lastCheckedAt = Date.now();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos-reachability-changed', { detail: { reachable } }));
  }
}

/**
 * Comprueba de forma ligera y segura si el backend de Inventarya responde.
 * Reutiliza el endpoint existente GET /api/ping (o maneja errores de red/5xx).
 * No realiza polling agresivo ni bucles continuos (Secciones 19, 20, 21, 22).
 */
export async function checkBackendReachability(force = false): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    reachability.isBackendReachable = false;
    return false;
  }

  const now = Date.now();
  // Cache liviano de 5 segundos para evitar múltiples pings simultáneos
  if (!force && reachability.isBackendReachable !== null && now - reachability.lastCheckedAt < 5000) {
    return reachability.isBackendReachable;
  }

  if (reachability.isChecking) {
    return reachability.isBackendReachable ?? false;
  }

  reachability.isChecking = true;
  try {
    const res = await tenantApi.get('/ping', { timeout: 4000 });
    const isOk = res.status === 200;
    reachability.isBackendReachable = isOk;
    reachability.lastCheckedAt = Date.now();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-reachability-changed', { detail: { reachable: isOk } }));
    }
    return isOk;
  } catch (err: any) {
    // Si la llamada falla por error de red o 5xx, el backend no está disponible
    reachability.isBackendReachable = false;
    reachability.lastCheckedAt = Date.now();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-reachability-changed', { detail: { reachable: false } }));
    }
    return false;
  } finally {
    reachability.isChecking = false;
  }
}

/**
 * Deriva el estado semántico de conectividad del POS (Secciones 19, 21, 23).
 */
export function deriveConnectivityState(
  isNetworkOnline: boolean,
  storeSlug?: string,
  tenantKey?: string
): ConnectivityState {
  if (!isNetworkOnline) {
    return 'offline';
  }

  const isSyncing = storeSlug ? isStoreSyncing(storeSlug, tenantKey) : false;
  if (isSyncing || reachability.isChecking || reachability.isBackendReachable === null) {
    return 'reconnecting';
  }

  if (reachability.isBackendReachable === false) {
    return 'server_unavailable';
  }

  return 'online';
}

/**
 * Motor de sincronización aislado estrictamente por [tenantKey + storeSlug].
 * Implementa Single Sync Owner con Shared Mutex (Fase 6B.4D.1 - Secciones 4, 5, 6, 10, 11).
 *
 * Invariantes garantizadas:
 * 1. Mismo tenant + store simultáneos -> un solo flujo efectivo en vuelo.
 * 2. Ventas de otra tienda u otro tenant se filtran tempranamente antes de pasar a 'syncing' o POST.
 * 3. Ventas con server_accepted=true ejecutan reconciliación local sin reenviar POST.
 * 4. El UUID original se conserva en todo momento.
 */
export async function syncPendingSalesForStore(
  storeSlug: string,
  tenantKey?: string,
  options?: {
    onSyncComplete?: () => void;
  }
): Promise<SyncResult> {
  const effectiveTenant = tenantKey || getTenantSlug();
  if (!effectiveTenant || !storeSlug) {
    return {
      success: false,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      error: 'Contexto de tenant y store requerido para sincronización offline.',
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    reachability.isBackendReachable = false;
    return {
      success: false,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      error: 'Sin conexión a internet.',
    };
  }

  const key = getSyncKey(effectiveTenant, storeSlug);

  // Exclusión mutua compartida: si ya existe una sincronización en curso para este store/tenant, retornar la misma promesa
  const existingPromise = activeSyncPromises.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const syncPromise = (async (): Promise<SyncResult> => {
    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    try {
      // 1. Recuperar ventas syncing huérfanas limitadas estrictamente a este tenant y store
      await recoverStaleSyncingSales(30000, {
        tenantKey: effectiveTenant,
        storeSlug,
      });

      // 2. Consultar ventas con estado 'pending'
      const allPending = await posDb.pos_pending_sales
        .where('status')
        .equals('pending')
        .sortBy('created_at');

      // 3. FILTRADO TEMPRANO ESTRICTO (Secciones 5 y 6)
      // Ninguna venta de otra tienda u otro tenant puede pasar a 'syncing' ni a POST
      const eligibleSales: PosPendingSale[] = [];

      for (const item of allPending) {
        // 1. Aislamiento de tienda estricto: nunca tocar ni mutar ventas de otra tienda (Fase 6B.4D.1 FIX-1)
        if (item.store_slug !== storeSlug) {
          continue;
        }

        // 2. Pertenece a esta tienda, pero carece de identidad tenant
        if (!item.tenant_key) {
          // Venta legacy sin tenant_key: marcar failed para revisión manual, nunca atribuir al tenant actual
          await posDb.pos_pending_sales.update(item.id, {
            status: 'failed',
            last_error_code: 'MISSING_TENANT_KEY',
            last_error_message: 'Venta legacy sin tenant_key. Preservada para revisión manual.',
            error_message: 'Venta anterior sin contexto tenant/caja. Requiere revisión manual; no se ha eliminado.',
            last_attempt_at: Date.now(),
          });
          failedCount++;
          continue;
        }

        // 3. Nunca tocar otro tenant
        if (item.tenant_key !== effectiveTenant) {
          continue;
        }

        eligibleSales.push(item);
      }

      if (eligibleSales.length === 0) {
        return { success: true, syncedCount: 0, conflictCount, failedCount };
      }

      // Notificar que la sincronización comenzó
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-sync-status-changed', {
          detail: { storeSlug, tenantKey: effectiveTenant, isSyncing: true },
        }));
      }

      for (const item of eligibleSales) {
        // Venta previamente aceptada por el servidor pero con reconciliación Dexie local pendiente:
        // NO reenviar por red (Fase 6B.4D / 6B.4D.1 - Secciones 18 y 38)
        if (item.server_accepted && item.last_error_code === 'LOCAL_RECONCILIATION_FAILED') {
          const reconcile = await reconcileAuthoritativeSale({
            saleId: item.id,
            storeSlug: item.store_slug,
            tenantKey: item.tenant_key!,
            affectedProducts: item.affected_products,
            isDuplicate: true,
          });
          if (reconcile.success) {
            syncedCount++;
          } else {
            failedCount++;
          }
          continue;
        }

        // Marcar en curso antes del POST
        await posDb.pos_pending_sales.update(item.id, {
          status: 'syncing',
          last_attempt_at: Date.now(),
          attempt_count: (item.attempt_count ?? 0) + 1,
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos-offline-sales-changed'));
        }

        try {
          const res = await tenantApi.post(item.endpoint || '/sales', item.payload);

          if (res.status === 200 || res.status === 201) {
            markBackendReachable(true);

            try {
              await posDb.pos_pending_sales.update(item.id, {
                server_accepted: true,
                affected_products: res.data?.affected_products,
              });
            } catch {
              // No crítico
            }

            const reconcile = await reconcileAuthoritativeSale({
              saleId: item.id,
              storeSlug: item.store_slug,
              tenantKey: item.tenant_key!,
              affectedProducts: res.data?.affected_products,
              isDuplicate: res.data?.is_duplicate ?? false,
            });

            if (reconcile.success) {
              syncedCount++;
            } else {
              failedCount++;
            }
          }
        } catch (err: any) {
          const classified = classifyOfflineSyncError(err);

          // Si es éxito idempotente (200 con is_duplicate o 409 canónico idéntico):
          if (classified.kind === 'idempotent_success') {
            markBackendReachable(true);
            const reconcile = await reconcileAuthoritativeSale({
              saleId: item.id,
              storeSlug: item.store_slug,
              tenantKey: item.tenant_key!,
              affectedProducts: err?.response?.data?.affected_products,
              isDuplicate: true,
            });

            if (reconcile.success) {
              syncedCount++;
            } else {
              failedCount++;
            }
            continue;
          }

          // Si es conflicto comercial autoritativo:
          if (classified.kind === 'conflict') {
            markBackendReachable(true);
            conflictCount++;
            await posDb.pos_pending_sales.update(item.id, {
              status: 'conflict',
              last_error_code: classified.code,
              last_error_message: classified.message,
              error_message: classified.message,
              affected_products: err?.response?.data?.affected_products,
              last_attempt_at: Date.now(),
            });
            continue;
          }

          // Errores de red o de servidor transitorios (5xx):
          if (classified.kind === 'retryable') {
            markBackendReachable(false);
            failedCount++;
            await posDb.pos_pending_sales.update(item.id, {
              status: 'pending',
              last_error_code: classified.code,
              last_error_message: classified.message,
              error_message: classified.message,
              last_attempt_at: Date.now(),
            });
            continue;
          }

          // Errores terminales:
          failedCount++;
          await posDb.pos_pending_sales.update(item.id, {
            status: 'failed',
            last_error_code: classified.code,
            last_error_message: classified.message,
            error_message: classified.message,
            last_attempt_at: Date.now(),
          });
        }
      }

      if (syncedCount > 0) {
        options?.onSyncComplete?.();
      }

      return {
        success: true,
        syncedCount,
        conflictCount,
        failedCount,
      };
    } finally {
      activeSyncPromises.delete(key);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-sync-status-changed', {
          detail: { storeSlug, tenantKey: effectiveTenant, isSyncing: false },
        }));
        window.dispatchEvent(new CustomEvent('pos-offline-sales-changed'));
      }
    }
  })();

  activeSyncPromises.set(key, syncPromise);
  return syncPromise;
}
