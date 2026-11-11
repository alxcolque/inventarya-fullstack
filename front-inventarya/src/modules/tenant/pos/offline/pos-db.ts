import { getTenantSlug } from '@/utils/tenant';
import Dexie, { Table } from 'dexie';
import { getLeafCategoryName } from '../utils/category';

export interface PosOfflineStore {
  store_cache_id?: string; // `${tenant_key}:${slug}`
  slug: string;
  id: string | number;
  tenant_key?: string;
  name: string;
  address?: string;
  phone?: string;
  location?: string;
  is_active?: boolean;
  updated_at: number;
}

export interface PosOfflineProduct {
  inventory_id: string | number;
  store_slug: string;
  tenant_key?: string;
  product_id: string | number;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  description?: string;
  category_name?: string;
  category_slug?: string;
  category_color?: string;
  brand_name?: string;
  unit: string;
  price: number;
  sale_price: number;
  quantity: number;
  stock_quantity: number;
  min_stock?: number;
  expiration_date?: string | null;
  updated_at: number;
}

export interface PosCatalogMeta {
  id: string; // `${tenant_key}:${store_slug}`
  tenant_key: string;
  store_slug: string;
  status: 'refreshing' | 'complete' | 'stale' | 'error';
  catalog_complete: boolean;
  cached_at: number;
  product_count: number;
  started_at?: number;
  completed_at?: number;
  last_refresh_attempt_at?: number;
  last_refresh_error?: string;
  reservation_deficit?: number;
  schema_version?: number;
}

export interface PosOfflineCustomer {
  id: number | string;
  name: string;
  phone?: string;
  ci?: string;
  document_number?: string;
  document_type?: number;
  document_complement?: string;
  email?: string;
}

export interface PosPendingSale {
  tenant_key?: string;
  id: string; // UUID
  store_slug: string;
  store_id: string | number;
  endpoint: string;
  payload: any;
  created_at: number;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error_message?: string;
  attempt_count?: number;
  last_error_code?: string;
  last_error_message?: string;
  server_accepted?: boolean;
  affected_products?: Array<{ product_id: number | string; stock_quantity: number }>;
  last_attempt_at?: number;
}

export interface PosOfflineSaleHistory {
  id: string; // UUID
  store_slug: string;
  customer_name: string;
  phone?: string;
  total: number;
  discount: number;
  payment_method: string;
  date: string;
  created_at: string;
  status: string;
  is_offline: boolean;
  products: Array<{
    product_id: string | number;
    inventory_id?: string | number;
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
}

class PosDexieDB extends Dexie {
  pos_stores!: Table<PosOfflineStore, string>;
  pos_stores_v4!: Table<PosOfflineStore, string>;
  pos_products!: Table<PosOfflineProduct, string | number>;
  pos_customers!: Table<PosOfflineCustomer, string | number>;
  pos_pending_sales!: Table<PosPendingSale, string>;
  pos_sales_history!: Table<PosOfflineSaleHistory, string>;
  pos_catalog_meta!: Table<PosCatalogMeta, string>;

