import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  posDb,
  getOfflineQueueSummary,
  recoverStaleSyncingSales,
  retryLocalAuthoritativeReconciliation,
  type PosPendingSale,
} from './pos-db';
import {
  syncPendingSalesForStore,
  isStoreSyncing,
  getSyncKey,
  checkBackendReachability,
  deriveConnectivityState,
  markBackendReachable,
} from './offlineSyncCoordinator';
import { executeManualRetryPendingSale } from './usePosOfflineSync';
import { tenantApi } from '@/api/tenant/tenantApi';

describe('FASE 6B.4D.1 — OFFLINE UX INTEGRATION HARDENING', () => {
  const tenantA = 'tenant_empresa_a';
  const tenantB = 'tenant_empresa_b';
  const storeCentral = 'central';
  const storeNorte = 'norte';

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
    await posDb.pos_pending_sales.clear();
    await posDb.pos_sales_history.clear();
    await posDb.pos_products.clear();
    await posDb.pos_catalog_meta.clear();
    await posDb.pos_stores_v4.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SECCIÓN 29 — TESTS STORE & TENANT ISOLATION EN SYNC
  // =========================================================================

  describe('29. Store & Tenant Isolation during Sync', () => {
    it('TEST 1: sync Central processes Central sale successfully', async () => {
      const saleCentralId = 'uuid-sale-central-1';
      await posDb.pos_pending_sales.add({
        id: saleCentralId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Central', total: 100 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      const postSpy = vi.spyOn(tenantApi, 'post').mockResolvedValueOnce({
        status: 201,
        data: { id: 1001, sale_num: 'V-1001', affected_products: [] },
      });

      const result = await syncPendingSalesForStore(storeCentral, tenantA);

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/sales', expect.objectContaining({ client_name: 'Cliente Central' }));

      // Venta eliminada de pending tras reconciliación
      const pendingAfter = await posDb.pos_pending_sales.get(saleCentralId);
      expect(pendingAfter).toBeUndefined();
    });

    it('TEST 2: sync Central does NOT touch, post, or transition Norte sale to syncing', async () => {
      const saleNorteId = 'uuid-sale-norte-1';
      await posDb.pos_pending_sales.add({
        id: saleNorteId,
        store_id: 2,
        store_slug: storeNorte,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Norte', total: 200 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      const postSpy = vi.spyOn(tenantApi, 'post');

      const result = await syncPendingSalesForStore(storeCentral, tenantA);

      // No debe haber procesado la venta de Norte
      expect(result.syncedCount).toBe(0);
      expect(postSpy).not.toHaveBeenCalled();

      // La venta de Norte debe permanecer intacta en status 'pending'
      const norteSaleAfter = await posDb.pos_pending_sales.get(saleNorteId);
      expect(norteSaleAfter).toBeDefined();
      expect(norteSaleAfter?.status).toBe('pending');
      expect(norteSaleAfter?.attempt_count).toBe(0);
    });

    it('TEST 3: when both Central and Norte have pending sales, sync Central only processes Central', async () => {
      const saleCentralId = 'uuid-sale-c3';
      const saleNorteId = 'uuid-sale-n3';

      await posDb.pos_pending_sales.bulkAdd([
        {
          id: saleCentralId,
          store_id: 1,
          store_slug: storeCentral,
          tenant_key: tenantA,
          endpoint: '/sales',
          payload: { client_name: 'Cliente Central 3', total: 50 },
          created_at: Date.now() - 1000,
          status: 'pending',
          attempt_count: 0,
          server_accepted: false,
        },
        {
          id: saleNorteId,
          store_id: 2,
          store_slug: storeNorte,
          tenant_key: tenantA,
          endpoint: '/sales',
          payload: { client_name: 'Cliente Norte 3', total: 80 },
          created_at: Date.now(),
          status: 'pending',
          attempt_count: 0,
          server_accepted: false,
        },
      ]);

      const postSpy = vi.spyOn(tenantApi, 'post').mockResolvedValueOnce({
        status: 201,
        data: { id: 1003, sale_num: 'V-1003', affected_products: [] },
      });

      const result = await syncPendingSalesForStore(storeCentral, tenantA);

      expect(result.syncedCount).toBe(1);
      expect(postSpy).toHaveBeenCalledTimes(1);

      // Central fue procesada y eliminada
      expect(await posDb.pos_pending_sales.get(saleCentralId)).toBeUndefined();

      // Norte permanece pendiente e inmutable
      const norteSale = await posDb.pos_pending_sales.get(saleNorteId);
      expect(norteSale).toBeDefined();
      expect(norteSale?.status).toBe('pending');
    });

    it('TEST 4: sync tenant A / Central does NOT touch or post tenant B / Central sale', async () => {
      const saleTenantBId = 'uuid-sale-tenant-b';
      await posDb.pos_pending_sales.add({
        id: saleTenantBId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantB,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Empresa B', total: 300 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      const postSpy = vi.spyOn(tenantApi, 'post');

      const result = await syncPendingSalesForStore(storeCentral, tenantA);

      expect(result.syncedCount).toBe(0);
      expect(postSpy).not.toHaveBeenCalled();

      // La venta del Tenant B debe quedar intacta
      const saleB = await posDb.pos_pending_sales.get(saleTenantBId);
      expect(saleB).toBeDefined();
      expect(saleB?.status).toBe('pending');
      expect(saleB?.tenant_key).toBe(tenantB);
    });
  });

  // =========================================================================
  // SECCIÓN 30 — TESTS CONTADORES AISLADOS POR TENANT Y STORE
  // =========================================================================

  describe('30. Store- and Tenant-Scoped Counters', () => {
    it('calculates pending count strictly for current tenant and store', async () => {
      // tenant A / Central = 2 pending
      // tenant A / Norte = 3 pending
      // tenant B / Central = 4 pending
      const sales: PosPendingSale[] = [
        // Tenant A - Central (2)
        { id: 'a-c-1', store_id: 1, store_slug: storeCentral, tenant_key: tenantA, endpoint: '/sales', payload: {}, created_at: 1, status: 'pending' },
        { id: 'a-c-2', store_id: 1, store_slug: storeCentral, tenant_key: tenantA, endpoint: '/sales', payload: {}, created_at: 2, status: 'pending' },

        // Tenant A - Norte (3)
        { id: 'a-n-1', store_id: 2, store_slug: storeNorte, tenant_key: tenantA, endpoint: '/sales', payload: {}, created_at: 3, status: 'pending' },
        { id: 'a-n-2', store_id: 2, store_slug: storeNorte, tenant_key: tenantA, endpoint: '/sales', payload: {}, created_at: 4, status: 'pending' },
        { id: 'a-n-3', store_id: 2, store_slug: storeNorte, tenant_key: tenantA, endpoint: '/sales', payload: {}, created_at: 5, status: 'pending' },

        // Tenant B - Central (4)
        { id: 'b-c-1', store_id: 1, store_slug: storeCentral, tenant_key: tenantB, endpoint: '/sales', payload: {}, created_at: 6, status: 'pending' },
        { id: 'b-c-2', store_id: 1, store_slug: storeCentral, tenant_key: tenantB, endpoint: '/sales', payload: {}, created_at: 7, status: 'pending' },
        { id: 'b-c-3', store_id: 1, store_slug: storeCentral, tenant_key: tenantB, endpoint: '/sales', payload: {}, created_at: 8, status: 'pending' },
        { id: 'b-c-4', store_id: 1, store_slug: storeCentral, tenant_key: tenantB, endpoint: '/sales', payload: {}, created_at: 9, status: 'pending' },
      ];

      await posDb.pos_pending_sales.bulkAdd(sales);

      // Contexto: Tenant A / Central
      const summary = await getOfflineQueueSummary({
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      // Debe ser exactamente 2, NO 9
      expect(summary.pending).toBe(2);
      expect(summary.total).toBe(2);

      // Contexto: Tenant A / Norte
      const summaryNorte = await getOfflineQueueSummary({
        storeSlug: storeNorte,
        tenantKey: tenantA,
      });
      expect(summaryNorte.pending).toBe(3);

      // Contexto: Tenant B / Central
      const summaryTenantB = await getOfflineQueueSummary({
        storeSlug: storeCentral,
        tenantKey: tenantB,
      });
      expect(summaryTenantB.pending).toBe(4);
    });
  });

  // =========================================================================
  // SECCIÓN 31 — TESTS STALE SYNCING RECOVERY CON AISLAMIENTO
  // =========================================================================

  describe('31. Stale Syncing Sales Recovery Isolation', () => {
    it('recovers only stale sales matching the explicit tenant and store context', async () => {
      const oldTime = Date.now() - 60000; // 60s ago (> 30s threshold)

      await posDb.pos_pending_sales.bulkAdd([
        {
          id: 'stale-a-central',
          store_id: 1,
          store_slug: storeCentral,
          tenant_key: tenantA,
          endpoint: '/sales',
          payload: {},
          created_at: oldTime,
          last_attempt_at: oldTime,
          status: 'syncing',
        },
        {
          id: 'stale-a-norte',
          store_id: 2,
          store_slug: storeNorte,
          tenant_key: tenantA,
          endpoint: '/sales',
          payload: {},
          created_at: oldTime,
          last_attempt_at: oldTime,
          status: 'syncing',
        },
        {
          id: 'stale-b-central',
          store_id: 1,
          store_slug: storeCentral,
          tenant_key: tenantB,
          endpoint: '/sales',
          payload: {},
          created_at: oldTime,
          last_attempt_at: oldTime,
          status: 'syncing',
        },
      ]);

      // Recuperación lanzada desde A/Central
      const recoveredCount = await recoverStaleSyncingSales(30000, {
        tenantKey: tenantA,
        storeSlug: storeCentral,
      });

      expect(recoveredCount).toBe(1);

      // Solo A/Central pasó a pending
      const saleACentral = await posDb.pos_pending_sales.get('stale-a-central');
      expect(saleACentral?.status).toBe('pending');

      // Las demás permanecen intactas en status syncing
      const saleANorte = await posDb.pos_pending_sales.get('stale-a-norte');
      expect(saleANorte?.status).toBe('syncing');

      const saleBCentral = await posDb.pos_pending_sales.get('stale-b-central');
      expect(saleBCentral?.status).toBe('syncing');
    });
  });

  // =========================================================================
  // SECCIONES 32, 33, 34 — TESTS SINGLE SYNC OWNER / SHARED MUTEX
  // =========================================================================

  describe('32-34. Single Sync Owner / Shared Mutex', () => {
    it('32 & 33. deduplicates simultaneous triggers from multiple consumers to ONE effective POST', async () => {
      const saleId = 'uuid-sale-mutex-single';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Mutex Test Client', total: 45 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      let postCount = 0;
      vi.spyOn(tenantApi, 'post').mockImplementation(async () => {
        postCount++;
        // Simular latencia de red
        await new Promise((r) => setTimeout(r, 60));
        return {
          status: 201,
          data: { id: 2001, sale_num: 'V-2001', affected_products: [] },
        };
      });

      // Simular dos llamadas simultáneas (e.g. Navbar y ShopHome al recibir evento 'online')
      const p1 = syncPendingSalesForStore(storeCentral, tenantA);
      const p2 = syncPendingSalesForStore(storeCentral, tenantA);

      expect(isStoreSyncing(storeCentral, tenantA)).toBe(true);

      const [res1, res2] = await Promise.all([p1, p2]);

      expect(postCount).toBe(1); // EXACTAMENTE 1 POST a la red
      expect(res1.syncedCount).toBe(1);
      expect(res2.syncedCount).toBe(1); // Ambos consumidores reciben el resultado compartido
      expect(isStoreSyncing(storeCentral, tenantA)).toBe(false);
    });

    it('34. lock key is scoped by store and tenant: Central and Norte have distinct keys', () => {
      const keyCentral = getSyncKey(tenantA, storeCentral);
      const keyNorte = getSyncKey(tenantA, storeNorte);
      const keyTenantB = getSyncKey(tenantB, storeCentral);

      expect(keyCentral).toBe('tenant_empresa_a:central');
      expect(keyNorte).toBe('tenant_empresa_a:norte');
      expect(keyTenantB).toBe('tenant_empresa_b:central');

      expect(keyCentral).not.toBe(keyNorte);
      expect(keyCentral).not.toBe(keyTenantB);
    });
  });

  // =========================================================================
  // SECCIONES 35-38 — TESTS STRICT TENANT & STORE LOCAL RECONCILIATION
  // =========================================================================

  describe('35-38. Strict Tenant & Store Local Reconciliation', () => {
    it('35. missing tenant_key fails safely: NO stock mutation, NO pending delete, NO fallback default', async () => {
      const saleId = 'sale-missing-tenant';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: undefined, // Sin tenant_key
        endpoint: '/sales',
        payload: { total: 100 },
        created_at: Date.now(),
        status: 'failed',
        server_accepted: true,
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        attempt_count: 1,
      });

      const result = await retryLocalAuthoritativeReconciliation(saleId, {
        tenantKey: tenantA,
        storeSlug: storeCentral,
      });

      expect(result.success).toBe(false);
      expect(result.reconciledLocally).toBe(false);
      expect(result.error).toContain('tenant_key');

      // La venta permanece en la cola sin borrado
      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter).toBeDefined();
      expect(saleAfter?.server_accepted).toBe(true);
    });

    it('36. wrong tenant retry local from POS context A is rejected safely', async () => {
      const saleId = 'sale-tenant-b-accepted';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantB, // Venta de Tenant B
        endpoint: '/sales',
        payload: { total: 200 },
        created_at: Date.now(),
        status: 'failed',
        server_accepted: true,
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        attempt_count: 1,
      });

      // Intento de reconciliación local desde el POS de Tenant A
      const result = await retryLocalAuthoritativeReconciliation(saleId, {
        tenantKey: tenantA,
        storeSlug: storeCentral,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('otra organización tenant');

      // Venta intacta
      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter).toBeDefined();
      expect(saleAfter?.tenant_key).toBe(tenantB);
    });

    it('37. wrong store retry local from POS Central for Norte sale is rejected safely', async () => {
      const saleId = 'sale-norte-accepted';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 2,
        store_slug: storeNorte, // Venta de Norte
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { total: 150 },
        created_at: Date.now(),
        status: 'failed',
        server_accepted: true,
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        attempt_count: 1,
      });

      // Intento de reconciliación local desde POS Central
      const result = await retryLocalAuthoritativeReconciliation(saleId, {
        tenantKey: tenantA,
        storeSlug: storeCentral,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('otra sucursal');

      // Venta permanece intacta
      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter).toBeDefined();
      expect(saleAfter?.store_slug).toBe(storeNorte);
    });

    it('38. server_accepted=true with LOCAL_RECONCILIATION_FAILED does ZERO POST calls during retry', async () => {
      const saleId = 'sale-accepted-no-post';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { total: 80, name: 'Comprador 38' },
        created_at: Date.now(),
        status: 'failed',
        server_accepted: true,
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        affected_products: [],
        attempt_count: 1,
      });

      await posDb.pos_sales_history.put({
        id: saleId,
        store_slug: storeCentral,
        customer_name: 'Comprador 38',
        total: 80,
        discount: 0,
        payment_method: 'efectivo',
        date: 'Hoy',
        created_at: new Date().toISOString(),
        status: 'completado (pendiente de sincronizar)',
        is_offline: true,
        products: [],
      });

      const postSpy = vi.spyOn(tenantApi, 'post');

      const result = await retryLocalAuthoritativeReconciliation(saleId, {
        tenantKey: tenantA,
        storeSlug: storeCentral,
      });

      expect(result.success).toBe(true);
      expect(result.reconciledLocally).toBe(true);
      expect(postSpy).not.toHaveBeenCalled(); // CERO llamadas POST por red

      // Venta eliminada de pendientes tras completar la reconciliación local
      expect(await posDb.pos_pending_sales.get(saleId)).toBeUndefined();

      // Historial actualizado a sincronizado
      const historyItem = await posDb.pos_sales_history.get(saleId);
      expect(historyItem?.status).toBe('completado (sincronizado previamente)');
    });
  });

  // =========================================================================
  // SECCIÓN 39 & 40 — TESTS BACKEND REACHABILITY Y CONECTIVIDAD REAL
  // =========================================================================

  describe('39-40. Real Backend Reachability and Connectivity States', () => {
    it('39-A: navigator.onLine=false -> OFFLINE', () => {
      const state = deriveConnectivityState(false, storeCentral, tenantA);
      expect(state).toBe('offline');
    });

    it('39-B: navigator.onLine=true + verification success -> ONLINE', async () => {
      vi.spyOn(tenantApi, 'get').mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok', online: true },
      });

      const isReachable = await checkBackendReachability(true);
      expect(isReachable).toBe(true);

      const state = deriveConnectivityState(true, storeCentral, tenantA);
      expect(state).toBe('online');
    });

    it('39-C: navigator.onLine=true + connection error -> SERVER_UNAVAILABLE', async () => {
      vi.spyOn(tenantApi, 'get').mockRejectedValueOnce({
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'Network Error',
      });

      const isReachable = await checkBackendReachability(true);
      expect(isReachable).toBe(false);

      const state = deriveConnectivityState(true, storeCentral, tenantA);
      expect(state).toBe('server_unavailable');
    });

    it('39-D: navigator.onLine=true + HTTP 503 -> SERVER_UNAVAILABLE', async () => {
      vi.spyOn(tenantApi, 'get').mockRejectedValueOnce({
        response: { status: 503, data: { message: 'Service Unavailable' } },
      });

      const isReachable = await checkBackendReachability(true);
      expect(isReachable).toBe(false);

      const state = deriveConnectivityState(true, storeCentral, tenantA);
      expect(state).toBe('server_unavailable');
    });

    it('39-E: online event after offline transitions through checking/reconnecting, NOT false ONLINE immediately', async () => {
      // 1. Inicialmente offline
      const offlineState = deriveConnectivityState(false, storeCentral, tenantA);
      expect(offlineState).toBe('offline');

      // 2. Red vuelve online pero backend no verificado todavía (reachability is checking/reconnecting)
      // deriveConnectivityState cuando reachability aún se está comprobando o syncing
      vi.spyOn(tenantApi, 'get').mockImplementation(async () => {
        // Simular latencia de ping
        await new Promise((r) => setTimeout(r, 40));
        return { status: 200, data: { status: 'ok', online: true } };
      });

      const pingPromise = checkBackendReachability(true);

      // Mientras la verificación está en vuelo: estado transitorio seguro
      const intermediateState = deriveConnectivityState(true, storeCentral, tenantA);
      expect(intermediateState).toBe('reconnecting');
      expect(intermediateState).not.toBe('online');

      // Tras completarse la verificación exitosa: ahora sí pasa a 'online'
      await pingPromise;
      const verifiedState = deriveConnectivityState(true, storeCentral, tenantA);
      expect(verifiedState).toBe('online');
    });

    it('40. Server down: offline queue accepts sale and state is SERVER_UNAVAILABLE', async () => {
      // Marcar backend como no alcanzable
      markBackendReachable(false);

      const state = deriveConnectivityState(true, storeCentral, tenantA);
      expect(state).toBe('server_unavailable');

      // Venta registrada bajo esta condición
      const saleId = 'uuid-sale-server-down';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Venta durante caída backend', total: 120 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      const summary = await getOfflineQueueSummary({
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(summary.pending).toBe(1);
      const pendingSale = await posDb.pos_pending_sales.get(saleId);
      expect(pendingSale?.id).toBe(saleId);
      expect(pendingSale?.status).toBe('pending');
    });
  });

  // =========================================================================
  // FASE 6B.4D.1 FIX-1 — TESTS DE ENDURECIMIENTO ESPECÍFICOS
  // =========================================================================

  describe('FASE 6B.4D.1 FIX-1 — Final Integration Corrections', () => {
    it('FIX-1 A: Central sync leaves legacy tenantless sale of Norte COMPLETELY untouched (0 mutations, 0 POST)', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');

      // Venta 1: Legacy sin tenant_key perteneciente a Norte
      const legacyNorteId = 'legacy-norte-sale-id';
      const originalCreatedAt = Date.now() - 50000;
      await posDb.pos_pending_sales.add({
        id: legacyNorteId,
        store_id: 2,
        store_slug: storeNorte,
        tenant_key: undefined,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Legacy Norte', total: 250 },
        created_at: originalCreatedAt,
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      // Ejecutar sincronización de Central para tenantA
      const result = await syncPendingSalesForStore(storeCentral, tenantA);

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(postSpy).not.toHaveBeenCalled();

      // INVARIANTE CRÍTICA FIX-1: La venta de Norte NO fue tocada ni mutada
      const legacyNorteAfter = await posDb.pos_pending_sales.get(legacyNorteId);
      expect(legacyNorteAfter).toBeDefined();
      expect(legacyNorteAfter?.status).toBe('pending');
      expect(legacyNorteAfter?.tenant_key).toBeUndefined();
      expect(legacyNorteAfter?.store_slug).toBe(storeNorte);
      expect(legacyNorteAfter?.last_error_code).toBeUndefined();
      expect(legacyNorteAfter?.attempt_count).toBe(0);
      expect(legacyNorteAfter?.last_attempt_at).toBeUndefined();
    });

    it('FIX-1 B: Central sync with legacy tenantless sale of Central fails safely (preserves UUID, NO POST, NOT attributed to tenantA)', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');

      // Venta 2: Legacy sin tenant_key pero físicamente perteneciente a Central
      const legacyCentralId = 'legacy-central-sale-id';
      await posDb.pos_pending_sales.add({
        id: legacyCentralId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: undefined,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Legacy Central', total: 300 },
        created_at: Date.now() - 30000,
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      const result = await syncPendingSalesForStore(storeCentral, tenantA);

      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(postSpy).not.toHaveBeenCalled();

      // Comprobar estado en IndexedDB
      const legacyCentralAfter = await posDb.pos_pending_sales.get(legacyCentralId);
      expect(legacyCentralAfter).toBeDefined();
      expect(legacyCentralAfter?.id).toBe(legacyCentralId); // UUID inmutable
      expect(legacyCentralAfter?.status).toBe('failed');
      expect(legacyCentralAfter?.last_error_code).toBe('MISSING_TENANT_KEY');
      expect(legacyCentralAfter?.tenant_key).toBeUndefined(); // NUNCA atribuido a tenantA ni a 'default'
      expect(legacyCentralAfter?.store_slug).toBe(storeCentral);
      expect(legacyCentralAfter?.error_message).toContain('Requiere revisión manual');
    });

    it('FIX-1 C: isStoreSyncing without tenant returns false and does NOT construct default:store lock', () => {
      expect(isStoreSyncing(storeCentral, undefined)).toBe(false);
      expect(isStoreSyncing(storeCentral, '')).toBe(false);
      expect(isStoreSyncing('', tenantA)).toBe(false);
    });

    it('FIX-1 D: Locks tenant/store remain strictly independent (Central vs Norte)', async () => {
      const keyCentral = getSyncKey(tenantA, storeCentral);
      const keyNorte = getSyncKey(tenantA, storeNorte);

      expect(keyCentral).toBe(`${tenantA}:${storeCentral}`);
      expect(keyNorte).toBe(`${tenantA}:${storeNorte}`);
      expect(keyCentral).not.toBe(keyNorte);
      expect(keyCentral).not.toContain('default');
    });
  });

  // =========================================================================
  // FASE 6B.4D.1 FIX-2 — STRICT MANUAL RETRY CONTEXT GUARD
  // =========================================================================

  describe('FASE 6B.4D.1 FIX-2 — Strict Manual Retry Context Guard', () => {
    it('TEST 1 (Sec 13): Missing active tenant blocks retry, prevents mutation, 0 POST', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-no-active-tenant';
      const originalCreatedAt = Date.now() - 10000;

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Test', total: 100 },
        created_at: originalCreatedAt,
        status: 'failed',
        attempt_count: 1,
        last_error_code: 'NETWORK_ERROR',
        server_accepted: false,
      });

      // Contexto con activeTenant = undefined
      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: undefined,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Empresa activa no determinada');
      expect(postSpy).not.toHaveBeenCalled();

      // Invariante: Venta en Dexie no fue mutada
      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('failed');
      expect(saleAfter?.attempt_count).toBe(1);
      expect(saleAfter?.last_attempt_at).toBeUndefined();
    });

    it('TEST 2 (Sec 14): Missing sale tenant blocks retry, preserves status=failed, 0 POST, no attribution', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-no-sale-tenant';

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: undefined, // legacy sin tenant
        endpoint: '/sales',
        payload: { client_name: 'Cliente Legacy', total: 150 },
        created_at: Date.now() - 20000,
        status: 'failed',
        attempt_count: 1,
        last_error_code: 'MISSING_TENANT_KEY',
        server_accepted: false,
      });

      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Venta sin tenant_key');
      expect(postSpy).not.toHaveBeenCalled();

      // Invariante: no pasa a pending, no se atribuye tenantA
      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('failed');
      expect(saleAfter?.tenant_key).toBeUndefined();
    });

    it('TEST 3 (Sec 15): Missing active store blocks retry, 0 mutations, 0 POST', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-no-active-store';

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Test', total: 100 },
        created_at: Date.now() - 10000,
        status: 'failed',
        attempt_count: 1,
        server_accepted: false,
      });

      // storeSlug = undefined
      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: undefined,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sucursal activa no determinada');
      expect(postSpy).not.toHaveBeenCalled();

      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('failed');
    });

    it('TEST 4 (Sec 16): Missing sale store blocks retry, 0 mutations, 0 POST', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-no-sale-store';

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: '' as any, // venta sin store_slug
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Test', total: 100 },
        created_at: Date.now() - 10000,
        status: 'failed',
        attempt_count: 1,
        server_accepted: false,
      });

      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Venta sin store_slug');
      expect(postSpy).not.toHaveBeenCalled();

      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('failed');
    });

    it('TEST 5 (Sec 17): Wrong tenant retry blocked, 0 mutations, 0 POST', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-wrong-tenant';

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantB, // Pertenece a tenantB
        endpoint: '/sales',
        payload: { client_name: 'Cliente Tenant B', total: 100 },
        created_at: Date.now() - 10000,
        status: 'failed',
        attempt_count: 1,
        server_accepted: false,
      });

      // Intentar retry desde POS de tenantA
      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('otro tenant');
      expect(postSpy).not.toHaveBeenCalled();

      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('failed');
      expect(saleAfter?.tenant_key).toBe(tenantB);
    });

    it('TEST 6 (Sec 18): Wrong store retry blocked, 0 mutations, 0 POST', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-wrong-store';

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 2,
        store_slug: storeNorte, // Pertenece a Norte
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Norte', total: 100 },
        created_at: Date.now() - 10000,
        status: 'failed',
        attempt_count: 1,
        server_accepted: false,
      });

      // Intentar retry desde POS de Central
      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('otra sucursal');
      expect(postSpy).not.toHaveBeenCalled();

      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('failed');
      expect(saleAfter?.store_slug).toBe(storeNorte);
    });

    it('TEST 7 (Sec 19): Valid retry allows failed -> pending -> sync -> POST count = 1, UUID preserved', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post').mockResolvedValueOnce({
        status: 200,
        data: {
          sale_id: 'uuid-retry-valid-success',
          status: 'completado',
          affected_products: [],
        },
      });

      const saleId = 'uuid-retry-valid-success';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Valido', total: 200, offline_sale_id: saleId },
        created_at: Date.now() - 15000,
        status: 'failed',
        attempt_count: 1,
        last_error_code: 'NETWORK_ERROR',
        server_accepted: false,
      });

      // 1. Ejecutar manual retry
      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(true);

      // La venta pasó a pending
      const salePending = await posDb.pos_pending_sales.get(saleId);
      expect(salePending?.status).toBe('pending');
      expect(salePending?.last_error_message).toBeUndefined();

      // 2. Sincronizar
      const syncResult = await syncPendingSalesForStore(storeCentral, tenantA);
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBe(1);
      expect(postSpy).toHaveBeenCalledTimes(1);

      // UUID original intacto
      expect(postSpy).toHaveBeenCalledWith(
        '/sales',
        expect.objectContaining({
          client_name: 'Cliente Valido',
          offline_sale_id: saleId,
        })
      );
    });

    it('TEST 8 (Sec 20): server_accepted=true blocks retryPendingSale, NO repost (POST count = 0)', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-server-accepted';

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Ya Aceptado', total: 350 },
        created_at: Date.now() - 10000,
        status: 'failed',
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        server_accepted: true, // Ya aceptada en backend
      });

      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ya fue aceptada');
      expect(postSpy).not.toHaveBeenCalled();

      // No fue reseteada a pending
      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('failed');
      expect(saleAfter?.server_accepted).toBe(true);
    });

    it('TEST 9 (Sec 21): status=conflict blocks retryPendingSale, 0 mutations, 0 POST', async () => {
      const postSpy = vi.spyOn(tenantApi, 'post');
      const saleId = 'uuid-retry-conflict';

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeCentral,
        tenant_key: tenantA,
        endpoint: '/sales',
        payload: { client_name: 'Cliente Conflicto', total: 400 },
        created_at: Date.now() - 10000,
        status: 'conflict',
        last_error_code: 'STOCK_INSUFFICIENT',
        server_accepted: false,
      });

      const result = await executeManualRetryPendingSale(saleId, {
        storeSlug: storeCentral,
        tenantKey: tenantA,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conflicto comercial');
      expect(postSpy).not.toHaveBeenCalled();

      const saleAfter = await posDb.pos_pending_sales.get(saleId);
      expect(saleAfter?.status).toBe('conflict');
    });
  });
});
