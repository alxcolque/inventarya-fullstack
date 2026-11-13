<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProductRequest;
use App\Models\Brand;
use App\Models\Category;
use App\Models\InventoryStore;
use App\Models\InventoryWarehouse;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\FileStorageService;
use App\Services\ProductAttributeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    /**
     * Display a listing of products with their category hierarchy and brand.
     */
    public function index(): JsonResponse
    {
        $products = Product::with(['category', 'brand'])
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'slug' => $product->slug,
                    'sku' => $product->sku,
                    'barcode' => $product->barcode,
                    'sin_product_code' => $product->sin_product_code,
                    'sin_activity_code' => $product->sin_activity_code,
                    'sin_unit_code' => $product->sin_unit_code,
                    'description' => $product->description,
                    'image' => $product->image,
                    'thumbnail' => $product->image,
                    'category_id' => $product->category_id,
                    'category' => $product->category?->name ?? 'VARIOS',
                    'category_path' => $product->category?->full_path ?? $product->category?->name ?? 'VARIOS',
                    'color' => $product->category?->color ?? '#6366f1',
                    'brand_id' => $product->brand_id,
                    'brand' => $product->brand?->name ?? 'DESCONOCIDO',
                    'attributes' => $product->attributes ?: new \stdClass,
                    'created_at' => $product->created_at,
                    'updated_at' => $product->updated_at,
                ];
            });

        return response()->json($products);
    }

    /**
     * Display the specified product with relations and gallery.
     */
    public function show(string $id): JsonResponse
    {
        if (!Str::isUuid($id)) {
            return response()->json(['message' => 'Producto no encontrado'], 404);
        }

        $product = Product::with([
            'category',
            'brand',
            'productImages',
            'inventoryWarehouses.location',
            'inventoryStore.store',
            'inventoryStore.location',
        ])->find($id);

        if (!$product) {
            return response()->json(['message' => 'Producto no encontrado'], 404);
        }

        $productInventoryWarehouse = $product->inventoryWarehouses->map(function ($inv) {
            $inv->location_name = $inv->location?->name;
            $inv->location_path = $inv->location?->full_path;

            return $inv;
        });

        $productInventoryStore = $product->inventoryStore->map(function ($inv) {
            $inv->store_name = $inv->store?->name;
            $inv->location_name = $inv->location?->name;
            $inv->location_path = $inv->location?->full_path;

            return $inv;
        });

        return response()->json([
            'id' => $product->id,
            'name' => $product->name,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'sin_product_code' => $product->sin_product_code,
            'sin_activity_code' => $product->sin_activity_code,
            'sin_unit_code' => $product->sin_unit_code,
            'description' => $product->description,
            'image' => $product->image,
            'thumbnail' => $product->image,
            'category_id' => $product->category_id,
            'category' => $product->category?->name ?? 'VARIOS',
            'category_path' => $product->category?->full_path ?? $product->category?->name ?? 'VARIOS',
            'color' => $product->category?->color ?? '#6366f1',
            'brand_id' => $product->brand_id,
            'brand' => $product->brand?->name ?? 'DESCONOCIDO',
            'attributes' => $product->attributes ?: new \stdClass,
            'product_images' => $product->productImages,
            'productInventoryWarehouse' => $productInventoryWarehouse,
            'productInventoryStore' => $productInventoryStore,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
        ]);
    }

    /**
     * Get a product by slug including gallery and inventory.
     */
    public function getProductBySlug(string $slug): JsonResponse
    {
        $product = Product::with(['category', 'brand'])->where('slug', $slug)->first();
        if (!$product) {
            return response()->json(['message' => 'Producto no encontrado'], 404);
        }

        $formattedProduct = [
            'id' => $product->id,
            'name' => $product->name,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'sin_product_code' => $product->sin_product_code,
            'sin_activity_code' => $product->sin_activity_code,
            'sin_unit_code' => $product->sin_unit_code,
            'description' => $product->description,
            'image' => $product->image,
            'thumbnail' => $product->image,
            'category_id' => $product->category_id,
            'category' => $product->category?->name ?? 'VARIOS',
            'category_path' => $product->category?->full_path ?? $product->category?->name ?? 'VARIOS',
            'color' => $product->category?->color ?? '#6366f1',
            'brand_id' => $product->brand_id,
            'brand' => $product->brand?->name ?? 'DESCONOCIDO',
            'attributes' => $product->attributes ?: new \stdClass,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
        ];

        /* Product Images */
        $productImages = ProductImage::where('product_id', $product->id)->get();

        /* Inventory Warehouse */
        $productInventoryWarehouse = InventoryWarehouse::with('location')
            ->where('product_id', $product->id)
            ->get()
            ->map(function ($inv) {
                $inv->location_name = $inv->location?->name;
                $inv->location_path = $inv->location?->full_path;

                return $inv;
            });

        /* Inventory Store */
        $productInventoryStore = InventoryStore::with(['store', 'location'])
            ->where('product_id', $product->id)
            ->get()
            ->map(function ($inventory) {
                $inventory->store_name = $inventory->store?->name;
                $inventory->location_name = $inventory->location?->name;
                $inventory->location_path = $inventory->location?->full_path;

                return $inventory;
            });

        return response()->json([
            'product' => $formattedProduct,
            'productImages' => $productImages,
            'productInventoryWarehouse' => $productInventoryWarehouse,
            'productInventoryStore' => $productInventoryStore,
        ], 200);
    }

    /**
     * Get a product by SKU or barcode including inventory store and warehouse relations.
     */
    public function getProductBySku(string $sku): JsonResponse
    {
        $cleanSku = trim($sku);
        $product = Product::with(['category', 'brand'])
            ->where('sku', $cleanSku)
            ->orWhere('barcode', $cleanSku)
            ->orWhere('slug', $cleanSku)
            ->first();

        if (!$product) {
            return response()->json(['message' => 'Producto no encontrado por SKU/código: ' . $sku], 404);
        }

        $formattedProduct = [
            'id' => $product->id,
            'name' => $product->name,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'sin_product_code' => $product->sin_product_code,
            'sin_activity_code' => $product->sin_activity_code,
            'sin_unit_code' => $product->sin_unit_code,
            'description' => $product->description,
            'image' => $product->image,
            'thumbnail' => $product->image,
            'category_id' => $product->category_id,
            'category' => $product->category?->name ?? 'VARIOS',
            'category_path' => $product->category?->full_path ?? $product->category?->name ?? 'VARIOS',
            'color' => $product->category?->color ?? '#6366f1',
            'brand_id' => $product->brand_id,
            'brand' => $product->brand?->name ?? 'DESCONOCIDO',
            'attributes' => $product->attributes ?: new \stdClass,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
        ];

        /* Product Inventory Store */
        $productInventoryStore = InventoryStore::with(['store', 'location'])
            ->where('product_id', $product->id)
            ->get()
            ->map(function ($inventory) {
                return [
                    'id' => $inventory->id,
                    'inventory_id' => $inventory->id,
                    'store_id' => $inventory->store_id,
                    'store_name' => $inventory->store?->name,
                    'quantity' => $inventory->quantity,
                    'stock' => $inventory->stock_quantity,
                    'stock_quantity' => $inventory->stock_quantity,
                    'min_stock' => $inventory->min_stock,
                    'is_public' => (bool) $inventory->is_public,
                    'price' => $inventory->price,
                    'sale_price' => $inventory->sale_price,
                    'location_id' => $inventory->location_id,
                    'location_name' => $inventory->location?->name,
                    'location_path' => $inventory->location?->full_path,
                ];
            });

        return response()->json([
            'product' => $formattedProduct,
            'productInventoryStore' => $productInventoryStore,
        ], 200);
    }

    /**
     * Store a newly created product in storage.
     */
    public function store(ProductRequest $request): JsonResponse
    {
        $tenant = tenant();
        if ($tenant) {
            $check = app(\App\Services\TenantLimitService::class)->canCreateProduct($tenant);
            if (!$check['allowed']) {
                return response()->json([
                    'code' => $check['code'] ?? 'PLAN_LIMIT_REACHED',
                    'message' => $check['message'] ?? 'Has alcanzado el límite de productos de tu plan.',
                    'limit' => $check['limit'] ?? null,
                    'current' => $check['current'] ?? null,
                ], 422);
            }
        }

        $data = $request->validated();
        $data['attributes'] = app(ProductAttributeService::class)->merge(
            (array) ($data['attributes'] ?? []),
            app(ProductAttributeService::class)->activeFieldsForCurrentTenant(),
        );
        $newImagePath = null;

        if ($request->filled('image')) {
            try {
                $upload = FileStorageService::upload(
                    $request->image,
                    'products',
                    tenant('id') ?? 'default'
                );
                $newImagePath = $upload['path'];
                $data['image'] = $newImagePath;
            } catch (\Throwable $exception) {
                return response()->json(['message' => 'Error al subir la imagen: ' . $exception->getMessage()], 422);
            }
        }

        try {
            $product = Product::create($data);
        } catch (\Throwable $exception) {
            if ($newImagePath) {
                FileStorageService::delete($newImagePath);
            }
            throw $exception;
        }

        $product->load(['category', 'brand']);

        return response()->json([
            'message' => 'Producto registrado correctamente',
            'product' => $product,
        ], 201);
    }

    /**
     * Update the specified product in storage.
     */
    public function update(ProductRequest $request, string $id): JsonResponse
    {
        if (!Str::isUuid($id)) {
            return response()->json(['message' => 'Producto no encontrado'], 404);
        }

        $product = Product::find($id);
        if (!$product) {
            return response()->json(['message' => 'Producto no encontrado'], 404);
        }

        $data = $request->validated();
        if (array_key_exists('attributes', $data)) {
            $data['attributes'] = app(ProductAttributeService::class)->merge(
                (array) $data['attributes'],
                app(ProductAttributeService::class)->activeFieldsForCurrentTenant(),
                (array) $product->attributes,
            );
        }
        $oldImagePath = $product->getRawOriginal('image');
        $newImagePath = null;

        if (
            $request->filled('image')
            && !FileStorageService::referencesMatch($request->image, $oldImagePath)
        ) {
            try {
                $upload = FileStorageService::upload(
                    $request->image,
                    'products',
                    tenant('id') ?? 'default'
                );
                $newImagePath = $upload['path'];
                $data['image'] = $newImagePath;
            } catch (\Throwable $exception) {
                return response()->json(['message' => 'Error al actualizar imagen: ' . $exception->getMessage()], 422);
            }
        } else {
            unset($data['image']);
        }

        try {
            $product->update($data);
        } catch (\Throwable $exception) {
            if ($newImagePath) {
                FileStorageService::delete($newImagePath);
            }
            throw $exception;
        }

        if (
            $newImagePath && $oldImagePath
            && !FileStorageService::referencesMatch($oldImagePath, $newImagePath)
        ) {
            FileStorageService::delete($oldImagePath);
        }

        $product->load(['category', 'brand']);

        return response()->json([
            'message' => 'Producto actualizado correctamente',
            'product' => $product,
        ], 200);
    }

    /**
     * Remove the specified product from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        if (!Str::isUuid($id)) {
            return response()->json(['message' => 'Producto no encontrado'], 404);
        }

        $product = Product::with('productImages')->find($id);
        if (!$product) {
            return response()->json(['message' => 'Producto no encontrado'], 404);
        }

        // Eliminar imágenes de la galería del disco
        foreach ($product->productImages as $pi) {
            $rawImg = $pi->getRawOriginal('image') ?? $pi->image_key;
            if ($rawImg) {
                FileStorageService::delete($rawImg);
            }
            $pi->delete();
        }

        // Eliminar imagen principal del storage
        $mainRaw = $product->getRawOriginal('image');
        if ($mainRaw) {
            FileStorageService::delete($mainRaw);
        }

        // Eliminar items de movimientos de stock para evitar violaciones de clave foránea
        DB::table('stock_movement_items')->where('product_id', $product->id)->delete();

        $product->delete();

        return response()->json([
            'message' => 'Producto eliminado correctamente',
        ], 200);
    }

    /**
     * Remove all products and dependent records from storage.
     */
    public function destroyAll(): JsonResponse
    {
        DB::beginTransaction();
        try {
            $products = Product::with('productImages')->get();
            foreach ($products as $product) {
                // Eliminar imágenes de la galería del disco
                foreach ($product->productImages as $pi) {
                    $rawImg = $pi->getRawOriginal('image') ?? $pi->image_key;
                    if ($rawImg) {
                        FileStorageService::delete($rawImg);
                    }
                }
                // Eliminar imagen principal del storage
                $mainRaw = $product->getRawOriginal('image');
                if ($mainRaw) {
                    FileStorageService::delete($mainRaw);
                }
            }

            // Limpiar registros dependientes para integridad referencial
            DB::table('stock_movement_items')->delete();
            DB::table('stock_movements')->delete();
            DB::table('inventory_warehouses')->delete();
            DB::table('inventory_stores')->delete();
            DB::table('sale_details')->delete();
            DB::table('product_images')->delete();

            $deletedCount = Product::query()->delete();

            DB::commit();

            return response()->json([
                'message' => "Se eliminaron {$deletedCount} productos correctamente",
                'deleted_count' => $deletedCount,
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al eliminar todos los productos: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Descargar plantilla Excel/CSV para importación de productos.
     * Columnas (11): No., Nombre, Categoría, Marca, Unidad, Cantidad,
     *                Precio compra, Precio venta, Stock mínimo, Fecha expiración, Código de barras
     */
    public function downloadTemplate(Request $request)
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Plantilla Productos');

        // Encabezados (11 columnas)
        $headers = [
            'No.', 'Nombre', 'Categoría', 'Marca', 'Unidad',
            'Cantidad', 'Precio compra', 'Precio venta',
            'Stock mínimo', 'Fecha expiración', 'Código de barras',
        ];
        foreach ($headers as $colIndex => $header) {
            $col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex + 1);
            $sheet->setCellValue($col . '1', $header);
        }

        // Estilo del encabezado
        $lastCol = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($headers));
        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1E293B'],
            ],
            'alignment' => [
                'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
            ],
        ];
        $sheet->getStyle('A1:' . $lastCol . '1')->applyFromArray($headerStyle);
        $sheet->getRowDimension(1)->setRowHeight(26);

        // Filas de ejemplo
        // Categoría: puede ser simple "Lácteos" o jerárquica "Alimentos,Lácteos,Frescos"
        $samples = [
            [1, 'Leche Entera 1L',    'Alimentos,Lácteos',  'Alpina',     'Unidad', 100, 2200.00, 2800.00, 10,  '2026-12-31', '7700001234567'],
            [2, 'Arroz Blanco 1kg',   'Abarrotes',          'Diana',      'kg',     50,  3200.00, 4000.00, 5,   '',           ''],
            [3, 'Aceite Vegetal 500ml','',                   '',           '',       0,   0.00,    0.00,    0,   '',           ''],
        ];

        $rowNum = 2;
        foreach ($samples as $sample) {
            foreach ($sample as $colIndex => $value) {
                $col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex + 1);
                $sheet->setCellValue($col . $rowNum, $value);
            }
            $sheet->getRowDimension($rowNum)->setRowHeight(20);
            $rowNum++;
        }

        // Anchos de columna
        $sheet->getColumnDimension('A')->setWidth(6);   // No.
        $sheet->getColumnDimension('B')->setWidth(35);  // Nombre
        $sheet->getColumnDimension('C')->setWidth(30);  // Categoría
        $sheet->getColumnDimension('D')->setWidth(20);  // Marca
        $sheet->getColumnDimension('E')->setWidth(14);  // Unidad
        $sheet->getColumnDimension('F')->setWidth(12);  // Cantidad
        $sheet->getColumnDimension('G')->setWidth(16);  // Precio compra
        $sheet->getColumnDimension('H')->setWidth(16);  // Precio venta
        $sheet->getColumnDimension('I')->setWidth(14);  // Stock mínimo
        $sheet->getColumnDimension('J')->setWidth(18);  // Fecha expiración
        $sheet->getColumnDimension('K')->setWidth(20);  // Código de barras

        // Nota aclaratoria en celda M2
        $sheet->setCellValue('M2', 'Categoría: usa comas para jerarquía (ej: Alimentos,Lácteos,Frescos)');
        $sheet->getStyle('M2')->getFont()->setItalic(true)->getColor()->setRGB('888888');

        $format = strtolower($request->query('format', 'xlsx'));

        if ($format === 'csv') {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Csv($spreadsheet);
            $filename = 'plantilla_productos.csv';
            $contentType = 'text/csv';
        } else {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $filename = 'plantilla_productos.xlsx';
            $contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'max-age=0, no-cache, must-revalidate, proxy-revalidate',
        ]);
    }

    /**
     * Exportar todos los productos a Excel o CSV.
     * Columnas (11): No., Nombre, Categoría, Marca, Unidad, Cantidad,
     *                Precio compra, Precio venta, Stock mínimo, Fecha expiración, Código de barras
     */
    public function export(Request $request)
    {
        $products = Product::with(['category.parent', 'brand', 'inventoryWarehouses'])
            ->orderBy('name', 'asc')
            ->get();

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Productos');

        // Encabezados (11 columnas)
        $headers = [
            'No.', 'Nombre', 'Categoría', 'Marca', 'Unidad',
            'Cantidad', 'Precio compra', 'Precio venta',
            'Stock mínimo', 'Fecha expiración', 'Código de barras',
        ];
        foreach ($headers as $colIndex => $header) {
            $col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex + 1);
            $sheet->setCellValue($col . '1', $header);
        }

        $lastCol = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($headers));
        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => '0F766E'],
            ],
            'alignment' => [
                'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
            ],
        ];
        $sheet->getStyle('A1:' . $lastCol . '1')->applyFromArray($headerStyle);
        $sheet->getRowDimension(1)->setRowHeight(26);

        $rowNum = 2;
        foreach ($products as $index => $product) {
            // Primer registro de inventario (si existe)
            $inv = $product->inventoryWarehouses->first();

            // Ruta de categoría jerárquica con comas (compatible con plantilla de importación)
            $catPath = $product->category?->full_path
                ? str_replace(' > ', ',', $product->category->full_path)
                : ($product->category?->name ?? 'VARIOS');

            $sheet->setCellValue('A' . $rowNum, $index + 1);
            $sheet->setCellValue('B' . $rowNum, $product->name);
            $sheet->setCellValue('C' . $rowNum, $catPath);
            $sheet->setCellValue('D' . $rowNum, $product->brand?->name ?? 'DESCONOCIDO');
            $sheet->setCellValue('E' . $rowNum, $inv?->unit ?? '');
            $sheet->setCellValue('F' . $rowNum, $inv?->quantity ?? 0);
            $sheet->setCellValue('G' . $rowNum, $inv?->price ?? 0);
            $sheet->setCellValue('H' . $rowNum, $inv?->sale_price ?? 0);
            $sheet->setCellValue('I' . $rowNum, $inv?->min_stock ?? 0);
            $sheet->setCellValue('J' . $rowNum, $inv?->expiration_date?->format('Y-m-d') ?? '');
            $sheet->setCellValue('K' . $rowNum, $product->barcode ?? '');
            $sheet->getRowDimension($rowNum)->setRowHeight(20);
            $rowNum++;
        }

        // Anchos de columna
        $sheet->getColumnDimension('A')->setWidth(6);
        $sheet->getColumnDimension('B')->setWidth(35);
        $sheet->getColumnDimension('C')->setWidth(30);
        $sheet->getColumnDimension('D')->setWidth(20);
        $sheet->getColumnDimension('E')->setWidth(14);
        $sheet->getColumnDimension('F')->setWidth(12);
        $sheet->getColumnDimension('G')->setWidth(16);
        $sheet->getColumnDimension('H')->setWidth(16);
        $sheet->getColumnDimension('I')->setWidth(14);
        $sheet->getColumnDimension('J')->setWidth(18);
        $sheet->getColumnDimension('K')->setWidth(20);

        $format = strtolower($request->query('format', 'xlsx'));

        if ($format === 'csv') {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Csv($spreadsheet);
            $filename = 'productos_' . date('Ymd_His') . '.csv';
            $contentType = 'text/csv';
        } else {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $filename = 'productos_' . date('Ymd_His') . '.xlsx';
            $contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'max-age=0, no-cache, must-revalidate, proxy-revalidate',
        ]);
    }

    /**
     * Importar productos desde Excel/CSV con validación estricta y reporte detallado.
     *
     * Columnas soportadas (11):
     *   No., Nombre*, Categoría, Marca, Unidad, Cantidad, Precio compra,
     *   Precio venta, Stock mínimo, Fecha expiración, Código de barras
     * (*) obligatoria
     *
     * Reglas:
     * - Nombre: se guarda tal como viene, solo formatea espacios.
     * - Categoría: soporta jerarquía separada por comas ("Alimentos,Lácteos,Frescos").
     *   Cada nivel se resuelve/crea de forma recursiva usando caché en memoria.
     * - Marca: si vacía → 'DESCONOCIDO'. Se compara en MAYÚSCULAS.
     * - Unidad: si vacía → 'Unidad'.
     * - Código de barras: opcional, string (no se convierte a int).
     * - Precio venta → sale_price en inventory_warehouses.
     * - Stock mínimo → min_stock en inventory_warehouses.
     * - Fecha expiración → expiration_date en inventory_warehouses (formato Y-m-d).
     * - inventory_warehouses: se crea cuando Cantidad > 0 Y (Precio compra > 0 O Precio venta > 0).
     */
    public function import(Request $request)
    {
        // 1. Validación del archivo: máximo 5MB y solo Excel (.xlsx, .xls) o CSV (.csv)
        $validator = Validator::make($request->all(), [
            'file' => [
                'required',
                'file',
                'max:5120',
                function ($attribute, $value, $fail) {
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
                        $fail('El archivo debe ser un formato válido de Excel (.xlsx, .xls) o CSV (.csv).');
                    }
                },
            ],
        ], [
            'file.required' => 'Debes adjuntar un archivo para importar.',
            'file.file'     => 'El archivo subido no es válido.',
            'file.max'      => 'El archivo no debe superar 5MB de tamaño.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        $file     = $request->file('file');
        $realPath = $file->getRealPath();

        try {
            $spreadsheet  = \PhpOffice\PhpSpreadsheet\IOFactory::load($realPath);
            $sheet        = $spreadsheet->getActiveSheet();
            $highestRow   = $sheet->getHighestDataRow();
            $highestCol   = $sheet->getHighestDataColumn();
            $highestColIdx = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);

            if ($highestRow < 2) {
                return response()->json([
                    'message' => 'El archivo no contiene filas de datos. Usa la plantilla oficial.',
                ], 422);
            }

            // 2. Mapear encabezados dinámicamente (fila 1) a nombres internos
            $colMap     = [];
            $colAliases = [
                // Nombre
                'nombre'          => 'nombre',
                'name'            => 'nombre',
                'producto'        => 'nombre',
                // Categoría
                'categoria'       => 'categoria',
                'categorias'      => 'categoria',
                'category'        => 'categoria',
                'categories'      => 'categoria',
                // Marca
                'marca'           => 'marca',
                'marcas'          => 'marca',
                'brand'           => 'marca',
                'brands'          => 'marca',
                // Unidad
                'unidad'          => 'unidad',
                'unit'            => 'unidad',
                // Cantidad
                'cantidad'        => 'cantidad',
                'quantity'        => 'cantidad',
                'stock'           => 'cantidad',
                // Precio compra
                'preciocompra'    => 'precio_compra',
                'precio'          => 'precio_compra',
                'price'           => 'precio_compra',
                'costo'           => 'precio_compra',
                'cost'            => 'precio_compra',
                // Precio venta
                'precioventa'     => 'precio_venta',
                'saleprice'       => 'precio_venta',
                'pvp'             => 'precio_venta',
                // Stock mínimo
                'stockminimo'     => 'stock_minimo',
                'minstock'        => 'stock_minimo',
                'stockmin'        => 'stock_minimo',
                'minimo'          => 'stock_minimo',
                // Fecha expiración
                'fechaexpiracion' => 'fecha_expiracion',
                'expiracion'      => 'fecha_expiracion',
                'expiration'      => 'fecha_expiracion',
                'fechavencimiento'=> 'fecha_expiracion',
                'vencimiento'     => 'fecha_expiracion',
                'expdate'         => 'fecha_expiracion',
                // Código de barras
                'codigodebarras'  => 'codigo_barras',
                'codigobarras'    => 'codigo_barras',
                'barcode'         => 'codigo_barras',
                'ean'             => 'codigo_barras',
                'upc'             => 'codigo_barras',
            ];

            for ($col = 1; $col <= $highestColIdx; $col++) {
                $raw        = trim((string) $sheet->getCell([$col, 1])->getValue());
                $normalized = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $raw));
                $normalized = preg_replace('/[^a-z]/', '', $normalized);
                if (isset($colAliases[$normalized])) {
                    $colMap[$colAliases[$normalized]] = $col;
                }
            }

            // La columna «Nombre» es obligatoria
            if (!isset($colMap['nombre'])) {
                return response()->json([
                    'message' => 'El archivo no contiene la columna obligatoria "Nombre". Descarga la plantilla oficial.',
                ], 422);
            }

            // 3. Cargar en memoria productos existentes con sus unidades de almacén
            $existingDbProducts = Product::select('id', 'name', 'slug', 'sku', 'category_id', 'brand_id')
                ->with(['inventoryWarehouses:id,product_id,unit'])
                ->get();

            // Mapa 1: Búsqueda exacta por (Nombre + Categoría + Marca) en MAYÚSCULAS
            // Clave: NOMBRE|CATEGORY_ID|BRAND_ID
            $productsByExactKey = [];

            // Mapa 2: Búsqueda por (Nombre + Categoría) para detectar si ya existe con otra marca
            // Clave: NOMBRE|CATEGORY_ID
            $productsByNameCat = [];

            foreach ($existingDbProducts as $p) {
                $nUpper = mb_strtoupper(trim($p->name), 'UTF-8');
                $cId = (string) $p->category_id;
                $bId = (string) ($p->brand_id ?? 0);
                $exactKey = $nUpper . '|' . $cId . '|' . $bId;

                $unitsMap = [];
                foreach ($p->inventoryWarehouses as $iw) {
                    if (!empty($iw->unit)) {
                        $unitsMap[mb_strtoupper(trim($iw->unit), 'UTF-8')] = true;
                    }
                }

                $entry = [
                    'id' => $p->id,
                    'name' => $p->name,
                    'slug' => $p->slug,
                    'sku' => $p->sku,
                    'category_id' => $p->category_id,
                    'brand_id' => $p->brand_id,
                    'units' => $unitsMap,
                ];

                $productsByExactKey[$exactKey] = $entry;
                $nameCatKey = $nUpper . '|' . $cId;
                $productsByNameCat[$nameCatKey][] = $entry;
            }

            // ---------------------------------------------------------------
            // Cache de CATEGORÍAS (clave = RUTA_CON_COMAS_EN_MAYÚSCULAS → id)
            // ---------------------------------------------------------------
            $allCategories   = Category::all(['id', 'name', 'parent_id']);
            $catById         = $allCategories->keyBy('id');

            $getCatPath = function (string $id) use (&$catById, &$getCatPath): string {
                $cat = $catById[$id] ?? null;
                if (!$cat) return '';
                if (!$cat->parent_id) return mb_strtoupper(trim($cat->name), 'UTF-8');
                $parentPath = $getCatPath((string) $cat->parent_id);
                return $parentPath . ',' . mb_strtoupper(trim($cat->name), 'UTF-8');
            };

            $categoryPathCache = [];
            foreach ($allCategories as $cat) {
                $path = $getCatPath((string) $cat->id);
                $categoryPathCache[$path] = (string) $cat->id;
            }

            $resolveCategoryPath = function (string $rawCat) use (
                &$categoryPathCache,
                &$catById,
                &$getCatPath
            ): string {
                $cleanCat = preg_replace('/\s+/', ' ', trim($rawCat));
                $segments = array_map(
                    fn($s) => preg_replace('/\s+/', ' ', trim($s)),
                    explode(',', $cleanCat)
                );
                $segments = array_filter($segments, fn($s) => $s !== '');

                if (empty($segments)) {
                    $segments = ['VARIOS'];
                }

                $parentId        = null;
                $accumulatedPath = '';

                foreach ($segments as $segment) {
                    $segUpper    = mb_strtoupper($segment, 'UTF-8');
                    $currentPath = $accumulatedPath === '' ? $segUpper : $accumulatedPath . ',' . $segUpper;

                    if (isset($categoryPathCache[$currentPath])) {
                        $parentId        = $categoryPathCache[$currentPath];
                        $accumulatedPath = $currentPath;
                        continue;
                    }

                    $catSlug  = Str::slug($segment);
                    if (empty($catSlug)) {
                        $catSlug = 'cat-' . time() . '-' . rand(10, 99);
                    }
                    $baseSlug = $catSlug;
                    $counter  = 1;
                    while (Category::where('slug', $catSlug)->exists()) {
                        $catSlug = "{$baseSlug}-{$counter}";
                        $counter++;
                    }

                    $newCat = Category::create([
                        'name'      => $segment,
                        'slug'      => $catSlug,
                        'color'     => CategoryController::randomLightColor(),
                        'parent_id' => $parentId,
                    ]);

                    $categoryPathCache[$currentPath] = (string) $newCat->id;
                    $catById[$newCat->id]            = $newCat;
                    $parentId        = (string) $newCat->id;
                    $accumulatedPath = $currentPath;
                }

                return $parentId;
            };

            // Cache de MARCAS (clave en MAYÚSCULAS)
            $brandCache = [];
            foreach (Brand::all(['id', 'name']) as $brand) {
                $brandCache[mb_strtoupper(trim($brand->name), 'UTF-8')] = (string) $brand->id;
            }

            $importedCount = 0;
            $notImportedCount = 0;
            $errors = [];
            $importedList = [];

            // Ubicación predeterminada para inventory_warehouses
            $defaultLocation = Location::first();

            // 4. Iterar cada fila de datos (a partir de fila 2)
            for ($row = 2; $row <= $highestRow; $row++) {
                // Leer y formatear Nombre (se respetan mayúsculas/minúsculas y caracteres, solo se formatean espacios)
                $rawName = (string) $sheet->getCell([$colMap['nombre'], $row])->getValue();
                $name = preg_replace('/\s+/', ' ', trim($rawName));

                // Si la celda de Nombre está vacía:
                if ($name === '') {
                    // Verificar si toda la fila está vacía para ignorar silenciosamente filas en blanco
                    $hasAnyData = false;
                    for ($c = 1; $c <= min($highestColIdx, 7); $c++) {
                        if (trim((string) $sheet->getCell([$c, $row])->getValue()) !== '') {
                            $hasAnyData = true;
                            break;
                        }
                    }
                    if (!$hasAnyData) {
                        continue;
                    }

                    // Si contiene otros datos pero el nombre está vacío, omitir registro
                    $notImportedCount++;
                    $errors[] = [
                        'fila' => $row,
                        'nombre' => '(Vacío)',
                        'motivo' => 'Fila omitida: la celda de Nombre está vacía.',
                    ];

                    continue;
                }

                // Longitud máxima de seguridad
                if (mb_strlen($name, 'UTF-8') > 255) {
                    $notImportedCount++;
                    $errors[] = [
                        'fila' => $row,
                        'nombre' => mb_substr($name, 0, 40) . '...',
                        'motivo' => 'El nombre excede los 255 caracteres permitidos.',
                    ];

                    continue;
                }

                $nameKey = mb_strtoupper($name, 'UTF-8');

                // --- CATEGORÍA (con soporte de jerarquía por comas) ---
                $rawCat   = isset($colMap['categoria'])
                    ? (string) $sheet->getCell([$colMap['categoria'], $row])->getValue()
                    : '';
                $cleanCat  = preg_replace('/\s+/', ' ', trim($rawCat));
                $catToUse  = ($cleanCat !== '') ? $cleanCat : 'VARIOS';
                $categoryId = $resolveCategoryPath($catToUse);

                // --- MARCA ---
                $rawBrand = isset($colMap['marca'])
                    ? (string) $sheet->getCell([$colMap['marca'], $row])->getValue()
                    : '';
                $cleanBrand = preg_replace('/\s+/', ' ', trim($rawBrand));
                $brandToUse = ($cleanBrand !== '') ? $cleanBrand : 'DESCONOCIDO';
                $brandUpper = mb_strtoupper($brandToUse, 'UTF-8');

                if (isset($brandCache[$brandUpper])) {
                    $brandId = $brandCache[$brandUpper];
                } else {
                    $bSlug   = Str::slug($brandToUse);
                    if (empty($bSlug)) {
                        $bSlug = 'brand-' . time() . '-' . rand(10, 99);
                    }
                    $baseSlug = $bSlug;
                    $counter  = 1;
                    while (Brand::where('slug', $bSlug)->exists()) {
                        $bSlug = "{$baseSlug}-{$counter}";
                        $counter++;
                    }
                    $newBrand = Brand::create([
                        'name' => $brandToUse,
                        'slug' => $bSlug,
                    ]);
                    $brandId              = (string) $newBrand->id;
                    $brandCache[$brandUpper] = $brandId;
                }

                // --- UNIDAD ---
                $rawUnit  = isset($colMap['unidad'])
                    ? (string) $sheet->getCell([$colMap['unidad'], $row])->getValue()
                    : '';
                $cleanUnit = preg_replace('/\s+/', ' ', trim($rawUnit));
                $unit      = ($cleanUnit !== '') ? $cleanUnit : 'Unidad';
                $unitUpper = mb_strtoupper($unit, 'UTF-8');

                // --- CANTIDAD, PRECIOS Y CAMPOS EXTRA ---
                $rawQuantity = isset($colMap['cantidad'])
                    ? trim((string) $sheet->getCell([$colMap['cantidad'], $row])->getValue())
                    : '';
                $rawPriceCompra = isset($colMap['precio_compra'])
                    ? trim((string) $sheet->getCell([$colMap['precio_compra'], $row])->getValue())
                    : '';
                $rawPriceVenta = isset($colMap['precio_venta'])
                    ? trim((string) $sheet->getCell([$colMap['precio_venta'], $row])->getValue())
                    : '';
                $rawMinStock = isset($colMap['stock_minimo'])
                    ? trim((string) $sheet->getCell([$colMap['stock_minimo'], $row])->getValue())
                    : '';
                $rawExpDate = isset($colMap['fecha_expiracion'])
                    ? trim((string) $sheet->getCell([$colMap['fecha_expiracion'], $row])->getValue())
                    : '';
                $rawBarcode = isset($colMap['codigo_barras'])
                    ? trim((string) $sheet->getCell([$colMap['codigo_barras'], $row])->getFormattedValue())
                    : '';

                $hasValidQty       = ($rawQuantity !== '' && is_numeric($rawQuantity) && (float) $rawQuantity >= 0);
                $hasValidPrice     = ($rawPriceCompra !== '' && is_numeric($rawPriceCompra) && (float) $rawPriceCompra >= 0);
                $hasValidSalePrice = ($rawPriceVenta !== '' && is_numeric($rawPriceVenta) && (float) $rawPriceVenta >= 0);

                $quantity  = $hasValidQty ? (float) $rawQuantity : 0;
                $price     = $hasValidPrice ? (float) $rawPriceCompra : 0;
                $salePrice = $hasValidSalePrice ? round((float) $rawPriceVenta, 2) : null;
                $minStock  = ($rawMinStock !== '' && is_numeric($rawMinStock)) ? (float) $rawMinStock : 0;
                $barcode   = ($rawBarcode !== '') ? (string) $rawBarcode : null;

                // Parsear fecha de expiración (acepta Y-m-d, d/m/Y, d-m-Y y valores numéricos de Excel)
                $expirationDate = null;
                if ($rawExpDate !== '') {
                    // Valor numérico de Excel (días desde 1900-01-01)
                    if (is_numeric($rawExpDate)) {
                        try {
                            $expirationDate = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $rawExpDate)->format('Y-m-d');
                        } catch (\Throwable) {}
                    } else {
                        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y'] as $fmt) {
                            $parsed = \DateTime::createFromFormat($fmt, $rawExpDate);
                            if ($parsed) {
                                $expirationDate = $parsed->format('Y-m-d');
                                break;
                            }
                        }
                    }
                }

                // --- REGLAS DE IMPORTACIÓN Y EVALUACIÓN DE DUPLICADOS ---
                $exactKey = $nameKey . '|' . $categoryId . '|' . $brandId;
                $nameCatKey = $nameKey . '|' . $categoryId;

                // CASO A: Ya existe producto con Nombre, Categoría y Marca IGUALES
                if (isset($productsByExactKey[$exactKey])) {
                    $existingEntry = &$productsByExactKey[$exactKey];

                    // CONDICIÓN 1: Nombre, Categoría, Marca y Unidad IGUALES -> SE DESCARTA
                    if (isset($existingEntry['units'][$unitUpper])) {
                        $notImportedCount++;
                        $errors[] = [
                            'fila' => $row,
                            'nombre' => $name,
                            'motivo' => "Producto con mismo nombre, categoría, marca y unidad '{$unit}' ya existe en el sistema (descartado).",
                        ];

                        continue;
                    }

                    // CONDICIÓN 2: Nombre, Categoría y Marca IGUALES, diferente Unidad ->
                    // Tomar id del existente y registrar en inventory_warehouses
                    try {
                        $existingId = $existingEntry['id'];
                        DB::transaction(function () use (
                            $existingId, $defaultLocation, $unit, $quantity,
                            $price, $salePrice, $minStock, $expirationDate
                        ) {
                            InventoryWarehouse::create([
                                'product_id'      => $existingId,
                                'location_id'     => $defaultLocation?->id,
                                'unit'            => $unit,
                                'quantity'        => round($quantity, 2),
                                'price'           => $price,
                                'sale_price'      => $salePrice,
                                'min_stock'       => $minStock,
                                'expiration_date' => $expirationDate,
                                'stock_quantity'  => round($quantity, 2),
                            ]);
                        });

                        $existingEntry['units'][$unitUpper] = true;
                        $importedCount++;

                        $importedList[] = [
                            'id'        => $existingId,
                            'fila'      => $row,
                            'nombre'    => $existingEntry['name'],
                            'slug'      => $existingEntry['slug'] ?? '',
                            'sku'       => $existingEntry['sku'] ?? '',
                            'categoria' => $catToUse,
                            'marca'     => $brandToUse,
                            'unidad'    => $unit,
                            'tipo'      => 'Nueva unidad en almacén',
                        ];

                        continue;
                    } catch (\Throwable $rowEx) {
                        $notImportedCount++;
                        $errors[] = [
                            'fila'   => $row,
                            'nombre' => $name,
                            'motivo' => 'Error al registrar unidad en almacén: ' . $rowEx->getMessage(),
                        ];

                        continue;
                    }
                }

                // CASO B: Verificar si existe el mismo Nombre y Categoría con MARCA DIFERENTE
                // CONDICIÓN 3: "Si el producto tiene “Nombre”, “Categoría” y la “Marcas” diferente se registra nuevo producto...
                // Concatenar “Agua” + “ “ + “Cielo”"
                $hasDifferentBrand = false;
                if (!empty($productsByNameCat[$nameCatKey])) {
                    foreach ($productsByNameCat[$nameCatKey] as $entry) {
                        if ((string) $entry['brand_id'] !== (string) $brandId) {
                            $hasDifferentBrand = true;
                            break;
                        }
                    }
                }

                $targetName = $name;
                if ($hasDifferentBrand) {
                    if (!str_ends_with(mb_strtolower($name, 'UTF-8'), mb_strtolower($brandToUse, 'UTF-8'))) {
                        $targetName = trim($name . ' ' . $brandToUse);
                    }
                }

                $targetNameKey = mb_strtoupper($targetName, 'UTF-8');
                $targetExactKey = $targetNameKey . '|' . $categoryId . '|' . $brandId;

                // Si el nombre resultante concatenado ya existía en la base de datos o en el archivo
                if (isset($productsByExactKey[$targetExactKey])) {
                    $existingEntry = &$productsByExactKey[$targetExactKey];

                    if (isset($existingEntry['units'][$unitUpper])) {
                        // Misma unidad para el producto concatenado -> se descarta
                        $notImportedCount++;
                        $errors[] = [
                            'fila' => $row,
                            'nombre' => $targetName,
                            'motivo' => "Producto con mismo nombre, categoría, marca y unidad '{$unit}' ya existe en el sistema (descartado).",
                        ];

                        continue;
                    }

                    // Diferente unidad para el producto concatenado -> se registra en almacén tomando su id
                    try {
                        $existingId = $existingEntry['id'];
                        DB::transaction(function () use (
                            $existingId, $defaultLocation, $unit, $quantity,
                            $price, $salePrice, $minStock, $expirationDate
                        ) {
                            InventoryWarehouse::create([
                                'product_id'      => $existingId,
                                'location_id'     => $defaultLocation?->id,
                                'unit'            => $unit,
                                'quantity'        => round($quantity, 2),
                                'price'           => $price,
                                'sale_price'      => $salePrice,
                                'min_stock'       => $minStock,
                                'expiration_date' => $expirationDate,
                                'stock_quantity'  => round($quantity, 2),
                            ]);
                        });

                        $existingEntry['units'][$unitUpper] = true;
                        $importedCount++;

                        $importedList[] = [
                            'id'        => $existingId,
                            'fila'      => $row,
                            'nombre'    => $existingEntry['name'],
                            'slug'      => $existingEntry['slug'] ?? '',
                            'sku'       => $existingEntry['sku'] ?? '',
                            'categoria' => $catToUse,
                            'marca'     => $brandToUse,
                            'unidad'    => $unit,
                            'tipo'      => 'Nueva unidad en almacén',
                        ];

                        continue;
                    } catch (\Throwable $rowEx) {
                        $notImportedCount++;
                        $errors[] = [
                            'fila'   => $row,
                            'nombre' => $targetName,
                            'motivo' => 'Error al registrar unidad en almacén: ' . $rowEx->getMessage(),
                        ];

                        continue;
                    }
                }

                // CASO C: Registro de NUEVO PRODUCTO
                try {
                    $product = null;
                    DB::transaction(function () use (
                        $targetName, $categoryId, $brandId, $barcode,
                        $defaultLocation, $unit, $quantity,
                        $price, $salePrice, $minStock, $expirationDate,
                        &$product
                    ) {
                        $product = Product::create([
                            'name'        => $targetName,
                            'category_id' => $categoryId,
                            'brand_id'    => $brandId,
                            'barcode'     => $barcode,
                        ]);

                        if ($quantity > 0 || $price > 0 || $salePrice > 0) {
                            InventoryWarehouse::create([
                                'product_id'      => $product->id,
                                'location_id'     => $defaultLocation?->id,
                                'unit'            => $unit,
                                'quantity'        => round($quantity, 2),
                                'price'           => $price,
                                'sale_price'      => $salePrice,
                                'min_stock'       => $minStock,
                                'expiration_date' => $expirationDate,
                                'stock_quantity'  => round($quantity, 2),
                            ]);
                        }
                    });

                    $newEntry = [
                        'id'          => $product->id,
                        'name'        => $product->name,
                        'slug'        => $product->slug,
                        'sku'         => $product->sku,
                        'category_id' => $categoryId,
                        'brand_id'    => $brandId,
                        'units'       => $unitUpper ? [$unitUpper => true] : [],
                    ];
                    $productsByExactKey[$targetExactKey]    = $newEntry;
                    $targetNameCatKey                      = $targetNameKey . '|' . $categoryId;
                    $productsByNameCat[$targetNameCatKey][] = $newEntry;

                    $importedCount++;

                    $product->load(['category', 'brand']);
                    $importedList[] = [
                        'id'        => $product->id,
                        'fila'      => $row,
                        'nombre'    => $product->name,
                        'slug'      => $product->slug,
                        'sku'       => $product->sku,
                        'barcode'   => $product->barcode ?? '',
                        'categoria' => $product->category?->full_path ?? $product->category?->name ?? 'VARIOS',
                        'marca'     => $product->brand?->name ?? 'DESCONOCIDO',
                        'unidad'    => $unit,
                        'tipo'      => 'Nuevo producto',
                    ];
                } catch (\Throwable $rowEx) {
                    $notImportedCount++;
                    $errors[] = [
                        'fila'   => $row,
                        'nombre' => $targetName,
                        'motivo' => 'Error en base de datos: ' . $rowEx->getMessage(),
                    ];
                }
            }

            $totalProcessed = $importedCount + $notImportedCount;

            return response()->json([
                'success' => true,
                'message' => $importedCount > 0
                    ? "Importación completada: {$importedCount} productos importados exitosamente."
                    : 'Proceso completado: 0 productos importados.',
                'resumen' => [
                    'total_filas' => $totalProcessed,
                    'importados' => $importedCount,
                    'no_importados' => $notImportedCount,
                ],
                'errores' => $errors,
                'importados_lista' => $importedList,
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al procesar el archivo: ' . $e->getMessage(),
            ], 500);
        }
    }
}
