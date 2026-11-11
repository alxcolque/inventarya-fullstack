import { posDb } from './pos-db';

export interface AuthoritativeAffectedProduct {
  product_id: number | string;
  inventory_id?: string | number;
  stock_quantity: number;
}

export interface ReconcileSaleParams {
  saleId: string;
  storeSlug: string;
  tenantKey: string;
  affectedProducts?: AuthoritativeAffectedProduct[];
  isDuplicate?: boolean;
}

export interface ReconcileSaleResult {
  success: boolean;
  reconciledLocally: boolean;
  error?: string;
}

/**
 * Reconcilia autoritativamente el estado local de una venta offline sincronizada con el servidor.
 * Fase 6B.4B — Sincronización y Reconciliación Autoritativa.
 *
 * Invariantes:
 * 1. El servidor es la autoridad de stock (no calcular stockServidor = stockLocal - algo).
 * 2. Transacción atómica Dexie: actualiza stock de productos afectados, actualiza historial y elimina pending.
 * 3. Si falla la escritura local en IndexedDB, la venta NO se pierde ni se reenvía con UUID nuevo;
 *    se preserva como pending con error de reconciliación local para que el próximo retry (200 SALE_ALREADY_SYNCED)
 *    reintente la reconciliación autoritativa.
 * 4. Aislamiento Multi-Store: solo afecta los productos de la tienda de la venta (storeSlug).
 * 5. tenantKey es OBLIGATORIO: previene reconciliación arbitraria o cross-tenant (Fase 6B.4C.2).
 */
export async function reconcileAuthoritativeSale({
  saleId,
  storeSlug,
  tenantKey,
  affectedProducts,
  isDuplicate,
}: ReconcileSaleParams): Promise<ReconcileSaleResult> {
  // Runtime guard: tenantKey es estrictamente obligatorio (Sección 14 y 20)
  if (!tenantKey || typeof tenantKey !== 'string' || !tenantKey.trim()) {
    console.error('[Reconciliation] Error: tenantKey es obligatorio para reconciliación autoritativa.');
    return {
      success: false,
      reconciledLocally: false,
      error: 'tenantKey es obligatorio para reconciliación autoritativa',
    };
  }

  try {
    await posDb.transaction('rw', [posDb.pos_products, posDb.pos_sales_history, posDb.pos_pending_sales], async () => {
      // 1. Reconciliación autoritativa de stock en Dexie para la tienda específica
      if (storeSlug && Array.isArray(affectedProducts) && affectedProducts.length > 0) {
        for (const item of affectedProducts) {
          if (item.product_id === undefined || item.product_id === null) continue;

          // Buscar productos cacheados de esta tienda con el product_id afectado (con aislamiento multi-tenant estricto)
          const matchingProducts = await posDb.pos_products
            .where('store_slug')
            .equals(storeSlug)
            .filter((p) => {
              const matchProduct = String(p.product_id) === String(item.product_id);
              const matchTenant = p.tenant_key === tenantKey;
              return matchProduct && matchTenant;
            })
            .toArray();

          for (const prod of matchingProducts) {
            await posDb.pos_products.update(prod.inventory_id, {
              stock_quantity: Number(item.stock_quantity),
              quantity: Number(item.stock_quantity),
              updated_at: Date.now(),
            });
          }
        }
      }

      // 2. Actualizar estado en el historial local
      await posDb.pos_sales_history.update(saleId, {
        status: isDuplicate ? 'completado (sincronizado previamente)' : 'completado (sincronizado)',
      });

      // 3. Eliminar de la cola de pendientes dentro de la misma transacción atómica
      await posDb.pos_pending_sales.delete(saleId);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-offline-sales-changed'));
    }

    return {
      success: true,
      reconciledLocally: true,
    };
  } catch (error: any) {
    console.error(`[Reconciliation] Error en transacción Dexie para venta ${saleId}:`, error);

    // Si falla la transacción local, preservar la venta en pos_pending_sales para reintento de reconciliación
    try {
      await posDb.pos_pending_sales.update(saleId, {
        status: 'pending',
        server_accepted: true,
        affected_products: affectedProducts as any,
        last_error_code: 'LOCAL_RECONCILIATION_FAILED',
        last_error_message: 'Venta registrada en servidor; pendiente reconciliar datos locales.',
        error_message: 'Venta registrada en servidor; pendiente reconciliar datos locales.',
        last_attempt_at: Date.now(),
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-offline-sales-changed'));
      }
    } catch (saveErr) {
      console.error(`[Reconciliation] No se pudo actualizar estado de error local para venta ${saleId}:`, saveErr);
    }

    return {
      success: false,
      reconciledLocally: false,
      error: error?.message || 'Fallo de reconciliación local en IndexedDB.',
    };
  }
}
