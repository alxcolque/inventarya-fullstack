import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  posDb,
  cacheStoreInfo,
  getOfflineStore,
  cacheStoreProducts,
  getOfflineStoreProducts,
  validateOfflineStock,
  decrementOfflineStock,
} from './pos-db';
import {
  isBaseCatalogQuery,
  saveCatalogSnapshot,
  refreshCompleteOfflineCatalog,
  getOfflineCatalogMeta,
  isCatalogSnapshotComplete,
  mergeProductGroups,
  shouldReservePendingSaleLocally,
} from './offlineCatalog';
import { reconcileAuthoritativeSale } from './offlineSaleReconciliation';
import { tenantApi } from '@/api';

describe('offlineCatalog (Fase 6B.4C / 6B.4C.1 — Hardening & Integrity)', () => {
  let inMemoryProducts: Map<any, any>;
  let inMemoryMeta: Map<any, any>;
  let inMemoryPendingSales: Map<any, any>;
  let inMemorySalesHistory: Map<any, any>;
  let inMemoryStores: Map<any, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryProducts = new Map();
    inMemoryMeta = new Map();
    inMemoryPendingSales = new Map();
    inMemorySalesHistory = new Map();

    // Mock pos_catalog_meta
    vi.spyOn(posDb.pos_catalog_meta, 'get').mockImplementation(async (id: any) => {
      return inMemoryMeta.get(id);
    });

    vi.spyOn(posDb.pos_catalog_meta, 'put').mockImplementation(async (item: any) => {
      inMemoryMeta.set(item.id, { ...item });
      return item.id;
    });

    // Mock pos_products
    vi.spyOn(posDb.pos_products, 'get').mockImplementation(async (id: any) => {
      return inMemoryProducts.get(id);
    });

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
          delete: async () => {
            for (const [k, prod] of inMemoryProducts.entries()) {
              if (prod[index] === val) inMemoryProducts.delete(k);
            }
          },
          toArray: async () => {
            const list: any[] = [];
            for (const prod of inMemoryProducts.values()) {
              if (prod[index] === val) list.push(prod);
            }
            return list;
          },
        }),
      } as any;
    });

    vi.spyOn(posDb.pos_products, 'delete').mockImplementation(async (id: any) => {
      inMemoryProducts.delete(id);
      return;
    });

    vi.spyOn(posDb.pos_products, 'put').mockImplementation(async (prod: any) => {
      inMemoryProducts.set(prod.inventory_id, { ...prod });
      return prod.inventory_id;
    });

    vi.spyOn(posDb.pos_products, 'bulkPut').mockImplementation(async (prods: any[]) => {
      for (const prod of prods) {
        inMemoryProducts.set(prod.inventory_id, { ...prod });
      }
      return prods.length;
    });

    vi.spyOn(posDb.pos_products, 'update').mockImplementation(async (id: any, changes: any) => {
      const prod = inMemoryProducts.get(id);
      if (prod) {
        Object.assign(prod, changes);
      }
      return 1;
    });

    // Mock pos_pending_sales
    vi.spyOn(posDb.pos_pending_sales, 'where').mockImplementation((index: string) => {
      return {
        equals: (val: any) => ({
          toArray: async () => {
            const list: any[] = [];
            for (const sale of inMemoryPendingSales.values()) {
              if (sale[index] === val) list.push(sale);
            }
            return list;
          },
        }),
      } as any;
    });

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

    vi.spyOn(posDb.pos_pending_sales, 'toArray').mockImplementation(async () => {
      return Array.from(inMemoryPendingSales.values());
    });

    // Mock pos_stores and pos_stores_v4
    inMemoryStores = new Map();
    const mockStoreGet = async (id: any) => {
      return inMemoryStores.get(id);
    };
    const mockStorePut = async (item: any) => {
      const key = item.store_cache_id || item.slug;
      inMemoryStores.set(key, { ...item });
      return key;
    };
    const mockStoreWhere = (index: string) => {
      return {
        equals: (val: any) => ({
          first: async () => {
            for (const store of inMemoryStores.values()) {
              if (index === '[tenant_key+slug]' && Array.isArray(val)) {
                if (store.tenant_key === val[0] && store.slug === val[1]) return store;
              } else if (store[index] === val) {
                return store;
              }
            }
            return undefined;
          },
        }),
      } as any;
    };

    vi.spyOn(posDb.pos_stores, 'get').mockImplementation(mockStoreGet);
    vi.spyOn(posDb.pos_stores, 'put').mockImplementation(mockStorePut);
    vi.spyOn(posDb.pos_stores, 'where').mockImplementation(mockStoreWhere);

    vi.spyOn(posDb.pos_stores_v4, 'get').mockImplementation(mockStoreGet);
    vi.spyOn(posDb.pos_stores_v4, 'put').mockImplementation(mockStorePut);
    vi.spyOn(posDb.pos_stores_v4, 'where').mockImplementation(mockStoreWhere);

    // Mock Dexie transaction
    vi.spyOn(posDb, 'transaction').mockImplementation(async (_mode: any, _tables: any, fn: any) => {
      return await fn();
    });
  });

  // ── 1. Full unfiltered catalog creates complete snapshot ───────────────────
  it('1. full unfiltered catalog can create complete snapshot', async () => {
    const res = await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          category: 'Bebidas',
          slug_category: 'bebidas',
          products: [
            { id: 101, inventory_id: 'inv-101', name: 'Jugo', price: 10, quantity: 20 },
            { id: 102, inventory_id: 'inv-102', name: 'Agua', price: 5, quantity: 50 },
          ],
        },
      ],
      isComplete: true,
    });

    expect(res.success).toBe(true);
    expect(res.productCount).toBe(2);

    const isComplete = await isCatalogSnapshotComplete('alex', 'central');
    expect(isComplete).toBe(true);

    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.status).toBe('complete');
    expect(meta?.product_count).toBe(2);
  });

  // ── 2, 3, 4. Filters & search detection ────────────────────────────────────
  it('2. isBaseCatalogQuery discriminates base catalog from searches and filters', () => {
    expect(isBaseCatalogQuery({})).toBe(true);
    expect(isBaseCatalogQuery({ per_page: 50 })).toBe(true);
    expect(isBaseCatalogQuery({ per_page: 50, cursor: 'xyz' })).toBe(true);

    expect(isBaseCatalogQuery({ search: 'coca' })).toBe(false);
    expect(isBaseCatalogQuery({ categories: '10' })).toBe(false);
    expect(isBaseCatalogQuery({ category: 'bebidas' })).toBe(false);
    expect(isBaseCatalogQuery({ brands: 'nestle' })).toBe(false);
    expect(isBaseCatalogQuery({ stock_filter: 'in_stock' })).toBe(false);
  });

  // ── TEST CRÍTICO 34: Filter Cache Corruption ────────────────────────────────
  it('34. CRITICAL: search result cannot replace complete snapshot in IndexedDB', async () => {
    // Inicializar snapshot completo con 500 productos simulados
    const fullGroups = [
      {
        category_id: 1,
        category: 'Alimentos',
        slug_category: 'alimentos',
        products: Array.from({ length: 500 }, (_, i) => ({
          id: i + 1,
          inventory_id: `inv-${i + 1}`,
          name: `Producto ${i + 1}`,
          price: 10,
          quantity: 15,
        })),
      },
    ];

    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: fullGroups,
      isComplete: true,
    });

    expect(inMemoryProducts.size).toBe(500);
    const initialMeta = await getOfflineCatalogMeta('alex', 'central');
    expect(initialMeta?.product_count).toBe(500);
    expect(initialMeta?.catalog_complete).toBe(true);

    // Usuario busca "coca" -> Backend responde 4 productos con hasMore = false
    const searchResultGroups = [
      {
        category_id: 1,
        category: 'Alimentos',
        slug_category: 'alimentos',
        products: [
          { id: 1, inventory_id: 'inv-1', name: 'Coca Cola 2L', price: 12, quantity: 5 },
          { id: 2, inventory_id: 'inv-2', name: 'Coca Cola Zero', price: 12, quantity: 4 },
          { id: 3, inventory_id: 'inv-3', name: 'Coca Cola 500ml', price: 6, quantity: 8 },
          { id: 4, inventory_id: 'inv-4', name: 'Coca Cola Lata', price: 5, quantity: 10 },
        ],
      },
    ];

    // cacheStoreProducts sin isComplete (como ocurriría en una búsqueda)
    await cacheStoreProducts('central', searchResultGroups, {
      tenantKey: 'alex',
      isComplete: false,
    });

    // INVARIANTE: IndexedDB DEBE CONSERVAR los 500 productos y la metadata complete intacta
    expect(inMemoryProducts.size).toBe(500);
    const preservedMeta = await getOfflineCatalogMeta('alex', 'central');
    expect(preservedMeta?.product_count).toBe(500);
    expect(preservedMeta?.catalog_complete).toBe(true);
  });

  // ── TEST CRÍTICO 35: Atomic Refresh ────────────────────────────────────────
  it('35. CRITICAL: atomic refresh failure preserves old snapshot intact', async () => {
    // Snapshot V1: 100 productos
    const groupsV1 = [
      {
        category_id: 1,
        category: 'General',
        products: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          inventory_id: `inv-v1-${i + 1}`,
          name: `Prod V1 ${i + 1}`,
          price: 10,
          quantity: 10,
        })),
      },
    ];

    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: groupsV1,
      isComplete: true,
    });

    expect(inMemoryProducts.size).toBe(100);

    // Simular que el commit de V2 falla por excepción en Dexie (ej. quota excedida)
    vi.spyOn(posDb, 'transaction').mockImplementationOnce(async () => {
      throw new Error('IndexedDB transaction abort: storage quota exceeded');
    });

    const groupsV2 = [
      {
        category_id: 1,
        category: 'General',
        products: Array.from({ length: 120 }, (_, i) => ({
          id: i + 1,
          inventory_id: `inv-v2-${i + 1}`,
          name: `Prod V2 ${i + 1}`,
          price: 10,
          quantity: 10,
        })),
      },
    ];

    const failRes = await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: groupsV2,
      isComplete: true,
    });

    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('quota exceeded');

    // El snapshot previo (100 productos) debe continuar intacto
    expect(inMemoryProducts.size).toBe(100);
    const metaAfterFail = await getOfflineCatalogMeta('alex', 'central');
    expect(metaAfterFail?.product_count).toBe(100);
    expect(metaAfterFail?.catalog_complete).toBe(true);
  });

  // ── TEST CRÍTICO 36: Multitenant Isolation ─────────────────────────────────
  it('36. CRITICAL: tenant A and tenant B with same store_slug remain strictly isolated', async () => {
    // Tenant A en sucursal 'central'
    await saveCatalogSnapshot({
      tenantKey: 'tenant-a',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          category: 'Abarrotes',
          products: [{ id: 501, inventory_id: 'inv-a-501', name: 'Arroz A', price: 8, quantity: 10 }],
        },
      ],
      isComplete: true,
    });

    // Tenant B en sucursal 'central'
    await saveCatalogSnapshot({
      tenantKey: 'tenant-b',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          category: 'Abarrotes',
          products: [{ id: 501, inventory_id: 'inv-b-501', name: 'Arroz B', price: 12, quantity: 50 }],
        },
      ],
      isComplete: true,
    });

    // Consulta de Tenant A: solo debe devolver 'Arroz A' con stock 10
    const prodsA = await getOfflineStoreProducts('central', 'tenant-a');
    expect(prodsA.length).toBe(1);
    expect(prodsA[0].products[0].name).toBe('Arroz A');
    expect(prodsA[0].products[0].quantity).toBe(10);

    // Consulta de Tenant B: solo debe devolver 'Arroz B' con stock 50
    const prodsB = await getOfflineStoreProducts('central', 'tenant-b');
    expect(prodsB.length).toBe(1);
    expect(prodsB[0].products[0].name).toBe('Arroz B');
    expect(prodsB[0].products[0].quantity).toBe(50);

    // Venta offline en Tenant A: descuenta solo a Tenant A
    await decrementOfflineStock(
      [{ inventory_id: 'inv-a-501', product_id: 501, quantity: 2 }],
      { storeSlug: 'central', tenantKey: 'tenant-a' }
    );

    const updatedA = inMemoryProducts.get('inv-a-501');
    expect(updatedA.stock_quantity).toBe(8);

    // Tenant B debe permanecer intacto en 50
    const untouchedB = inMemoryProducts.get('inv-b-501');
    expect(untouchedB.stock_quantity).toBe(50);
  });

  // ── TEST CRÍTICO 37: Pending Sale + Catalog Refresh ───────────────────────
  it('37. CRITICAL: catalog refresh preserves locally reserved stock of pending sales', async () => {
    // Snapshot inicial: P1 tiene stock 10 en servidor y en local
    inMemoryProducts.set('inv-p1', {
      inventory_id: 'inv-p1',
      store_slug: 'central',
      tenant_key: 'alex',
      product_id: 999,
      name: 'Galletas Oreo',
      price: 5,
      quantity: 10,
      stock_quantity: 10,
    });

    // Se realiza una venta offline: consume 2 de P1 y se guarda en pos_pending_sales
    inMemoryPendingSales.set('uuid-pending-sale', {
      id: 'uuid-pending-sale',
      store_slug: 'central',
      tenant_key: 'alex',
      status: 'pending',
      payload: {
        products: [{ product_id: 999, quantity: 2 }],
      },
    });

    // Al ejecutarse un refresh de catálogo antes de sincronizar la venta (el servidor aún tiene 10)
    const remoteGroupsFromServer = [
      {
        category_id: 1,
        category: 'Golosinas',
        products: [{ id: 999, inventory_id: 'inv-p1', name: 'Galletas Oreo', price: 5, quantity: 10 }],
      },
    ];

    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: remoteGroupsFromServer,
      isComplete: true,
    });

    // INVARIANTE: El stock vendible local debe ser 8 (10 - 2 pendientes), NO resetear a 10
    const localProd = inMemoryProducts.get('inv-p1');
    expect(localProd.stock_quantity).toBe(8);
    expect(localProd.quantity).toBe(8);

    // Cuando 6B.4B sincroniza la venta y el backend responde con affected_products autoritativo (8):
    await reconcileAuthoritativeSale({
      saleId: 'uuid-pending-sale',
      storeSlug: 'central',
      tenantKey: 'alex',
      affectedProducts: [{ product_id: 999, stock_quantity: 8 }],
      isDuplicate: false,
    });

    expect(inMemoryProducts.get('inv-p1').stock_quantity).toBe(8);
    expect(inMemoryPendingSales.has('uuid-pending-sale')).toBe(false);
  });

  // ── 6. Cursor Traversal Pagination ─────────────────────────────────────────
  it('6. complete cursor traversal downloads all pages and marks snapshot complete', async () => {
    vi.spyOn(tenantApi, 'get')
      .mockResolvedValueOnce({
        data: {
          products: [
            {
              category_id: 1,
              category: 'Cat 1',
              products: [{ id: 1, inventory_id: 'inv-1', name: 'P1', quantity: 5 }],
            },
          ],
          pagination: { has_more: true, next_cursor: 'cursor-page-2', per_page: 1 },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          products: [
            {
              category_id: 1,
              category: 'Cat 1',
              products: [{ id: 2, inventory_id: 'inv-2', name: 'P2', quantity: 10 }],
            },
          ],
          pagination: { has_more: false, next_cursor: null, per_page: 1 },
        },
      } as any);

    const refreshRes = await refreshCompleteOfflineCatalog('central', { tenantKey: 'alex', perPage: 1 });
    expect(refreshRes.success).toBe(true);
    expect(refreshRes.productCount).toBe(2);

    expect(inMemoryProducts.has('inv-1')).toBe(true);
    expect(inMemoryProducts.has('inv-2')).toBe(true);

    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.catalog_complete).toBe(true);
    expect(meta?.status).toBe('complete');
  });

  // ── 7. Refresh network failure preserves existing snapshot ─────────────────
  it('7. refresh network failure preserves old snapshot and marks meta stale/error', async () => {
    // Snapshot previo existente
    inMemoryProducts.set('inv-old', {
      inventory_id: 'inv-old',
      store_slug: 'central',
      tenant_key: 'alex',
      product_id: 77,
      name: 'Viejo Producto',
      quantity: 50,
    });
    inMemoryMeta.set('alex:central', {
      id: 'alex:central',
      tenant_key: 'alex',
      store_slug: 'central',
      status: 'complete',
      catalog_complete: true,
      product_count: 1,
      cached_at: 1000,
    });

    vi.spyOn(tenantApi, 'get').mockRejectedValueOnce(new Error('Network connection timeout'));

    const res = await refreshCompleteOfflineCatalog('central', { tenantKey: 'alex' });
    expect(res.success).toBe(false);

    // El producto previo no se borra
    expect(inMemoryProducts.has('inv-old')).toBe(true);

    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.catalog_complete).toBe(true);
    expect(meta?.status).toBe('stale');
    expect(meta?.last_refresh_error).toContain('Network connection timeout');
  });

  // ── 10. Authoritative zero-product catalog creates valid empty snapshot ────
  it('10. authoritative complete zero-product catalog creates valid empty complete snapshot', async () => {
    vi.spyOn(tenantApi, 'get').mockResolvedValueOnce({
      data: {
        products: [],
        pagination: { has_more: false, next_cursor: null },
      },
    } as any);

    const res = await refreshCompleteOfflineCatalog('tienda-vacia', { tenantKey: 'alex' });
    expect(res.success).toBe(true);
    expect(res.productCount).toBe(0);

    const meta = await getOfflineCatalogMeta('alex', 'tienda-vacia');
    expect(meta?.catalog_complete).toBe(true);
    expect(meta?.product_count).toBe(0);
  });

  // ── 13. Store A refresh does not mutate Store B ────────────────────────────
  it('13. Store A refresh does not mutate Store B products', async () => {
    inMemoryProducts.set('inv-b-1', {
      inventory_id: 'inv-b-1',
      store_slug: 'store-b',
      tenant_key: 'alex',
      product_id: 808,
      name: 'Prod Store B',
      quantity: 25,
    });

    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'store-a',
      productGroups: [
        {
          category_id: 1,
          category: 'A',
          products: [{ id: 801, inventory_id: 'inv-a-1', name: 'Prod Store A', quantity: 10 }],
        },
      ],
      isComplete: true,
    });

    expect(inMemoryProducts.has('inv-a-1')).toBe(true);
    expect(inMemoryProducts.get('inv-b-1').quantity).toBe(25);
  });

  // ── 16. Insufficient local stock aborts instead of clamping to zero ────────
  it('16. insufficient local stock aborts instead of clamping to zero', async () => {
    inMemoryProducts.set('inv-low', {
      inventory_id: 'inv-low',
      store_slug: 'central',
      tenant_key: 'alex',
      product_id: 333,
      name: 'Item Escaso',
      stock_quantity: 2,
      quantity: 2,
    });

    // Validación previa detecta insuficiencia
    const check = await validateOfflineStock(
      [{ inventory_id: 'inv-low', product_id: 333, quantity: 5 }],
      { storeSlug: 'central', tenantKey: 'alex' }
    );
    expect(check.valid).toBe(false);
    expect(check.error).toContain('Stock local insuficiente');

    // Intentar decrementar 5 unidades cuando hay 2 debe lanzar error y abortar
    await expect(
      decrementOfflineStock(
        [{ inventory_id: 'inv-low', product_id: 333, quantity: 5 }],
        { storeSlug: 'central', tenantKey: 'alex' }
      )
    ).rejects.toThrow('Stock insuficiente en decremento local');

    // El stock no debe haberse modificado a 0 ni a -3
    expect(inMemoryProducts.get('inv-low').stock_quantity).toBe(2);
    expect(inMemoryProducts.get('inv-low').quantity).toBe(2);
  });

  // ── 17. quantity and stock_quantity stay consistent ────────────────────────
  it('17. quantity and stock_quantity stay strictly consistent on decrement', async () => {
    inMemoryProducts.set('inv-cons', {
      inventory_id: 'inv-cons',
      store_slug: 'central',
      tenant_key: 'alex',
      product_id: 444,
      name: 'Consistente',
      stock_quantity: 10,
      quantity: 10,
    });

    await decrementOfflineStock(
      [{ inventory_id: 'inv-cons', product_id: 444, quantity: 3 }],
      { storeSlug: 'central', tenantKey: 'alex' }
    );

    const prod = inMemoryProducts.get('inv-cons');
    expect(prod.stock_quantity).toBe(7);
    expect(prod.quantity).toBe(7);
  });

  // ── 20, 21. Pending & conflict sales not deleted or modified by refresh ────
  it('20, 21. pending and conflict sales are not deleted or modified during catalog refresh', async () => {
    inMemoryPendingSales.set('sale-pending-1', {
      id: 'sale-pending-1',
      status: 'pending',
      store_slug: 'central',
      tenant_key: 'alex',
      payload: { total: 100 },
    });

    inMemoryPendingSales.set('sale-conflict-1', {
      id: 'sale-conflict-1',
      status: 'conflict',
      store_slug: 'central',
      tenant_key: 'alex',
      last_error_code: 'STOCK_INSUFFICIENT',
      payload: { total: 200 },
    });

    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          category: 'A',
          products: [{ id: 1, inventory_id: 'inv-1', name: 'P1', quantity: 10 }],
        },
      ],
      isComplete: true,
    });

    expect(inMemoryPendingSales.has('sale-pending-1')).toBe(true);
    expect(inMemoryPendingSales.get('sale-pending-1').status).toBe('pending');

    expect(inMemoryPendingSales.has('sale-conflict-1')).toBe(true);
    expect(inMemoryPendingSales.get('sale-conflict-1').status).toBe('conflict');
  });

  // ── 22, 23. 6B.4B reconciliation affects only matching store ───────────────
  it('22, 23. 6B.4B authoritative reconciliation affects only matching store product', async () => {
    // Producto 700 en Store A
    inMemoryProducts.set('inv-a-700', {
      inventory_id: 'inv-a-700',
      store_slug: 'store-a',
      tenant_key: 'alex',
      product_id: 700,
      stock_quantity: 10,
    });

    // Producto 700 en Store B
    inMemoryProducts.set('inv-b-700', {
      inventory_id: 'inv-b-700',
      store_slug: 'store-b',
      tenant_key: 'alex',
      product_id: 700,
      stock_quantity: 25,
    });

    inMemoryPendingSales.set('sale-store-a', {
      id: 'sale-store-a',
      status: 'syncing',
      store_slug: 'store-a',
      tenant_key: 'alex',
    });

    await reconcileAuthoritativeSale({
      saleId: 'sale-store-a',
      storeSlug: 'store-a',
      tenantKey: 'alex',
      affectedProducts: [{ product_id: 700, stock_quantity: 6 }],
      isDuplicate: false,
    });

    // Solo Store A cambia a 6
    expect(inMemoryProducts.get('inv-a-700').stock_quantity).toBe(6);
    // Store B intacto en 25
    expect(inMemoryProducts.get('inv-b-700').stock_quantity).toBe(25);
  });

  // ── 18. Stale complete snapshot remains readable offline ───────────────────
  it('18. stale complete snapshot remains readable offline', async () => {
    // Un snapshot que fue creado hace tiempo o marcado 'stale' por un error de refresh
    inMemoryMeta.set('alex:central', {
      id: 'alex:central',
      tenant_key: 'alex',
      store_slug: 'central',
      status: 'stale',
      catalog_complete: true,
      product_count: 1,
      cached_at: Date.now() - 1000 * 60 * 60 * 24 * 7, // 7 días atrás
    });
    inMemoryProducts.set('inv-stale', {
      inventory_id: 'inv-stale',
      store_slug: 'central',
      tenant_key: 'alex',
      product_id: 101,
      name: 'Producto Existente Stale',
      quantity: 12,
      stock_quantity: 12,
    });

    const isComplete = await isCatalogSnapshotComplete('alex', 'central');
    expect(isComplete).toBe(true);

    const groups = await getOfflineStoreProducts('central', 'alex');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].products[0].name).toBe('Producto Existente Stale');
    expect(groups[0].products[0].quantity).toBe(12);
  });

  // ── 19. Interrupted refresh does not become complete ───────────────────────
  it('19. interrupted refresh does not become complete', async () => {
    // Si un refresh comienza pero se interrumpe (ej. timeout o desconexión en página 2 de 3)
    vi.spyOn(tenantApi, 'get')
      .mockResolvedValueOnce({
        data: {
          products: [
            {
              category_id: 1,
              category: 'Cat 1',
              products: [{ id: 1, inventory_id: 'inv-part-1', name: 'Part 1', quantity: 5 }],
            },
          ],
          pagination: { has_more: true, next_cursor: 'cursor-2', per_page: 1 },
        },
      } as any)
      .mockRejectedValueOnce(new Error('Browser closed or connection dropped'));

    const res = await refreshCompleteOfflineCatalog('central', { tenantKey: 'alex', perPage: 1 });
    expect(res.success).toBe(false);

    // No debe haber marcado catalog_complete = true para la descarga interrumpida
    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.catalog_complete).toBeFalsy();
    expect(['error', 'stale']).toContain(meta?.status);
  });

  // ── 24. Filtered UI state remains independent from persistent full snapshot ─
  it('24. filtered UI state remains independent from persistent full snapshot', async () => {
    // Establecer snapshot completo inicial de 50 productos
    for (let i = 1; i <= 50; i++) {
      inMemoryProducts.set(`inv-full-${i}`, {
        inventory_id: `inv-full-${i}`,
        store_slug: 'central',
        tenant_key: 'alex',
        product_id: i,
        name: `Producto ${i}`,
        quantity: 10,
        stock_quantity: 10,
      });
    }
    inMemoryMeta.set('alex:central', {
      id: 'alex:central',
      tenant_key: 'alex',
      store_slug: 'central',
      status: 'complete',
      catalog_complete: true,
      product_count: 50,
      cached_at: Date.now(),
    });

    // Supongamos que la UI recibe una respuesta filtrada de 2 productos para { category: 5 }
    const filteredUiProducts = [
      {
        category_id: 5,
        category: 'Bebidas',
        products: [
          { id: 1, inventory_id: 'inv-full-1', name: 'Producto 1', quantity: 10 },
          { id: 2, inventory_id: 'inv-full-2', name: 'Producto 2', quantity: 10 },
        ],
      },
    ];

    // cacheStoreProducts rechaza sobreescribir el catálogo completo porque isComplete no es true
    await cacheStoreProducts('central', filteredUiProducts, { tenantKey: 'alex' });

    // El catálogo offline persistente continúa teniendo los 50 productos intactos
    expect(inMemoryProducts.size).toBe(50);
    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.product_count).toBe(50);
    expect(meta?.catalog_complete).toBe(true);
  });

  // ===========================================================================
  // FASE 6B.4C.1 — HARDENING & INTEGRITY SUITE (Sección 16)
  // ===========================================================================

  // ── 3. Inconsistent response: has_more=true + next_cursor=null ─────────────
  it('6B.4C.1 - 3. has_more=true with next_cursor=null rejects candidate and preserves old complete snapshot', async () => {
    // Snapshot previo válido
    inMemoryProducts.set('inv-pre-3', {
      inventory_id: 'inv-pre-3',
      store_slug: 'central',
      tenant_key: 'alex',
      product_id: 301,
      name: 'Preexistente',
      quantity: 40,
    });
    inMemoryMeta.set('alex:central', {
      id: 'alex:central',
      tenant_key: 'alex',
      store_slug: 'central',
      status: 'complete',
      catalog_complete: true,
      product_count: 1,
      cached_at: 1000,
    });

    // Respuesta rota del backend: dice que hay más pero no manda cursor
    vi.spyOn(tenantApi, 'get').mockResolvedValueOnce({
      data: {
        products: [{ category_id: 1, products: [{ id: 999, inventory_id: 'inv-bad', name: 'Incompleto' }] }],
        pagination: { has_more: true, next_cursor: null },
      },
    } as any);

    const res = await refreshCompleteOfflineCatalog('central', { tenantKey: 'alex' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('next_cursor es nulo');

    // El snapshot previo continúa existiendo
    expect(inMemoryProducts.has('inv-pre-3')).toBe(true);
    // El candidato roto NO se guardó
    expect(inMemoryProducts.has('inv-bad')).toBe(false);

    // Metadata preserva catalog_complete previo pero marca stale con el error
    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.catalog_complete).toBe(true);
    expect(meta?.status).toBe('stale');
    expect(meta?.last_refresh_error).toContain('next_cursor es nulo');
  });

  // ── 4. MAX_PAGES reached with has_more=true ────────────────────────────────
  it('6B.4C.1 - 4. MAX_PAGES reached with has_more=true does NOT mark snapshot complete', async () => {
    // Simular que el backend siempre devuelve has_more=true con nuevo cursor
    let page = 0;
    vi.spyOn(tenantApi, 'get').mockImplementation(async () => {
      page++;
      return {
        data: {
          products: [{ category_id: 1, products: [{ id: page, inventory_id: `inv-p-${page}`, name: `Prod ${page}` }] }],
          pagination: { has_more: true, next_cursor: `cursor-${page + 1}` },
        },
      } as any;
    });

    const res = await refreshCompleteOfflineCatalog('central', { tenantKey: 'alex', perPage: 1 });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Límite de páginas alcanzado');

    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.catalog_complete).toBeFalsy();
    expect(meta?.status).toBe('error');
  });

  // ── 5. Repeated cursor detection ───────────────────────────────────────────
  it('6B.4C.1 - 5. repeated cursor detection aborts refresh to prevent infinite loops', async () => {
    vi.spyOn(tenantApi, 'get')
      .mockResolvedValueOnce({
        data: {
          products: [{ category_id: 1, products: [{ id: 1, inventory_id: 'inv-1', name: 'P1' }] }],
          pagination: { has_more: true, next_cursor: 'cursor-repeat' },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          products: [{ category_id: 1, products: [{ id: 2, inventory_id: 'inv-2', name: 'P2' }] }],
          // Mismo cursor que la página anterior -> loop!
          pagination: { has_more: true, next_cursor: 'cursor-repeat' },
        },
      } as any);

    const res = await refreshCompleteOfflineCatalog('central', { tenantKey: 'alex' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Cursor repetido detectado');

    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.catalog_complete).toBeFalsy();
    expect(meta?.last_refresh_error).toContain('Cursor repetido detectado');
  });

  // ── 8, 9, 10. pos_stores coexistence across tenants ────────────────────────
  it('6B.4C.1 - 8, 9, 10. store_cache_id ensures safe coexistence of same store_slug across tenants', async () => {
    // Tenant A guarda store 'central'
    await cacheStoreInfo(
      { slug: 'central', id: 'store-uuid-a', name: 'Sucursal Central A', address: 'Calle 1' },
      'tenant-a'
    );

    // Tenant B guarda store 'central'
    await cacheStoreInfo(
      { slug: 'central', id: 'store-uuid-b', name: 'Sucursal Central B', address: 'Avenida 2' },
      'tenant-b'
    );

    // Ambos deben coexistir en IndexedDB bajo su store_cache_id
    const storeA = await getOfflineStore('central', 'tenant-a');
    expect(storeA).toBeDefined();
    expect(storeA?.id).toBe('store-uuid-a');
    expect(storeA?.name).toBe('Sucursal Central A');
    expect(storeA?.tenant_key).toBe('tenant-a');

    const storeB = await getOfflineStore('central', 'tenant-b');
    expect(storeB).toBeDefined();
    expect(storeB?.id).toBe('store-uuid-b');
    expect(storeB?.name).toBe('Sucursal Central B');
    expect(storeB?.tenant_key).toBe('tenant-b');

    // Tenant A nunca debe obtener el store de Tenant B
    expect(storeA?.id).not.toBe(storeB?.id);
  });

  // ── 11. Legacy tenantless product cannot act as wildcard ───────────────────
  it('6B.4C.1 - 11. legacy tenantless product does not act as wildcard for tenant catalog or stock', async () => {
    // Producto legacy en base de datos sin tenant_key
    inMemoryProducts.set('inv-legacy-1', {
      inventory_id: 'inv-legacy-1',
      store_slug: 'central',
      tenant_key: undefined, // Legacy sin tenant
      product_id: 888,
      name: 'Legacy No Asignado',
      quantity: 50,
      stock_quantity: 50,
    });

    // Consultar catálogo offline para Tenant Alex
    const prodsAlex = await getOfflineStoreProducts('central', 'alex');
    // NO debe incluir el producto legacy sin tenant como parte del catálogo de Alex
    expect(prodsAlex.length).toBe(0);

    // Validar stock para Tenant Alex tampoco debe hacer match con el legacy: debe rechazar por UNVERIFIED_STOCK (Fase 6B.4D)
    const stockCheck = await validateOfflineStock(
      [{ product_id: 888, quantity: 1 }],
      { storeSlug: 'central', tenantKey: 'alex' }
    );
    expect(stockCheck.valid).toBe(false);
    expect(stockCheck.code).toBe('UNVERIFIED_STOCK');
    expect(stockCheck.error).toContain('No se pudo verificar el stock');
  });

  // ── 12. Authoritative reconciliation for Tenant A ignores other tenants ─────
  it('6B.4C.1 - 12. authoritative reconciliation for Tenant A never modifies Tenant B or legacy products', async () => {
    // Producto en Tenant B
    inMemoryProducts.set('inv-tb-10', {
      inventory_id: 'inv-tb-10',
      store_slug: 'central',
      tenant_key: 'tenant-b',
      product_id: 555,
      stock_quantity: 30,
      quantity: 30,
    });

    // Producto legacy sin tenant
    inMemoryProducts.set('inv-legacy-10', {
      inventory_id: 'inv-legacy-10',
      store_slug: 'central',
      tenant_key: undefined,
      product_id: 555,
      stock_quantity: 10,
      quantity: 10,
    });

    // Reconciliación autoritativa para Tenant A
    await reconcileAuthoritativeSale({
      saleId: 'sale-recon-a',
      storeSlug: 'central',
      tenantKey: 'tenant-a',
      affectedProducts: [{ product_id: 555, stock_quantity: 2 }],
      isDuplicate: false,
    });

    // Ni Tenant B ni Legacy se deben haber modificado a 2
    expect(inMemoryProducts.get('inv-tb-10').stock_quantity).toBe(30);
    expect(inMemoryProducts.get('inv-legacy-10').stock_quantity).toBe(10);
  });

  // ── 13 & 14. Server-committed Double Decrement Prevention ───────────────────
  it('6B.4C.1 - 13 & 14. DOUBLE-DECREMENT PREVENTION: server-accepted sale does NOT double decrement on fresh refresh', async () => {
    // ESCENARIO 1: Venta pendiente local AÚN NO procesada por el servidor
    // Servidor: 10. Venta local: 2.
    inMemoryPendingSales.set('sale-uncommitted', {
      id: 'sale-uncommitted',
      status: 'pending',
      tenant_key: 'alex',
      store_slug: 'central',
      server_accepted: false,
      payload: { products: [{ product_id: 111, quantity: 2 }] },
    });

    // El helper canónico confirma que DEBE reservarse
    expect(shouldReservePendingSaleLocally(inMemoryPendingSales.get('sale-uncommitted'))).toBe(true);

    // Refresh descarga snapshot con stock 10
    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          products: [{ id: 111, inventory_id: 'inv-111', stock_quantity: 10, quantity: 10 }],
        },
      ],
      isComplete: true,
    });

    // Stock local disponible queda en 8 (10 - 2 pendientes)
    expect(inMemoryProducts.get('inv-111').stock_quantity).toBe(8);

    // ESCENARIO 2: La venta fue procesada por el servidor (server_accepted = true o LOCAL_RECONCILIATION_FAILED)
    // El servidor ya tiene P1 = 8.
    inMemoryPendingSales.set('sale-uncommitted', {
      id: 'sale-uncommitted',
      status: 'pending',
      tenant_key: 'alex',
      store_slug: 'central',
      server_accepted: true, // ¡Ya aceptada en PostgreSQL!
      last_error_code: 'LOCAL_RECONCILIATION_FAILED',
      payload: { products: [{ product_id: 111, quantity: 2 }] },
    });

    // El helper canónico confirma que NO debe reservarse nuevamente
    expect(shouldReservePendingSaleLocally(inMemoryPendingSales.get('sale-uncommitted'))).toBe(false);

    // Refresh descarga el stock fresco del servidor (8)
    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          products: [{ id: 111, inventory_id: 'inv-111', stock_quantity: 8, quantity: 8 }],
        },
      ],
      isComplete: true,
    });

    // INVARIANTE CRÍTICO: El stock local queda en 8, ¡NUNCA 6!
    expect(inMemoryProducts.get('inv-111').stock_quantity).toBe(8);
  });

  // ── 15. Conflict sale does not cause local stock compensation ──────────────
  it('6B.4C.1 - 15. conflict sale does not deduct local stock on refresh', async () => {
    inMemoryPendingSales.set('sale-conflict', {
      id: 'sale-conflict',
      status: 'conflict',
      tenant_key: 'alex',
      store_slug: 'central',
      last_error_code: 'STOCK_INSUFFICIENT',
      payload: { products: [{ product_id: 222, quantity: 5 }] },
    });

    expect(shouldReservePendingSaleLocally(inMemoryPendingSales.get('sale-conflict'))).toBe(false);

    await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          products: [{ id: 222, inventory_id: 'inv-222', stock_quantity: 10, quantity: 10 }],
        },
      ],
      isComplete: true,
    });

    // No se descuenta la venta conflictiva: stock queda en 10
    expect(inMemoryProducts.get('inv-222').stock_quantity).toBe(10);
  });

  // ── 16 & 17. Refresh Mutex ─────────────────────────────────────────────────
  it('6B.4C.1 - 16, 17. refresh mutex prevents duplicate concurrent refreshes on same store while allowing different stores', async () => {
    let callCount = 0;
    vi.spyOn(tenantApi, 'get').mockImplementation(async (url: string) => {
      callCount++;
      // Retraso artificial para simular descarga en vuelo
      await new Promise((r) => setTimeout(r, 20));
      return {
        data: {
          products: [{ category_id: 1, products: [{ id: 1, inventory_id: 'inv-1', name: 'Prod' }] }],
          pagination: { has_more: false, next_cursor: null },
        },
      } as any;
    });

    // Disparar dos refresh concurrentes para la MISMA tienda (alex:central)
    const [p1, p2] = await Promise.all([
      refreshCompleteOfflineCatalog('central', { tenantKey: 'alex' }),
      refreshCompleteOfflineCatalog('central', { tenantKey: 'alex', force: true }),
    ]);

    expect(p1.success).toBe(true);
    expect(p2.success).toBe(true);
    // Solo se realizó 1 llamada HTTP gracias al mutex Map
    expect(callCount).toBe(1);

    // Disparar refresh para OTRA tienda diferente (alex:sucursal-sur)
    const pSur = await refreshCompleteOfflineCatalog('sucursal-sur', { tenantKey: 'alex' });
    expect(pSur.success).toBe(true);
    expect(callCount).toBe(2);
  });

  // ── 18. Reservation deficit detection when reserved > serverStock ──────────
  it('6B.4C.1 - 18. reservation deficit detection clamps display to 0 but records deficit in metadata', async () => {
    // Venta local pendiente reservó 3 unidades
    inMemoryPendingSales.set('sale-oversell', {
      id: 'sale-oversell',
      status: 'pending',
      tenant_key: 'alex',
      store_slug: 'central',
      payload: { products: [{ product_id: 999, quantity: 3 }] },
    });

    // Servidor solo tiene 1 unidad disponible
    const res = await saveCatalogSnapshot({
      tenantKey: 'alex',
      storeSlug: 'central',
      productGroups: [
        {
          category_id: 1,
          products: [{ id: 999, inventory_id: 'inv-999', stock_quantity: 1, quantity: 1 }],
        },
      ],
      isComplete: true,
    });

    expect(res.success).toBe(true);
    // Déficit detectado = 3 - 1 = 2
    expect(res.reservationDeficit).toBe(2);
    expect(res.deficits?.length).toBe(1);
    expect(res.deficits?.[0].deficit).toBe(2);

    // Stock local en display / IndexedDB no es negativo: se clampea visualmente a 0
    expect(inMemoryProducts.get('inv-999').stock_quantity).toBe(0);

    // Metadata guarda el déficit para auditoría
    const meta = await getOfflineCatalogMeta('alex', 'central');
    expect(meta?.reservation_deficit).toBe(2);
  });
});


