import { tenantApi } from '@/api';
import { getTenantSlug } from '@/utils/tenant';
import { posDb, PosCatalogMeta, PosOfflineProduct } from './pos-db';
import { getLeafCategoryName } from '../utils/category';

/**
 * Determina si los parámetros de consulta corresponden a una solicitud de catálogo base completo,
 * o si contienen filtros comerciales (búsqueda, categoría, marca, etc.).
 * Fase 6B.4C — Sección 13.
 *
 * Invariante: Una búsqueda, categoría o marca filtra los datos.
 * Parámetros técnicos de paginación (per_page, cursor, page) NO son filtros comerciales.
 */
export function isBaseCatalogQuery(params?: Record<string, any>): boolean {
  if (!params) return true;

  // Búsqueda por texto (nombre, sku, código de barras)
  if (params.search && String(params.search).trim() !== '') return false;

  // Filtro por categoría (ID o slug)
  if (params.categories && String(params.categories).trim() !== '') return false;
  if (params.category && String(params.category).trim() !== '') return false;

  // Filtro por marca (ID o slug)
  if (params.brands && String(params.brands).trim() !== '') return false;
  if (params.brand && String(params.brand).trim() !== '') return false;

  // Filtro de stock comercial
  if (params.stock_filter && params.stock_filter !== 'all') return false;

  return true;
}

/**
 * Obtiene la metadata del catálogo offline para la combinación (tenant_key, store_slug)
 */
export async function getOfflineCatalogMeta(
  tenantKey?: string,
  storeSlug?: string
): Promise<PosCatalogMeta | undefined> {
  const resolvedTenant = tenantKey || getTenantSlug();
  if (!resolvedTenant || !storeSlug) return undefined;
  try {
    return await posDb.pos_catalog_meta.get(`${resolvedTenant}:${storeSlug}`);
  } catch (err) {
    console.error('[OfflineCatalog] Error al leer metadata de catálogo:', err);
    return undefined;
  }
}

/**
 * Comprueba si existe un snapshot completo válido para la combinación (tenant_key, store_slug)
 */
export async function isCatalogSnapshotComplete(
  tenantKey?: string,
  storeSlug?: string
): Promise<boolean> {
  const meta = await getOfflineCatalogMeta(tenantKey, storeSlug);
  return Boolean(meta?.catalog_complete);
}

/**
 * Fusiona dos colecciones de grupos de productos respetando categorías y deduplicando por inventory_id
 */
export function mergeProductGroups(existingGroups: any[], newGroups: any[]): any[] {
  const groupsMap = new Map<string, any>();

  const processGroups = (groups: any[]) => {
    for (const group of groups) {
      const key = String(group.category_id || group.slug_category || 'varios');
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          category_id: group.category_id,
          category: group.category,
          category_path: group.category_path,
          slug_category: group.slug_category,
          color: group.color || '#6366f1',
          products: [],
        });
      }
      const targetGroup = groupsMap.get(key);
      const existingProductIds = new Set(targetGroup.products.map((p: any) => String(p.inventory_id ?? p.id)));

      for (const prod of group.products || []) {
        const pId = String(prod.inventory_id ?? prod.id);
        if (!existingProductIds.has(pId)) {
          existingProductIds.add(pId);
          targetGroup.products.push(prod);
        }
      }
    }
  };

  processGroups(existingGroups);
  processGroups(newGroups);

  return Array.from(groupsMap.values());
}

export interface SaveCatalogSnapshotParams {
  tenantKey?: string;
  storeSlug: string;
  productGroups: any[];
  isComplete?: boolean;
}

export interface SaveCatalogSnapshotResult {
  success: boolean;
  productCount: number;
  reservationDeficit?: number;
  deficits?: Array<{ product_id: string; server_stock: number; reserved: number; deficit: number }>;
  error?: string;
}

