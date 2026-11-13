<?php

namespace App\Http\Controllers;

use App\Models\InventoryStore;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExternalStoreProductController extends Controller
{
    /**
     * Retorna los productos publicados en la tabla `inventory_stores` correspondientes a la tienda autorizada.
     * Consumido de forma segura desde el sitio web externo del cliente.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var Store $store */
        $store = $request->attributes->get('authorized_store');

        if (!$store) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tienda no autorizada o identificada.',
            ], 403);
        }

        // Solo los registros marcados como públicos se exponen al sitio externo.
        $query = InventoryStore::where('store_id', $store->id)
            ->where('is_public', true)
            ->with([
                'product.category',
                'product.brand',
                'product.productImages',
                'location',
            ]);

        // Filtro opcional de búsqueda por nombre, SKU o código de barra
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('sku', 'ilike', "%{$search}%")
                    ->orWhere('barcode', 'ilike', "%{$search}%");
            });
        }

        // Filtro opcional por categoría (slug o nombre)
        if ($request->filled('category')) {
            $cat = trim($request->input('category'));
            $query->whereHas('product.category', function ($q) use ($cat) {
                $q->where('slug', $cat)->orWhere('name', 'ilike', "%{$cat}%");
            });
        }

        // Filtro opcional por marca (slug o nombre)
        if ($request->filled('brand')) {
            $brand = trim($request->input('brand'));
            $query->whereHas('product.brand', function ($q) use ($brand) {
                $q->where('slug', $brand)->orWhere('name', 'ilike', "%{$brand}%");
            });
        }

        // Filtro opcional por productos que tengan stock disponible
        if ($request->boolean('in_stock', false)) {
            $query->where('stock_quantity', '>', 0);
        }

        $items = $query->orderBy('updated_at', 'desc')->get();

        $data = $items->map(function ($item) {
            $product = $item->product;
            $gallery = $product?->productImages?->map(function ($img) {
                return $img->image_url ?? $img->image;
            })->filter()->values()->all() ?? [];

            return [
                'inventory_id' => $item->id,
                'product_id' => $item->product_id,
                'name' => $product?->name ?? 'Producto sin nombre',
                'slug' => $product?->slug,
                'sku' => $product?->sku,
                'barcode' => $product?->barcode,
                'description' => $product?->description,
                'unit' => $item->unit,
                'price' => (float) $item->price,
                'sale_price' => (float) $item->sale_price,
                'stock_quantity' => (int) $item->stock_quantity,
                'min_stock' => (int) $item->min_stock,
                'expiration_date' => $item->expiration_date,
                'image' => $product?->image,
                'gallery' => $gallery,
                'category' => [
                    'id' => $product?->category?->id,
                    'name' => $product?->category?->name ?? 'VARIOS',
                    'slug' => $product?->category?->slug ?? 'varios',
                    'path' => $product?->category_path,
                ],
                'brand' => [
                    'id' => $product?->brand?->id,
                    'name' => $product?->brand?->name ?? 'DESCONOCIDO',
                    'slug' => $product?->brand?->slug,
                ],
                'location' => $item->location?->name,
                'updated_at' => $item->updated_at,
            ];
        });

        return response()->json([
            'status' => 'success',
            'store' => [
                'id' => $store->id,
                'name' => $store->name,
                'slug' => $store->slug,
                'address' => $store->address,
                'phone' => $store->phone,
                'location' => $store->location,
            ],
            'total' => $data->count(),
            'data' => $data,
        ], 200);
    }
}
