import { describe, it, expect, beforeEach, vi } from 'vitest';
import { posDb } from './pos-db';
import { reconcileAuthoritativeSale } from './offlineSaleReconciliation';

describe('offlineSaleReconciliation (Fase 6B.4B - Secciones 16-23, 34, 47-51)', () => {
  let inMemoryProducts: Map<any, any>;
  let inMemoryPendingSales: Map<any, any>;
  let inMemorySalesHistory: Map<any, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryProducts = new Map();
    inMemoryPendingSales = new Map();
    inMemorySalesHistory = new Map();

    // Mock pos_products
    vi.spyOn(posDb.pos_products, 'where').mockImplementation((index: string) => {
      return {
        equals: (val: any) => ({
          filter: (predicate: (p: any) => boolean) => ({
            toArray: async () => {
              const list: any[] = [];
              for (const prod of inMemoryProducts.values()) {
                if (prod[index] === val && predicate(prod)) {
                  list.push(prod);
                }
              }
              return list;
            },
          }),
        }),
      } as any;
    });

    vi.spyOn(posDb.pos_products, 'update').mockImplementation(async (id: any, changes: any) => {
      const prod = inMemoryProducts.get(id);
      if (prod) {
        Object.assign(prod, changes);
      }
      return 1;
    });

    // Mock pos_sales_history
    vi.spyOn(posDb.pos_sales_history, 'update').mockImplementation(async (id: any, changes: any) => {
      const hist = inMemorySalesHistory.get(id);
      if (hist) {
        Object.assign(hist, changes);
      } else {
        inMemorySalesHistory.set(id, { id, ...changes });
      }
      return 1;
    });

    // Mock pos_pending_sales
    vi.spyOn(posDb.pos_pending_sales, 'delete').mockImplementation(async (id: any) => {
      inMemoryPendingSales.delete(id);
      return;
    });

    vi.spyOn(posDb.pos_pending_sales, 'update').mockImplementation(async (id: any, changes: any) => {
      const item = inMemoryPendingSales.get(id);
      if (item) {
        Object.assign(item, changes);
      }
      return 1;
    });

    // Transaction mock
    vi.spyOn(posDb, 'transaction').mockImplementation(async (_mode: any, _tables: any, fn: any) => {
      return await fn();
    });
  });

  it('1. 201 Created: reconciles authoritative stock, updates history to synced, and deletes pending sale', async () => {
    const saleId = 'uuid-sale-01';
    inMemoryPendingSales.set(saleId, {
      id: saleId,
      store_slug: 'central-store',
      status: 'syncing',
    });
    inMemorySalesHistory.set(saleId, {
      id: saleId,
      status: 'pendiente (offline)',
    });
    inMemoryProducts.set('inv-01', {
      inventory_id: 'inv-01',
      store_slug: 'central-store',
      product_id: 101,
      stock_quantity: 8,
      tenant_key: 'tenant-test',
      quantity: 8,
    });

    const result = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'central-store',
      tenantKey: 'tenant-test',
      affectedProducts: [
        { product_id: 101, inventory_id: 'inv-01', stock_quantity: 5 },
      ],
      isDuplicate: false,
    });

    expect(result.success).toBe(true);
    expect(result.reconciledLocally).toBe(true);

    // Stock local debe ser exactamente el stock autoritativo del servidor (5), no 8 ni 6
    const updatedProd = inMemoryProducts.get('inv-01');
    expect(updatedProd.stock_quantity).toBe(5);
    expect(updatedProd.quantity).toBe(5);

    // Historial marcado como sincronizado
    const updatedHist = inMemorySalesHistory.get(saleId);
    expect(updatedHist.status).toBe('completado (sincronizado)');

    // Pending eliminado
    expect(inMemoryPendingSales.has(saleId)).toBe(false);
  });

  it('2. 200 SALE_ALREADY_SYNCED: duplicate sale reconciles authoritative stock and deletes pending sale', async () => {
    const saleId = 'uuid-sale-dup';
    inMemoryPendingSales.set(saleId, {
      id: saleId,
      store_slug: 'central-store',
      status: 'syncing',
    });
    inMemorySalesHistory.set(saleId, {
      id: saleId,
      status: 'pendiente (offline)',
    });
    inMemoryProducts.set('inv-02', {
      inventory_id: 'inv-02',
      store_slug: 'central-store',
      tenant_key: 'tenant-test',
      product_id: 202,
      stock_quantity: 15,
      quantity: 15,
    });

    const result = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'central-store',
      tenantKey: 'tenant-test',
      affectedProducts: [
        { product_id: 202, inventory_id: 'inv-02', stock_quantity: 12 },
      ],
      isDuplicate: true,
    });

    expect(result.success).toBe(true);
    expect(inMemoryProducts.get('inv-02').stock_quantity).toBe(12);
    expect(inMemorySalesHistory.get(saleId).status).toBe('completado (sincronizado previamente)');
    expect(inMemoryPendingSales.has(saleId)).toBe(false);
  });

  it('3. Multi-Store Isolation: only updates products belonging to storeSlug of the sale', async () => {
    const saleId = 'uuid-sale-store-a';
    inMemoryPendingSales.set(saleId, {
      id: saleId,
      store_slug: 'store-a',
      status: 'syncing',
    });

    // Producto 303 en Store A
    inMemoryProducts.set('inv-store-a', {
      inventory_id: 'inv-store-a',
      store_slug: 'store-a',
      tenant_key: 'tenant-test',
      product_id: 303,
      stock_quantity: 10,
    });

    // Producto 303 en Store B
    inMemoryProducts.set('inv-store-b', {
      inventory_id: 'inv-store-b',
      store_slug: 'store-b',
      tenant_key: 'tenant-test',
      product_id: 303,
      stock_quantity: 20,
    });

    const result = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'store-a',
      tenantKey: 'tenant-test',
      affectedProducts: [
        { product_id: 303, stock_quantity: 7 },
      ],
      isDuplicate: false,
    });

    expect(result.success).toBe(true);
    // Store A actualizado a 7
    expect(inMemoryProducts.get('inv-store-a').stock_quantity).toBe(7);
    // Store B intacto en 20
    expect(inMemoryProducts.get('inv-store-b').stock_quantity).toBe(20);
  });

  it('4. Dexie transaction failure: preserves pending sale with LOCAL_RECONCILIATION_FAILED and does NOT delete it', async () => {
    const saleId = 'uuid-sale-dexie-fail';
    inMemoryPendingSales.set(saleId, {
      id: saleId,
      store_slug: 'central-store',
      status: 'syncing',
      attempt_count: 1,
    });

    // Simular que la transacción Dexie arroja un error (ej. disco lleno o IndexedDB lock)
    vi.spyOn(posDb, 'transaction').mockImplementationOnce(async () => {
      throw new Error('IndexedDB transaction abort: quota exceeded');
    });

    const result = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'central-store',
      tenantKey: 'tenant-test',
      affectedProducts: [
        { product_id: 101, stock_quantity: 5 },
      ],
      isDuplicate: false,
    });

    expect(result.success).toBe(false);
    expect(result.reconciledLocally).toBe(false);
    expect(result.error).toContain('quota exceeded');

    // La venta NO debe ser eliminada
    expect(inMemoryPendingSales.has(saleId)).toBe(true);

    // Debe conservar el estado pending con el mensaje de error para reintento seguro
    const preservedSale = inMemoryPendingSales.get(saleId);
    expect(preservedSale.status).toBe('pending');
    expect(preservedSale.last_error_code).toBe('LOCAL_RECONCILIATION_FAILED');
    expect(preservedSale.last_error_message).toContain('Venta registrada en servidor; pendiente reconciliar datos locales.');
  });

  it('5. Subsequent retry after local failure: SALE_ALREADY_SYNCED finishes reconciliation and deletes pending sale', async () => {
    const saleId = 'uuid-sale-retry-after-fail';
    inMemoryPendingSales.set(saleId, {
      id: saleId,
      store_slug: 'central-store',
      status: 'pending',
      last_error_code: 'LOCAL_RECONCILIATION_FAILED',
      last_error_message: 'Venta registrada en servidor; pendiente reconciliar datos locales.',
    });
    inMemoryProducts.set('inv-retry', {
      inventory_id: 'inv-retry',
      store_slug: 'central-store',
      tenant_key: 'tenant-test',
      product_id: 404,
      stock_quantity: 10,
    });

    // En el siguiente reintento, el servidor responde SALE_ALREADY_SYNCED y Dexie funciona normalmente
    const retryResult = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'central-store',
      tenantKey: 'tenant-test',
      affectedProducts: [
        { product_id: 404, stock_quantity: 6 },
      ],
      isDuplicate: true,
    });

    expect(retryResult.success).toBe(true);
    expect(inMemoryProducts.get('inv-retry').stock_quantity).toBe(6);
    expect(inMemoryPendingSales.has(saleId)).toBe(false);
  });

  // ── 6. Mandatory tenantKey runtime guard (Fase 6B.4C.2 - Sección 14 & 20) ───
  it('6. tenantKey missing or empty rejects reconciliation safely without modifying stock or pending queue', async () => {
    const saleId = 'sale-no-tenant';
    inMemoryPendingSales.set(saleId, {
      id: saleId,
      store_slug: 'central-store',
      status: 'pending',
    });
    inMemoryProducts.set('inv-test-prod', {
      inventory_id: 'inv-test-prod',
      store_slug: 'central-store',
      tenant_key: 'tenant-a',
      product_id: 500,
      stock_quantity: 10,
    });

    // Llamada con tenantKey undefined/vacío
    const resUndefined = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'central-store',
      tenantKey: undefined as any,
      affectedProducts: [{ product_id: 500, stock_quantity: 2 }],
    });

    expect(resUndefined.success).toBe(false);
    expect(resUndefined.reconciledLocally).toBe(false);
    expect(resUndefined.error).toContain('tenantKey es obligatorio');

    // Stock y cola pending intactos
    expect(inMemoryProducts.get('inv-test-prod').stock_quantity).toBe(10);
    expect(inMemoryPendingSales.has(saleId)).toBe(true);

    const resEmpty = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'central-store',
      tenantKey: '   ',
      affectedProducts: [{ product_id: 500, stock_quantity: 2 }],
    });

    expect(resEmpty.success).toBe(false);
    expect(resEmpty.reconciledLocally).toBe(false);
    expect(inMemoryProducts.get('inv-test-prod').stock_quantity).toBe(10);
  });

  // ── 7. Cross-tenant Authoritative Reconciliation (Fase 6B.4C.2 - Sección 21) ─
  it('7. Tenant A authoritative reconciliation modifies Tenant A stock, but leaves Tenant B and Legacy untouched', async () => {
    const saleId = 'sale-tenant-a-01';
    inMemoryPendingSales.set(saleId, {
      id: saleId,
      store_slug: 'central',
      tenant_key: 'tenant-a',
      status: 'syncing',
    });

    // Tenant A: P1 stock = 10
    inMemoryProducts.set('inv-ta-p1', {
      inventory_id: 'inv-ta-p1',
      store_slug: 'central',
      tenant_key: 'tenant-a',
      product_id: 'p1',
      stock_quantity: 10,
      quantity: 10,
    });

    // Tenant B: P1 stock = 20
    inMemoryProducts.set('inv-tb-p1', {
      inventory_id: 'inv-tb-p1',
      store_slug: 'central',
      tenant_key: 'tenant-b',
      product_id: 'p1',
      stock_quantity: 20,
      quantity: 20,
    });

    // Legacy: P1 stock = 30
    inMemoryProducts.set('inv-legacy-p1', {
      inventory_id: 'inv-legacy-p1',
      store_slug: 'central',
      tenant_key: undefined,
      product_id: 'p1',
      stock_quantity: 30,
      quantity: 30,
    });

    // Reconciliación con tenantKey = 'tenant-a', authoritative stock = 7
    const result = await reconcileAuthoritativeSale({
      saleId,
      storeSlug: 'central',
      tenantKey: 'tenant-a',
      affectedProducts: [{ product_id: 'p1', stock_quantity: 7 }],
    });

    expect(result.success).toBe(true);
    expect(result.reconciledLocally).toBe(true);

    // Tenant A modificado a 7
    expect(inMemoryProducts.get('inv-ta-p1').stock_quantity).toBe(7);
    expect(inMemoryProducts.get('inv-ta-p1').quantity).toBe(7);

    // Tenant B permanece en 20 (no modificado)
    expect(inMemoryProducts.get('inv-tb-p1').stock_quantity).toBe(20);
    expect(inMemoryProducts.get('inv-tb-p1').quantity).toBe(20);

    // Legacy permanece en 30 (no modificado)
    expect(inMemoryProducts.get('inv-legacy-p1').stock_quantity).toBe(30);
    expect(inMemoryProducts.get('inv-legacy-p1').quantity).toBe(30);
  });
});