/**
 * Determina si una venta pendiente debe descontar stock localmente sobre un snapshot fresco del servidor.
 * Fase 6B.4C.1 — Secciones 10, 11, 12:
 *
 * Invariante:
 * A. Ventas locales NO confirmadas por servidor -> RESERVAR (true).
 * B. Ventas ya aceptadas por servidor (server_accepted = true o LOCAL_RECONCILIATION_FAILED) -> NO RESERVAR (false),
 *    evitando DOBLE DESCUENTO porque el catálogo recién descargado ya tiene el stock decrementado.
 * C. Ventas en conflicto o fallidas -> NO RESERVAR (false).
 */
export function shouldReservePendingSaleLocally(sale: any): boolean {
  if (!sale) return false;
  if (sale.server_accepted === true) return false;
  if (sale.last_error_code === 'LOCAL_RECONCILIATION_FAILED') return false;
  if (sale.status === 'conflict' || sale.status === 'failed') return false;
  if (sale.status === 'pending' || sale.status === 'syncing') return true;
  return false;
}

/**
 * Guarda o actualiza atómicamente el snapshot del catálogo en Dexie.
 *
 * Invariantes (Fase 6B.4C / 6B.4C.1):
 * 1. Aislamiento Multi-Tenant y Multi-Store estricto: solo modifica y consulta datos de (tenantKey, storeSlug).
 * 2. Transacción Atómica Dexie: si falla, no se produce borrado parcial y el snapshot previo sobrevive.
 * 3. Ventas Offline Pendientes: solo descuenta ventas no confirmadas por el servidor para evitar doble descuento.
 * 4. Detección de Déficit de Reserva: si reserved > serverStock, muestra 0 pero registra el déficit internamente.
 */
export async function saveCatalogSnapshot({
  tenantKey,
  storeSlug,
  productGroups,
  isComplete = true,
}: SaveCatalogSnapshotParams): Promise<SaveCatalogSnapshotResult> {
  const resolvedTenant = tenantKey || getTenantSlug();
  if (!resolvedTenant || !storeSlug) {
    return {
      success: false,
      productCount: 0,
      error: 'Tenant o store slug no disponible',
    };
  }
  const metaKey = `${resolvedTenant}:${storeSlug}`;

  try {
    // 1. Consultar ventas pendientes locales no confirmadas por el servidor
    let reservedStockByProduct = new Map<string, number>();
    try {
      const allPendingSales = await posDb.pos_pending_sales.toArray();
      const relevantSales = allPendingSales.filter(
        (s) => s.tenant_key === resolvedTenant && s.store_slug === storeSlug && shouldReservePendingSaleLocally(s)
      );
      for (const sale of relevantSales) {
        if (Array.isArray(sale.payload?.products)) {
          for (const item of sale.payload.products) {
            const pId = String(item.product_id);
            const qty = Number(item.quantity) || 0;
            reservedStockByProduct.set(pId, (reservedStockByProduct.get(pId) || 0) + qty);
          }
        }
      }
    } catch (e) {
      console.warn('[OfflineCatalog] No se pudo leer ventas pendientes para calcular reserva:', e);
    }

    // 2. Aplanar productos del snapshot candidato y detectar déficits de reserva
    let totalReservationDeficit = 0;
    const reservationDeficits: Array<{ product_id: string; server_stock: number; reserved: number; deficit: number }> = [];
    const productsToSave: PosOfflineProduct[] = [];
    const now = Date.now();

    productGroups.forEach((group: any) => {
      const rawCategory = group.category || group.category_path;
      const categoryName = getLeafCategoryName(rawCategory);
      const categorySlug = group.slug_category;
      const categoryColor = group.color || '#6366f1';

      (group.products || []).forEach((p: any) => {
        const invId = p.inventory_id ?? p.id;
        if (!invId) return;

        const prodId = String(p.id ?? invId);
        const serverStock = Number(p.stock_quantity ?? p.quantity) || 0;
        const reserved = reservedStockByProduct.get(prodId) || 0;

        if (reserved > serverStock) {
          const deficit = reserved - serverStock;
          totalReservationDeficit += deficit;
          reservationDeficits.push({
            product_id: prodId,
            server_stock: serverStock,
            reserved,
            deficit,
          });
        }

        // El stock efectivo local descuenta ventas locales pendientes que el backend aún no procesó
        const effectiveStock = Math.max(0, serverStock - reserved);

        productsToSave.push({
          inventory_id: invId,
          store_slug: storeSlug,
          tenant_key: resolvedTenant,
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
          quantity: effectiveStock,
          stock_quantity: effectiveStock,
          min_stock: Number(p.min_stock) || 0,
          expiration_date: p.expiration_date || null,
          updated_at: now,
        });
      });
    });

    // 3. Commit Atómico en IndexedDB (Transacción Dexie RW)
    await posDb.transaction('rw', [posDb.pos_products, posDb.pos_catalog_meta], async () => {
      // Eliminar únicamente productos del store y tenant específicos (estricto)
      const existing = await posDb.pos_products
        .where('store_slug')
        .equals(storeSlug)
        .filter((p) => p.tenant_key === resolvedTenant)
        .toArray();

      for (const item of existing) {
        await posDb.pos_products.delete(item.inventory_id);
      }

      if (productsToSave.length > 0) {
        await posDb.pos_products.bulkPut(productsToSave);
      }

      await posDb.pos_catalog_meta.put({
        id: metaKey,
        tenant_key: resolvedTenant,
        store_slug: storeSlug,
        status: isComplete ? 'complete' : 'stale',
        catalog_complete: isComplete,
        cached_at: now,
        completed_at: isComplete ? now : undefined,
        product_count: productsToSave.length,
        reservation_deficit: totalReservationDeficit,
        schema_version: 3,
      });
    });

    return {
      success: true,
      productCount: productsToSave.length,
      reservationDeficit: totalReservationDeficit,
      deficits: reservationDeficits,
    };
  } catch (error: any) {
    console.error(`[OfflineCatalog] Error en commit atómico de catálogo (${storeSlug}):`, error);
    return {
      success: false,
      productCount: 0,
      reservationDeficit: 0,
      error: error?.message || 'Error en commit atómico de IndexedDB',
    };
  }
}

