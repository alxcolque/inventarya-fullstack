<?php

namespace App\Http\Controllers;

use App\Exceptions\IdempotencyConflictException;
use App\Http\Requests\SaleRequest;
use App\Models\Assignment;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SalePayment;
use App\Models\SaleRefund;
use App\Models\Store;
use App\Services\SaleCancellationService;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleController extends Controller
{
    /**
     * Display a listing of the resource (con filtros de tienda y fecha y aislamiento multi-store).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Sale::with([
            'customer',
            'user:id,name,email',
            'store:id,name,slug',
            'saleDetails.product:id,name,sku,barcode',
            'payments',
        ])->orderBy('created_at', 'desc');

        // Aislamiento Multi-Store estricto (H-04)
        if ($user && !$user->can('stores:view-all')) {
            $assignedStoreIds = Assignment::where('user_id', $user->id)->pluck('store_id')->toArray();
            if ($request->has('store_id') && !empty($request->store_id) && $request->store_id !== 'all') {
                $requestedStore = Store::where('id', $request->store_id)->orWhere('slug', $request->store_id)->first();
                if (!$requestedStore || !in_array($requestedStore->id, $assignedStoreIds)) {
                    return response()->json(['sales' => []], 200);
                }
                $query->where('store_id', $requestedStore->id);
            } else {
                $query->whereIn('store_id', $assignedStoreIds);
            }
        } else {
            if ($request->has('store_id') && !empty($request->store_id) && $request->store_id !== 'all') {
                $storeId = $request->store_id;
                $store = Store::where('id', $storeId)->orWhere('slug', $storeId)->first();
                if ($store) {
                    $query->where('store_id', $store->id);
                } else {
                    $query->where('store_id', $storeId);
                }
            }
        }

        if ($request->has('from_date') && !empty($request->from_date)) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }

        if ($request->has('to_date') && !empty($request->to_date)) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $tz = \App\Models\Setting::first()?->timezone ?: 'America/La_Paz';
        $sales = $query->get()->map(function ($sale) use ($tz) {
            $customerName = ($sale->customer_id === 0 || !$sale->customer)
                ? ($sale->name ?: 'Cliente')
                : $sale->customer->name;

            $sale['customer'] = $customerName;
            $sale['customer_name'] = $customerName;
            $sale['date'] = Carbon::parse($sale->created_at)->diffForHumans();
            $saleDateCarbon = $sale->created_at ? $sale->created_at->copy()->setTimezone($tz) : null;
            $sale['sale_date'] = $saleDateCarbon ? $saleDateCarbon->format('Y-m-d') : ($sale->order_date ? substr((string) $sale->order_date, 0, 10) : null);
            $sale['formatted_date'] = $saleDateCarbon ? $saleDateCarbon->format('d/m/Y H:i') : null;

            return $sale;
        });

        return response()->json([
            'sales' => $sales,
        ], 200);
    }

    /**
     * Get sales by store slug / id (con validación de permisos multi-store).
     */
    public function getSalesByStoreId(Request $request, $slug)
    {
        $storeQuery = Store::where('slug', $slug);
        if (\Illuminate\Support\Str::isUuid($slug)) {
            $storeQuery->orWhere('id', $slug);
        }
        $store = $storeQuery->first();

        if (!$store) {
            return response()->json(['message' => 'La tienda no existe'], 404);
        }

        $user = $request->user();
        if ($user && !$user->can('stores:view-all')) {
            $isAssigned = Assignment::where('user_id', $user->id)->where('store_id', $store->id)->exists();
            abort_unless($isAssigned, 403, 'No tienes acceso a las ventas de esta tienda.');
        }

        $query = Sale::with([
            'customer',
            'user:id,name,email',
            'store:id,name,slug',
            'saleDetails.product:id,name,sku,barcode',
            'payments',
        ])
            ->where('store_id', $store->id)
            ->orderBy('created_at', 'desc');

        if ($request->has('from_date') && !empty($request->from_date)) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }

        if ($request->has('to_date') && !empty($request->to_date)) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $tz = \App\Models\Setting::first()?->timezone ?: 'America/La_Paz';
        $sales = $query->get()->map(function ($sale) use ($tz) {
            $customerName = ($sale->customer_id === 0 || !$sale->customer)
                ? ($sale->name ?: 'Cliente')
                : $sale->customer->name;

            $sale['customer'] = $customerName;
            $sale['customer_name'] = $customerName;
            $sale['date'] = Carbon::parse($sale->created_at)->diffForHumans();
            $saleDateCarbon = $sale->created_at ? $sale->created_at->copy()->setTimezone($tz) : null;
            $sale['sale_date'] = $saleDateCarbon ? $saleDateCarbon->format('Y-m-d') : ($sale->order_date ? substr((string) $sale->order_date, 0, 10) : null);
            $sale['formatted_date'] = $saleDateCarbon ? $saleDateCarbon->format('d/m/Y H:i') : null;

            return $sale;
        });

        return response()->json([
            'sales' => $sales,
        ], 200);
    }

    /**
     * Store a newly created resource in storage.
     * Incorpora precios autoritativos, bloqueo pesimista ordenado, pagos mixtos y aislamiento.
     */
    public function store(SaleRequest $request)
    {
        if (tenancy()->initialized && DB::getDefaultConnection() !== 'tenant') {
            DB::setDefaultConnection('tenant');
        }

        $user = $request->user();
        if ($user && !$user->can('sales:create')) {
            abort(403, 'No tienes permiso para registrar ventas.');
        }

        $data = $request->validated();

        if (empty($request->products) || !is_array($request->products)) {
            return response()->json(['message' => 'El carrito no contiene productos.'], 400);
        }

        // Control de duplicados e idempotencia para sincronización offline
        if (!empty($request->id)) {
            $existingSale = Sale::with(['payments', 'saleDetails'])->find($request->id);
            if ($existingSale) {
                try {
                    $this->assertSaleIdempotentPayloadMatches($existingSale, $request, $data);
                } catch (IdempotencyConflictException $e) {
                    return response()->json([
                        'message' => $e->getMessage(),
                        'code' => 'SALE_IDEMPOTENCY_CONFLICT',
                    ], 409);
                }

                $affectedProducts = InventoryStore::where('store_id', $existingSale->store_id)
                    ->whereIn('product_id', $existingSale->saleDetails->pluck('product_id')->unique())
                    ->get()
                    ->map(fn($inv) => [
                        'product_id' => (int) $inv->product_id,
                        'inventory_id' => $inv->id,
                        'stock_quantity' => (float) $inv->stock_quantity,
                    ])
                    ->values()
                    ->all();

                app(\App\Services\CashRegisterService::class)->authorize($request->user(), $existingSale->store_id);
                return response()->json([
                    'message' => 'Venta sincronizada previamente',
                    'sale' => $existingSale,
                    'id' => $existingSale->id,
                    'is_duplicate' => true,
                    'code' => 'SALE_ALREADY_SYNCED',
                    'affected_products' => $affectedProducts,
                ], 200);
            }
            $data['id'] = $request->id;
        }

        // Consolidar cantidades por producto para evitar evasión de stock en líneas repetidas
        $consolidatedQuantities = [];
        foreach ($request->products as $product) {
            if (empty($product['product_id'])) {
                return response()->json(['message' => 'Cada producto debe especificar su product_id.'], 400);
            }
            $pId = (string) $product['product_id'];
            $qty = (float) ($product['quantity'] ?? 0);
            if ($qty <= 0) {
                return response()->json(['message' => 'La cantidad de cada producto debe ser mayor a 0.'], 400);
            }
            $consolidatedQuantities[$pId] = ($consolidatedQuantities[$pId] ?? 0.0) + $qty;
        }

        // Ordenamiento determinista de IDs de productos para evitar deadlocks
        $sortedProductIds = array_keys($consolidatedQuantities);
        sort($sortedProductIds);

        try {
            $sale = DB::transaction(function () use ($request, $data, $user, $consolidatedQuantities, $sortedProductIds) {
                $cash = app(\App\Services\CashRegisterService::class)->forSale(
                    $request->user(), $data['store_id'], $data['cash_register_session_id'] ?? null, !empty($request->id)
                );
                $data['cash_register_session_id'] = $cash->id;

                // Recheck idempotency after acquiring the session lock
                if (!empty($request->id) && ($existing = Sale::with(['payments', 'saleDetails'])->find($request->id))) {
                    $this->assertSaleIdempotentPayloadMatches($existing, $request, $data);
                    return $existing;
                }

                // 1. Bloqueo pesimista ordenado de filas en InventoryStore
                $inventoryStores = InventoryStore::where('store_id', $data['store_id'])
                    ->whereIn('product_id', $sortedProductIds)
                    ->orderBy('product_id', 'asc')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('product_id');

                $productsMap = Product::whereIn('id', $sortedProductIds)->get()->keyBy('id');

                // Validar stock bajo lock
                foreach ($consolidatedQuantities as $prodId => $totalReqQty) {
                    $prod = $productsMap->get($prodId);
                    $prodName = $prod ? $prod->name : "Producto #{$prodId}";

                    $invStore = $inventoryStores->get($prodId);
                    if (!$invStore) {
                        throw new \Exception("El producto '{$prodName}' no se encuentra registrado en el inventario de esta tienda.");
                    }

                    if ((float) $invStore->stock_quantity < $totalReqQty) {
                        throw new \Exception("Stock insuficiente para '{$prodName}'. Stock disponible: {$invStore->stock_quantity}, Cantidad solicitada: {$totalReqQty}.");
                    }
                }

                // 2. Resolución de precios autoritativos y cálculo de subtotales con BigDecimal
                $canEditPrice = $user ? $user->can('sales:edit-price') : false;
                $calculatedSubtotalBD = BigDecimal::zero();
                $processedLines = [];

                foreach ($request->products as $item) {
                    $prodId = (string) $item['product_id'];
                    $invStore = $inventoryStores->get($prodId);
                    $catalogPrice = (float) ($invStore->sale_price > 0 ? $invStore->sale_price : $invStore->price);

                    if ($canEditPrice && isset($item['price']) && is_numeric($item['price']) && (float) $item['price'] >= 0) {
                        $effectivePrice = (float) $item['price'];
                    } else {
                        $effectivePrice = $catalogPrice;
                    }

                    $qtyBD = BigDecimal::of((string) $item['quantity']);
                    $priceBD = BigDecimal::of((string) $effectivePrice)->toScale(2, RoundingMode::HALF_UP);
                    $lineSubtotalBD = $qtyBD->multipliedBy($priceBD)->toScale(2, RoundingMode::HALF_UP);
                    $calculatedSubtotalBD = $calculatedSubtotalBD->plus($lineSubtotalBD);

                    $processedLines[] = [
                        'product_id' => $prodId,
                        'id' => $item['id'] ?? null,
                        'quantity' => (float) $item['quantity'],
                        'price' => (float) (string) $priceBD,
                        'subtotal' => (float) (string) $lineSubtotalBD,
                    ];
                }

                // 3. Validación de descuento
                $requestedDiscount = (float) ($request->discount ?? 0);
                if ($requestedDiscount < 0) {
                    throw ValidationException::withMessages(['discount' => 'El descuento no puede ser negativo.']);
                }
                $discountBD = BigDecimal::of((string) $requestedDiscount)->toScale(2, RoundingMode::HALF_UP);
                if ($discountBD->isGreaterThan($calculatedSubtotalBD)) {
                    throw ValidationException::withMessages(['discount' => 'El descuento no puede ser mayor al subtotal de la venta.']);
                }

                $calculatedTotalBD = $calculatedSubtotalBD->minus($discountBD);

                // 4. Normalización y validación de pagos (Simple y Mixto)
                $paymentsList = [];
                if ($request->has('payments') && is_array($request->payments) && count($request->payments) > 0) {
                    $paymentsSumBD = BigDecimal::zero();
                    $methodsUsed = [];

                    foreach ($request->payments as $p) {
                        $pMethod = strtolower(trim($p['payment_method'] ?? 'efectivo'));
                        $methodsUsed[$pMethod] = true;
                        $pAmountBD = BigDecimal::of((string) ($p['amount'] ?? 0))->toScale(2, RoundingMode::HALF_UP);
                        if ($pAmountBD->isLessThanOrEqualTo(BigDecimal::zero())) {
                            throw ValidationException::withMessages(['payments' => 'El monto de cada pago debe ser mayor a 0.']);
                        }
                        $paymentsSumBD = $paymentsSumBD->plus($pAmountBD);

                        $pReceived = null;
                        $pChange = null;
                        if (\App\Services\CashRegisterService::isCash($pMethod)) {
                            $recVal = isset($p['amount_received']) && is_numeric($p['amount_received'])
                                ? (float) $p['amount_received']
                                : (float) (string) $pAmountBD;
                            if ($recVal < (float) (string) $pAmountBD) {
                                throw ValidationException::withMessages(['payments' => 'El monto recibido en efectivo no puede ser menor al monto a cobrar.']);
                            }
                            $pReceived = $recVal;
                            $pChange = round($recVal - (float) (string) $pAmountBD, 2);
                        }

                        $paymentsList[] = [
                            'payment_method' => $pMethod,
                            'amount' => (float) (string) $pAmountBD,
                            'amount_received' => $pReceived,
                            'change_amount' => $pChange,
                            'reference' => $p['reference'] ?? null,
                        ];
                    }

                    if ($paymentsSumBD->compareTo($calculatedTotalBD) !== 0) {
                        throw ValidationException::withMessages([
                            'payments' => "La suma de los pagos (" . (string) $paymentsSumBD . ") no coincide con el total de la venta (" . (string) $calculatedTotalBD . ")."
                        ]);
                    }

                    $primaryPaymentMethod = count($methodsUsed) === 1 ? array_key_first($methodsUsed) : 'mixto';
                } else {
                    // Compatibilidad hacia atrás: pago único
                    $singleMethod = strtolower(trim($request->payment_method ?: 'efectivo'));
                    $pReceived = null;
                    $pChange = null;

                    if (\App\Services\CashRegisterService::isCash($singleMethod)) {
                        $recVal = isset($request->amount_received) && is_numeric($request->amount_received)
                            ? (float) $request->amount_received
                            : (float) (string) $calculatedTotalBD;
                        if ($recVal < (float) (string) $calculatedTotalBD) {
                            throw ValidationException::withMessages(['amount_received' => 'El monto recibido en efectivo no puede ser menor al total.']);
                        }
                        $pReceived = $recVal;
                        $pChange = round($recVal - (float) (string) $calculatedTotalBD, 2);
                    }

                    $paymentsList[] = [
                        'payment_method' => $singleMethod,
                        'amount' => (float) (string) $calculatedTotalBD,
                        'amount_received' => $pReceived,
                        'change_amount' => $pChange,
                        'reference' => $request->observation ?? null,
                    ];
                    $primaryPaymentMethod = $singleMethod;
                }

                // 5. Asignar cliente y metadatos
                if ($request->tab === 'customer') {
                    $data['customer_id'] = 0;
                    $data['name'] = $request->name ?: 'Cliente';
                    $data['phone'] = $request->phone;
                } else {
                    $data['customer_id'] = $request->customer_id ?? 0;
                }

                if (empty($data['user_id'])) {
                    $data['user_id'] = $request->seller_id ?? $request->user()?->id ?? auth()->id() ?? 1;
                }
                if (empty($data['order_date'])) {
                    $data['order_date'] = now();
                }

                $data['total'] = (float) (string) $calculatedTotalBD;
                $data['discount'] = (float) (string) $discountBD;
                $data['payment_method'] = $primaryPaymentMethod;

                $sale = Sale::create($data);

                // 6. Registrar detalle y decrementar stock bajo lock
                foreach ($processedLines as $line) {
                    $detailData = [
                        'sale_id' => $sale->id,
                        'product_id' => $line['product_id'],
                        'quantity' => $line['quantity'],
                        'price' => $line['price'],
                        'subtotal' => $line['subtotal'],
                    ];
                    if (!empty($line['id'])) {
                        $detailData['id'] = $line['id'];
                    }

                    SaleDetail::create($detailData);

                    $inventoryStore = $inventoryStores->get($line['product_id']);
                    if ($inventoryStore) {
                        $inventoryStore->decrement('stock_quantity', $line['quantity']);
                    }
                }

                // 7. Registrar desglose en sale_payments
                foreach ($paymentsList as $paymentData) {
                    $paymentData['sale_id'] = $sale->id;
                    SalePayment::create($paymentData);
                }

                return $sale->load(['saleDetails.product', 'payments']);
            });

            $connName = $sale->getConnectionName() ?: (tenancy()->initialized ? 'tenant' : DB::getDefaultConnection());
            $affectedProducts = InventoryStore::on($connName)
                ->where('store_id', $sale->store_id)
                ->whereIn('product_id', $sale->saleDetails->pluck('product_id')->unique())
                ->get()
                ->map(fn($inv) => [
                    'product_id' => (int) $inv->product_id,
                    'inventory_id' => $inv->id,
                    'stock_quantity' => (float) $inv->stock_quantity,
                ])
                ->values()
                ->all();

            // Disparar eventos de negocio de forma desacoplada
            try {
                $sale->loadMissing(['store', 'user']);
                event(new \App\Events\Tenant\SaleCompletedEvent([
                    'sale_id' => $sale->id,
                    'store_id' => $sale->store_id,
                    'store_name' => $sale->store?->name ?? 'Tienda',
                    'total' => (float) $sale->total,
                    'seller_name' => $sale->user?->name ?? 'Vendedor',
                    'action_url' => '/sales',
                ]));
            } catch (\Throwable $evEx) {
                \Illuminate\Support\Facades\Log::warning('Error al despachar eventos post-venta: ' . $evEx->getMessage());
            }

            $isDuplicate = !$sale->wasRecentlyCreated;

            return response()->json([
                'message' => $isDuplicate ? 'Venta sincronizada previamente' : 'Venta registrada con éxito',
                'sale' => $sale,
                'id' => $sale->id,
                'is_duplicate' => $isDuplicate,
                'code' => $isDuplicate ? 'SALE_ALREADY_SYNCED' : null,
                'affected_products' => $affectedProducts,
            ], $isDuplicate ? 200 : 201);
        } catch (\App\Exceptions\CashRegisterConflictException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => $e->getErrorCode(),
                'errors' => ['cash_register' => [$e->getMessage()]],
            ], 422);
        } catch (IdempotencyConflictException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'SALE_IDEMPOTENCY_CONFLICT',
            ], 409);
        } catch (\Illuminate\Database\QueryException $e) {
            if (!empty($request->id) && (string)$e->getCode() === '23505') {
                $existing = Sale::with(['payments', 'saleDetails'])->find($request->id);
                if ($existing) {
                    $this->assertSaleIdempotentPayloadMatches($existing, $request, $data);
                    $affectedProducts = InventoryStore::where('store_id', $existing->store_id)
                        ->whereIn('product_id', $existing->saleDetails->pluck('product_id')->unique())
                        ->get()
                        ->map(fn($inv) => [
                            'product_id' => (int) $inv->product_id,
                            'inventory_id' => $inv->id,
                            'stock_quantity' => (float) $inv->stock_quantity,
                        ])
                        ->values()
                        ->all();
                    return response()->json([
                        'message' => 'Venta sincronizada previamente',
                        'sale' => $existing,
                        'id' => $existing->id,
                        'is_duplicate' => true,
                        'code' => 'SALE_ALREADY_SYNCED',
                        'affected_products' => $affectedProducts,
                    ], 200);
                }
            }
            throw $e;
        } catch (\Illuminate\Validation\ValidationException|\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            throw $e;
        } catch (\Exception $e) {
            $code = str_contains($e->getMessage(), 'Stock insuficiente') ? 'STOCK_INSUFFICIENT' : 'SALE_PROCESSING_ERROR';
            return response()->json([
                'message' => $e->getMessage() ?: 'Error al procesar la venta',
                'code' => $code,
            ], 400);
        }
    }

    /**
     * Display the specified resource (con validación de aislamiento multi-store).
     */
    public function show(Request $request, $id)
    {
        $sale = Sale::with([
            'payments',
            'customer',
            'user:id,name,email',
            'store:id,name,slug',
            'saleDetails.product:id,name,sku,barcode',
        ])->find($id);

        if (!$sale) {
            return response()->json(['message' => 'Venta no encontrada'], 404);
        }

        $user = $request->user();
        if ($user && !$user->can('stores:view-all')) {
            $isAssigned = Assignment::where('user_id', $user->id)->where('store_id', $sale->store_id)->exists();
            abort_unless($isAssigned, 403, 'No tienes acceso a esta venta.');
        }

        return response()->json($sale);
    }

    /**
     * Retorna la información estructurada para el comprobante de venta interno comercial.
     * Estrictamente diferenciado de factura electrónica (sin CUF, CUFD, QR ni leyendas fiscales).
     */
    public function receipt($id)
    {
        $sale = Sale::with(['store', 'customer', 'user', 'saleDetails.product', 'payments'])->find($id);

        if (!$sale) {
            return response()->json(['message' => 'Venta no encontrada'], 404);
        }

        $setting = \App\Models\Setting::first();
        $tz = $setting?->timezone ?: 'America/La_Paz';
        $saleDate = $sale->created_at ? $sale->created_at->copy()->setTimezone($tz) : now();

        $items = $sale->saleDetails->map(function ($d) {
            return [
                'product_name' => $d->product?->name ?? "Item #{$d->product_id}",
                'quantity'     => (float) $d->quantity,
                'price'        => (float) $d->price,
                'subtotal'     => (float) $d->subtotal,
            ];
        });

        $customerName = ($sale->customer_id === 0 || !$sale->customer)
            ? ($sale->name ?: 'Cliente')
            : $sale->customer->name;

        $payments = $sale->payments->map(function ($p) {
            return [
                'payment_method'  => $p->payment_method,
                'amount'          => (float) $p->amount,
                'amount_received' => $p->amount_received !== null ? (float) $p->amount_received : null,
                'change_amount'   => $p->change_amount !== null ? (float) $p->change_amount : null,
                'reference'       => $p->reference,
            ];
        });

        return response()->json([
            'document_title' => 'COMPROBANTE DE VENTA',
            'disclaimer'     => 'DOCUMENTO INTERNO COMERCIAL - NO VÁLIDO PARA CRÉDITO FISCAL',
            'sale_id'        => $sale->id,
            'date'           => $saleDate->format('d/m/Y H:i'),
            'store_name'     => $sale->store?->name ?? 'Tienda',
            'store_address'  => $sale->store?->address,
            'store_phone'    => $sale->store?->phone,
            'cashier_name'   => $sale->user?->name ?? 'Cajero',
            'customer_name'  => $customerName,
            'customer_phone' => $sale->customer?->phone ?: $sale->phone,
            'payment_method' => $sale->payment_method ?? 'Efectivo',
            'payments'       => $payments,
            'items'          => $items,
            'subtotal'       => (float) $sale->saleDetails->sum('subtotal'),
            'discount'       => (float) ($sale->discount ?? 0),
            'total'          => (float) $sale->total,
            'is_fiscal'      => false,
        ], 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SaleRequest $request, $id)
    {
        $user = $request->user();
        if ($user && !$user->can('sales:update')) {
            abort(403, 'No tienes permiso para actualizar ventas.');
        }

        $data = $request->validated();
        $sale = Sale::find($id);
        if (!$sale) {
            return response()->json(['message' => 'Venta no encontrada'], 404);
        }

        if ($sale->isFinalized()) {
            throw ValidationException::withMessages(['sale' => 'Las ventas finalizadas no pueden modificarse directamente.']);
        }

        if ($sale->cash_register_session_id) {
            throw ValidationException::withMessages(['sale' => 'Una venta vinculada a caja no puede editarse mediante esta operación.']);
        }
        unset($data['cash_register_session_id']);
        $sale->update($data);

        return response()->json([
            'message' => 'Venta actualizada correctamente',
        ], 201);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if ($user && !$user->can('sales:delete')) {
            abort(403, 'No tienes permiso para eliminar ventas.');
        }

        $sale = Sale::find($id);
        if (!$sale) {
            return response()->json(['message' => 'Venta no encontrada'], 404);
        }

        if ($sale->isFinalized()) {
            throw ValidationException::withMessages(['sale' => 'Las ventas finalizadas no pueden eliminarse. Utilice cancelación o devolución comercial.']);
        }

        if ($sale->cash_register_session_id) {
            throw ValidationException::withMessages(['sale' => 'Una venta vinculada a caja no puede eliminarse mediante esta operación.']);
        }
        $sale->delete();

        return response()->json([
            'message' => 'Venta eliminada correctamente',
        ], 201);
    }

    /**
     * Cancela comercialmente una venta de forma total, atómica e idempotente (Fase 6B.3D).
     */
    public function cancel(Request $request, string $id)
    {
        $user = $request->user();
        if ($user && !$user->can('sales:cancel')) {
            abort(403, 'No tienes permiso para cancelar ventas.');
        }

        $sale = Sale::findOrFail($id);

        if ($user && !$user->can('stores:view-all')) {
            $isAssigned = Assignment::where('user_id', $user->id)
                ->where('store_id', $sale->store_id)
                ->exists();
            abort_unless($isAssigned, 403, 'No tienes acceso a esta venta.');
        }

        $request->validate([
            'id'     => 'nullable|uuid',
            'reason' => 'nullable|string|max:255',
            'notes'  => 'nullable|string|max:1000',
        ]);

        try {
            $service = app(SaleCancellationService::class);
            $result = $service->cancelSale($sale, $request->all(), $user);

            $statusCode = $result['is_duplicate'] ? 200 : 201;

            return response()->json($result, $statusCode);
        } catch (IdempotencyConflictException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 409);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage() ?: 'Error al cancelar la venta.',
            ], 400);
        }
    }

    /* Saca el total de ventas de hoy con integridad contable */
    public function totalSalesToday()
    {
        $today = Carbon::today();
        $grossSales = (float) Sale::whereDate('created_at', $today)
            ->whereIn('status', ['completed', 'completado', 'cancelled', 'cancelado'])
            ->sum('total');

        $refunds = (float) SaleRefund::whereDate('created_at', $today)
            ->where('status', 'completed')
            ->sum('total');

        $netSales = max(0.0, round($grossSales - $refunds, 2));

        return response()->json([
            'totalSalesToday' => $netSales,
            'gross_sales'     => $grossSales,
            'refunds'         => $refunds,
            'net_sales'       => $netSales,
        ], 200);
    }

    /**
     * Valida la huella canónica de idempotencia para un reintento de venta offline con el mismo UUID.
     * Invariante: Determinista, normalizado por productos (orden y duplicados), sin floats monetarios (centavos exactos),
     * composición de pagos, descuento exacto, identidad de cliente comercial y sesión de caja original.
     */
    protected function assertSaleIdempotentPayloadMatches(Sale $existing, Request $request, array $data): void
    {
        // 1. Tienda (store_id)
        $reqStoreId = (string) ($data['store_id'] ?? $request->store_id ?? '');
        if ($reqStoreId !== '' && (string) $existing->store_id !== $reqStoreId) {
            throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta en otra sucursal.');
        }

        // 2. Líneas de productos y cantidades (Normalización canónica de orden y líneas repetidas/consolidadas)
        $incomingQuantities = [];
        foreach ($request->products as $p) {
            $pId = (string) ($p['product_id'] ?? '');
            $qtyBD = BigDecimal::of((string) ($p['quantity'] ?? 0))->toScale(3, RoundingMode::HALF_UP);
            $incomingQuantities[$pId] = ($incomingQuantities[$pId] ?? BigDecimal::zero())->plus($qtyBD);
        }

        $existingQuantities = [];
        foreach ($existing->saleDetails as $detail) {
            $pId = (string) $detail->product_id;
            $qtyBD = BigDecimal::of((string) $detail->quantity)->toScale(3, RoundingMode::HALF_UP);
            $existingQuantities[$pId] = ($existingQuantities[$pId] ?? BigDecimal::zero())->plus($qtyBD);
        }

        ksort($incomingQuantities);
        ksort($existingQuantities);

        if (array_keys($incomingQuantities) !== array_keys($existingQuantities)) {
            throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con productos diferentes.');
        }

        foreach ($incomingQuantities as $pId => $inQtyBD) {
            if (!$inQtyBD->isEqualTo($existingQuantities[$pId])) {
                throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con cantidades diferentes.');
            }
        }

        // 3. Descuento comercial (centavos exactos)
        if ($request->has('discount') || isset($data['discount'])) {
            $inDiscountCents = \App\Services\CashRegisterService::cents($data['discount'] ?? $request->discount ?? 0);
            $exDiscountCents = \App\Services\CashRegisterService::cents($existing->discount ?? 0);
            if ($inDiscountCents !== $exDiscountCents) {
                throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con descuento diferente.');
            }
        }

        // 4. Monto Total (centavos exactos sin tolerancias de float arbitrarias)
        if ($request->has('total') || isset($data['total'])) {
            $inTotalCents = \App\Services\CashRegisterService::cents($data['total'] ?? $request->total);
            $exTotalCents = \App\Services\CashRegisterService::cents($existing->total);
            if ($inTotalCents !== $exTotalCents) {
                throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con monto total diferente.');
            }
        }

        // 5. Composición de Pagos (sale_payments / payment_method)
        if ($request->has('payments') && is_array($request->payments) && count($request->payments) > 0) {
            $inPayments = [];
            foreach ($request->payments as $p) {
                $m = strtolower(trim($p['payment_method'] ?? 'efectivo'));
                $cents = \App\Services\CashRegisterService::cents($p['amount'] ?? 0);
                $inPayments[$m] = ($inPayments[$m] ?? 0) + $cents;
            }

            $exPayments = [];
            if ($existing->payments && $existing->payments->isNotEmpty()) {
                foreach ($existing->payments as $p) {
                    $m = strtolower(trim($p->payment_method ?? 'efectivo'));
                    $cents = \App\Services\CashRegisterService::cents($p->amount ?? 0);
                    $exPayments[$m] = ($exPayments[$m] ?? 0) + $cents;
                }
            } else {
                $m = strtolower(trim($existing->payment_method ?? 'efectivo'));
                $exPayments[$m] = \App\Services\CashRegisterService::cents($existing->total);
            }

            ksort($inPayments);
            ksort($exPayments);

            if (array_keys($inPayments) !== array_keys($exPayments)) {
                throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con métodos de pago diferentes.');
            }

            foreach ($inPayments as $m => $cents) {
                if ($cents !== ($exPayments[$m] ?? 0)) {
                    throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con desglose de pagos diferente.');
                }
            }
        } elseif ($request->has('payment_method') || isset($data['payment_method'])) {
            $inMethod = strtolower(trim($data['payment_method'] ?? $request->payment_method ?? 'efectivo'));
            $exMethod = strtolower(trim($existing->payment_method ?? 'efectivo'));
            if ($inMethod !== $exMethod) {
                throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con método de pago diferente.');
            }
        }

        // 6. Identidad de Cliente comercial registrado
        if ($request->has('customer_id') || isset($data['customer_id'])) {
            $inCustId = (int) ($data['customer_id'] ?? $request->customer_id ?? 0);
            $exCustId = (int) ($existing->customer_id ?? 0);
            if ($inCustId > 0 && $inCustId !== $exCustId) {
                throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta asignada a otro cliente.');
            }
        }

        // 7. Identidad de Sesión de Caja original
        $reqSessionId = $data['cash_register_session_id'] ?? $request->cash_register_session_id ?? null;
        if (!empty($reqSessionId) && !empty($existing->cash_register_session_id)) {
            if ((string) $reqSessionId !== (string) $existing->cash_register_session_id) {
                throw new IdempotencyConflictException('Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta asociada a otra sesión de caja.');
            }
        }
    }
}
