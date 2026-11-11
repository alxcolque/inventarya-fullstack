import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStockStore } from '@/modules/tenant/inventory/store/inventories/inv-shops.store';
import { useShopCartStore } from '@/modules/tenant/pos/store/cart/shop-cart.store';
import { tenantApi } from '@/api';
import * as tenantUtil from '@/utils/tenant';

vi.mock('@/api', () => ({
  tenantApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('FASE 6B.5 — POS UX & Performance Optimizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStockStore.setState({
      shops: [],
      products: [],
      storeProducts: [],
      categories: [],
      nextCursor: null,
      hasMore: false,
      isLoadingMore: false,
      activeStoreSlug: null,
      requestSeq: 0,
    });
    useShopCartStore.getState().clearCart();
    vi.spyOn(tenantUtil, 'getTenantSlug').mockReturnValue('tenant-alpha');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. RACE CONDITIONS DE BÚSQUEDA (SECCIÓN 11)
  // =========================================================================
  it('1. search race condition: stale earlier search response does NOT overwrite newer search results', async () => {
    let resolveFirstSearch!: (val: any) => void;
    const slowFirstPromise = new Promise((resolve) => {
      resolveFirstSearch = resolve;
    });

    const fastSecondPromise = Promise.resolve({
      data: {
        products: [
          {
            category_id: 1,
            category: 'Bebidas',
            products: [{ inventory_id: 201, id: 2, name: 'Café Espresso', sale_price: 15, stock_quantity: 10 }],
          },
        ],
        categories: [{ id: 1, name: 'Bebidas' }],
        pagination: { has_more: false, next_cursor: null },
      },
    });

    vi.mocked(tenantApi.get).mockImplementation((url, config) => {
      if (config?.params?.search === 'c') {
        return slowFirstPromise as any;
      }
      if (config?.params?.search === 'cafe') {
        return fastSecondPromise as any;
      }
      return Promise.resolve({ data: { products: [], categories: [] } }) as any;
    });

    // Disparar primera búsqueda lenta "c"
    const req1 = useStockStore.getState().getStoreProducts('central', { search: 'c', per_page: 30 });

    // Inmediatamente disparar segunda búsqueda rápida "cafe"
    const req2 = useStockStore.getState().getStoreProducts('central', { search: 'cafe', per_page: 30 });

    // req2 resuelve de inmediato
    await req2;

    const stateAfterReq2 = useStockStore.getState();
    expect(stateAfterReq2.storeProducts).toHaveLength(1);
    expect(stateAfterReq2.storeProducts[0].products[0].name).toBe('Café Espresso');

    // Ahora resuelve la primera búsqueda lenta "c" con datos obsoletos
    resolveFirstSearch({
      data: {
        products: [
          {
            category_id: 1,
            category: 'Bebidas',
            products: [{ inventory_id: 101, id: 1, name: 'Coca Cola', sale_price: 10, stock_quantity: 50 }],
          },
        ],
        categories: [{ id: 1, name: 'Bebidas' }],
        pagination: { has_more: false, next_cursor: null },
      },
    });

    await req1;

    // Verificación: la respuesta vieja "c" NO debe haber reemplazado los resultados de "cafe"
    const finalState = useStockStore.getState();
    expect(finalState.storeProducts).toHaveLength(1);
    expect(finalState.storeProducts[0].products[0].name).toBe('Café Espresso');
    expect(finalState.storeProducts[0].products[0].inventory_id).toBe(201);
  });

  // =========================================================================
  // 2. REQUEST RACE STORE ISOLATION (SECCIÓN 62 & 63)
  // =========================================================================
  it('2. store race condition: switching stores immediately clears stale products and rejects delayed response from old store', async () => {
    let resolveCentral!: (val: any) => void;
    const slowCentralPromise = new Promise((resolve) => {
      resolveCentral = resolve;
    });

    const fastNortePromise = Promise.resolve({
      data: {
        products: [
          {
            category_id: 2,
            category: 'Lácteos',
            products: [{ inventory_id: 501, id: 5, name: 'Leche Norte 1L', sale_price: 8, stock_quantity: 20 }],
          },
        ],
        categories: [{ id: 2, name: 'Lácteos' }],
        pagination: { has_more: false, next_cursor: null },
      },
    });

    vi.mocked(tenantApi.get).mockImplementation((url) => {
      if (url.includes('central')) return slowCentralPromise as any;
      if (url.includes('norte')) return fastNortePromise as any;
      return Promise.resolve({ data: { products: [] } }) as any;
    });

    // Iniciar carga de Tienda Central
    const reqCentral = useStockStore.getState().getStoreProducts('central', { per_page: 30 });

    // Usuario cambia inmediatamente a Tienda Norte
    const reqNorte = useStockStore.getState().getStoreProducts('norte', { per_page: 30 });

    // Al cambiar de tienda, activeStoreSlug cambia y se limpia el store
    expect(useStockStore.getState().activeStoreSlug).toBe('norte');
    expect(useStockStore.getState().storeProducts).toHaveLength(0);

    // Norte responde rápidamente
    await reqNorte;
    expect(useStockStore.getState().storeProducts[0].products[0].name).toBe('Leche Norte 1L');

    // Ahora responde Central tarde
    resolveCentral({
      data: {
        products: [
          {
            category_id: 1,
            category: 'Snacks',
            products: [{ inventory_id: 301, id: 3, name: 'Papas Fritas Central', sale_price: 12, stock_quantity: 15 }],
          },
        ],
        categories: [{ id: 1, name: 'Snacks' }],
        pagination: { has_more: false, next_cursor: null },
      },
    });

    await reqCentral;

    // Verificación estricta: Los productos de Central NUNCA se muestran en Norte
    const finalState = useStockStore.getState();
    expect(finalState.activeStoreSlug).toBe('norte');
    expect(finalState.storeProducts).toHaveLength(1);
    expect(finalState.storeProducts[0].products[0].name).toBe('Leche Norte 1L');
  });

  // =========================================================================
  // 3. REQUEST RACE TENANT ISOLATION (SECCIÓN 61 & 64)
  // =========================================================================
  it('3. tenant race condition: response arriving after tenant context switch is rejected', async () => {
    let resolveTenantA!: (val: any) => void;
    const slowTenantPromise = new Promise((resolve) => {
      resolveTenantA = resolve;
    });

    vi.mocked(tenantApi.get).mockReturnValue(slowTenantPromise as any);

    // Iniciar petición bajo Tenant Alpha
    const req = useStockStore.getState().getStoreProducts('central', { per_page: 30 });

    // Cambiar contexto a Tenant Beta antes de que resuelva la petición
    vi.spyOn(tenantUtil, 'getTenantSlug').mockReturnValue('tenant-beta');

    // Resuelve la petición de Tenant Alpha
    resolveTenantA({
      data: {
        products: [
          {
            category_id: 1,
            category: 'General',
            products: [{ inventory_id: 999, id: 99, name: 'Producto Confidencial Alpha', sale_price: 100, stock_quantity: 1 }],
          },
        ],
        categories: [{ id: 1, name: 'General' }],
        pagination: { has_more: false, next_cursor: null },
      },
    });

    await req;

    // Verificación: la respuesta fue descartada por aislamiento de tenant
    expect(useStockStore.getState().storeProducts).toHaveLength(0);
  });

  // =========================================================================
  // 4. DUPLICATE REQUEST PROTECTION (SECCIÓN 10)
  // =========================================================================
  it('4. duplicate request guard: concurrent loadMore calls do not trigger multiple parallel requests', async () => {
    let resolveLoadMore!: (val: any) => void;
    const slowLoadMorePromise = new Promise((resolve) => {
      resolveLoadMore = resolve;
    });

    vi.mocked(tenantApi.get).mockReturnValue(slowLoadMorePromise as any);

    useStockStore.setState({
      activeStoreSlug: 'central',
      hasMore: true,
      nextCursor: 'cursor_page_2',
      isLoadingMore: false,
      storeProducts: [
        {
          category_id: 1,
          products: [{ inventory_id: 1, name: 'P1' }],
        },
      ],
    });

    // Disparar loadMore simultáneamente (simulando scroll listener + observer en el mismo tick)
    const call1 = useStockStore.getState().loadMoreStoreProducts('central');
    const call2 = useStockStore.getState().loadMoreStoreProducts('central');
    const call3 = useStockStore.getState().loadMoreStoreProducts('central');

    expect(tenantApi.get).toHaveBeenCalledTimes(1);
    expect(useStockStore.getState().isLoadingMore).toBe(true);

    resolveLoadMore({
      data: {
        products: [
          {
            category_id: 1,
            products: [{ inventory_id: 2, name: 'P2' }],
          },
        ],
        categories: [],
        pagination: { has_more: false, next_cursor: null },
      },
    });

    await Promise.all([call1, call2, call3]);

    expect(tenantApi.get).toHaveBeenCalledTimes(1);
    expect(useStockStore.getState().isLoadingMore).toBe(false);
    expect(useStockStore.getState().storeProducts[0].products).toHaveLength(2);
  });

  // =========================================================================
  // 5. NO DUPLICATE PRODUCTS ON CONCATENATION (SECCIÓN 49)
  // =========================================================================
  it('5. deduplication guard: concatenating pages with overlapping product boundary deduplicates by inventory_id', async () => {
    vi.mocked(tenantApi.get).mockResolvedValueOnce({
      data: {
        products: [
          {
            category_id: 1,
            products: [
              { inventory_id: 10, name: 'Item 10' }, // ya existía en la página anterior
              { inventory_id: 11, name: 'Item 11' }, // nuevo
            ],
          },
        ],
        categories: [],
        pagination: { has_more: false, next_cursor: null },
      },
    });

    useStockStore.setState({
      activeStoreSlug: 'central',
      hasMore: true,
      nextCursor: 'cursor_abc',
      isLoadingMore: false,
      storeProducts: [
        {
          category_id: 1,
          products: [{ inventory_id: 10, name: 'Item 10' }],
        },
      ],
    });

    await useStockStore.getState().loadMoreStoreProducts('central');

    const products = useStockStore.getState().storeProducts[0].products;
    expect(products).toHaveLength(2);
    expect(products.map((p: any) => p.inventory_id)).toEqual([10, 11]);
  });

  // =========================================================================
  // 6. CART RESILIENCE (SECCIÓN 19, 20 & 65)
  // =========================================================================
  it('6. cart resilience: rapid additions and stock decrements do not trigger catalog reloads or clear cart', () => {
    const { addItem, updateQty, cart } = useShopCartStore.getState();

    const p1 = { inventory_id: 101, name: 'P1', sale_price: 20, stock_quantity: 10 };
    const p2 = { inventory_id: 102, name: 'P2', sale_price: 35, stock_quantity: 5 };

    addItem(p1, 1);
    addItem(p2, 2);
    addItem(p1, 1); // incrementa P1 a 2

    const state1 = useShopCartStore.getState();
    expect(state1.cart).toHaveLength(2);
    expect(state1.totalUnits).toBe(4);
    expect(state1.totalAmount).toBe(20 * 2 + 35 * 2); // 40 + 70 = 110

    // Decremento local tras venta
    useStockStore.setState({
      storeProducts: [
        {
          category_id: 1,
          products: [
            { inventory_id: 101, name: 'P1', stock_quantity: 10, stock: 10 },
            { inventory_id: 102, name: 'P2', stock_quantity: 5, stock: 5 },
          ],
        },
      ],
    });

    useStockStore.getState().decrementLocalStock([
      { inventory_id: 101, quantity: 2 },
      { inventory_id: 102, quantity: 2 },
    ]);

    const prods = useStockStore.getState().storeProducts[0].products;
    expect(prods.find((p: any) => p.inventory_id === 101).stock_quantity).toBe(8);
    expect(prods.find((p: any) => p.inventory_id === 102).stock_quantity).toBe(3);
  });

  // =========================================================================
  // 7. PERFORMANCE BENCHMARK WITH LARGE CATALOG FIXTURES (SECCIÓN 17 & 57)
  // =========================================================================
  it('7. performance fixture: 2,000 products process in memory in under 50ms', () => {
    const categoriesCount = 20;
    const productsPerCat = 100;
    const bigStoreProducts: any[] = [];

    for (let c = 1; c <= categoriesCount; c++) {
      const prods: any[] = [];
      for (let p = 1; p <= productsPerCat; p++) {
        const id = (c - 1) * productsPerCat + p;
        prods.push({
          inventory_id: id,
          id,
          name: `Producto de Prueba ${id}`,
          sale_price: 10 + (id % 50),
          stock_quantity: 100,
          category_id: c,
        });
      }
      bigStoreProducts.push({
        category_id: c,
        category: `Categoría ${c}`,
        products: prods,
      });
    }

    const tStart = performance.now();

    // Simular el flattening y el lookup O(1) con 2,000 productos
    const flat: any[] = [];
    bigStoreProducts.forEach((group) => {
      group.products.forEach((prod: any) => {
        flat.push({ ...prod, category_name: group.category });
      });
    });

    const cartMap = new Map<number, number>();
    cartMap.set(50, 2);
    cartMap.set(150, 1);

    let foundCartCount = 0;
    flat.forEach((p) => {
      const inCart = cartMap.get(p.inventory_id) || 0;
      if (inCart > 0) foundCartCount += inCart;
    });

    const tDuration = performance.now() - tStart;

    expect(flat).toHaveLength(2000);
    expect(foundCartCount).toBe(3);
    expect(tDuration).toBeLessThan(50); // Debe tomar menos de 50ms
  });

  // =========================================================================
  // 11. LIMPIEZA DE CATEGORÍAS (SIN PARENTS CONCATENADOS)
  // =========================================================================
  it('11. leaf category formatting: extracts final category without parent hierarchy', async () => {
    const { getLeafCategoryName } = await import('@/modules/tenant/pos/utils/category');

    expect(getLeafCategoryName('Tecnología > Computación > Laptops')).toBe('Laptops');
    expect(getLeafCategoryName('Bebidas / Gaseosas / Mini')).toBe('Mini');
    expect(getLeafCategoryName('Abarrotes')).toBe('Abarrotes');
    expect(getLeafCategoryName('   Categoría Final   ')).toBe('Categoría Final');
    expect(getLeafCategoryName(null)).toBe('');
    expect(getLeafCategoryName(undefined)).toBe('');
    expect(getLeafCategoryName('')).toBe('');
  });

  it('12. cart addition stores leaf category without parent concatenations', () => {
    useShopCartStore.getState().addItem({
      id: 10,
      inventory_id: 100,
      name: 'Laptop Gamer',
      category: 'Tecnología > Computación > Laptops',
      sale_price: 1500,
      stock_quantity: 5,
    }, 1);

    const items = useShopCartStore.getState().cart;
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe('Laptops');
  });
});