// Mutex canónico por tenant_key + store_slug para evitar refresh concurrentes en la misma tienda
const activeRefreshPromises = new Map<string, Promise<{ success: boolean; productCount: number; error?: string }>>();

export interface RefreshCatalogOptions {
  tenantKey?: string;
  perPage?: number;
  force?: boolean;
}

/**
 * Descarga el catálogo completo recorriendo el cursor de paginación de forma controlada
 * y lo guarda atómicamente en IndexedDB.
 * Fase 6B.4C.1 — Secciones 1, 3, 4, 5, 14.
 */
export async function refreshCompleteOfflineCatalog(
  slug: string,
  options?: RefreshCatalogOptions
): Promise<{ success: boolean; productCount: number; error?: string }> {
  if (!slug) {
    return { success: false, productCount: 0, error: 'Store slug requerido' };
  }

  const tenantKey = options?.tenantKey || getTenantSlug();
  if (!tenantKey) {
    return { success: false, productCount: 0, error: 'Tenant key no disponible' };
  }
  const lockKey = `${tenantKey}:${slug}`;

  // Mutex: si ya hay un refresh en curso para este tenant+tienda, reutilizar la promesa activa
  const existingPromise = activeRefreshPromises.get(lockKey);
  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = (async () => {
    try {
      return await executeCatalogRefresh(slug, tenantKey, options);
    } finally {
      activeRefreshPromises.delete(lockKey);
    }
  })();

  activeRefreshPromises.set(lockKey, refreshPromise);
  return refreshPromise;
}

