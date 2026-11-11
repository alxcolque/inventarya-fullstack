<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryStoreRequest;
use App\Models\InventoryStore;
use App\Models\InventoryWarehouse;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryStoreController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $inventoryStores = InventoryStore::with(['product.category', 'store', 'location'])->get();
        return response()->json($inventoryStores);
    }

    /**
     * Get inventory store items by store slug.
     * Supports optional cursor-based pagination via ?per_page=N&cursor=LAST_ID.
     * Without per_page, returns all records (offline-first compatible).
     */
    public function getInventoryStoreSlug(Request $request, string $slug): JsonResponse
    {
        $search   = $request->get('search');
        $brands   = $request->get('brands');
        $cats     = $request->get('categories');
        $perPage  = $request->get('per_page');   // null → sin paginación (offline full-load)
        $cursorRaw = $request->get('cursor');     // JSON: {"ts":"...","id":"..."}

        $slugWithHyphen     = str_replace('_', '-', $slug);
        $slugWithUnderscore = str_replace('-', '_', $slug);

        $storeQuery = Store::where('slug', $slug)
            ->orWhere('slug', $slugWithHyphen)
            ->orWhere('slug', $slugWithUnderscore);

        if (\Illuminate\Support\Str::isUuid($slug)) {
            $storeQuery->orWhere('id', $slug);
        }

        $store = $storeQuery->first();

        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        $inventoryQuery = InventoryStore::with([
            'product.category',
            'product.brand',
            'location',
        ])
        ->where('store_id', $store->id)
        ->orderBy('created_at', 'asc')
        ->orderBy('id', 'asc');  // desempate con UUID para orden estable

        if ($search) {
            $words = array_filter(explode(' ', trim($search)));
            $inventoryQuery->whereHas('product', function ($q) use ($words) {
                foreach ($words as $word) {
                    $q->where(function ($sub) use ($word) {
                        $sub->where('name', 'ilike', '%' . $word . '%')
                            ->orWhere('sku', 'ilike', '%' . $word . '%')
                            ->orWhere('barcode', 'ilike', '%' . $word . '%');
                    });
                }
            });
        }

        if ($brands) {
            $inventoryQuery->whereHas('product.brand', function ($q) use ($brands) {
                $q->where('slug', $brands)
                  ->orWhere('name', 'ilike', '%' . $brands . '%');
                if (is_numeric($brands)) {
                    $q->orWhere('id', (int) $brands);
                } elseif (\Illuminate\Support\Str::isUuid($brands)) {
                    $q->orWhere('id', $brands);
                }
            });
        }

        if ($cats) {
            $inventoryQuery->whereHas('product.category', function ($q) use ($cats) {
                $q->where('slug', $cats)
                  ->orWhere('name', 'ilike', '%' . $cats . '%');
                if (is_numeric($cats)) {
                    $q->orWhere('id', (int) $cats);
                } elseif (\Illuminate\Support\Str::isUuid($cats)) {
                    $q->orWhere('id', $cats);
                }
            });
        }

        // Cursor compuesto (created_at, id) — estable aunque varios registros tengan igual timestamp
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
                    $q->where('created_at', '>', $rawTs)
                      ->orWhere(function ($q2) use ($rawTs, $curId) {
                          $q2->where('created_at', '=', $rawTs)
                             ->where('id', '>', $curId);
                      });
                });
            }
        }

        // Obtener un elemento extra para saber si hay más páginas
        $hasMore    = false;
        $nextCursor = null;

        if ($perPage) {
            $limit    = (int) $perPage;
            $items    = $inventoryQuery->limit($limit + 1)->get();
            $hasMore  = $items->count() > $limit;
            if ($hasMore) {
                $items = $items->take($limit);
            }
            /** @var \App\Models\InventoryStore|null $last */
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

        // Construir array plano de productos
        $products = [];
        foreach ($items as $item) {
            $product  = $item->product;
            $category = $product?->category;
            $brand    = $product?->brand;
            $location = $item->location;
            $leafCategory = $this->getLeafCategoryName($category?->name);

            $products[] = [
                'inventory_id'    => $item->id,
                'id'              => $product?->id,
                'name'            => $product?->name,
                'slug'            => $product?->slug,
                'barcode'         => $product?->barcode,
                'sku'             => $product?->sku,
                'thumbnail'       => $product?->image_thumb ?? $product?->image,
                'quantity'        => $item->quantity,
                'unit'            => $item->unit,
                'price'           => $item->price,
                'sale_price'      => $item->sale_price,
                'saleprice'       => $item->sale_price,
                'stock'           => $item->stock_quantity,
                'stock_quantity'  => $item->stock_quantity,
                'min_stock'       => $item->min_stock,
                'expiration_date' => $item->expiration_date,
                'restock_date'    => $item->restock_date,
                'brand'           => $brand?->name ?? 'Sin marca',
                'brand_id'        => $brand?->id,
                'brand_slug'      => $brand?->slug,
                'category_id'     => $category?->id,
                'category'        => $leafCategory,
                'category_path'   => $leafCategory,
                'subcategory_id'  => $category?->id,
                'subcategory'     => $leafCategory,
                'color'           => $category?->color ?? '#6366f1',
                'slug_category'   => $category?->slug ?? '',
                'location_id'     => $item->location_id,
                'location'        => $location?->name,
                'location_path'   => $location?->full_path,
                'metadata'        => $item->metadata,
            ];
        }

        // Agrupar por categoría
        $groupedByCategory = collect($products)->groupBy('category_id');
        $formatted = $groupedByCategory->map(function ($groupItems, $categoryId) {
            $first = $groupItems->first();
            return [
                'category_id'   => $categoryId,
                'category'      => $first['category'],
                'category_path' => $first['category'],
                'subcategory_id'=> $categoryId,
                'subcategory'   => $first['category'],
                'color'         => $first['color'],
                'slug_category' => $first['slug_category'],
                'products'      => $groupItems->map(fn ($item) => [
                    'id'             => $item['id'],
                    'inventory_id'   => $item['inventory_id'],
                    'name'           => $item['name'],
                    'barcode'        => $item['barcode'] ?? null,
                    'sku'            => $item['sku'] ?? null,
                    'price'          => $item['price'],
                    'sale_price'     => $item['sale_price'],
                    'saleprice'      => $item['sale_price'],
                    'slug'           => $item['slug'],
                    'thumbnail'      => $item['thumbnail'],
                    'quantity'       => $item['quantity'],
                    'unit'           => $item['unit'],
                    'stock_quantity' => $item['stock_quantity'],
                    'min_stock'      => $item['min_stock'],
                    'expiration_date'=> $item['expiration_date'],
                    'restock_date'   => $item['restock_date'],
                    'brand'          => $item['brand'],
                    'brand_id'       => $item['brand_id'],
                    'brand_slug'     => $item['brand_slug'] ?? null,
                    'stock'          => $item['stock'],
                    'location_id'    => $item['location_id'],
                    'location'       => $item['location'],
                    'location_path'  => $item['location_path'],
                    'metadata'       => $item['metadata'],
                ])->values(),
            ];
        })->values();

        // ── Categorías únicas COMPLETAS de la tienda (consulta ligera sin paginación) ──
        // Se ejecuta siempre para que los filtros del POS muestren TODAS las categorías,
        // independientemente de qué página de productos esté cargada.
        $allCategoriesRaw = InventoryStore::with(['product.category'])
            ->where('store_id', $store->id)
            ->whereHas('product.category')
            ->get()
            ->map(function ($inv) {
                $cat = $inv->product?->category;
                return [
                    'id'    => $cat?->id,
                    'name'  => $this->getLeafCategoryName($cat?->name),
                    'color' => $cat?->color ?? '#6366f1',
                    'slug'  => $cat?->slug ?? '',
                ];
            })
            ->filter(fn ($c) => !empty($c['id']))
            ->unique('id')
            ->values();

        // Contar productos por categoría en la página actual (para UI informativa)
        $countByCategory = $formatted->mapWithKeys(fn ($group) => [
            $group['category_id'] => count($group['products']),
        ]);

        $categories = $allCategoriesRaw->map(fn ($cat) => [
            'id'            => $cat['id'],
            'name'          => $cat['name'],
            'color'         => $cat['color'],
            'slug'          => $cat['slug'],
            'product_count' => $countByCategory->get($cat['id'], 0),
        ])->values();

        $response = [
            'categories'  => $categories,
            'products'    => $formatted,
        ];

        // Añadir metadatos de paginación solo cuando se solicita paginación
        if ($perPage) {
            $response['pagination'] = [
                'has_more'    => $hasMore,
                'next_cursor' => $nextCursor,
                'per_page'    => (int) $perPage,
            ];
        }

        return response()->json($response);
    }

    /**
     * Store a newly created inventory store item.
     */
    public function store(InventoryStoreRequest $request): JsonResponse
    {
        $data                   = $request->validated();
        $data['sale_price']     = $request->price;
        $data['stock_quantity'] = $data['quantity'];
        $data['restock_date']   = now();

        /* Verify stock from warehouse item */
        $warehouseItem = InventoryWarehouse::find($request->id);
        if (!$warehouseItem || $warehouseItem->stock_quantity < $data['quantity']) {
            return response()->json([
                'message' => 'La cantidad de stock en almacén es insuficiente',
            ], 400);
        }

        /* Decrease stock from warehouse */
        $warehouseItem->stock_quantity -= $data['quantity'];
        $warehouseItem->save();

        $inventoryStore = InventoryStore::create($data);
        $inventoryStore->load(['product.category', 'store', 'location']);

        return response()->json([
            'message'        => 'Salida de producto a tienda creada correctamente',
            'inventoryStore' => $inventoryStore
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $inventoryStore = InventoryStore::with(['product.category', 'store', 'location'])->find($id);
        if (!$inventoryStore) {
            return response()->json(['message' => 'Registro de inventario de tienda no encontrado'], 404);
        }

        return response()->json($inventoryStore);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(InventoryStoreRequest $request, string $id): JsonResponse
    {
        $data = $request->validated();
        $inventoryStore = InventoryStore::find($id);
        if (!$inventoryStore) {
            return response()->json(['message' => 'Registro de inventario de tienda no encontrado'], 404);
        }

        $inventoryStore->update($data);
        $inventoryStore->load(['product.category', 'store', 'location']);

        return response()->json([
            'message'        => 'Inventario de tienda actualizado correctamente',
            'inventoryStore' => $inventoryStore
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $inventoryStore = InventoryStore::find($id);
        if (!$inventoryStore) {
            return response()->json(['message' => 'Registro no encontrado'], 404);
        }

        /* Devolver stock restante al almacén si existe registro o crearlo */
        $remaining = (float)$inventoryStore->stock_quantity;
        if ($remaining > 0) {
            $warehouseItem = InventoryWarehouse::where('product_id', $inventoryStore->product_id)->first();
            if ($warehouseItem) {
                $warehouseItem->stock_quantity += $remaining;
                $warehouseItem->save();
            } else {
                InventoryWarehouse::create([
                    'product_id'     => $inventoryStore->product_id,
                    'quantity'       => $remaining,
                    'stock_quantity' => $remaining,
                    'price'          => $inventoryStore->price ?? 0,
                    'sale_price'     => $inventoryStore->sale_price ?? 0,
                    'unit'           => $inventoryStore->unit ?? 'und',
                    'location_id'    => $inventoryStore->location_id,
                ]);
            }
        }

        $inventoryStore->delete();

        return response()->json([
            'message' => 'Producto retirado de la tienda y devuelto al almacén correctamente',
        ], 200);
    }

    /**
     * Devolver producto al almacén con cantidad opcional.
     */
    public function returnToWarehouse(Request $request, string $id): JsonResponse
    {
        $inventoryStore = InventoryStore::find($id);
        if (!$inventoryStore) {
            return response()->json(['message' => 'Registro no encontrado'], 404);
        }

        $available = (float)$inventoryStore->stock_quantity;
        if ($available <= 0) {
            return response()->json(['message' => 'No hay stock disponible en tienda para devolver'], 422);
        }

        $qtyInput = $request->input('quantity', $available);
        $returnQty = min((float)$qtyInput, $available);

        if ($returnQty <= 0) {
            return response()->json(['message' => 'Cantidad inválida para devolver'], 422);
        }

        $warehouseItem = InventoryWarehouse::where('product_id', $inventoryStore->product_id)->first();
        if ($warehouseItem) {
            $warehouseItem->stock_quantity += $returnQty;
            $warehouseItem->save();
        } else {
            InventoryWarehouse::create([
                'product_id'     => $inventoryStore->product_id,
                'quantity'       => $returnQty,
                'stock_quantity' => $returnQty,
                'price'          => $inventoryStore->price ?? 0,
                'sale_price'     => $inventoryStore->sale_price ?? 0,
                'unit'           => $inventoryStore->unit ?? 'und',
                'location_id'    => $inventoryStore->location_id,
            ]);
        }

        $inventoryStore->stock_quantity -= $returnQty;
        if ($inventoryStore->stock_quantity <= 0) {
            $inventoryStore->delete();
        } else {
            $inventoryStore->save();
        }

        return response()->json([
            'message' => "Se devolvieron {$returnQty} unidad(es) al almacén correctamente",
        ], 200);
    }

    /**
     * Búsqueda exacta de un producto en el inventario de una tienda por barcode, sku o slug.
     * Diseñado para lectores de código de barras USB/Bluetooth y cámara en POS.
     */
    public function getByBarcode(Request $request, string $slug, string $code): JsonResponse
    {
        $cleanCode = trim($code);
        if (!$cleanCode) {
            return response()->json(['message' => 'Código no proporcionado'], 400);
        }

        $slugWithHyphen     = str_replace('_', '-', $slug);
        $slugWithUnderscore = str_replace('-', '_', $slug);

        $storeQuery = Store::where('slug', $slug)
            ->orWhere('slug', $slugWithHyphen)
            ->orWhere('slug', $slugWithUnderscore);

        if (\Illuminate\Support\Str::isUuid($slug)) {
            $storeQuery->orWhere('id', $slug);
        }

        $store = $storeQuery->first();
        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        $item = InventoryStore::with(['product.category', 'product.brand', 'location'])
            ->where('store_id', $store->id)
            ->where(function ($query) use ($cleanCode) {
                $query->whereHas('product', function ($q) use ($cleanCode) {
                    $q->where('barcode', $cleanCode)
                      ->orWhere('sku', $cleanCode)
                      ->orWhere('slug', $cleanCode);
                    if (\Illuminate\Support\Str::isUuid($cleanCode)) {
                        $q->orWhere('id', $cleanCode);
                    }
                });
                if (\Illuminate\Support\Str::isUuid($cleanCode)) {
                    $query->orWhere('id', $cleanCode);
                }
            })
            ->first();

        if (!$item) {
            return response()->json(['message' => 'Producto no encontrado con el código: ' . $code], 404);
        }

        $product  = $item->product;
        $category = $product?->category;
        $brand    = $product?->brand;
        $leafCategory = $this->getLeafCategoryName($category?->name);

        return response()->json([
            'product' => [
                'inventory_id'    => $item->id,
                'id'              => $product?->id,
                'product_id'      => $product?->id,
                'name'            => $product?->name,
                'slug'            => $product?->slug,
                'barcode'         => $product?->barcode,
                'sku'             => $product?->sku,
                'thumbnail'       => $product?->image_thumb ?? $product?->image,
                'quantity'        => $item->quantity,
                'unit'            => $item->unit,
                'price'           => $item->price,
                'sale_price'      => $item->sale_price,
                'saleprice'       => $item->sale_price,
                'stock'           => $item->stock_quantity,
                'stock_quantity'  => $item->stock_quantity,
                'min_stock'       => $item->min_stock,
                'category'        => $leafCategory,
                'category_name'   => $leafCategory,
                'category_path'   => $leafCategory,
                'category_color'  => $category?->color ?? '#6366f1',
                'brand'           => $brand?->name ?? 'Sin marca',
                'brand_id'        => $brand?->id,
                'brand_slug'      => $brand?->slug,
            ]
        ], 200);
    }

    /**
     * Vaciar o eliminar todos los registros de productos en el POS asociados a la tabla inventory_stores para una tienda específica.
     */
    public function clearByStore(string $storeId): JsonResponse
    {
        $slugWithHyphen     = str_replace('_', '-', $storeId);
        $slugWithUnderscore = str_replace('-', '_', $storeId);

        $storeQuery = Store::where('slug', $storeId)
            ->orWhere('slug', $slugWithHyphen)
            ->orWhere('slug', $slugWithUnderscore);

        if (\Illuminate\Support\Str::isUuid($storeId)) {
            $storeQuery->orWhere('id', $storeId);
        }

        $store = $storeQuery->first();
        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        $deletedCount = InventoryStore::where('store_id', $store->id)->delete();

        return response()->json([
            'message'       => "Se vaciaron {$deletedCount} productos del POS de la tienda \"{$store->name}\" correctamente.",
            'deleted_count' => $deletedCount,
            'store_id'      => $store->id,
            'store_name'    => $store->name,
        ], 200);
    }

    /**
     * Vaciar o eliminar todos los registros de inventario de tiendas POS (inventory_stores).
     */
    public function destroyAll(): JsonResponse
    {
        $deletedCount = InventoryStore::query()->delete();

        return response()->json([
            'message'       => "Se eliminaron {$deletedCount} registros de inventario del POS correctamente.",
            'deleted_count' => $deletedCount,
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
