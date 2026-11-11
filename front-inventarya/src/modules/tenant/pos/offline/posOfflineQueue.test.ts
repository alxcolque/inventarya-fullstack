import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  posDb,
  validateOfflineStock,
  decrementOfflineStock,
  queueOfflineSale,
  recoverStaleSyncingSales,
  getOfflineQueueSummary,
} from './pos-db';
import { saleRefundApi } from '@/modules/tenant/sales/api/saleRefundApi';

describe('posOfflineQueue (Fase 6B.4A - Secciones 8, 9, 10, 15, 19, 27, 28, 44)', () => {
  let inMemoryProducts: Map<any, any>;
  let inMemoryPendingSales: Map<any, any>;
  let inMemorySalesHistory: Map<any, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    inMemoryProducts = new Map();
    inMemoryPendingSales = new Map();
    inMemorySalesHistory = new Map();

    // Mock pos_products
    vi.spyOn(posDb.pos_products, 'get').mockImplementation(async (id: any) => {
      return inMemoryProducts.get(id);
    });

    vi.spyOn(posDb.pos_products, 'where').mockImplementation((index: string) => {
      return {
        equals: (val: any) => ({
          first: async () => {
            for (const prod of inMemoryProducts.values()) {
              if (prod[index] === val) return prod;
            }
            return undefined;
          },
          toArray: async () => {
            const list: any[] = [];
            for (const prod of inMemoryProducts.values()) {
              if (prod[index] === val) list.push(prod);
            }
            return list;
          },
          delete: async () => {
            for (const [k, prod] of inMemoryProducts.entries()) {
              if (prod[index] === val) inMemoryProducts.delete(k);
            }
          },
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

    vi.spyOn(posDb, 'transaction').mockImplementation(async (_mode: any, _tables: any, fn: any) => {
      return await fn();
    });

    // Mock pos_pending_sales
    vi.spyOn(posDb.pos_pending_sales, 'put').mockImplementation(async (item: any) => {
      inMemoryPendingSales.set(item.id, { ...item });
      return item.id;
    });

    vi.spyOn(posDb.pos_pending_sales, 'get').mockImplementation(async (id: any) => {
      return inMemoryPendingSales.get(id);
    });

    vi.spyOn(posDb.pos_pending_sales, 'where').mockImplementation((index: string) => {
      return {
        equals: (val: any) => ({
          toArray: async () => {
            const list: any[] = [];
            for (const item of inMemoryPendingSales.values()) {
              if (item[index] === val) list.push(item);
            }
            return list;
          },
          count: async () => {
            let count = 0;
            for (const item of inMemoryPendingSales.values()) {
              if (item[index] === val) count++;
            }
            return count;
          },
        }),
      } as any;
    });

    vi.spyOn(posDb.pos_pending_sales, 'update').mockImplementation(async (id: any, changes: any) => {
      const item = inMemoryPendingSales.get(id);
      if (item) {
        Object.assign(item, changes);
      }
      return 1;
    });

    vi.spyOn(posDb.pos_pending_sales, 'toCollection').mockImplementation(() => ({
      toArray: async () => Array.from(inMemoryPendingSales.values()),
    } as any));

    vi.spyOn(posDb.pos_pending_sales, 'count').mockImplementation(async () => {
      return inMemoryPendingSales.size;
    });

    // Mock pos_sales_history
    vi.spyOn(posDb.pos_sales_history, 'put').mockImplementation(async (item: any) => {
      inMemorySalesHistory.set(item.id, { ...item });
      return item.id;
    });
  });

  it('1. Dexie DB operates on version 2 or higher with updated schema', () => {
    expect(posDb.verno).toBeGreaterThanOrEqual(2);
    expect(posDb.pos_pending_sales.schema.indexes.some((idx) => idx.name === 'last_attempt_at')).toBe(true);
  });

  it('2. Local Stock Guard (Sección 19 y 44): rejects when requested exceeds local stock', async () => {
    inMemoryProducts.set('inv-101', {
      inventory_id: 'inv-101',
      product_id: 'prod-101',
      store_slug: 'tienda-test',
      tenant_key: 'inventarya',
      name: 'Bebida Energizante',
      slug: 'bebida-energizante',
      sku: 'BEB-101',
      unit: 'Unidad',
      price: 15,
      sale_price: 15,
      quantity: 2,
      stock_quantity: 2, // Stock local = 2
      updated_at: Date.now(),
    });

    // Intento de venta de 5 unidades con stock disponible 2
    const checkFail = await validateOfflineStock([
      { inventory_id: 'inv-101', product_id: 'prod-101', quantity: 5 },
    ]);
    expect(checkFail.valid).toBe(false);
    expect(checkFail.error).toContain('Stock local insuficiente');

    // Intento de venta de 2 unidades con stock disponible 2
    const checkOk = await validateOfflineStock([
      { inventory_id: 'inv-101', product_id: 'prod-101', quantity: 2 },
    ]);
    expect(checkOk.valid).toBe(true);
  });

  it('3. queueOfflineSale rejects and does NOT enqueue if local stock is insufficient', async () => {
    inMemoryProducts.set('inv-102', {
      inventory_id: 'inv-102',
      product_id: 'prod-102',
      store_slug: 'tienda-test',
      tenant_key: 'inventarya',
      name: 'Galletas Choco',
      slug: 'galletas-choco',
      sku: 'GAL-102',
      unit: 'Paquete',
      price: 5,
      sale_price: 5,
      quantity: 1,
      stock_quantity: 1, // Stock local = 1
      updated_at: Date.now(),
    });

    const saleUuid = 'uuid-stock-insufficient-01';
    const payload = {
      id: saleUuid,
      products: [{ product_id: 'prod-102', inventory_id: 'inv-102', quantity: 3, price: 5 }],
      total: 15,
      name: 'Cliente Prueba',
    };

    await expect(
      queueOfflineSale(saleUuid, 'tienda-test', 'store-1', payload)
    ).rejects.toThrow(/Stock local insuficiente/);

    // Comprobar que NO se encoló en pos_pending_sales
    expect(inMemoryPendingSales.size).toBe(0);

    // Comprobar que el stock local NO quedó modificado o en negativo
    const product = inMemoryProducts.get('inv-102');
    expect(product?.stock_quantity).toBe(1);
  });

  it('4. queueOfflineSale enqueues valid sale with initial attempt_count: 0 and status: pending', async () => {
    inMemoryProducts.set('inv-103', {
      inventory_id: 'inv-103',
      product_id: 'prod-103',
      store_slug: 'tienda-test',
      tenant_key: 'inventarya',
      name: 'Café Molido',
      slug: 'cafe-molido',
      sku: 'CAF-103',
      unit: 'Bolsa',
      price: 25,
      sale_price: 25,
      quantity: 10,
      stock_quantity: 10,
      updated_at: Date.now(),
    });

    const saleUuid = 'uuid-sale-valid-01';
    const payload = {
      id: saleUuid,
      products: [{ product_id: 'prod-103', inventory_id: 'inv-103', quantity: 2, price: 25 }],
      total: 50,
      name: 'Cliente Juan',
    };

    await queueOfflineSale(saleUuid, 'tienda-test', 'store-1', payload);
    await decrementOfflineStock([{ inventory_id: 'inv-103', product_id: 'prod-103', quantity: 2 }]);

    const record = inMemoryPendingSales.get(saleUuid);
    expect(record).toBeDefined();
    expect(record?.status).toBe('pending');
    expect(record?.attempt_count).toBe(0);
    expect(record?.payload.id).toBe(saleUuid); // Preservación estricta de UUID

    // Stock local decrementado a 8
    const updatedProd = inMemoryProducts.get('inv-103');
    expect(updatedProd?.stock_quantity).toBe(8);
  });

  it('5. Stale Syncing Recovery (Sección 15 y 39): resets orphaned syncing sales back to pending', async () => {
    const saleUuid = 'uuid-stuck-syncing-01';
    inMemoryPendingSales.set(saleUuid, {
      id: saleUuid,
      store_slug: 'tienda-test',
      store_id: 'store-1',
      endpoint: '/sales',
      payload: { id: saleUuid, total: 10 },
      created_at: Date.now() - 60000,
      last_attempt_at: Date.now() - 45000, // 45 segundos atrás
      status: 'syncing',
      attempt_count: 1,
    });

    // Recuperar con umbral de 30 segundos
    const recoveredCount = await recoverStaleSyncingSales(30000);
    expect(recoveredCount).toBe(1);

    const record = inMemoryPendingSales.get(saleUuid);
    expect(record?.status).toBe('pending');
    expect(record?.error_message).toContain('Recuperado');
  });

  it('6. Queue summary reflects pending, conflict, and failed counts accurately', async () => {
    inMemoryPendingSales.set('s-1', {
      id: 's-1',
      store_slug: 'tienda-test',
      store_id: 'store-1',
      endpoint: '/sales',
      payload: {},
      created_at: 100,
      status: 'pending',
    });
    inMemoryPendingSales.set('s-2', {
      id: 's-2',
      store_slug: 'tienda-test',
      store_id: 'store-1',
      endpoint: '/sales',
      payload: {},
      created_at: 200,
      status: 'conflict',
    });
    inMemoryPendingSales.set('s-3', {
      id: 's-3',
      store_slug: 'tienda-test',
      store_id: 'store-1',
      endpoint: '/sales',
      payload: {},
      created_at: 300,
      status: 'failed',
    });

    const summary = await getOfflineQueueSummary('tienda-test');
    expect(summary.pending).toBe(1);
    expect(summary.conflict).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.total).toBe(3);
  });

  it('7. Offline Refund Guard (Sección 27): throws and blocks createRefund when offline', async () => {
    const originalNavigator = global.navigator;
    try {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        configurable: true,
      });

      await expect(
        saleRefundApi.createRefund('sale-uuid-test', { items: [] })
      ).rejects.toThrow(/Las devoluciones comerciales requieren conexión activa/);
    } finally {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    }
  });

  it('8. Offline Cancellation Guard (Sección 28): throws and blocks cancelSale when offline', async () => {
    const originalNavigator = global.navigator;
    try {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        configurable: true,
      });

      await expect(
        saleRefundApi.cancelSale('sale-uuid-test', { reason: 'Test cancel offline' })
      ).rejects.toThrow(/La cancelación comercial requiere conexión activa/);
    } finally {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    }
  });
});
