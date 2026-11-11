import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie, { Table } from 'dexie';
import {
  posDb,
  cacheStoreInfo,
  getOfflineStore,
  cacheStoreProducts,
  getOfflineStoreProducts,
  decrementOfflineStock,
  validateOfflineStock,
  PosOfflineStore,
  PosOfflineProduct,
  PosCatalogMeta,
  PosPendingSale,
  PosOfflineSaleHistory,
} from './pos-db';
import { reconcileAuthoritativeSale } from './offlineSaleReconciliation';

/**
 * Suite de Pruebas Reales de Migración Física IndexedDB / Dexie v3 -> v4
 * Fase 6B.4C.2 — DEXIE SCHEMA MIGRATION SAFETY
 *
 * Utiliza fake-indexeddb para ejecutar IndexedDB y el motor de Dexie de manera
 * completamente real y determinista (no mocks de Map).
 */
describe('DexieSchemaMigration (Fase 6B.4C.2 — Real Physical Upgrade V3 -> V4)', () => {
  const TEST_DB_NAME = 'InventaryaPosOfflineDB';

  afterEach(async () => {
    // Cerrar y limpiar base de datos después de cada test
    try {
      if (posDb.isOpen()) {
        posDb.close();
      }
      await Dexie.delete(TEST_DB_NAME);
    } catch (e) {
      // Ignorar error al limpiar DB en afterEach
    }
  });

  // ── TEST 1: Physical V3 -> V4 Schema Upgrade (Sección 17) ───────────────────
  it('1. REAL V3 -> V4 UPGRADE: preserves pos_stores with new PK, keeps pending sales, history, products and meta intact', async () => {
    // PASO A: Crear la base de datos simulando exactamente el estado V3 publicado en 6B.4C
    class PhysicalV3DB extends Dexie {
      pos_stores!: Table<any, string>;
      pos_products!: Table<any, string | number>;
      pos_customers!: Table<any, string | number>;
      pos_pending_sales!: Table<any, string>;
      pos_sales_history!: Table<any, string>;
      pos_catalog_meta!: Table<any, string>;

      constructor() {
        super(TEST_DB_NAME);
        this.version(1).stores({
          pos_stores: 'slug, id',
          pos_products: 'inventory_id, store_slug, product_id, category_slug, sku',
          pos_customers: 'id, name, phone',
          pos_pending_sales: 'id, store_slug, status, created_at',
          pos_sales_history: 'id, store_slug, created_at',
        });
        this.version(2).stores({
          pos_pending_sales: 'id, store_slug, status, created_at, tenant_key, last_attempt_at',
        });
        // Definición V3 física original: PK = slug
        this.version(3).stores({
          pos_stores: 'slug, id, tenant_key, [tenant_key+slug]',
          pos_products: 'inventory_id, store_slug, product_id, category_slug, sku, tenant_key, [tenant_key+store_slug]',
          pos_catalog_meta: 'id, tenant_key, store_slug, [tenant_key+store_slug], catalog_complete, cached_at',
        });
      }
    }

    const v3Instance = new PhysicalV3DB();
    await v3Instance.open();

    expect(v3Instance.verno).toBe(3);
    // Confirmar que físicamente la tabla pos_stores tiene PK = slug
    expect(v3Instance.table('pos_stores').schema.primKey.name).toBe('slug');

    // Insertar datos de prueba en la base v3
    await v3Instance.table('pos_stores').put({
      slug: 'central',
      tenant_key: 'tenant-a',
      id: 'store-a',
      name: 'Central Tenant A',
      updated_at: 1000,
    });

    await v3Instance.table('pos_pending_sales').put({
      id: 'sale-001',
      store_slug: 'central',
      store_id: 'store-a',
      tenant_key: 'tenant-a',
      endpoint: '/api/v1/tenant/pos/sales',
      payload: { total: 150.5, client: 'Cliente A' },
      status: 'pending',
      attempt_count: 1,
      created_at: 1000,
      last_attempt_at: 1000,
    });

    await v3Instance.table('pos_sales_history').put({
      id: 'sale-history-001',
      store_slug: 'central',
      customer_name: 'Juan Perez',
      total: 150.5,
      discount: 0,
      payment_method: 'EFECTIVO',
      date: '2026-10-20',
      created_at: '2026-10-20',
      status: 'completado (offline)',
      is_offline: true,
      products: [{ product_id: 10, name: 'Item 10', quantity: 2, price: 75.25, subtotal: 150.5 }],
    });

    await v3Instance.table('pos_products').put({
      inventory_id: 'inv-ta-01',
      store_slug: 'central',
      tenant_key: 'tenant-a',
      product_id: 10,
      name: 'Item 10',
      slug: 'item-10',
      sku: 'SKU-10',
      unit: 'Unidad',
      price: 75.25,
      sale_price: 75.25,
      quantity: 15,
      stock_quantity: 15,
      updated_at: 1000,
    });

    await v3Instance.table('pos_catalog_meta').put({
      id: 'tenant-a:central',
      tenant_key: 'tenant-a',
      store_slug: 'central',
      status: 'complete',
      catalog_complete: true,
      cached_at: 1000,
      product_count: 1,
      schema_version: 3,
    });

    // PASO B: Cerrar la conexión V3
    v3Instance.close();

    // PASO C: Abrir utilizando la aplicación con el nuevo schema V4 (posDb)
    await posDb.open();

    // PASO D: Verificaciones estrictas
    expect(posDb.verno).toBe(4);

    // 1. pos_stores_v4 tiene store_cache_id como PK
    expect(posDb.pos_stores_v4.schema.primKey.name).toBe('store_cache_id');

    // 2. Tienda migrada correctamente con store_cache_id = 'tenant-a:central'
    const migratedStore = await posDb.pos_stores_v4.get('tenant-a:central');
    expect(migratedStore).toBeDefined();
    expect(migratedStore?.slug).toBe('central');
    expect(migratedStore?.tenant_key).toBe('tenant-a');
    expect(migratedStore?.id).toBe('store-a');
    expect(migratedStore?.name).toBe('Central Tenant A');

    // 3. pos_pending_sales intacta: no se perdió UUID, payload, status, attempt_count
    const pendingSale = await posDb.pos_pending_sales.get('sale-001');
    expect(pendingSale).toBeDefined();
    expect(pendingSale?.id).toBe('sale-001');
    expect(pendingSale?.tenant_key).toBe('tenant-a');
    expect(pendingSale?.payload.total).toBe(150.5);
    expect(pendingSale?.status).toBe('pending');
    expect(pendingSale?.attempt_count).toBe(1);

    // 4. pos_sales_history intacta
    const salesHistory = await posDb.pos_sales_history.get('sale-history-001');
    expect(salesHistory).toBeDefined();
    expect(salesHistory?.id).toBe('sale-history-001');
    expect(salesHistory?.total).toBe(150.5);
    expect(salesHistory?.customer_name).toBe('Juan Perez');

    // 5. pos_products intactos
    const product = await posDb.pos_products.get('inv-ta-01');
    expect(product).toBeDefined();
    expect(product?.name).toBe('Item 10');
    expect(product?.stock_quantity).toBe(15);
    expect(product?.tenant_key).toBe('tenant-a');

    // 6. pos_catalog_meta intacta
    const meta = await posDb.pos_catalog_meta.get('tenant-a:central');
    expect(meta).toBeDefined();
    expect(meta?.catalog_complete).toBe(true);
    expect(meta?.product_count).toBe(1);

    posDb.close();
  });

  // ── TEST 2: Legacy Store Without Tenant Upgrade & Coexistence (Sección 18) ──
  it('2. LEGACY STORE WITHOUT TENANT: remains legacy/unverified, not attributed to active tenant, coexists safely', async () => {
    // Crear base V3 con una tienda legacy sin tenant_key
    class PhysicalV3DB extends Dexie {
      pos_stores!: Table<any, string>;
      constructor() {
        super(TEST_DB_NAME);
        this.version(1).stores({ pos_stores: 'slug, id' });
        this.version(3).stores({ pos_stores: 'slug, id, tenant_key, [tenant_key+slug]' });
      }
    }

    const v3 = new PhysicalV3DB();
    await v3.open();
    await v3.pos_stores.put({
      slug: 'central',
      tenant_key: undefined,
      id: 'legacy-store-99',
      name: 'Legacy Central Store',
      updated_at: 500,
    });
    v3.close();

    // Abrir con V4
    await posDb.open();

    // 1. Debe existir en pos_stores_v4 bajo 'legacy:central'
    const legacyRecord = await posDb.pos_stores_v4.get('legacy:central');
    expect(legacyRecord).toBeDefined();
    expect(legacyRecord?.slug).toBe('central');
    expect(legacyRecord?.tenant_key).toBeUndefined();
    expect(legacyRecord?.name).toBe('Legacy Central Store');

    // 2. Si consultamos para el tenant 'alex', NO debe retornar el legacy
    const storeAlexBefore = await getOfflineStore('central', 'alex');
    expect(storeAlexBefore).toBeUndefined();

    // 3. Cuando llega la conexión y se cachea la tienda de 'alex'
    await cacheStoreInfo(
      {
        slug: 'central',
        id: 'alex-store-01',
        name: 'Alex Sucursal Central',
        address: 'Av. Siempre Viva 123',
      },
      'alex'
    );

    // 4. Ahora getOfflineStore('central', 'alex') retorna la tienda correcta de alex
    const storeAlexAfter = await getOfflineStore('central', 'alex');
    expect(storeAlexAfter).toBeDefined();
    expect(storeAlexAfter?.id).toBe('alex-store-01');
    expect(storeAlexAfter?.name).toBe('Alex Sucursal Central');
    expect(storeAlexAfter?.tenant_key).toBe('alex');

    // 5. El registro legacy no fue destruido ni atribuido falsamente a alex
    const legacyStillExists = await posDb.pos_stores_v4.get('legacy:central');
    expect(legacyStillExists).toBeDefined();
    expect(legacyStillExists?.id).toBe('legacy-store-99');
    expect(legacyStillExists?.tenant_key).toBeUndefined();

    posDb.close();
  });

  // ── TEST 3: Multi-tenant Same Slug Coexistence (Sección 19) ─────────────────
  it('3. SAME SLUG MULTI-TENANT: tenant-a:central and tenant-b:central physically coexist in pos_stores_v4', async () => {
    await posDb.open();

    // Guardar Tenant A
    await cacheStoreInfo(
      { slug: 'central', id: 'store-tenant-a', name: 'Sucursal Central Tenant A' },
      'tenant-a'
    );

    // Guardar Tenant B con el MISMO slug 'central'
    await cacheStoreInfo(
      { slug: 'central', id: 'store-tenant-b', name: 'Sucursal Central Tenant B' },
      'tenant-b'
    );

    // Verificar que getOfflineStore distingue perfectamente por tenant
    const storeA = await getOfflineStore('central', 'tenant-a');
    const storeB = await getOfflineStore('central', 'tenant-b');

    expect(storeA).toBeDefined();
    expect(storeA?.id).toBe('store-tenant-a');
    expect(storeA?.name).toBe('Sucursal Central Tenant A');
    expect(storeA?.store_cache_id).toBe('tenant-a:central');

    expect(storeB).toBeDefined();
    expect(storeB?.id).toBe('store-tenant-b');
    expect(storeB?.name).toBe('Sucursal Central Tenant B');
    expect(storeB?.store_cache_id).toBe('tenant-b:central');

    // Ambos registros coexisten físicamente en la tabla
    const allStores = await posDb.pos_stores_v4.toArray();
    expect(allStores.length).toBe(2);

    posDb.close();
  });

  // ── TEST 4: Clean Installation Directly on V4 (Sección 24) ──────────────────
  it('4. CLEAN INSTALLATION: opening fresh DB directly initializes schema v4 without requiring previous physical versions', async () => {
    await posDb.open();

    expect(posDb.verno).toBe(4);
    expect(posDb.pos_stores_v4).toBeDefined();
    expect(posDb.pos_stores_v4.schema.primKey.name).toBe('store_cache_id');

    // Probar operaciones en DB limpia
    await cacheStoreInfo({ slug: 'norte', id: 'st-01', name: 'Norte' }, 'fresh-tenant');
    const store = await getOfflineStore('norte', 'fresh-tenant');
    expect(store?.name).toBe('Norte');

    // Probar catálogo
    await cacheStoreProducts(
      'norte',
      [
        {
          category: 'Bebidas',
          slug_category: 'bebidas',
          products: [{ id: 'p-1', name: 'Agua', price: 5, quantity: 10 }],
        },
      ],
      { tenantKey: 'fresh-tenant', isComplete: true }
    );

    const prods = await getOfflineStoreProducts('norte', 'fresh-tenant');
    expect(prods.length).toBe(1);
    expect(prods[0].products[0].name).toBe('Agua');

    // Probar validación y decremento de stock
    const valid = await validateOfflineStock(
      [{ product_id: 'p-1', quantity: 3 }],
      { storeSlug: 'norte', tenantKey: 'fresh-tenant' }
    );
    expect(valid.valid).toBe(true);

    await decrementOfflineStock(
      [{ product_id: 'p-1', quantity: 3 }],
      { storeSlug: 'norte', tenantKey: 'fresh-tenant' }
    );

    const prodsAfter = await getOfflineStoreProducts('norte', 'fresh-tenant');
    expect(prodsAfter[0].products[0].stock_quantity).toBe(7);

    posDb.close();
  });

  // ── TEST 5: Empirical Verification of Why pos_stores_v4 was Required (Sección 26) ─
  it('5. EMPIRICAL VERIFICATION: Dexie/IndexedDB rejects changing primary key on existing object store under same table name', async () => {
    const TEMP_DB_NAME = 'TempTestPKChangeDB';

    // 1. Crear DB con tabla pos_stores donde PK = slug
    const dbOld = new Dexie(TEMP_DB_NAME);
    dbOld.version(1).stores({
      pos_stores: 'slug, id',
    });
    await dbOld.open();
    await dbOld.table('pos_stores').put({ slug: 'central', id: 's1' });
    dbOld.close();

    // 2. Intentar cambiar la primary key a store_cache_id bajo el MISMO nombre 'pos_stores'
    const dbNew = new Dexie(TEMP_DB_NAME);
    dbNew.version(1).stores({
      pos_stores: 'slug, id',
    });
    dbNew.version(2).stores({
      pos_stores: 'store_cache_id, slug, id',
    });

    let threwError = false;
    let errorMessage = '';
    try {
      await dbNew.open();
    } catch (err: any) {
      threwError = true;
      errorMessage = err?.message || String(err);
    } finally {
      dbNew.close();
      await Dexie.delete(TEMP_DB_NAME);
    }

    // Dexie o IndexedDB rechazan explícitamente cambiar el keyPath de un object store existente
    expect(threwError).toBe(true);
    expect(errorMessage.toLowerCase()).toMatch(/keypath|primary key|cannot be changed|schema/);
  });

  // ── TEST 6: Authoritative Reconciliation with Mandatory tenantKey (Sección 20 & 21) ─
  it('6. AUTHORITATIVE RECONCILIATION: requires tenantKey and isolates updates strictly by tenant in real DB', async () => {
    await posDb.open();

    // Insertar productos reales en pos_products para tenant-a, tenant-b y legacy
    await posDb.pos_products.bulkPut([
      {
        inventory_id: 'prod-ta-1',
        store_slug: 'central',
        tenant_key: 'tenant-a',
        product_id: 101,
        name: 'Producto A',
        slug: 'prod-a',
        sku: 'SKU-A',
        unit: 'U',
        price: 10,
        sale_price: 10,
        quantity: 10,
        stock_quantity: 10,
        updated_at: 1000,
      },
      {
        inventory_id: 'prod-tb-1',
        store_slug: 'central',
        tenant_key: 'tenant-b',
        product_id: 101,
        name: 'Producto B',
        slug: 'prod-b',
        sku: 'SKU-B',
        unit: 'U',
        price: 10,
        sale_price: 10,
        quantity: 20,
        stock_quantity: 20,
        updated_at: 1000,
      },
      {
        inventory_id: 'prod-legacy-1',
        store_slug: 'central',
        tenant_key: undefined,
        product_id: 101,
        name: 'Producto Legacy',
        slug: 'prod-l',
        sku: 'SKU-L',
        unit: 'U',
        price: 10,
        sale_price: 10,
        quantity: 30,
        stock_quantity: 30,
        updated_at: 1000,
      },
    ]);

    // Insertar venta pendiente en pos_pending_sales
    await posDb.pos_pending_sales.put({
      id: 'sale-ta-uuid',
      store_slug: 'central',
      store_id: 'store-a',
      tenant_key: 'tenant-a',
      endpoint: '/sales',
      payload: {},
      status: 'syncing',
      created_at: 1000,
    });

    // A. Reconciliación sin tenantKey debe fallar y no modificar nada (Sección 20)
    const failRes = await reconcileAuthoritativeSale({
      saleId: 'sale-ta-uuid',
      storeSlug: 'central',
      tenantKey: undefined as any,
      affectedProducts: [{ product_id: 101, stock_quantity: 7 }],
    });
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('tenantKey es obligatorio');

    const checkTaStockPre = await posDb.pos_products.get('prod-ta-1');
    expect(checkTaStockPre?.stock_quantity).toBe(10); // Intacto

    // B. Reconciliación con tenantKey = 'tenant-a'
    const successRes = await reconcileAuthoritativeSale({
      saleId: 'sale-ta-uuid',
      storeSlug: 'central',
      tenantKey: 'tenant-a',
      affectedProducts: [{ product_id: 101, stock_quantity: 7 }],
    });
    expect(successRes.success).toBe(true);

    // Tenant A actualizado a 7
    const prodTa = await posDb.pos_products.get('prod-ta-1');
    expect(prodTa?.stock_quantity).toBe(7);

    // Tenant B permanece en 20 (no modificado)
    const prodTb = await posDb.pos_products.get('prod-tb-1');
    expect(prodTb?.stock_quantity).toBe(20);

    // Legacy permanece en 30 (no modificado)
    const prodLegacy = await posDb.pos_products.get('prod-legacy-1');
    expect(prodLegacy?.stock_quantity).toBe(30);

    // Venta eliminada de pending
    const pendingAfter = await posDb.pos_pending_sales.get('sale-ta-uuid');
    expect(pendingAfter).toBeUndefined();

    posDb.close();
  });
});
