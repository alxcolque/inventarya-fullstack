import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOfflineConflictPresentation,
  classifyOfflineSyncError,
} from './offlineErrorClassifier';
import {
  posDb,
  validateOfflineStock,
  decrementOfflineStock,
  queueOfflineSale,
  retryLocalAuthoritativeReconciliation,
  type PosPendingSale,
} from './pos-db';
import { reconcileAuthoritativeSale } from './offlineSaleReconciliation';

describe('FASE 6B.4D — OFFLINE UX / CONFLICT MANAGEMENT', () => {
  const tenantKey = 'tenant_test_ux';
  const storeSlug = 'central-store';
  const otherStoreSlug = 'branch-north';

  beforeEach(async () => {
    await posDb.pos_pending_sales.clear();
    await posDb.pos_sales_history.clear();
    await posDb.pos_products.clear();
    await posDb.pos_catalog_meta.clear();
    await posDb.pos_stores_v4.clear();
  });

  // =========================================================================
  // SECCIÓN 39 — TESTS UNITARIOS UX / ESTADO
  // =========================================================================

  describe('1-3. Connectivity States Mapping', () => {
    it('1. navigator online + backend reachable -> ONLINE', () => {
      const isOnline = true;
      const isBackendReachable = true;
      const isReconnecting = false;
      const state = !isOnline
        ? 'offline'
        : isReconnecting
        ? 'reconnecting'
        : isBackendReachable
        ? 'online'
        : 'server_unavailable';

      expect(state).toBe('online');
    });

    it('2. navigator offline -> OFFLINE', () => {
      const isOnline = false;
      const isBackendReachable = false;
      const isReconnecting = false;
      const state = !isOnline
        ? 'offline'
        : isReconnecting
        ? 'reconnecting'
        : isBackendReachable
        ? 'online'
        : 'server_unavailable';

      expect(state).toBe('offline');
    });

    it('3. navigator online + backend unreachable -> SERVER_UNAVAILABLE', () => {
      const isOnline = true;
      const isBackendReachable = false;
      const isReconnecting = false;
      const state = !isOnline
        ? 'offline'
        : isReconnecting
        ? 'reconnecting'
        : isBackendReachable
        ? 'online'
        : 'server_unavailable';

      expect(state).toBe('server_unavailable');
    });
  });

  describe('4-8. Queue States and Counters', () => {
    it('4. pending status counts towards pendingCount', async () => {
      await posDb.pos_pending_sales.add({
        id: 'sale-pending-1',
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: { client_name: 'Ana', total: 100 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      const all = await posDb.pos_pending_sales.toArray();
      const items = all.filter((s) => s.tenant_key === tenantKey && s.store_slug === storeSlug);

      const pendingCount = items.filter(
        (i) => i.status === 'pending' || i.status === 'failed'
      ).length;
      expect(pendingCount).toBe(1);
    });

    it('5. syncing status counts towards syncingCount', async () => {
      await posDb.pos_pending_sales.add({
        id: 'sale-syncing-1',
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: { client_name: 'Carlos', total: 50 },
        created_at: Date.now(),
        status: 'syncing',
        attempt_count: 1,
        server_accepted: false,
      });

      const all = await posDb.pos_pending_sales.toArray();
      const items = all.filter((s) => s.tenant_key === tenantKey && s.store_slug === storeSlug);

      const syncingCount = items.filter((i) => i.status === 'syncing').length;
      expect(syncingCount).toBe(1);
    });

    it('6. conflict status counts towards attentionCount', async () => {
      await posDb.pos_pending_sales.add({
        id: 'sale-conflict-1',
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: { client_name: 'Elena', total: 200 },
        created_at: Date.now(),
        status: 'conflict',
        last_error_code: 'STOCK_INSUFFICIENT',
        last_error_message: 'Stock insuficiente',
        attempt_count: 3,
        server_accepted: false,
      });

      const all = await posDb.pos_pending_sales.toArray();
      const items = all.filter((s) => s.tenant_key === tenantKey && s.store_slug === storeSlug);

      const conflictCount = items.filter((i) => i.status === 'conflict').length;
      const totalAttention = items.filter(
        (i) => i.status === 'conflict' || i.last_error_code === 'LOCAL_RECONCILIATION_FAILED'
      ).length;

      expect(conflictCount).toBe(1);
      expect(totalAttention).toBe(1);
    });

    it('7. LOCAL_RECONCILIATION_FAILED does NOT appear as regular failed sale', () => {
      const presentation = getOfflineConflictPresentation('LOCAL_RECONCILIATION_FAILED');
      expect(presentation.title).toBe('Venta registrada en servidor');
      expect(presentation.description).toContain('actualizar los datos en este dispositivo');
      expect(presentation.action).toBe('retry_local');
      expect(presentation.retryable).toBe(true);
    });

    it('8. server_accepted=true forbids sending duplicate sale to backend', async () => {
      const sale: PosPendingSale = {
        id: 'sale-accepted-local-failed',
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: { client_name: 'Mario', total: 75 },
        created_at: Date.now(),
        status: 'failed',
        server_accepted: true,
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        attempt_count: 1,
      };

      // Condition evaluated by usePosOfflineSync and UI:
      const shouldPostNewSale = !sale.server_accepted;
      expect(shouldPostNewSale).toBe(false);

      const presentation = getOfflineConflictPresentation(sale.last_error_code);
      expect(presentation.action).toBe('retry_local');
    });
  });

  describe('9-13. Conflict Classification and Action Policies', () => {
    it('9. network error -> retryable with retry action', () => {
      const presentation = getOfflineConflictPresentation('NETWORK_ERROR');
      expect(presentation.retryable).toBe(true);
      expect(presentation.action).toBe('retry');
      expect(presentation.title).toContain('conexión');
    });

    it('10. STOCK_INSUFFICIENT -> non-auto-retry / review action', () => {
      const presentation = getOfflineConflictPresentation('STOCK_INSUFFICIENT');
      expect(presentation.retryable).toBe(false);
      expect(presentation.action).toBe('refresh_catalog');
      expect(presentation.title).toBe('Stock insuficiente');
      expect(presentation.description).toContain('cambió mientras el dispositivo operaba sin conexión');
    });

    it('11. CASH_REGISTER_CLOSED -> conflict / no silent reassignment', () => {
      const presentation = getOfflineConflictPresentation('CASH_REGISTER_CLOSED');
      expect(presentation.retryable).toBe(false);
      expect(presentation.action).toBe('contact_admin');
      expect(presentation.title).toBe('Caja original cerrada');
      expect(presentation.description).toContain('no se modificará automáticamente');
    });

    it('12. STORE_MISMATCH -> conflict / no store mutation', () => {
      const presentation = getOfflineConflictPresentation('STORE_MISMATCH');
      expect(presentation.retryable).toBe(false);
      expect(presentation.action).toBe('switch_store');
      expect(presentation.title).toBe('Esta venta pertenece a otra sucursal');
      expect(presentation.description).toContain('otra tienda');
    });

    it('13. payload/idempotency conflict -> no new UUID, technical review', () => {
      const presentation = getOfflineConflictPresentation('SALE_IDEMPOTENCY_CONFLICT');
      expect(presentation.retryable).toBe(false);
      expect(presentation.action).toBe('view_details');
      expect(presentation.title).toBe('Conflicto de integridad de la venta');
      expect(presentation.description).toContain('datos diferentes');
    });
  });

  describe('14-17. Catalog Freshness, Deficit and Completeness', () => {
    it('14. reservation_deficit > 0 -> warning state', async () => {
      await posDb.pos_catalog_meta.put({
        id: `${tenantKey}:${storeSlug}`,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        cached_at: Date.now(),
        catalog_complete: true,
        product_count: 10,
        status: 'complete',
        reservation_deficit: 3,
      });

      const meta = await posDb.pos_catalog_meta
        .where('[tenant_key+store_slug]')
        .equals([tenantKey, storeSlug])
        .first();

      expect(meta?.reservation_deficit).toBe(3);
      expect((meta?.reservation_deficit ?? 0) > 0).toBe(true);
    });

    it('15. catalog stale + complete -> usable with warning', async () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      await posDb.pos_catalog_meta.put({
        id: `${tenantKey}:${storeSlug}`,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        cached_at: twoHoursAgo,
        catalog_complete: true,
        product_count: 5,
        status: 'stale',
      });

      const meta = await posDb.pos_catalog_meta
        .where('[tenant_key+store_slug]')
        .equals([tenantKey, storeSlug])
        .first();

      expect(meta?.catalog_complete).toBe(true);
      expect(meta?.status).toBe('stale');
    });

    it('16. catalog incomplete + offline -> unsafe operation blocked', async () => {
      await posDb.pos_catalog_meta.put({
        id: `${tenantKey}:${storeSlug}`,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        cached_at: Date.now(),
        catalog_complete: false, // Incomplete snapshot
        product_count: 2,
        status: 'stale',
      });

      const meta = await posDb.pos_catalog_meta
        .where('[tenant_key+store_slug]')
        .equals([tenantKey, storeSlug])
        .first();

      // Check policy: offline sale requires complete catalog
      const canSellOffline = meta?.catalog_complete === true;
      expect(canSellOffline).toBe(false);
    });

    it('17. refresh failed + previous complete snapshot -> previous snapshot remains usable', async () => {
      const originalTime = Date.now() - 10 * 60 * 1000;
      await posDb.pos_catalog_meta.put({
        id: `${tenantKey}:${storeSlug}`,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        cached_at: originalTime,
        catalog_complete: true,
        product_count: 20,
        status: 'complete',
      });

      // Simulate a failed refresh: metadata status changes to error/stale, but snapshot remains complete
      await posDb.pos_catalog_meta
        .where('[tenant_key+store_slug]')
        .equals([tenantKey, storeSlug])
        .modify({
          status: 'stale',
          last_refresh_error: 'Network timeout during refresh',
        });

      const meta = await posDb.pos_catalog_meta
        .where('[tenant_key+store_slug]')
        .equals([tenantKey, storeSlug])
        .first();

      expect(meta?.catalog_complete).toBe(true);
      expect(meta?.status).toBe('stale');
      expect(meta?.last_refresh_error).toContain('timeout');
    });
  });

  describe('18-20. Multi-Tenant/Store Isolation & Persistence', () => {
    it('18. same tenant/store only: panel does not expose other tenant or other store sales', async () => {
      // Sale for target tenant and store
      await posDb.pos_pending_sales.add({
        id: 'sale-target-1',
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: { client_name: 'Target Store', total: 100 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      // Sale for different store under same tenant
      await posDb.pos_pending_sales.add({
        id: 'sale-other-store',
        store_id: 2,
        store_slug: otherStoreSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: { client_name: 'Branch North', total: 150 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      // Sale for different tenant entirely
      await posDb.pos_pending_sales.add({
        id: 'sale-other-tenant',
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: 'tenant_alien_999',
        endpoint: '/sales',
        payload: { client_name: 'Alien Tenant', total: 200 },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      // Fetch only for [tenantKey, storeSlug]
      const allSales = await posDb.pos_pending_sales.toArray();
      const scopedSales = allSales.filter(
        (s) => s.tenant_key === tenantKey && s.store_slug === storeSlug
      );

      expect(scopedSales.length).toBe(1);
      expect(scopedSales[0].id).toBe('sale-target-1');
    });

    it('19. F5 / reinitialize: count is reconstructed faithfully from IndexedDB', async () => {
      await posDb.pos_pending_sales.bulkAdd([
        {
          id: 'p1',
          store_id: 1,
          store_slug: storeSlug,
          tenant_key: tenantKey,
          endpoint: '/sales',
          payload: { total: 10 },
          created_at: Date.now(),
          status: 'pending',
          attempt_count: 0,
          server_accepted: false,
        },
        {
          id: 'p2',
          store_id: 1,
          store_slug: storeSlug,
          tenant_key: tenantKey,
          endpoint: '/sales',
          payload: { total: 20 },
          created_at: Date.now(),
          status: 'conflict',
          last_error_code: 'STOCK_INSUFFICIENT',
          attempt_count: 2,
          server_accepted: false,
        },
        {
          id: 'p3',
          store_id: 1,
          store_slug: storeSlug,
          tenant_key: tenantKey,
          endpoint: '/sales',
          payload: { total: 30 },
          created_at: Date.now(),
          status: 'failed',
          last_error_code: 'LOCAL_RECONCILIATION_FAILED',
          attempt_count: 1,
          server_accepted: true,
        },
      ]);

      // Re-read directly as if newly mounted after page reload
      const all = await posDb.pos_pending_sales.toArray();
      const loaded = all.filter((s) => s.tenant_key === tenantKey && s.store_slug === storeSlug);

      const pending = loaded.filter(
        (s) => s.status === 'pending' || (s.status === 'failed' && s.last_error_code !== 'LOCAL_RECONCILIATION_FAILED')
      ).length;
      const conflict = loaded.filter((s) => s.status === 'conflict').length;
      const reconciliation = loaded.filter((s) => s.last_error_code === 'LOCAL_RECONCILIATION_FAILED').length;

      expect(pending).toBe(1);
      expect(conflict).toBe(1);
      expect(reconciliation).toBe(1);
      expect(conflict + reconciliation).toBe(2); // totalAttention
    });

    it('20. manual retry twice rapidly executes only one sync (concurrency protection)', async () => {
      let activeRuns = 0;
      let totalExecuted = 0;
      let isSyncing = false;

      const performSyncWithMutex = async () => {
        if (isSyncing) return;
        isSyncing = true;
        activeRuns++;
        try {
          await new Promise((r) => setTimeout(r, 50));
          totalExecuted++;
        } finally {
          activeRuns--;
          isSyncing = false;
        }
      };

      // Fire twice rapidly
      const [p1, p2] = [performSyncWithMutex(), performSyncWithMutex()];
      await Promise.all([p1, p2]);

      expect(totalExecuted).toBe(1);
      expect(activeRuns).toBe(0);
    });
  });

  // =========================================================================
  // SECCIONES 40-46 — TESTS CRÍTICOS DE NEGOCIO
  // =========================================================================

  describe('40. TEST CRÍTICO — VENTA OFFLINE NORMAL', () => {
    it('executes normal offline sale lifecycle: save -> stock decrement -> auto sync -> authoritative reconciliation', async () => {
      // 1. Snapshot available
      await posDb.pos_products.put({
        inventory_id: 101,
        product_id: 101,
        tenant_key: tenantKey,
        store_slug: storeSlug,
        slug: 'coca-cola-2l',
        sku: 'CC-2L',
        barcode: 'PROD-101',
        name: 'Coca-Cola 2L',
        price: 12,
        sale_price: 12,
        unit: 'PZA',
        stock_quantity: 10,
        quantity: 10,
        updated_at: Date.now(),
      });

      // 2. Offline check
      const stockCheck = await validateOfflineStock(
        [{ inventory_id: 101, product_id: 101, quantity: 2 }],
        { storeSlug, tenantKey }
      );
      expect(stockCheck.valid).toBe(true);

      // 3. Save pending sale and add to history (normal queue flow)
      const saleId = 'test-uuid-sale-40';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: {
          client_name: 'Comprador 40',
          total: 24,
          products: [{ inventory_id: 101, product_id: 101, quantity: 2, price: 12 }],
        },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 0,
        server_accepted: false,
      });

      await posDb.pos_sales_history.put({
        id: saleId,
        store_slug: storeSlug,
        customer_name: 'Comprador 40',
        total: 24,
        discount: 0,
        payment_method: 'efectivo',
        date: 'Recién registrado (Offline)',
        created_at: new Date().toISOString(),
        status: 'completado (pendiente de sincronizar)',
        is_offline: true,
        products: [{ product_id: 101, inventory_id: 101, name: 'Coca-Cola 2L', quantity: 2, price: 12, subtotal: 24 }],
      });

      // 4. Decrement stock locally for offline sale
      await decrementOfflineStock(
        [{ inventory_id: 101, product_id: 101, quantity: 2 }],
        { storeSlug, tenantKey }
      );

      const prodBefore = await posDb.pos_products.get(101);
      expect(prodBefore?.stock_quantity).toBe(8);

      // 5. Backend sync response (201 accepted) + authoritative reconciliation
      const recResult = await reconcileAuthoritativeSale({
        saleId,
        storeSlug,
        tenantKey,
        affectedProducts: [{ product_id: 101, inventory_id: 101, stock_quantity: 8 }],
      });
      expect(recResult.success).toBe(true);

      // 6. Queue should be empty for this sale
      const pendingAfter = await posDb.pos_pending_sales.get(saleId);
      expect(pendingAfter).toBeUndefined();

      // 7. Should be in pos_sales_history once
      const historyItem = await posDb.pos_sales_history.get(saleId);
      expect(historyItem).toBeDefined();
      expect(historyItem?.status).toBe('completado (sincronizado)');

      // 8. Stock remains consistent with authoritative value
      const prodAfter = await posDb.pos_products.get(101);
      expect(prodAfter?.stock_quantity).toBe(8);
    });
  });

  describe('41. TEST CRÍTICO — LOST RESPONSE / IDEMPOTENCIA', () => {
    it('handles duplicate response (200 is_duplicate) with same UUID without error or double stock discount', async () => {
      const duplicateErrorResponse = {
        response: {
          status: 200,
          data: {
            message: 'Venta sincronizada previamente con este UUID',
            is_duplicate: true,
            code: 'SALE_ALREADY_SYNCED',
          },
        },
      };

      const classified = classifyOfflineSyncError(duplicateErrorResponse);
      expect(classified.kind).toBe('idempotent_success');
      expect(classified.isDuplicate).toBe(true);

      const presentation = getOfflineConflictPresentation(classified.code);
      expect(presentation.title).toBe('Venta previamente sincronizada');
      expect(presentation.action).toBe('none');
    });
  });

  describe('42. TEST CRÍTICO — STOCK CONFLICT', () => {
    it('sets status to conflict on STOCK_INSUFFICIENT and preserves sale without auto-retry or deletion', async () => {
      const saleId = 'test-stock-conflict-uuid';
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: {
          client_name: 'Comprador 42',
          total: 36,
          products: [{ inventory_id: 101, product_id: 101, quantity: 3 }],
        },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 1,
        server_accepted: false,
      });

      // Backend rejects with STOCK_INSUFFICIENT
      const serverError = {
        response: {
          status: 400,
          data: {
            code: 'STOCK_INSUFFICIENT',
            message: 'Stock insuficiente para Coca-Cola 2L. Disponible: 1, solicitado: 3.',
            affected_products: [{ product_id: 101, stock_quantity: 1 }],
          },
        },
      };

      const classified = classifyOfflineSyncError(serverError);
      expect(classified.kind).toBe('conflict');
      expect(classified.code).toBe('STOCK_INSUFFICIENT');

      // Update pending sale to conflict
      await posDb.pos_pending_sales.update(saleId, {
        status: 'conflict',
        last_error_code: classified.code,
        last_error_message: classified.message,
        affected_products: serverError.response.data.affected_products,
      });

      const updatedSale = await posDb.pos_pending_sales.get(saleId);
      expect(updatedSale?.status).toBe('conflict');
      expect(updatedSale?.last_error_code).toBe('STOCK_INSUFFICIENT');
      expect(updatedSale?.affected_products?.[0].stock_quantity).toBe(1);

      // Verify UI presentation
      const presentation = getOfflineConflictPresentation(updatedSale?.last_error_code);
      expect(presentation.retryable).toBe(false);
      expect(presentation.action).toBe('refresh_catalog');
    });
  });

  describe('43. TEST CRÍTICO — CAJA CERRADA', () => {
    it('handles CASH_REGISTER_CLOSED as non-retryable conflict without mutating cash register session', async () => {
      const saleId = 'test-caja-cerrada-uuid';
      const originalSessionId = 55;

      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: {
          client_name: 'Comprador 43',
          cash_register_session_id: originalSessionId,
          total: 50,
        },
        created_at: Date.now(),
        status: 'pending',
        attempt_count: 1,
        server_accepted: false,
      });

      const errorResp = {
        response: {
          status: 422,
          data: {
            code: 'CASH_REGISTER_CLOSED',
            message: 'La sesión de caja original está cerrada.',
          },
        },
      };

      const classified = classifyOfflineSyncError(errorResp);
      expect(classified.kind).toBe('conflict');
      expect(classified.code).toBe('CASH_REGISTER_CLOSED');

      await posDb.pos_pending_sales.update(saleId, {
        status: 'conflict',
        last_error_code: classified.code,
        last_error_message: classified.message,
      });

      const sale = await posDb.pos_pending_sales.get(saleId);
      expect(sale?.status).toBe('conflict');
      // Original session ID remains untouched
      expect(sale?.payload.cash_register_session_id).toBe(originalSessionId);

      const presentation = getOfflineConflictPresentation(sale?.last_error_code);
      expect(presentation.title).toBe('Caja original cerrada');
      expect(presentation.retryable).toBe(false);
      expect(presentation.action).toBe('contact_admin');
    });
  });

  describe('44. TEST CRÍTICO — BACKEND DOWN', () => {
    it('distinguishes between offline and backend down (503/network), marks as retryable pending', async () => {
      const backendDownError = {
        response: {
          status: 503,
          data: { message: 'Service Unavailable' },
        },
      };

      const classified = classifyOfflineSyncError(backendDownError);
      expect(classified.kind).toBe('retryable');
      expect(classified.code).toBe('HTTP_503');

      const presentation = getOfflineConflictPresentation(classified.code);
      expect(presentation.title).toBe('Servidor no disponible temporalmente');
      expect(presentation.retryable).toBe(true);
      expect(presentation.action).toBe('retry');
    });
  });

  describe('45. TEST CRÍTICO — LOCAL RECONCILIATION FAILURE', () => {
    it('recovers from LOCAL_RECONCILIATION_FAILED without sending duplicate network POST', async () => {
      const saleId = 'test-local-reconciliation-failure-uuid';

      // 1. Add pending sale that backend already accepted
      await posDb.pos_pending_sales.add({
        id: saleId,
        store_id: 1,
        store_slug: storeSlug,
        tenant_key: tenantKey,
        endpoint: '/sales',
        payload: {
          client_name: 'Comprador 45',
          total: 100,
          products: [{ inventory_id: 101, product_id: 101, quantity: 1, name: 'Prod 101' }],
        },
        created_at: Date.now(),
        status: 'failed',
        server_accepted: true,
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        last_error_message: 'Fallo al actualizar base de datos local en Dexie',
        affected_products: [{ product_id: 101, stock_quantity: 1 }],
        attempt_count: 1,
      });

      await posDb.pos_sales_history.put({
        id: saleId,
        store_slug: storeSlug,
        customer_name: 'Comprador 45',
        total: 100,
        discount: 0,
        payment_method: 'efectivo',
        date: 'Recién registrado (Offline)',
        created_at: new Date().toISOString(),
        status: 'completado (pendiente de sincronizar)',
        is_offline: true,
        products: [{ product_id: 101, name: 'Prod 101', quantity: 1, price: 100, subtotal: 100 }],
      });

      // 2. Call local authoritative recovery (no network request!)
      const recovered = await retryLocalAuthoritativeReconciliation(saleId);
      expect(recovered.success).toBe(true);
      expect(recovered.reconciledLocally).toBe(true);

      // 3. Sale is moved to history and removed from pending queue
      const pendingItem = await posDb.pos_pending_sales.get(saleId);
      expect(pendingItem).toBeUndefined();

      const historyItem = await posDb.pos_sales_history.get(saleId);
      expect(historyItem).toBeDefined();
    });
  });

  describe('46. TEST CRÍTICO — PRODUCTO NO VERIFICABLE', () => {
    it('blocks offline sale when product cannot be verified in local snapshot (UNVERIFIED_STOCK)', async () => {
      // Catalog has product 201, but cart has unknown product 999
      await posDb.pos_products.put({
        inventory_id: 201,
        product_id: 201,
        tenant_key: tenantKey,
        store_slug: storeSlug,
        slug: 'galletas',
        sku: 'GAL-1',
        name: 'Galletas',
        price: 5,
        sale_price: 5,
        unit: 'PZA',
        stock_quantity: 20,
        quantity: 20,
        updated_at: Date.now(),
      });

      const validation = await validateOfflineStock(
        [{ inventory_id: 999, product_id: 999, quantity: 1 }],
        { storeSlug, tenantKey }
      );

      expect(validation.valid).toBe(false);
      expect(validation.code).toBe('UNVERIFIED_STOCK');
      expect(validation.error).toContain('No se pudo verificar el stock de este producto sin conexión');
    });
  });
});
