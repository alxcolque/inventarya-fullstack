<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryWarehouseRequest;
use App\Models\Category;
use App\Models\InventoryWarehouse;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryWarehouseController extends Controller
{
    /**
     * Display a listing of inventory in warehouse grouped by category.
     * Supports cursor pagination (?per_page=36&cursor=...) and server-side filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->get('search');
        $brands = $request->get('brands');
        $categories = $request->get('categories');
        $perPage = $request->get('per_page');
        $cursorRaw = $request->get('cursor');

        $inventoryQuery = InventoryWarehouse::with([
            'product.category',
            'product.brand',
            'location',
            'supplier',
        ])
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        if ($search) {
            $searchTerm = trim($search);
            $words = array_filter(explode(' ', $searchTerm));
            $inventoryQuery->whereHas('product', function ($query) use ($words, $searchTerm) {
                $query->where(function ($q) use ($words, $searchTerm) {
                    $q->where('name', 'like', '%' . $searchTerm . '%')
                        ->orWhere('sku', 'like', '%' . $searchTerm . '%')
                        ->orWhere('barcode', 'like', '%' . $searchTerm . '%')
                        ->orWhereHas('brand', function ($b) use ($searchTerm) {
                            $b->where('name', 'like', '%' . $searchTerm . '%');
                        })
                        ->orWhereHas('category', function ($c) use ($searchTerm) {
                            $c->where('name', 'like', '%' . $searchTerm . '%');
                        });

                    if (count($words) > 1) {
                        $q->orWhere(function ($allWordsQuery) use ($words) {
                            foreach ($words as $word) {
                                $allWordsQuery->where(function ($sub) use ($word) {
                                    $sub->where('name', 'like', '%' . $word . '%')
                                        ->orWhere('sku', 'like', '%' . $word . '%')
                                        ->orWhere('barcode', 'like', '%' . $word . '%')
                                        ->orWhereHas('brand', function ($b) use ($word) {
                                            $b->where('name', 'like', '%' . $word . '%');
                                        })
                                        ->orWhereHas('category', function ($c) use ($word) {
                                            $c->where('name', 'like', '%' . $word . '%');
                                        });
                                });
                            }
                        });
                    }
                });
            });
        }

        if ($brands) {
            $inventoryQuery->whereHas('product.brand', function ($query) use ($brands) {
                $query->where('slug', $brands)
                    ->orWhere('name', 'like', '%' . $brands . '%');
                if (is_numeric($brands)) {
                    $query->orWhere('id', (int) $brands);
                } elseif (\Illuminate\Support\Str::isUuid($brands)) {
                    $query->orWhere('id', $brands);
                }
            });
        }

        if ($categories) {
            $cat = Category::where('slug', $categories)
                ->orWhere('id', is_numeric($categories) ? (int) $categories : -1)
                ->first();
            if ($cat) {
                $childIds = Category::where('parent_id', $cat->id)->pluck('id')->toArray();
                $allCatIds = array_merge([$cat->id], $childIds);
                $inventoryQuery->whereHas('product', function ($query) use ($allCatIds) {
                    $query->whereIn('category_id', $allCatIds);
                });
            } else {
                $inventoryQuery->whereHas('product.category', function ($query) use ($categories) {
                    $query->where('slug', $categories)
                        ->orWhere('name', 'like', '%' . $categories . '%');
                    if (is_numeric($categories)) {
                        $query->orWhere('id', (int) $categories);
                    } elseif (\Illuminate\Support\Str::isUuid($categories)) {
                        $query->orWhere('id', $categories);
                    }
                });
            }
        }

        // Keyset cursor pagination (created_at desc, id desc)
        if ($cursorRaw) {
            $cur = json_decode($cursorRaw, true);
            if (isset($cur['ts'], $cur['id'])) {
                $rawTs = (string) $cur['ts'];
                if (str_contains($rawTs, 'T')) {
                    try {
                        $rawTs = \Carbon\Carbon::parse($rawTs)->setTimezone(config('app.timezone', 'America/La_Paz'))->format('Y-m-d H:i:s');
                    } catch (\Throwable $e) {
                        $rawTs = date('Y-m-d H:i:s', strtotime($rawTs));
                    }
                }
                $curId = (string) $cur['id'];
                $inventoryQuery->where(function ($q) use ($rawTs, $curId) {
                    $q->where('created_at', '<', $rawTs)
                        ->orWhere(function ($q2) use ($rawTs, $curId) {
                            $q2->where('created_at', '=', $rawTs)
                                ->where('id', '<', $curId);
                        });
                });
            }
        }

        $hasMore = false;
        $nextCursor = null;

        if ($perPage) {
            $limit = (int) $perPage;
            $items = $inventoryQuery->limit($limit + 1)->get();
            $hasMore = $items->count() > $limit;
            if ($hasMore) {
                $items = $items->take($limit);
            }
            /** @var \App\Models\InventoryWarehouse|null $last */
            $last = $items->last();
            $rawTs = null;
            if ($last instanceof \Illuminate\Database\Eloquent\Model) {
                $rawTs = $last->getRawOriginal('created_at') ?: ($last->created_at ? $last->created_at->format('Y-m-d H:i:s') : null);
            } elseif ($last && isset($last->created_at)) {
                $rawTs = $last->created_at instanceof \DateTimeInterface
                    ? $last->created_at->format('Y-m-d H:i:s')
                    : (string) $last->created_at;
            }
            $nextCursor = ($hasMore && $last)
                ? json_encode(['ts' => (string) $rawTs, 'id' => (string) $last->id])
                : null;
        } else {
            $items = $inventoryQuery->get();
        }

        $products = [];

        foreach ($items as $item) {
            $supplier = $item->supplier;
            $product = $item->product;
            $category = $product?->category;
            $leafCategory = $this->getLeafCategoryName($category?->name);
            $brand = $product?->brand;
            $location = $item->location;

            $products[] = [
                'inventory_id' => $item->id,
                'id' => $product?->id,
                'name' => $product?->name,
                'slug' => $product?->slug,
                'sku' => $product?->sku,
                'barcode' => $product?->barcode,
                'thumbnail' => $product?->image_thumb ?? $product?->image,
                'quantity' => $item->quantity,
                'price' => $item->price,
                'sale_price' => $item->sale_price ?? 0.00,
                'saleprice' => $item->sale_price ?? 0.00,
                'stock' => $item->stock_quantity,
                'stock_quantity' => $item->stock_quantity,
                'min_stock' => $item->min_stock,
                'restock_date' => $item->restock_date,
                'brand' => $brand?->name ?? 'Sin marca',
                'brand_id' => $brand?->id,
                'brand_slug' => $brand?->slug,
                'category_id' => $category?->id,
                'category_slug' => $category?->slug,
                'category' => $leafCategory,
                'category_path' => $leafCategory,
                'subcategory' => $leafCategory,
                'color' => $category?->color ?? '#6366f1',
                'supplier' => $supplier?->name ?? 'Sin proveedor',
                'supplier_id' => $supplier?->id,
                'unit' => $item->unit,
                'location_id' => $item->location_id,
                'location' => $location?->name,
                'location_path' => $location?->full_path,
                'metadata' => $item->metadata,
            ];
        }

        // Agrupar por category_id
        $groupedByCategory = collect($products)->groupBy('category_id');
        $formatted = $groupedByCategory->map(function ($groupItems, $categoryId) {
            $first = $groupItems->first();
            return [
                'category_id' => $categoryId,
                'category_slug' => $first['category_slug'] ?? null,
                'category' => $first['category'],
                'category_path' => $first['category_path'],
                'subcategory_id' => $categoryId,
                'subcategory' => $first['category'],
                'color' => $first['color'],
                'products' => $groupItems->map(function ($item) {
                    return [
                        'id' => $item['id'],
                        'inventory_id' => $item['inventory_id'],
                        'name' => $item['name'],
                        'sku' => $item['sku'] ?? null,
                        'barcode' => $item['barcode'] ?? null,
                        'price' => $item['price'],
                        'sale_price' => $item['sale_price'] ?? 0.00,
                        'saleprice' => $item['saleprice'] ?? 0.00,
                        'slug' => $item['slug'],
                        'thumbnail' => $item['thumbnail'],
                        'quantity' => $item['quantity'],
                        'stock_quantity' => $item['stock_quantity'],
                        'min_stock' => $item['min_stock'],
                        'restock_date' => $item['restock_date'],
                        'brand' => $item['brand'],
                        'brand_id' => $item['brand_id'],
                        'brand_slug' => $item['brand_slug'] ?? null,
                        'category' => $item['category'],
                        'category_id' => $item['category_id'],
                        'category_slug' => $item['category_slug'] ?? null,
                        'category_path' => $item['category_path'],
                        'color' => $item['color'],
                        'stock' => $item['stock'],
                        'supplier' => $item['supplier'],
                        'supplier_id' => $item['supplier_id'],
                        'unit' => $item['unit'],
                        'location_id' => $item['location_id'],
                        'location' => $item['location'],
                        'location_path' => $item['location_path'],
                        'metadata' => $item['metadata'],
                    ];
                })->values()
            ];
        })->values();

        // Categorías únicas de almacén mediante consulta directa a BD con conteo real
        $categoryCounts = InventoryWarehouse::join('products', 'products.id', '=', 'inventory_warehouses.product_id')
            ->whereNotNull('products.category_id')
            ->select('products.category_id', DB::raw('COUNT(*) as total_items'))
            ->groupBy('products.category_id')
            ->pluck('total_items', 'products.category_id');

        $categoriesList = Category::whereIn('id', $categoryCounts->keys())
            ->select(['id', 'name', 'color', 'slug'])
            ->get()
            ->map(fn($cat) => [
                'id' => $cat->id,
                'name' => $this->getLeafCategoryName($cat->name),
                'color' => $cat->color ?? '#6366f1',
                'slug' => $cat->slug,
                'product_count' => (int) ($categoryCounts[$cat->id] ?? 0),
            ])
            ->values();

        $response = [
            'categories' => $categoriesList,
            'products' => $formatted
        ];

        if ($perPage) {
            $response['pagination'] = [
                'has_more' => $hasMore,
                'next_cursor' => $nextCursor,
                'per_page' => (int) $perPage,
            ];
        }

        return response()->json($response);
    }

    /**
     * Get aggregated warehouse inventory KPIs (summary) calculated directly in SQL.
     */
    public function summary(Request $request): JsonResponse
    {
        $raw = InventoryWarehouse::selectRaw('
            COUNT(*) as total_products,
            COALESCE(SUM(COALESCE(stock_quantity, 0)), 0) as total_stock,
            COALESCE(SUM(COALESCE(stock_quantity, 0) * COALESCE(price, 0)), 0) as total_value,
            COALESCE(SUM(COALESCE(stock_quantity, 0) * COALESCE(sale_price, 0)), 0) as total_retail_value,
            COALESCE(SUM(CASE WHEN stock_quantity <= 0 OR stock_quantity IS NULL THEN 1 ELSE 0 END), 0) as out_of_stock,
            COALESCE(SUM(CASE WHEN stock_quantity > 0 AND min_stock > 0 AND stock_quantity <= min_stock THEN 1 ELSE 0 END), 0) as low_stock
        ')->first();

        $totalProducts = (int) ($raw->total_products ?? 0);
        $totalStock = (float) ($raw->total_stock ?? 0);
        $totalValue = (float) ($raw->total_value ?? 0);
        $totalRetailValue = (float) ($raw->total_retail_value ?? 0);
        $outOfStock = (int) ($raw->out_of_stock ?? 0);
        $lowStock = (int) ($raw->low_stock ?? 0);

        return response()->json([
            'total_products' => $totalProducts,
            'total_stock' => $totalStock,
            'total_value' => $totalValue,
            'total_retail_value' => $totalRetailValue,
            'out_of_stock' => $outOfStock,
            'low_stock' => $lowStock,
            // Aliases camelCase
            'totalProducts' => $totalProducts,
            'totalStock' => $totalStock,
            'totalValue' => $totalValue,
            'totalRetailValue' => $totalRetailValue,
            'outOfStock' => $outOfStock,
            'lowStock' => $lowStock,
        ]);
    }

    /**
     * Get lightweight paginated products catalog specifically for Register Purchase modal.
     */
    public function purchaseProducts(Request $request): JsonResponse
    {
        $search = $request->get('search');
        $category = $request->get('category');
        $perPage = (int) $request->get('per_page', 30);
        $cursorRaw = $request->get('cursor');

        $query = Product::with([
            'category:id,name,slug,color,parent_id',
            'brand:id,name,slug',
        ])
            ->withExists('inventoryWarehouses as is_in_warehouse')
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        if ($search) {
            $words = array_filter(explode(' ', trim($search)));
            foreach ($words as $word) {
                $query->where(function ($sub) use ($word) {
                    $sub->where('name', 'like', '%' . $word . '%')
                        ->orWhere('sku', 'like', '%' . $word . '%')
                        ->orWhere('barcode', 'like', '%' . $word . '%')
                        ->orWhereHas('brand', function ($b) use ($word) {
                            $b->where('name', 'like', '%' . $word . '%');
                        })
                        ->orWhereHas('category', function ($c) use ($word) {
                            $c->where('name', 'like', '%' . $word . '%');
                        });
                });
            }
        }

        if ($category && $category !== 'all') {
            $query->where(function ($q) use ($category) {
                if (is_numeric($category)) {
                    $q->where('category_id', (int) $category);
                } else {
                    $q->where('category_id', $category)
                        ->orWhereHas('category', function ($c) use ($category) {
                            $c->where('slug', $category)
                                ->orWhere('name', 'like', '%' . $category . '%');
                        });
                }
            });
        }

        if ($cursorRaw) {
            $cur = json_decode($cursorRaw, true);
            if (isset($cur['ts'], $cur['id'])) {
                $rawTs = (string) $cur['ts'];
                if (str_contains($rawTs, 'T')) {
                    try {
                        $rawTs = \Carbon\Carbon::parse($rawTs)->setTimezone(config('app.timezone', 'America/La_Paz'))->format('Y-m-d H:i:s');
                    } catch (\Throwable $e) {
                        $rawTs = date('Y-m-d H:i:s', strtotime($rawTs));
                    }
                }
                $curId = (string) $cur['id'];
                $query->where(function ($q) use ($rawTs, $curId) {
                    $q->where('created_at', '<', $rawTs)
                        ->orWhere(function ($q2) use ($rawTs, $curId) {
                            $q2->where('created_at', '=', $rawTs)
                                ->where('id', '<', $curId);
                        });
                });
            }
        }

        $items = $query->limit($perPage + 1)->get();
        $hasMore = $items->count() > $perPage;
        if ($hasMore) {
            $items = $items->take($perPage);
        }

        /** @var \App\Models\Product|null $last */
        $last = $items->last();
        $rawTs = null;
        if ($last instanceof \Illuminate\Database\Eloquent\Model) {
            $rawTs = $last->getRawOriginal('created_at') ?: ($last->created_at ? $last->created_at->format('Y-m-d H:i:s') : null);
        } elseif ($last && isset($last->created_at)) {
            $rawTs = $last->created_at instanceof \DateTimeInterface
                ? $last->created_at->format('Y-m-d H:i:s')
                : (string) $last->created_at;
        }
        $nextCursor = ($hasMore && $last)
            ? json_encode(['ts' => (string) $rawTs, 'id' => (string) $last->id])
            : null;

        $productIds = $items->pluck('id')->all();
        $latestWarehouseInfo = !empty($productIds)
            ? InventoryWarehouse::whereIn('product_id', $productIds)
                ->orderBy('updated_at', 'desc')
                ->get()
                ->keyBy('product_id')
            : collect();

        $products = $items->map(function ($product) use ($latestWarehouseInfo) {
            $wh = $latestWarehouseInfo->get($product->id);
            $leafCategory = $this->getLeafCategoryName($product->category?->name);
            return [
                'id' => $product->id,
                'name' => $product->name,
                'slug' => $product->slug,
                'sku' => $product->sku,
                'barcode' => $product->barcode,
                'thumbnail' => $product->image_thumb ?? $product->image,
                'image' => $product->image,
                'category_id' => $product->category_id,
                'category' => $leafCategory,
                'category_path' => $leafCategory,
                'color' => $product->category?->color ?? '#6366f1',
                'brand_id' => $product->brand_id,
                'brand' => $product->brand?->name ?? 'DESCONOCIDO',
                'price' => $wh ? (float) $wh->price : 0.00,
                'sale_price' => $wh ? (float) ($wh->sale_price ?? 0.00) : 0.00,
                'saleprice' => $wh ? (float) ($wh->sale_price ?? 0.00) : 0.00,
                'unit' => $wh ? ($wh->unit ?: 'Unidad') : 'Unidad',
                'is_in_warehouse' => (bool) $product->is_in_warehouse,
                'created_at' => $product->created_at,
            ];
        })->values();

        return response()->json([
            'products' => $products,
            'pagination' => [
                'has_more' => $hasMore,
                'next_cursor' => $nextCursor,
                'per_page' => $perPage,
            ],
        ]);
    }

    /**
     * Get list of product IDs already registered in warehouse inventory.
     */
    public function getRegisteredProductIds(): JsonResponse
    {
        $ids = InventoryWarehouse::pluck('product_id')->unique()->values();
        return response()->json($ids);
    }

    /**
     * Bulk register purchase of multiple products into warehouse inventory.
     * Optimized to avoid N queries by preloading existing warehouse records.
     */
    public function bulkPurchase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'nullable|exists:suppliers,id',
            'location_id' => 'nullable|exists:locations,id',
            'invoice_number' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.price' => 'nullable|numeric|min:0',
            'items.*.sale_price' => 'nullable|numeric|min:0',
            'items.*.saleprice' => 'nullable|numeric|min:0',
            'items.*.quantity' => 'nullable|numeric|min:0',
            'items.*.unit' => 'nullable|string|max:100',
            'items.*.min_stock' => 'nullable|numeric|min:0',
            'items.*.supplier_id' => 'nullable|exists:suppliers,id',
            'items.*.location_id' => 'nullable|exists:locations,id',
        ], [
            'items.required' => 'Debe agregar al menos un producto a la compra',
            'items.min' => 'Debe agregar al menos un producto a la compra',
            'items.*.product_id.required' => 'El producto es requerido',
            'items.*.product_id.exists' => 'El producto seleccionado no existe',
            'items.*.price.numeric' => 'El precio debe ser un número válido',
        ]);

        return DB::transaction(function () use ($validated) {
            $commonSupplierId = $validated['supplier_id'] ?? null;
            $commonLocationId = $validated['location_id'] ?? null;
            $invoiceNumber = $validated['invoice_number'] ?? null;
            $notes = $validated['notes'] ?? null;

            $registeredCount = 0;
            $updatedCount = 0;

            // Preload existing warehouse records for all product IDs in one single query
            $productIds = collect($validated['items'])->pluck('product_id')->unique()->all();
            $existingRecords = InventoryWarehouse::whereIn('product_id', $productIds)->get();

            // Build map keyed by "product_id|unit"
            $existingMap = [];
            foreach ($existingRecords as $rec) {
                $key = $rec->product_id . '|' . trim((string) $rec->unit);
                $existingMap[$key] = $rec;
            }

            foreach ($validated['items'] as $item) {
                $productId = $item['product_id'];
                $price = isset($item['price']) && $item['price'] !== '' ? (float) $item['price'] : 0.00;
                $salePrice = isset($item['sale_price']) && $item['sale_price'] !== ''
                    ? (float) $item['sale_price']
                    : (isset($item['saleprice']) && $item['saleprice'] !== '' ? (float) $item['saleprice'] : null);
                $qty = isset($item['quantity']) && (float) $item['quantity'] > 0 ? (float) $item['quantity'] : 1;
                $unit = !empty($item['unit']) ? trim($item['unit']) : 'Unidad';
                $supplierId = !empty($item['supplier_id']) ? $item['supplier_id'] : $commonSupplierId;
                $locationId = !empty($item['location_id']) ? $item['location_id'] : $commonLocationId;
                $minStock = isset($item['min_stock']) && $item['min_stock'] !== '' ? (float) $item['min_stock'] : 0;

                $meta = [];
                if ($invoiceNumber) {
                    $meta['invoice_number'] = $invoiceNumber;
                }
                if ($notes) {
                    $meta['notes'] = $notes;
                }
                $meta['last_purchase_at'] = now()->toDateTimeString();

                $mapLookupKey = $productId . '|' . $unit;
                $warehouseItem = $existingMap[$mapLookupKey] ?? null;

                if ($warehouseItem) {
                    // Update existing stock
                    $warehouseItem->quantity += $qty;
                    $warehouseItem->stock_quantity += $qty;
                    $warehouseItem->price = $price;
                    if ($salePrice !== null) {
                        $warehouseItem->sale_price = $salePrice;
                    }
                    $warehouseItem->unit = $unit;
                    $warehouseItem->restock_date = now();
                    if ($supplierId) {
                        $warehouseItem->supplier_id = $supplierId;
                    }
                    if ($locationId) {
                        $warehouseItem->location_id = $locationId;
                    }
                    if ($minStock > 0) {
                        $warehouseItem->min_stock = $minStock;
                    }
                    $currentMeta = is_array($warehouseItem->metadata) ? $warehouseItem->metadata : [];
                    $warehouseItem->metadata = array_merge($currentMeta, $meta);
                    $warehouseItem->save();
                    $updatedCount++;
                } else {
                    // Create new warehouse entry
                    $newItem = InventoryWarehouse::create([
                        'product_id' => $productId,
                        'unit' => $unit,
                        'quantity' => $qty,
                        'price' => $price,
                        'sale_price' => $salePrice ?? 0.00,
                        'supplier_id' => $supplierId,
                        'location_id' => $locationId,
                        'min_stock' => $minStock,
                        'restock_date' => now(),
                        'stock_quantity' => $qty,
                        'metadata' => !empty($meta) ? $meta : null,
                    ]);
                    $existingMap[$mapLookupKey] = $newItem;
                    $registeredCount++;
                }
            }

            $total = $registeredCount + $updatedCount;
            $msg = "Compra de $total producto(s) registrada correctamente.";
            if ($registeredCount > 0 && $updatedCount > 0) {
                $msg = "Compra registrada: $registeredCount producto(s) ingresados y $updatedCount producto(s) reabastecidos con éxito.";
            }

            return response()->json([
                'message' => $msg,
                'registered_count' => $registeredCount,
                'updated_count' => $updatedCount,
            ], 201);
        });
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(InventoryWarehouseRequest $request): JsonResponse
    {
        $data = $request->validated();
        if (isset($data['saleprice']) && !isset($data['sale_price'])) {
            $data['sale_price'] = $data['saleprice'];
        }
        unset($data['saleprice']);

        $data['unit'] = !empty($data['unit']) ? trim($data['unit']) : 'Unidad';

        // Si ya existe la combinación de producto y unidad, reabastecemos el stock
        $exists = InventoryWarehouse::where('product_id', $data['product_id'])
            ->where('unit', $data['unit'])
            ->first();
        if ($exists) {
            $qty = isset($data['quantity']) && (float) $data['quantity'] > 0 ? (float) $data['quantity'] : 1;
            $exists->quantity += $qty;
            $exists->stock_quantity += $qty;
            if (isset($data['price']) && $data['price'] !== '') {
                $exists->price = (float) $data['price'];
            }
            if (isset($data['sale_price']) && $data['sale_price'] !== '') {
                $exists->sale_price = (float) $data['sale_price'];
            }
            if (!empty($data['supplier_id'])) {
                $exists->supplier_id = $data['supplier_id'];
            }
            if (!empty($data['location_id'])) {
                $exists->location_id = $data['location_id'];
            }
            $exists->restock_date = now();
            $exists->save();
            $exists->load(['product.category', 'location']);

            return response()->json([
                'message' => 'Stock actualizado en almacén correctamente para esta unidad',
                'inventoryWarehouse' => $exists
            ], 200);
        }
        $data['price'] = isset($data['price']) && $data['price'] !== '' ? (float) $data['price'] : 0.00;
        $data['sale_price'] = isset($data['sale_price']) && $data['sale_price'] !== '' ? (float) $data['sale_price'] : 0.00;
        $data['quantity'] = isset($data['quantity']) && (float) $data['quantity'] > 0 ? (float) $data['quantity'] : 1;
        $data['supplier_id'] = !empty($data['supplier_id']) ? $data['supplier_id'] : null;
        $data['location_id'] = !empty($data['location_id']) ? $data['location_id'] : null;
        $data['min_stock'] = !empty($data['min_stock']) ? (float) $data['min_stock'] : 0;
        $data['restock_date'] = now();
        $data['stock_quantity'] = isset($data['stock_quantity']) && $data['stock_quantity'] !== '' ? (float) $data['stock_quantity'] : (float) $data['quantity'];

        $inventoryWarehouse = InventoryWarehouse::create($data);
        $inventoryWarehouse->load(['product.category', 'location']);

        return response()->json([
            'message' => 'Compra registrada y producto agregado al almacén correctamente',
            'inventoryWarehouse' => $inventoryWarehouse
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $inventoryWarehouse = InventoryWarehouse::with(['product.category', 'location', 'supplier'])->find($id);
        if (!$inventoryWarehouse) {
            return response()->json(['message' => 'Registro de almacén no encontrado'], 404);
        }

        return response()->json($inventoryWarehouse);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(InventoryWarehouseRequest $request, string $id): JsonResponse
    {
        $data = $request->validated();
        if (isset($data['saleprice']) && !isset($data['sale_price'])) {
            $data['sale_price'] = $data['saleprice'];
        }
        unset($data['saleprice']);
        $inventoryWarehouse = InventoryWarehouse::find($id);
        if (!$inventoryWarehouse) {
            return response()->json(['message' => 'Registro de almacén no encontrado'], 404);
        }

        $inventoryWarehouse->update($data);
        $inventoryWarehouse->load(['product.category', 'location']);

        return response()->json([
            'message' => 'Producto de almacén actualizado correctamente',
            'inventoryWarehouse' => $inventoryWarehouse
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $inventoryWarehouse = InventoryWarehouse::find($id);
        if (!$inventoryWarehouse) {
            return response()->json(['message' => 'Registro de almacén no encontrado'], 404);
        }

        $inventoryWarehouse->delete();

        return response()->json([
            'message' => 'Producto eliminado del almacén correctamente',
        ], 200);
    }

    /**
     * Remove all inventory records from warehouse.
     */
    public function destroyAll(): JsonResponse
    {
        $deleted = InventoryWarehouse::query()->delete();

        return response()->json([
            'message' => "Se eliminaron {$deleted} registros de inventario del almacén correctamente",
            'deleted_count' => $deleted,
        ], 200);
    }

    /**
     * Remove all out-of-stock products from warehouse.
     */
    public function destroyOutOfStock(): JsonResponse
    {
        $deleted = InventoryWarehouse::where('stock_quantity', '<=', 0)
            ->orWhereNull('stock_quantity')
            ->delete();

        return response()->json([
            'message' => "Se eliminaron {$deleted} productos agotados del almacén correctamente",
            'deleted_count' => $deleted,
        ], 200);
    }

    /**
     * Obtener el nombre simple de la categoría final (nodo hoja sin ancestros concatenados).
     */
    private function getLeafCategoryName(?string $name): string
    {
        if ($name === null || trim($name) === '') {
            return 'Sin categoría';
        }

        $trimmed = trim($name);
        if (str_contains($trimmed, '>')) {
            $parts = explode('>', $trimmed);
            $last = trim(end($parts));
            return $last !== '' ? $last : $trimmed;
        }

        if (str_contains($trimmed, '/')) {
            $parts = explode('/', $trimmed);
            $last = trim(end($parts));
            return $last !== '' ? $last : $trimmed;
        }

        return $trimmed;
    }
}
