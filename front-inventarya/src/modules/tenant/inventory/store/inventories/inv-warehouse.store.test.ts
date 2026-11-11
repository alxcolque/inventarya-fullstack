import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWarehouseStore } from './inv-warehouse.store';

vi.mock('@/api', () => ({
  tenantApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { tenantApi } from '@/api';

describe('useWarehouseStore (Inventory Warehouse Store)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWarehouseStore.setState({
      warehouseProducts: [],
      categories: [],
      nextCursor: null,
      hasMore: false,
      isLoadingProducts: false,
      isLoadingMore: false,
      summary: null,
      isLoadingSummary: false,
      purchaseProducts: [],
      purchaseNextCursor: null,
      purchaseHasMore: false,
      isLoadingPurchaseProducts: false,
      isLoadingMorePurchaseProducts: false,
    });
  });

  it('initializes with default pagination and summary states', () => {
    const state = useWarehouseStore.getState();
    expect(state.warehouseProducts).toEqual([]);
    expect(state.nextCursor).toBeNull();
    expect(state.hasMore).toBe(false);
    expect(state.summary).toBeNull();
    expect(state.purchaseProducts).toEqual([]);
    expect(state.purchaseNextCursor).toBeNull();
    expect(state.purchaseHasMore).toBe(false);
  });

  it('getSummary fetches and stores summary metrics', async () => {
    const mockSummary = {
      total_products: 42,
      total_stock: 580,
      total_value: 12500.5,
      out_of_stock: 3,
      low_stock: 7,
    };

    (tenantApi.get as any).mockResolvedValueOnce({
      data: mockSummary,
    });

    const result = await useWarehouseStore.getState().getSummary();

    expect(tenantApi.get).toHaveBeenCalledWith('/inventory-warehouses/summary');
    expect(result).toEqual(mockSummary);

    const state = useWarehouseStore.getState();
    expect(state.summary).toEqual(mockSummary);
    expect(state.isLoadingSummary).toBe(false);
  });

  it('getWarehouseProducts loads initial page and cursor pagination metadata', async () => {
    const mockGroups = [
      {
        category_id: 1,
        category_name: 'Bebidas',
        products: [
          { id: 'p1', inventory_id: 'w1', name: 'Product 1' },
          { id: 'p2', inventory_id: 'w2', name: 'Product 2' },
        ],
      },
    ];

    (tenantApi.get as any).mockResolvedValueOnce({
      data: {
        products: mockGroups,
        categories: [{ id: 1, name: 'Bebidas' }],
        pagination: {
          next_cursor: 'cursor-abc',
          has_more: true,
        },
      },
    });

    await useWarehouseStore.getState().getWarehouseProducts({
      search: 'term',
      brand: 'brandX',
      category: 'catY',
    });

    expect(tenantApi.get).toHaveBeenCalledWith('/inventory-warehouses', {
      params: {
        per_page: 36,
        search: 'term',
        brand: 'brandX',
        category: 'catY',
      },
    });

    const state = useWarehouseStore.getState();
    expect(state.warehouseProducts).toHaveLength(1);
    expect(state.nextCursor).toBe('cursor-abc');
    expect(state.hasMore).toBe(true);
    expect(state.registeredProductIds).toContain('p1');
    expect(state.registeredProductIds).toContain('p2');
  });

  it('loadMoreWarehouseProducts appends new products and ignores duplicates', async () => {
    useWarehouseStore.setState({
      warehouseProducts: [
        {
          category_id: 1,
          category_name: 'Bebidas',
          products: [{ id: 'p1', inventory_id: 'w1', name: 'Product 1' }],
        },
      ] as any,
      nextCursor: 'cursor-1',
      hasMore: true,
    });

    (tenantApi.get as any).mockResolvedValueOnce({
      data: {
        products: [
          {
            category_id: 1,
            category_name: 'Bebidas',
            products: [
              { id: 'p1', inventory_id: 'w1', name: 'Product 1' }, // Duplicate, must not be re-added
              { id: 'p2', inventory_id: 'w2', name: 'Product 2' }, // New product in same category
            ],
          },
        ],
        categories: [],
        pagination: {
          next_cursor: null,
          has_more: false,
        },
      },
    });

    await useWarehouseStore.getState().loadMoreWarehouseProducts();

    const state = useWarehouseStore.getState();
    expect(state.warehouseProducts).toHaveLength(1);
    expect(state.warehouseProducts[0].products).toHaveLength(2);
    expect(state.warehouseProducts[0].products[0].inventory_id).toBe('w1');
    expect(state.warehouseProducts[0].products[1].inventory_id).toBe('w2');
    expect(state.nextCursor).toBeNull();
    expect(state.hasMore).toBe(false);
  });

  it('loadMoreWarehouseProducts does not execute when hasMore is false', async () => {
    useWarehouseStore.setState({
      hasMore: false,
      nextCursor: null,
    });

    await useWarehouseStore.getState().loadMoreWarehouseProducts();
    expect(tenantApi.get).not.toHaveBeenCalled();
  });

  it('getPurchaseProducts fetches lightweight catalog with cursor pagination', async () => {
    const mockCatalog = [
      { id: 'p1', name: 'Product 1', sku: 'SKU1', is_in_warehouse: true },
      { id: 'p2', name: 'Product 2', sku: 'SKU2', is_in_warehouse: false },
    ];

    (tenantApi.get as any).mockResolvedValueOnce({
      data: {
        products: mockCatalog,
        pagination: {
          next_cursor: 'purchase-cursor-xyz',
          has_more: true,
        },
      },
    });

    await useWarehouseStore.getState().getPurchaseProducts({
      search: 'coca',
      category: 'beverages',
    });

    expect(tenantApi.get).toHaveBeenCalledWith('/inventory-warehouses/purchase-products', {
      params: {
        per_page: 30,
        search: 'coca',
        category: 'beverages',
      },
    });

    const state = useWarehouseStore.getState();
    expect(state.purchaseProducts).toHaveLength(2);
    expect(state.purchaseNextCursor).toBe('purchase-cursor-xyz');
    expect(state.purchaseHasMore).toBe(true);
  });

  it('loadMorePurchaseProducts appends unique items to purchase catalog', async () => {
    useWarehouseStore.setState({
      purchaseProducts: [
        { id: 'p1', name: 'Product 1', sku: 'SKU1' } as any,
      ],
      purchaseNextCursor: 'cur-1',
      purchaseHasMore: true,
    });

    (tenantApi.get as any).mockResolvedValueOnce({
      data: {
        products: [
          { id: 'p1', name: 'Product 1', sku: 'SKU1' },
          { id: 'p3', name: 'Product 3', sku: 'SKU3' },
        ],
        pagination: {
          next_cursor: null,
          has_more: false,
        },
      },
    });

    await useWarehouseStore.getState().loadMorePurchaseProducts();

    const state = useWarehouseStore.getState();
    expect(state.purchaseProducts).toHaveLength(2);
    expect(state.purchaseProducts.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(state.purchaseHasMore).toBe(false);
  });
});
