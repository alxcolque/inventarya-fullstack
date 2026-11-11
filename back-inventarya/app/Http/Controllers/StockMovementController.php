<?php

namespace App\Http\Controllers;

use App\Models\InventoryStore;
use App\Models\InventoryWarehouse;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\StockMovementItem;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class StockMovementController extends Controller
{
    public function __construct(
        private readonly NotificationRecipientResolver $recipientResolver,
        private readonly NotificationService $notificationService,
    ) {}

    /**
     * Listar movimientos de stock (traslados).
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->get('status');
        $storeId = $request->get('store_id');
        $search = $request->get('search');

        $query = StockMovement::with([
            'destinationStore',
            'user:id,name,email',
            'items.product.category',
        ])->orderBy('id', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        if ($storeId) {
            $query->where('destination_store_id', $storeId);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('document_number', 'like', '%'.$search.'%')
                    ->orWhere('notes', 'like', '%'.$search.'%')
                    ->orWhereHas('destinationStore', function ($sq) use ($search) {
                        $sq->where('name', 'like', '%'.$search.'%');
                    });
            });
        }

        $movements = $query->paginate($request->get('per_page', 25));

        return response()->json($movements);
    }

    /**
     * Crear un nuevo traslado de stock (Envío / Vaciar Carrito).
     * Transacción SQL:
     * 1. Crea cabecera en stock_movements (status: 'in_transit').
     * 2. Guarda los productos en stock_movement_items.
     * 3. Resta las cantidades de inventory_warehouses.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'destination_store_id' => 'required|exists:stores,id',
            'notes' => 'nullable|string|max:1000',
            'document_type' => 'nullable|string|max:50',
            'direct_to_store' => 'nullable|boolean',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.inventory_id' => 'nullable|uuid',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.cost_price' => 'nullable|numeric|min:0',
            'items.*.sale_price' => 'nullable|numeric|min:0',
            'items.*.unit' => 'nullable|string|max:100',
            'items.*.min_stock' => 'nullable|numeric|min:0',
        ], [
            'destination_store_id.required' => 'Debes seleccionar la tienda de destino.',
            'destination_store_id.exists' => 'La tienda de destino seleccionada no existe.',
            'items.required' => 'El carrito no contiene productos.',
            'items.min' => 'Debes incluir al menos un producto en el envío.',
            'items.*.quantity.min' => 'La cantidad debe ser mayor a 0.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $directToStore = $request->boolean('direct_to_store');

            $movement = DB::transaction(function () use ($request, $directToStore) {
                // 1. Validar que todos los productos cuenten con stock suficiente en almacén
                foreach ($request->items as $item) {
                    $whItem = null;
                    if (! empty($item['inventory_id'])) {
                        $whItem = InventoryWarehouse::find($item['inventory_id']);
                    }

                    $requestedUnit = trim((string) ($item['unit'] ?? ''));

                    if (! $whItem && ! empty($requestedUnit)) {
                        $whItem = InventoryWarehouse::where('product_id', $item['product_id'])
                            ->whereRaw('LOWER(TRIM(unit)) = ?', [mb_strtolower($requestedUnit)])
                            ->first();
                    }

                    if (! $whItem) {
                        $whItem = InventoryWarehouse::where('product_id', $item['product_id'])
                            ->orderByDesc('stock_quantity')
                            ->first();
                    }

                    $product = Product::find($item['product_id']);
                    $productName = $product ? $product->name : ('Producto #'.$item['product_id']);

                    if (! $whItem) {
                        throw new \Exception("El producto '{$productName}' no se encuentra registrado en el almacén.");
                    }

                    $warehouseUnit = trim((string) ($whItem->unit ?? ''));
                    $requestedQty = (float) $item['quantity'];

                    if ($whItem->stock_quantity < $requestedQty) {
                        throw new \Exception("Stock insuficiente en almacén para '{$productName}'. Stock actual: {$whItem->stock_quantity} {$warehouseUnit}, Cantidad solicitada: {$requestedQty}.");
                    }
                }

                // 2. Generar correlativo único de Guía de Remisión (ej: GR-202609-0001)
                $prefix = 'GR-'.date('Ym').'-';
                $lastMovement = StockMovement::where('document_number', 'like', $prefix.'%')
                    ->orderBy('id', 'desc')
                    ->first();

                $nextNumber = 1;
                if ($lastMovement) {
                    $lastPart = substr($lastMovement->document_number, strlen($prefix));
                    if (is_numeric($lastPart)) {
                        $nextNumber = ((int) $lastPart) + 1;
                    }
                }
                $documentNumber = $prefix.str_pad((string) $nextNumber, 4, '0', STR_PAD_LEFT);

                // 3. Crear registro cabecera de movimiento
                $movement = StockMovement::create([
                    'source_warehouse_id' => null,
                    'destination_store_id' => $request->destination_store_id,
                    'user_id' => $request->user()->id ?? auth()->id() ?? 1,
                    'document_type' => $request->document_type ?? 'Guía de Remisión',
                    'document_number' => $documentNumber,
                    'status' => $directToStore ? 'completed' : 'in_transit',
                    'notes' => $request->notes,
                    'shipped_at' => now(),
                    'received_at' => $directToStore ? now() : null,
                ]);

                // 4. Registrar items, descontar del almacén y si es directo, ingresar a tienda
                foreach ($request->items as $item) {
                    $whItem = null;
                    if (! empty($item['inventory_id'])) {
                        $whItem = InventoryWarehouse::find($item['inventory_id']);
                    }

                    $requestedUnit = trim((string) ($item['unit'] ?? ''));

                    if (! $whItem && ! empty($requestedUnit)) {
                        $whItem = InventoryWarehouse::where('product_id', $item['product_id'])
                            ->whereRaw('LOWER(TRIM(unit)) = ?', [mb_strtolower($requestedUnit)])
                            ->first();
                    }

                    if (! $whItem) {
                        $whItem = InventoryWarehouse::where('product_id', $item['product_id'])
                            ->orderByDesc('stock_quantity')
                            ->first();
                    }

                    $costPrice = isset($item['cost_price']) && is_numeric($item['cost_price'])
                        ? (float) $item['cost_price']
                        : (float) ($whItem?->price ?? 0);

                    $salePrice = isset($item['sale_price']) && is_numeric($item['sale_price'])
                        ? (float) $item['sale_price']
                        : $costPrice;

                    $unit = ! empty($requestedUnit)
                        ? $requestedUnit
                        : ($whItem?->unit ?? 'Unidad');

                    $minStock = isset($item['min_stock']) && is_numeric($item['min_stock'])
                        ? (float) $item['min_stock']
                        : (float) ($whItem?->min_stock ?? 0);

                    $expirationDate = ! empty($item['expiration_date']) ? $item['expiration_date'] : null;

                    // Crear detalle del movimiento
                    StockMovementItem::create([
                        'stock_movement_id' => $movement->id,
                        'product_id' => $item['product_id'],
                        'quantity' => (float) $item['quantity'],
                        'cost_price' => $costPrice,
                        'sale_price' => $salePrice,
                        'unit' => $unit,
                        'min_stock' => $minStock,
                        'expiration_date' => $expirationDate,
                    ]);

                    // Restar stock del almacén central
                    if ($whItem) {
                        $decrementQty = (float) $item['quantity'];
                        if ($decrementQty >= $whItem->stock_quantity) {
                            $whItem->update(['stock_quantity' => 0]);
                        } else {
                            $whItem->decrement('stock_quantity', $decrementQty);
                        }
                    }

                    // Si es directo a la tienda, registrar directamente en inventory_stores
                    if ($directToStore) {
                        $invStore = InventoryStore::where('product_id', $item['product_id'])
                            ->where('store_id', $request->destination_store_id)
                            ->whereRaw('LOWER(TRIM(unit)) = ?', [mb_strtolower($unit)])
                            ->first();

                        if ($invStore) {
                            $invStore->increment('stock_quantity', (float) $item['quantity']);
                            $invStore->increment('quantity', (float) $item['quantity']);
                            if ($salePrice > 0) {
                                $invStore->sale_price = (float) $salePrice;
                            }
                            $invStore->unit = $unit;
                            if ($minStock > 0) {
                                $invStore->min_stock = $minStock;
                            }
                            if (! empty($expirationDate)) {
                                $invStore->expiration_date = $expirationDate;
                            }
                            $invStore->restock_date = now();
                            $invStore->save();
                        } else {
                            InventoryStore::create([
                                'product_id' => $item['product_id'],
                                'store_id' => $request->destination_store_id,
                                'quantity' => (float) $item['quantity'],
                                'stock_quantity' => (float) $item['quantity'],
                                'price' => $costPrice,
                                'sale_price' => (float) ($salePrice > 0 ? $salePrice : $costPrice),
                                'unit' => $unit,
                                'min_stock' => $minStock,
                                'expiration_date' => $expirationDate,
                                'restock_date' => now(),
                            ]);
                        }
                    }
                }

                return $movement;
            });

            $movement->load(['destinationStore', 'user', 'items.product.category']);

            if ($directToStore) {
                $this->notifyTransferStatus($movement, true);
            }

            $successMsg = $directToStore
                ? 'Distribución directa entregada a la tienda con éxito. Guía de Remisión N° '.$movement->document_number
                : 'Envío confirmado y registrado correctamente con Guía de Remisión N° '.$movement->document_number;

            return response()->json([
                'message' => $successMsg,
                'movement' => $movement,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage() ?: 'Error al procesar el envío de productos',
            ], 400);
        }
    }

    /**
     * Ver detalle de un movimiento específico.
     */
    public function show(string $id): JsonResponse
    {
        $movement = StockMovement::with([
            'destinationStore',
            'user:id,name,email',
            'items.product.category',
            'items.product.brand',
        ])->find($id);

        if (! $movement) {
            return response()->json(['message' => 'Movimiento de stock no encontrado'], 404);
        }

        return response()->json($movement);
    }

    /**
     * Retorno / Devolución al Almacén.
     * Si la tienda rechaza o se cancela el traslado:
     * 1. Cambia el estado a 'returned'.
     * 2. Suma de regreso las cantidades a inventory_warehouses.
     * 3. Las cantidades en inventory_stores no se alteran.
     */
    public function returnMovement(Request $request, string $id): JsonResponse
    {
        $movement = StockMovement::with('items.product')->find($id);

        if (! $movement) {
            return response()->json(['message' => 'Movimiento de stock no encontrado'], 404);
        }

        if ($movement->status === 'returned') {
            return response()->json(['message' => 'Este envío ya fue devuelto al almacén previamente.'], 400);
        }

        if ($movement->status === 'completed') {
            return response()->json(['message' => 'No se puede retornar un envío que ya fue completado y recibido por la tienda.'], 400);
        }

        try {
            DB::transaction(function () use ($movement, $request) {
                // Reintegrar productos a inventory_warehouses
                foreach ($movement->items as $item) {
                    $itemUnit = trim((string) ($item->unit ?: 'Unidad'));
                    $whItem = InventoryWarehouse::where('product_id', $item->product_id)
                        ->whereRaw('LOWER(TRIM(unit)) = ?', [mb_strtolower($itemUnit)])
                        ->first()
                        ?? InventoryWarehouse::where('product_id', $item->product_id)->first();

                    if ($whItem) {
                        $whItem->increment('stock_quantity', (float) $item->quantity);
                    } else {
                        // Si por algún motivo el registro de almacén fue eliminado, se recrea
                        InventoryWarehouse::create([
                            'product_id' => $item->product_id,
                            'quantity' => (float) $item->quantity,
                            'stock_quantity' => (float) $item->quantity,
                            'price' => (float) $item->cost_price,
                            'unit' => $itemUnit,
                            'restock_date' => now(),
                        ]);
                    }
                }

                $reason = $request->get('reason', 'Devolución de traslado cancelado/rechazado');
                $updatedNotes = trim(($movement->notes ? $movement->notes.' | ' : '')."[DEVUELTO: {$reason} - ".now()->format('d/m/Y H:i').']');

                $movement->update([
                    'status' => 'returned',
                    'notes' => $updatedNotes,
                ]);
            });

            $movement->load(['destinationStore', 'user', 'items.product']);
            $this->notifyTransferStatus($movement, false);

            return response()->json([
                'message' => 'Envío retornado y cantidades devueltas al almacén correctamente.',
                'movement' => $movement,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al procesar la devolución al almacén: '.$e->getMessage(),
            ], 400);
        }
    }

    /**
     * Completar recepción del envío en la tienda de destino.
     * Incrementa o crea el stock en inventory_stores.
     */
    public function receiveMovement(string $id): JsonResponse
    {
        $movement = StockMovement::with('items.product')->find($id);

        if (! $movement) {
            return response()->json(['message' => 'Movimiento de stock no encontrado'], 404);
        }

        if ($movement->status === 'completed') {
            return response()->json(['message' => 'Este envío ya ha sido recibido y completado.'], 400);
        }

        if ($movement->status === 'returned' || $movement->status === 'cancelled') {
            return response()->json(['message' => 'No se puede recibir un envío cancelado o devuelto.'], 400);
        }

        try {
            DB::transaction(function () use ($movement) {
                foreach ($movement->items as $item) {
                    $itemUnit = trim((string) ($item->unit ?: 'Unidad'));
                    $invStore = InventoryStore::where('product_id', $item->product_id)
                        ->where('store_id', $movement->destination_store_id)
                        ->whereRaw('LOWER(TRIM(unit)) = ?', [mb_strtolower($itemUnit)])
                        ->first();

                    if ($invStore) {
                        $invStore->increment('stock_quantity', (float) $item->quantity);
                        $invStore->increment('quantity', (float) $item->quantity);
                        if ($item->sale_price > 0) {
                            $invStore->sale_price = (float) $item->sale_price;
                        }
                        $invStore->unit = $itemUnit;
                        if (isset($item->min_stock) && $item->min_stock > 0) {
                            $invStore->min_stock = (float) $item->min_stock;
                        }
                        if (! empty($item->expiration_date)) {
                            $invStore->expiration_date = $item->expiration_date;
                        }
                        $invStore->restock_date = now();
                        $invStore->save();
                    } else {
                        InventoryStore::create([
                            'product_id' => $item->product_id,
                            'store_id' => $movement->destination_store_id,
                            'quantity' => (float) $item->quantity,
                            'stock_quantity' => (float) $item->quantity,
                            'price' => (float) $item->cost_price,
                            'sale_price' => (float) ($item->sale_price > 0 ? $item->sale_price : $item->cost_price),
                            'unit' => $itemUnit,
                            'min_stock' => (float) ($item->min_stock ?? 0),
                            'expiration_date' => $item->expiration_date,
                            'restock_date' => now(),
                        ]);
                    }
                }

                $movement->update([
                    'status' => 'completed',
                    'received_at' => now(),
                ]);
            });

            $movement->load(['destinationStore', 'user', 'items.product']);
            $this->notifyTransferStatus($movement, true);

            return response()->json([
                'message' => 'Envío recibido con éxito. Stock ingresado a la tienda destino.',
                'movement' => $movement,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al recibir el envío: '.$e->getMessage(),
            ], 400);
        }
    }

    private function notifyTransferStatus(StockMovement $movement, bool $received): void
    {
        try {
            $storeName = $movement->destinationStore?->name ?? 'la tienda destino';
            $document = $movement->document_number;
            $type = $received ? 'transfer_received' : 'transfer_rejected';

            $this->notificationService->sendToRecipients(
                $this->recipientResolver->tenantInventoryRecipients($movement->destination_store_id),
                $received ? 'Transferencia recibida' : 'Transferencia rechazada',
                $received
                    ? "{$storeName} recibió correctamente la transferencia {$document}."
                    : "{$storeName} rechazó la transferencia {$document}.",
                [
                    'severity' => $received ? 'info' : 'critical',
                    'action_url' => '/inventories',
                    'resource' => 'stock_movement',
                    'resource_id' => (string) $movement->id,
                    'document_number' => $document,
                    'store_id' => $movement->destination_store_id,
                ],
                $type,
            );
        } catch (\Throwable $exception) {
            Log::error('El movimiento se guardó, pero no se pudo notificar su estado.', [
                'movement_id' => $movement->id,
                'type' => $received ? 'transfer_received' : 'transfer_rejected',
                'exception' => $exception->getMessage(),
            ]);
        }
    }
}