async function executeCatalogRefresh(
  slug: string,
  tenantKey: string,
  options?: RefreshCatalogOptions
): Promise<{ success: boolean; productCount: number; error?: string }> {
  const metaKey = `${tenantKey}:${slug}`;

  try {
    // Registrar inicio del refresco en metadata
    const prevMeta = await posDb.pos_catalog_meta.get(metaKey);
    await posDb.pos_catalog_meta.put({
      id: metaKey,
      tenant_key: tenantKey,
      store_slug: slug,
      status: 'refreshing',
      catalog_complete: prevMeta?.catalog_complete ?? false,
      cached_at: prevMeta?.cached_at ?? 0,
      product_count: prevMeta?.product_count ?? 0,
      started_at: Date.now(),
      last_refresh_attempt_at: Date.now(),
      schema_version: 3,
    });

    let nextCursor: string | null = null;
    let allGroups: any[] = [];
    const perPage = options?.perPage ?? 100;
    let pageCount = 0;
    const MAX_PAGES = 100; // Salvaguarda: hasta 10,000 productos
    let authoritativeEndReached = false;
    const visitedCursors = new Set<string>();

    while (pageCount < MAX_PAGES) {
      pageCount++;
      const params: any = { per_page: perPage };
      if (nextCursor) {
        params.cursor = nextCursor;
      }

      const res = await tenantApi.get(`/inventory-stores-get-by-store-slug/${slug}`, { params });
      const data = res.data;

      if (Array.isArray(data.products)) {
        allGroups = mergeProductGroups(allGroups, data.products);
      }

      const pagination = data?.pagination;
      const serverHasMore = Boolean(pagination?.has_more);
      const serverNextCursor = pagination?.next_cursor ? String(pagination.next_cursor) : null;

      // Condición 1: Finalización autoritativa exitosa
      if (!serverHasMore) {
        authoritativeEndReached = true;
        break;
      }

      // Condición 2 (Caso Crítico A): has_more=true pero next_cursor es nulo -> inconsistente
      if (serverHasMore && !serverNextCursor) {
        throw new Error('[OfflineCatalog] Respuesta inconsistente del servidor: has_more=true pero next_cursor es nulo.');
      }

      // Condición 3 (Sección 4): Protección contra cursores repetidos
      if (visitedCursors.has(serverNextCursor!)) {
        throw new Error(`[OfflineCatalog] Cursor repetido detectado (${serverNextCursor}). Abortando refresh por loop en servidor.`);
      }
      visitedCursors.add(serverNextCursor!);

      nextCursor = serverNextCursor;
    }

    // Condición 4 (Caso Crítico B): si alcanzó MAX_PAGES sin authoritativeEndReached -> truncado
    if (!authoritativeEndReached) {
      throw new Error(`[OfflineCatalog] Límite de páginas alcanzado (${MAX_PAGES}) sin completar el catálogo del servidor.`);
    }

    // Una vez demostrado el recorrido autoritativo completo, realizar commit atómico
    const saveRes = await saveCatalogSnapshot({
      tenantKey,
      storeSlug: slug,
      productGroups: allGroups,
      isComplete: true,
    });

    return saveRes;
  } catch (error: any) {
    console.error(`[OfflineCatalog] Error al descargar catálogo completo (${slug}):`, error);

    // En caso de fallo anormal, el snapshot previo sobrevive intacto (Sección 5).
    try {
      const prevMeta = await posDb.pos_catalog_meta.get(metaKey);
      await posDb.pos_catalog_meta.put({
        id: metaKey,
        tenant_key: tenantKey,
        store_slug: slug,
        status: prevMeta?.catalog_complete ? 'stale' : 'error',
        catalog_complete: prevMeta?.catalog_complete ?? false,
        cached_at: prevMeta?.cached_at ?? 0,
        product_count: prevMeta?.product_count ?? 0,
        last_refresh_attempt_at: Date.now(),
        last_refresh_error: error?.message || 'Error de conexión durante descarga de catálogo',
        schema_version: 3,
      });
    } catch (saveErr) {
      console.error('[OfflineCatalog] Error al registrar estado de fallo en metadata:', saveErr);
    }

    return {
      success: false,
      productCount: 0,
      error: error?.message || 'Error al descargar catálogo completo del servidor',
    };
  }
}