  constructor() {
    super('InventaryaPosOfflineDB');
    this.version(1).stores({
      pos_stores: 'slug, id',
      pos_products: 'inventory_id, store_slug, product_id, category_slug, sku',
      pos_customers: 'id, name, phone',
      pos_pending_sales: 'id, store_slug, status, created_at',
      pos_sales_history: 'id, store_slug, created_at',
    });
    this.version(2).stores({
      pos_pending_sales: 'id, store_slug, status, created_at, tenant_key, last_attempt_at',
    }).upgrade((tx) => {
      // Migración no destructiva de registros existentes (Fase 6B.4A)
      return tx.table('pos_pending_sales').toCollection().modify((sale: any) => {
        if (sale.attempt_count === undefined) sale.attempt_count = 0;
        if (!['pending', 'syncing', 'failed', 'conflict'].includes(sale.status)) {
          sale.status = 'pending';
        }
      });
    });
    // Versión 3 histórica (Fase 6B.4C): pos_stores con PK=slug
    this.version(3).stores({
      pos_stores: 'slug, id, tenant_key, [tenant_key+slug]',
      pos_products: 'inventory_id, store_slug, product_id, category_slug, sku, tenant_key, [tenant_key+store_slug]',
      pos_catalog_meta: 'id, tenant_key, store_slug, [tenant_key+store_slug], catalog_complete, cached_at',
    });
    // Versión 4 (Fase 6B.4C.2): Nuevo object store pos_stores_v4 con PK=store_cache_id
    this.version(4).stores({
      pos_stores_v4: 'store_cache_id, slug, id, tenant_key, [tenant_key+slug]',
    }).upgrade(async (tx) => {
      // Migración segura no destructiva v3 -> v4:
      // Lee pos_stores físico con PK=slug y transfiere a pos_stores_v4 con PK=store_cache_id
      try {
        const legacyStores = await tx.table('pos_stores').toArray();
        for (const store of legacyStores) {
          if (!store || !store.slug) continue;
          const tenantKey = store.tenant_key;
          const storeCacheId = tenantKey ? `${tenantKey}:${store.slug}` : `legacy:${store.slug}`;
          await tx.table('pos_stores_v4').put({
            ...store,
            store_cache_id: storeCacheId,
          });
        }
      } catch (err) {
        console.warn('[IndexedDB Upgrade v4] Error migrando pos_stores a pos_stores_v4:', err);
      }
    });
  }
}

export const posDb = new PosDexieDB();

/**
 * Guarda los datos de la sucursal actual en IndexedDB (pos_stores_v4 con PK=store_cache_id).
 * Exige tenantKey resoluble para evitar contaminación de "default" o tiendas cross-tenant.
 */
export async function cacheStoreInfo(shop: any, tenantKey?: string): Promise<void> {
  if (!shop || !shop.slug) return;
  try {
    const resolvedTenant = tenantKey || getTenantSlug();
    if (!resolvedTenant) {
      console.warn('[IndexedDB] No se puede persistir tienda sin tenant válido identificable.');
      return;
    }
    const storeCacheId = `${resolvedTenant}:${shop.slug}`;
    await posDb.pos_stores_v4.put({
      store_cache_id: storeCacheId,
      slug: shop.slug,
      id: shop.id,
      tenant_key: resolvedTenant,
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      location: shop.location,
      is_active: shop.is_active ?? true,
      updated_at: Date.now(),
    });
  } catch (err) {
    console.error('[IndexedDB] Error al guardar info de tienda:', err);
  }
}

export interface CacheStoreProductsOptions {
  tenantKey?: string;
  isComplete?: boolean;
}

/**
 * Guarda el catálogo de productos de una sucursal en IndexedDB
 * IMPORTANTE: No guarda imágenes para cumplir con el requisito offline.
 *
 * Protección de Snapshot Completo (Fase 6B.4C - Secciones 0, 2, 9, 34):
 * Una búsqueda, filtro o página parcial JAMÁS puede reemplazar un snapshot completo previo.
 */
export async function cacheStoreProducts(
  storeSlug: string,
  storeProductsGroups: any[],
  options?: CacheStoreProductsOptions
): Promise<void> {
  if (!storeSlug || !Array.isArray(storeProductsGroups)) return;
  try {
    const tenantKey = options?.tenantKey || getTenantSlug();
    if (!tenantKey) {
      console.warn('[IndexedDB] Ignorando cacheStoreProducts: tenantKey no disponible');
      return;
    }
    const isExplicitlyComplete = Boolean(options?.isComplete);

    // Protección de integridad: verificar si ya existe un snapshot completo válido
    const metaKey = `${tenantKey}:${storeSlug}`;
    const existingMeta = await posDb.pos_catalog_meta.get(metaKey);

    if (existingMeta?.catalog_complete && !isExplicitlyComplete) {
      console.warn(
        `[IndexedDB] Ignorando cache parcial: existe un snapshot completo válido (${existingMeta.product_count} productos) para tienda ${storeSlug}. No se sobrescribe.`
      );
      return;
    }

    const productsToSave: PosOfflineProduct[] = [];
    const now = Date.now();

    storeProductsGroups.forEach((group: any) => {
      const rawCategory = group.category || group.category_path;
      const categoryName = getLeafCategoryName(rawCategory);
      const categorySlug = group.slug_category;
      const categoryColor = group.color || '#6366f1';

      (group.products || []).forEach((p: any) => {
        const invId = p.inventory_id ?? p.id;
        if (!invId) return;

        productsToSave.push({
          inventory_id: invId,
          store_slug: storeSlug,
          tenant_key: tenantKey,
          product_id: p.id ?? invId,
          name: p.name || 'Producto',
          slug: p.slug || '',
          sku: p.sku || '',
          barcode: p.barcode || '',
          description: p.description || '',
          category_name: categoryName,
          category_slug: categorySlug,
          category_color: categoryColor,
          brand_name: p.brand || 'Desconocido',
          unit: p.unit || 'Unidad',
          price: Number(p.price) || 0,
          sale_price: Number(p.sale_price ?? p.saleprice ?? p.price) || 0,
          quantity: Number(p.quantity) || 0,
          stock_quantity: Number(p.stock_quantity ?? p.quantity) || 0,
          min_stock: Number(p.min_stock) || 0,
          expiration_date: p.expiration_date || null,
          updated_at: now,
          // NOTA: Se descartan p.image y p.thumbnail para no saturar IndexedDB
        });
      });
    });

    // Reemplazo atómico en IndexedDB scoped por (tenantKey + storeSlug)
    await posDb.transaction('rw', [posDb.pos_products, posDb.pos_catalog_meta], async () => {
      const existing = await posDb.pos_products
        .where('store_slug')
        .equals(storeSlug)
        .filter((p) => (tenantKey ? p.tenant_key === tenantKey : true))
        .toArray();

      for (const ep of existing) {
        await posDb.pos_products.delete(ep.inventory_id);
      }

      if (productsToSave.length > 0) {
        await posDb.pos_products.bulkPut(productsToSave);
      }

      await posDb.pos_catalog_meta.put({
        id: metaKey,
        tenant_key: tenantKey,
        store_slug: storeSlug,
        status: isExplicitlyComplete ? 'complete' : 'stale',
        catalog_complete: isExplicitlyComplete,
        cached_at: now,
        completed_at: isExplicitlyComplete ? now : undefined,
        product_count: productsToSave.length,
        schema_version: 4,
      });
    });
  } catch (err) {
    console.error('[IndexedDB] Error al cachear productos de tienda:', err);
  }
}

/**
 * Guarda clientes en IndexedDB
 */
export async function cacheCustomers(customers: any[]): Promise<void> {
  if (!Array.isArray(customers) || customers.length === 0) return;
  try {
    const list: PosOfflineCustomer[] = customers.map((c) => ({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      ci: c.document_number || c.cinit || c.ci || '',
      document_number: c.document_number || c.cinit || '',
      document_type: c.document_type,
      document_complement: c.document_complement || '',
      email: c.email || '',
    }));
    await posDb.pos_customers.bulkPut(list);
  } catch (err) {
    console.error('[IndexedDB] Error al guardar clientes:', err);
  }
}

/**
 * Obtiene los productos cacheados de una sucursal y los agrupa por categoría.
 * Aislamiento Multi-Tenant y Multi-Store estricto (Secciones 6, 7).
 */
export async function getOfflineStoreProducts(storeSlug: string, tenantKey?: string): Promise<any[]> {
  try {
    const resolvedTenant = tenantKey || getTenantSlug();
    let offlineList: PosOfflineProduct[] = [];

    if (resolvedTenant) {
      offlineList = await posDb.pos_products
        .where('store_slug')
        .equals(storeSlug)
        .filter((p) => p.tenant_key === resolvedTenant)
        .toArray();
    } else {
      offlineList = await posDb.pos_products
        .where('store_slug')
        .equals(storeSlug)
        .toArray();
    }

    if (offlineList.length === 0) return [];

    // Agrupar por categoría
    const groupsMap = new Map<string, any>();
    offlineList.forEach((prod) => {
      const catSlug = prod.category_slug || 'varios';
      if (!groupsMap.has(catSlug)) {
        groupsMap.set(catSlug, {
          category: prod.category_name || 'Varios',
          category_path: prod.category_name || 'Varios',
          slug_category: catSlug,
          color: prod.category_color || '#6366f1',
          products: [],
        });
      }

      groupsMap.get(catSlug).products.push({
        id: prod.product_id,
        inventory_id: prod.inventory_id,
        name: prod.name,
        slug: prod.slug,
        sku: prod.sku,
        barcode: prod.barcode,
        description: prod.description,
        brand: prod.brand_name,
        unit: prod.unit,
        price: prod.price,
        sale_price: prod.sale_price,
        saleprice: prod.sale_price,
        quantity: prod.quantity,
        stock_quantity: prod.stock_quantity,
        min_stock: prod.min_stock,
        // Sin imágenes
        image: null,
        thumbnail: null,
      });
    });

    return Array.from(groupsMap.values());
  } catch (err) {
    console.error('[IndexedDB] Error al leer productos offline:', err);
    return [];
  }
}

/**
 * Obtiene la tienda cacheada con aislamiento multi-tenant estricto desde pos_stores_v4 (Fase 6B.4C.2)
 */
export async function getOfflineStore(slug: string, tenantKey?: string): Promise<PosOfflineStore | undefined> {
  try {
    const resolvedTenant = tenantKey || getTenantSlug();
    if (resolvedTenant) {
      const storeCacheId = `${resolvedTenant}:${slug}`;
      const store = await posDb.pos_stores_v4.get(storeCacheId);
      if (store) {
        if (store.tenant_key && store.tenant_key !== resolvedTenant) {
          return undefined; // Tenant isolation guard
        }
        return store;
      }
      const byIndex = await posDb.pos_stores_v4
        .where('[tenant_key+slug]')
        .equals([resolvedTenant, slug])
        .first();
      if (byIndex) return byIndex;
      return undefined;
    } else {
      // Legacy fallback SOLO si no hay tenant activo (ej. diagnóstico offline sin contexto de tenant)
      // NUNCA devolver legacy si hay un tenant activo
      const legacyStore = await posDb.pos_stores_v4.get(`legacy:${slug}`);
      if (legacyStore) return legacyStore;
      return await posDb.pos_stores_v4.where('slug').equals(slug).first();
    }
  } catch (err) {
    console.error('[IndexedDB] Error al leer tienda offline:', err);
    return undefined;
  }
}

export interface OfflineStockContext {
  storeSlug?: string;
  tenantKey?: string;
}

export interface ValidateOfflineStockResult {
  valid: boolean;
  code?: 'INSUFFICIENT_STOCK' | 'UNVERIFIED_STOCK' | 'INVALID_PARAMS';
  error?: string;
}

/**
 * Valida que la cantidad solicitada no exceda el stock local conocido en IndexedDB.
 * Contextualizado estrictamente por tenant_key y store_slug.
 * Si un producto no se encuentra en el catálogo offline local, NO asume stock ilimitado (Fase 6B.4D - Secciones 22 y 46).
 */
export async function validateOfflineStock(
  items: Array<{ inventory_id?: string | number; product_id: string | number; quantity: number }>,
  context?: OfflineStockContext | string
): Promise<ValidateOfflineStockResult> {
  try {
    const storeSlug = typeof context === 'string' ? context : context?.storeSlug;
    const tenantKey = typeof context === 'object' ? context?.tenantKey : getTenantSlug();

    for (const item of items) {
      let productRecord: PosOfflineProduct | undefined;
      if (item.inventory_id) {
        const prod = await posDb.pos_products.get(item.inventory_id);
        if (prod) {
          if (!storeSlug || prod.store_slug === storeSlug) {
            if (!tenantKey || prod.tenant_key === tenantKey) {
              productRecord = prod;
            }
          }
        }
      }

      if (!productRecord) {
        const query = posDb.pos_products.where('product_id').equals(item.product_id);
        const candidates = typeof query.toArray === 'function'
          ? await query.toArray()
          : [await (query as any).first()].filter(Boolean);

        productRecord = candidates.find((p) => {
          if (storeSlug && p.store_slug !== storeSlug) return false;
          if (tenantKey && p.tenant_key !== tenantKey) return false;
          return true;
        });
      }

      // Si el producto no se encuentra en el snapshot offline:
      // NO asumir que tiene stock ilimitado (Fase 6B.4D - Sección 22 y 46).
      if (!productRecord) {
        return {
          valid: false,
          code: 'UNVERIFIED_STOCK',
          error: `No se pudo verificar el stock de este producto sin conexión. El producto no se encuentra en el catálogo local.`,
        };
      }

      const availableStock = Number(productRecord.stock_quantity ?? productRecord.quantity ?? 0);
      if (availableStock < item.quantity) {
        return {
          valid: false,
          code: 'INSUFFICIENT_STOCK',
          error: `Stock local insuficiente para '${productRecord.name}'. Disponible: ${availableStock}, solicitado: ${item.quantity}.`,
        };
      }
    }
    return { valid: true };
  } catch (err: any) {
    console.error('[IndexedDB] Error al validar stock offline:', err);
    return { valid: false, code: 'INVALID_PARAMS', error: err?.message || 'Error al validar stock local' };
  }
}

/**
 * Descuenta el stock localmente en IndexedDB al registrar una venta offline.
 * Contextualizado por tenant_key y store_slug.
 * Invariante Sección 18 & 19: Si stock < quantity ABORTA (no clamp a 0) y actualiza consistentemente stock_quantity y quantity.
 */
export async function decrementOfflineStock(
  items: Array<{ inventory_id?: string | number; product_id: string | number; quantity: number }>,
  context?: OfflineStockContext | string
): Promise<void> {
  const storeSlug = typeof context === 'string' ? context : context?.storeSlug;
  const tenantKey = typeof context === 'object' ? context?.tenantKey : getTenantSlug();

  await posDb.transaction('rw', posDb.pos_products, async () => {
    for (const item of items) {
      let productRecord: PosOfflineProduct | undefined;
      if (item.inventory_id) {
        const prod = await posDb.pos_products.get(item.inventory_id);
        if (prod) {
          if (!storeSlug || prod.store_slug === storeSlug) {
            if (!tenantKey || prod.tenant_key === tenantKey) {
              productRecord = prod;
            }
          }
        }
      }

      if (!productRecord) {
        const query = posDb.pos_products.where('product_id').equals(item.product_id);
        const candidates = typeof query.toArray === 'function'
          ? await query.toArray()
          : [await (query as any).first()].filter(Boolean);

        productRecord = candidates.find((p) => {
          if (storeSlug && p.store_slug !== storeSlug) return false;
          if (tenantKey && p.tenant_key !== tenantKey) return false;
          return true;
        });
      }

      if (productRecord) {
        const currentStock = Number(productRecord.stock_quantity ?? productRecord.quantity ?? 0);
        if (currentStock < item.quantity) {
          throw new Error(
            `Stock insuficiente en decremento local para '${productRecord.name}'. Disponible: ${currentStock}, solicitado: ${item.quantity}. Operación abortada.`
          );
        }
        const newStock = currentStock - item.quantity;
        await posDb.pos_products.update(productRecord.inventory_id, {
          stock_quantity: newStock,
          quantity: newStock,
          updated_at: Date.now(),
        });
      }
    }
  });
}

/**
 * Encola una venta en IndexedDB para sincronización diferida
 */
export async function queueOfflineSale(
  saleId: string,
  storeSlug: string,
  storeId: string | number,
  payload: any
): Promise<void> {
  try {
    const tenantKey = getTenantSlug() ?? undefined;
    // 1. Guarda de stock local contextualizada: verificar antes de encolar
    if (Array.isArray(payload.products) && payload.products.length > 0) {
      const stockCheck = await validateOfflineStock(
        payload.products.map((p: any) => ({
          inventory_id: p.inventory_id,
          product_id: p.product_id,
          quantity: Number(p.quantity) || 1,
        })),
        { storeSlug, tenantKey }
      );
      if (!stockCheck.valid) {
        throw new Error(stockCheck.error || 'Stock local insuficiente.');
      }
    }

    await posDb.pos_pending_sales.put({
      id: saleId,
      store_slug: storeSlug,
      store_id: storeId,
      endpoint: '/sales',
      tenant_key: getTenantSlug() ?? undefined,
      payload: { ...payload, id: saleId },
      created_at: Date.now(),
      status: 'pending',
      attempt_count: 0,
    });

    // Guardar en el historial local de ventas
    const productsDetails = (payload.products || []).map((p: any) => ({
      product_id: p.product_id,
      inventory_id: p.inventory_id,
      name: p.name || `Producto #${p.product_id}`,
      quantity: p.quantity,
      price: p.price,
      subtotal: p.quantity * p.price,
    }));

    await posDb.pos_sales_history.put({
      id: saleId,
      store_slug: storeSlug,
      customer_name: payload.name,
      phone: payload.phone || undefined,
      total: Number(payload.total) || 0,
      discount: Number(payload.discount) || 0,
      payment_method: payload.payment_method || 'efectivo',
      date: 'Recién registrado (Offline)',
      created_at: new Date().toISOString(),
      status: 'completado (pendiente de sincronizar)',
      is_offline: true,
      products: productsDetails,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-offline-sales-changed'));
    }
  } catch (err) {
    console.error('[IndexedDB] Error al encolar venta offline:', err);
    throw err;
  }
}

/**
 * Reintenta la reconciliación autoritativa local para ventas que el servidor ya aceptó (Fase 6B.4D - Sección 19 y 45).
 * NO hace un POST a la red ni crea una segunda venta.
 */
export async function retryLocalAuthoritativeReconciliation(
  saleId: string,
  context?: { tenantKey?: string; storeSlug?: string }
): Promise<{
  success: boolean;
  reconciledLocally: boolean;
  error?: string;
}> {
  try {
    const sale = await posDb.pos_pending_sales.get(saleId);
    if (!sale) {
      return { success: false, reconciledLocally: false, error: 'Venta no encontrada en la cola offline.' };
    }

    if (!sale.server_accepted) {
      return {
        success: false,
        reconciledLocally: false,
        error: 'Esta venta no ha sido aceptada aún por el servidor.',
      };
    }

    // Regla estricta: sale.tenant_key es estrictamente obligatorio (Fase 6B.4D.1 - Secciones 15 y 16)
    // ELIMINADO fallback a getTenantSlug() o 'default'
    if (!sale.tenant_key) {
      return {
        success: false,
        reconciledLocally: false,
        error: 'La venta no contiene tenant_key y requiere revisión manual.',
      };
    }

    // Validación de contexto: si la acción proviene del POS abierto, verificar tenant y store (Sección 16 y 17)
    if (context?.tenantKey && sale.tenant_key !== context.tenantKey) {
      return {
        success: false,
        reconciledLocally: false,
        error: 'La venta pertenece a otra organización tenant y no puede reconciliarse desde este contexto.',
      };
    }

    if (context?.storeSlug && sale.store_slug !== context.storeSlug) {
      return {
        success: false,
        reconciledLocally: false,
        error: 'La venta pertenece a otra sucursal y no puede reconciliarse desde esta tienda.',
      };
    }

    const { reconcileAuthoritativeSale } = await import('./offlineSaleReconciliation');
    const result = await reconcileAuthoritativeSale({
      saleId: sale.id,
      storeSlug: sale.store_slug,
      tenantKey: sale.tenant_key,
      affectedProducts: sale.affected_products,
      isDuplicate: true,
    });

    if (result.success && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-offline-sales-changed'));
    }

    return result;
  } catch (err: any) {
    console.error('[IndexedDB] Error en retryLocalAuthoritativeReconciliation:', err);
    return { success: false, reconciledLocally: false, error: err?.message || 'Error local al reconciliar' };
  }
}

/**
 * Recupera ventas atrapadas en 'syncing' de sesiones previas o cierres abruptos (Fase 6B.4A - Sección 15).
 * Aislado estrictamente por tenant y store (Fase 6B.4D.1 - Sección 8, 31).
 */
export async function recoverStaleSyncingSales(
  staleThresholdMs = 30000,
  context?: { tenantKey?: string; storeSlug?: string }
): Promise<number> {
  try {
    const now = Date.now();
    const staleSales = await posDb.pos_pending_sales
      .where('status')
      .equals('syncing')
      .toArray();

    let recovered = 0;
    for (const sale of staleSales) {
      if (context?.tenantKey && sale.tenant_key !== context.tenantKey) {
        continue;
      }
      if (context?.storeSlug && sale.store_slug !== context.storeSlug) {
        continue;
      }
      if (context?.tenantKey && !sale.tenant_key) {
        continue;
      }

      const elapsed = now - (sale.last_attempt_at || sale.created_at);
      if (elapsed > staleThresholdMs) {
        await posDb.pos_pending_sales.update(sale.id, {
          status: 'pending',
          error_message: 'Recuperado de sincronización interrumpida.',
        });
        recovered++;
      }
    }
    return recovered;
  } catch (err) {
    console.error('[IndexedDB] Error al recuperar ventas syncing estancadas:', err);
    return 0;
  }
}

/**
 * Obtiene desglose completo de la cola offline (pendientes, conflictos, fallidos).
 * Aislado estrictamente por store y tenant (Fase 6B.4D.1 - Secciones 7 y 30).
 */
export async function getOfflineQueueSummary(
  context?: { storeSlug?: string; tenantKey?: string } | string
): Promise<{
  pending: number;
  syncing: number;
  conflict: number;
  failed: number;
  total: number;
}> {
  try {
    const storeSlug = typeof context === 'string' ? context : context?.storeSlug;
    const tenantKey = typeof context === 'object' ? context?.tenantKey : undefined;

    let all: PosPendingSale[];
    if (storeSlug) {
      all = await posDb.pos_pending_sales.where('store_slug').equals(storeSlug).toArray();
    } else {
      all = await posDb.pos_pending_sales.toCollection().toArray();
    }

    // Aislamiento Multi-Tenant estricto cuando se especifica tenantKey (Fase 6B.4D.1 - Secciones 7 y 30)
    if (tenantKey) {
      all = all.filter((s) => s.tenant_key === tenantKey);
    }

    let pending = 0;
    let syncing = 0;
    let conflict = 0;
    let failed = 0;

    for (const item of all) {
      if (item.status === 'pending') pending++;
      else if (item.status === 'syncing') syncing++;
      else if (item.status === 'conflict') conflict++;
      else if (item.status === 'failed') failed++;
    }

    return { pending, syncing, conflict, failed, total: all.length };
  } catch (err) {
    console.error('[IndexedDB] Error al obtener resumen de cola offline:', err);
    return { pending: 0, syncing: 0, conflict: 0, failed: 0, total: 0 };
  }
}

/**
 * Obtiene todas las ventas pendientes de sincronización
 */
export async function getPendingSalesCount(storeSlug?: string): Promise<number> {
  try {
    if (storeSlug) {
      return await posDb.pos_pending_sales
        .where('store_slug')
        .equals(storeSlug)
        .count();
    }
    return await posDb.pos_pending_sales.count();
  } catch (err) {
    console.error('[IndexedDB] Error al contar ventas pendientes:', err);
    return 0;
  }
}

/**
 * Actualiza los campos de inventario de un producto en IndexedDB
 */
export async function updateOfflineProductInventory(
  inventoryId: string | number,
  updates: Partial<PosOfflineProduct>
): Promise<void> {
  try {
    await posDb.pos_products.update(inventoryId, {
      ...updates,
      updated_at: Date.now(),
    });
  } catch (err) {
    console.error('[IndexedDB] Error al actualizar producto en IndexedDB:', err);
  }
}
