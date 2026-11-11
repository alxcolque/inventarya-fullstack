<?php

namespace App\Services;

use App\Exceptions\IdempotencyConflictException;
use App\Models\CashRegisterMovement;
use App\Models\CashRegisterSession;
use App\Models\InventoryStore;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SaleRefund;
use App\Models\SaleRefundItem;
use App\Models\SaleRefundPayment;
use App\Models\User;
use App\Services\CashRegisterService;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleRefundService
{
    /**
     * Calcula la información autoritativa de saldos y cantidades reembolsables para una venta.
     */
    public function getRefundableData(Sale $sale): array
    {
        $sale->loadMissing(['saleDetails.product', 'payments', 'electronicInvoice']);

        $allDetails = $sale->saleDetails;
        $detailIds = $allDetails->pluck('id')->toArray();

        // 1. Cantidades ya devueltas por detalle
        $refundedQtyMap = SaleRefundItem::whereIn('sale_detail_id', $detailIds)
            ->whereHas('refund', fn ($q) => $q->where('status', 'completed'))
            ->groupBy('sale_detail_id')
            ->select('sale_detail_id', DB::raw('SUM(quantity) as total_refunded'))
            ->pluck('total_refunded', 'sale_detail_id')
            ->toArray();

        $refundedSubtotalMap = SaleRefundItem::whereIn('sale_detail_id', $detailIds)
            ->whereHas('refund', fn ($q) => $q->where('status', 'completed'))
            ->groupBy('sale_detail_id')
            ->select('sale_detail_id', DB::raw('SUM(subtotal) as total_subtotal'))
            ->pluck('total_subtotal', 'sale_detail_id')
            ->toArray();

        // 2. Prorrateo determinista de descuentos si existen
        $lineNetMap = $this->calculateLineNetTotals($sale, $allDetails);

        $items = [];
        $totalSoldQty = 0.0;
        $totalRefundedQty = 0.0;

        foreach ($allDetails as $detail) {
            $soldQty = (float) $detail->quantity;
            $refundedQty = (float) ($refundedQtyMap[$detail->id] ?? 0);
            $refundableQty = max(0.0, round($soldQty - $refundedQty, 3));

            $totalSoldQty += $soldQty;
            $totalRefundedQty += $refundedQty;

            $netLineTotal = (float) (string) $lineNetMap[$detail->id]['net_line_total'];
            $alreadyRefundedMoney = (float) ($refundedSubtotalMap[$detail->id] ?? 0);
            $remainingMoney = max(0.0, round($netLineTotal - $alreadyRefundedMoney, 2));

            $effectiveUnitPrice = $soldQty > 0
                ? round($netLineTotal / $soldQty, 2)
                : (float) $detail->price;

            $items[] = [
                'sale_detail_id'       => $detail->id,
                'product_id'           => $detail->product_id,
                'product_name'         => $detail->product?->name ?? "Producto #{$detail->product_id}",
                'product_sku'          => $detail->product?->sku,
                'sold_quantity'        => $soldQty,
                'refunded_quantity'    => $refundedQty,
                'refundable_quantity'  => $refundableQty,
                'unit_price'           => (float) $detail->price,
                'effective_unit_price' => $effectiveUnitPrice,
                'refundable_amount'    => $remainingMoney,
            ];
        }

        // 3. Métodos de pago y límites de reembolso
        $paymentMethods = $this->getRemainingByPaymentMethod($sale);

        $totalSaleMoney = (float) $sale->total;
        $totalRefundedMoney = (float) SaleRefund::where('sale_id', $sale->id)
            ->where('status', 'completed')
            ->sum('total');
        $remainingRefundableMoney = max(0.0, round($totalSaleMoney - $totalRefundedMoney, 2));

        $refundStatus = 'none';
        if ($totalRefundedQty > 0) {
            $refundStatus = ($totalRefundedQty >= ($totalSoldQty - 0.0001)) ? 'refunded' : 'partially_refunded';
        }

        return [
            'sale_id'                     => $sale->id,
            'sale_total'                  => $totalSaleMoney,
            'total_refunded'              => $totalRefundedMoney,
            'remaining_refundable_amount' => $remainingRefundableMoney,
            'refund_status'               => $refundStatus,
            'has_electronic_invoice'      => $sale->electronicInvoice !== null,
            'items'                       => $items,
            'payment_methods'             => $paymentMethods,
        ];
    }

    /**
     * Procesa una devolución comercial con bloqueo pesimista ordenado, cálculo autoritativo,
     * reposición atómica de stock y movimiento de caja en UNA SOLA transacción.
     *
     * Invariantes Fase 6B.3C:
     * - Toda la operación forma parte de una única transacción DB::transaction.
     * - El stock se restaura autoritativamente sobre inventory_stores.stock_quantity.
     * - El efectivo genera CashRegisterMovement tipo expense en la caja ABIERTA actual.
     * - Las ventas originales y sesiones cerradas permanecen inmutables.
     * - Desacoplado 100% de SIAT (0 llamadas al SIN).
     */
    public function processRefund(Sale $sale, array $data, $user): SaleRefund
    {
        // 1. Verificación previa de idempotencia si se envió un UUID de cliente
        if (!empty($data['id'])) {
            $existing = SaleRefund::with(['items', 'payments', 'cashMovement'])->find($data['id']);
            if ($existing) {
                $this->assertIdempotentPayloadMatches($existing, $sale->id, $data);
                $existing->setAttribute('is_duplicate', true);
                return $existing;
            }
        }

        if (empty($data['items']) || !is_array($data['items'])) {
            throw ValidationException::withMessages(['items' => 'Debe especificar al menos un ítem a devolver.']);
        }

        // Consolidar cantidades solicitadas por sale_detail_id
        $consolidated = [];
        foreach ($data['items'] as $item) {
            if (empty($item['sale_detail_id'])) {
                throw ValidationException::withMessages(['items' => 'Cada ítem debe indicar el sale_detail_id.']);
            }
            $detailId = (string) $item['sale_detail_id'];
            $qty = (float) ($item['quantity'] ?? 0);
            if ($qty <= 0) {
                throw ValidationException::withMessages(['items' => 'La cantidad a devolver debe ser mayor a 0.']);
            }
            $consolidated[$detailId] = ($consolidated[$detailId] ?? 0.0) + $qty;
        }

        // Ordenamiento determinista de IDs de detalles para evitar deadlocks en PostgreSQL
        $sortedDetailIds = array_keys($consolidated);
        sort($sortedDetailIds);

        return DB::transaction(function () use ($sale, $data, $user, $consolidated, $sortedDetailIds) {
            return $this->executeRefundTransaction($sale, $data, $user, $consolidated, $sortedDetailIds);
        });
    }

    /**
     * Ejecuta las operaciones de la devolución dentro de una transacción activa.
     */
    public function executeRefundTransaction(Sale $sale, array $data, $user, array $consolidated, array $sortedDetailIds): SaleRefund
    {
        // 1. Re-bloqueo de Sale bajo transacción
        $lockedSale = Sale::where('id', $sale->id)->lockForUpdate()->firstOrFail();

        // Re-chequeo de idempotencia bajo lock
        if (!empty($data['id'])) {
            $existing = SaleRefund::with(['items', 'payments', 'cashMovement'])->find($data['id']);
            if ($existing) {
                $this->assertIdempotentPayloadMatches($existing, $lockedSale->id, $data);
                $existing->setAttribute('is_duplicate', true);
                return $existing;
            }
        }

        // 2. Bloqueo pesimista ordenado de filas en sale_details
        $lockedDetails = SaleDetail::where('sale_id', $lockedSale->id)
            ->whereIn('id', $sortedDetailIds)
            ->orderBy('id', 'asc')
            ->lockForUpdate()
            ->with('product')
            ->get()
            ->keyBy('id');

        foreach ($sortedDetailIds as $dId) {
            if (!$lockedDetails->has($dId)) {
                throw ValidationException::withMessages(['items' => "El detalle '{$dId}' no pertenece a esta venta."]);
            }
        }

        // 3. Resolver y ordenar productos para bloqueo pesimista de InventoryStore
        $productIds = [];
        foreach ($sortedDetailIds as $dId) {
            $detail = $lockedDetails->get($dId);
            if (empty($detail->product_id)) {
                throw ValidationException::withMessages([
                    'items' => "No es posible reponer automáticamente el stock del ítem porque su producto asociado no existe en el sistema."
                ]);
            }
            $productIds[] = (string) $detail->product_id;
        }
        $sortedProductIds = array_values(array_unique($productIds));
        sort($sortedProductIds);

        // Bloqueo pesimista ordenado de InventoryStore
        $lockedInventoryStores = InventoryStore::where('store_id', $lockedSale->store_id)
            ->whereIn('product_id', $sortedProductIds)
            ->orderBy('product_id', 'asc')
            ->lockForUpdate()
            ->get()
            ->keyBy('product_id');

        foreach ($sortedProductIds as $pId) {
            if (!$lockedInventoryStores->has($pId)) {
                throw ValidationException::withMessages([
                    'items' => 'No existe un registro de inventario válido para restaurar el producto devuelto.'
                ]);
            }
        }

        // 4. Calcular cantidades ya devueltas bajo lock
        $refundedSums = SaleRefundItem::whereIn('sale_detail_id', $sortedDetailIds)
            ->whereHas('refund', fn ($q) => $q->where('status', 'completed'))
            ->groupBy('sale_detail_id')
            ->select('sale_detail_id', DB::raw('SUM(quantity) as qty'))
            ->pluck('qty', 'sale_detail_id')
            ->toArray();

        // Validar cantidades disponibles
        foreach ($sortedDetailIds as $dId) {
            $detail = $lockedDetails->get($dId);
            $soldQty = (float) $detail->quantity;
            $alreadyRefunded = (float) ($refundedSums[$dId] ?? 0);
            $reqQty = $consolidated[$dId];

            if (($alreadyRefunded + $reqQty) > ($soldQty + 0.0001)) {
                $productName = $detail->product_name ?? $detail->product?->name ?? "Ítem #{$dId}";
                throw ValidationException::withMessages([
                    'items' => "La cantidad a devolver supera la cantidad disponible de la venta. (Producto: {$productName}, disponible: " . max(0, $soldQty - $alreadyRefunded) . ", solicitado: {$reqQty})."
                ]);
            }
        }

        // 5. Prorrateo de descuentos y cálculo exacto de subtotales
        $allDetails = SaleDetail::where('sale_id', $lockedSale->id)->get();
        $lineNetMap = $this->calculateLineNetTotals($lockedSale, $allDetails);

        $refundTotalBD = BigDecimal::zero();
        $preparedItems = [];

        foreach ($sortedDetailIds as $dId) {
            $detail = $lockedDetails->get($dId);
            $reqQty = $consolidated[$dId];
            $soldQtyBD = BigDecimal::of((string) $detail->quantity);
            $reqQtyBD = BigDecimal::of((string) $reqQty);

            $netLineTotalBD = $lineNetMap[$dId]['net_line_total'];
            $alreadyRefundedQty = (float) ($refundedSums[$dId] ?? 0);
            $remainingQty = (float) $detail->quantity - $alreadyRefundedQty;

            // Si se devuelve toda la cantidad restante de la línea, devolver el remanente neto exacto
            if (abs($reqQty - $remainingQty) < 0.0001) {
                $prevLineSubtotalSum = (float) SaleRefundItem::where('sale_detail_id', $dId)
                    ->whereHas('refund', fn ($q) => $q->where('status', 'completed'))
                    ->sum('subtotal');
                $itemSubtotalBD = $netLineTotalBD->minus(BigDecimal::of((string) $prevLineSubtotalSum)->toScale(2, RoundingMode::HALF_UP));
            } else {
                $effectiveUnitBD = $netLineTotalBD->dividedBy($soldQtyBD, 4, RoundingMode::HALF_UP);
                $itemSubtotalBD = $effectiveUnitBD->multipliedBy($reqQtyBD)->toScale(2, RoundingMode::HALF_UP);
            }

            $historicalUnitPriceBD = BigDecimal::of((string) $detail->price)->toScale(2, RoundingMode::HALF_UP);
            $refundTotalBD = $refundTotalBD->plus($itemSubtotalBD);

            $preparedItems[] = [
                'sale_detail_id' => $detail->id,
                'product_id'     => $detail->product_id,
                'product_name'   => $detail->product_name ?? $detail->product?->name ?? "Producto #{$detail->product_id}",
                'product_sku'    => $detail->product_sku ?? $detail->product?->sku,
                'quantity'       => $reqQty,
                'unit_price'     => (float) (string) $historicalUnitPriceBD,
                'subtotal'       => (float) (string) $itemSubtotalBD,
            ];
        }

        // Invariante de tope monetario global: SUM(total devuelto) <= Sale.total
        $saleTotalBD = BigDecimal::of((string) $lockedSale->total)->toScale(2, RoundingMode::HALF_UP);
        $prevRefundsSum = (float) SaleRefund::where('sale_id', $lockedSale->id)
            ->where('status', 'completed')
            ->sum('total');
        $prevRefundsBD = BigDecimal::of((string) $prevRefundsSum)->toScale(2, RoundingMode::HALF_UP);
        $maxGlobalRefundableBD = $saleTotalBD->minus($prevRefundsBD);

        if ($refundTotalBD->isGreaterThan($maxGlobalRefundableBD)) {
            // Ajuste por redondeo si la diferencia es menor o igual a 0.05
            if ($refundTotalBD->minus($maxGlobalRefundableBD)->isLessThanOrEqualTo(BigDecimal::of('0.05'))) {
                $refundTotalBD = $maxGlobalRefundableBD;
            } else {
                throw ValidationException::withMessages([
                    'total' => "El monto a devolver ({$refundTotalBD}) supera el total comercial disponible de la venta ({$maxGlobalRefundableBD})."
                ]);
            }
        }

        // 6. Validación de pagos y límites por método
        $paymentBreakdown = $this->validateAndPrepareRefundPayments($lockedSale, $refundTotalBD, $data);

        // 7. Si hay componente en efectivo, resolver y bloquear sesión de caja abierta
        $cashAmountBD = BigDecimal::zero();
        foreach ($paymentBreakdown as $pay) {
            if (CashRegisterService::isCash($pay['payment_method'])) {
                $cashAmountBD = $cashAmountBD->plus(BigDecimal::of((string) $pay['amount'])->toScale(2, RoundingMode::HALF_UP));
            }
        }

        $cashSession = null;
        if ($cashAmountBD->isGreaterThan(BigDecimal::zero())) {
            $operatingUser = $user ?? $lockedSale->user ?? User::find($lockedSale->user_id);
            if (!$operatingUser) {
                throw ValidationException::withMessages([
                    'cash_register' => 'No se pudo identificar el usuario para registrar el movimiento de caja.'
                ]);
            }
            $cashRegisterService = app(CashRegisterService::class);
            $cashSession = $cashRegisterService->forRefund($operatingUser, $lockedSale->store_id);
        }

        // 8. Creación atómica de cabecera de devolución
        $refundData = [
            'sale_id'  => $lockedSale->id,
            'store_id' => $lockedSale->store_id,
            'user_id'  => $user?->id ?? $lockedSale->user_id,
            'status'   => 'completed',
            'reason'   => $data['reason'] ?? null,
            'notes'    => $data['notes'] ?? null,
            'total'    => (float) (string) $refundTotalBD,
        ];

        if (!empty($data['id'])) {
            $refundData['id'] = $data['id'];
        }

        $refund = SaleRefund::create($refundData);

        // 9. Registro de ítems de devolución
        foreach ($preparedItems as $item) {
            $item['sale_refund_id'] = $refund->id;
            SaleRefundItem::create($item);
        }

        // 10. Registro de pagos de devolución
        foreach ($paymentBreakdown as $pay) {
            $pay['sale_refund_id'] = $refund->id;
            SaleRefundPayment::create($pay);
        }

        // 11. EFECTOS COMPENSATORIOS ATÓMICOS (Fase 6B.3C)
        // A. Restaurar stock bajo lock
        foreach ($preparedItems as $item) {
            $invStore = $lockedInventoryStores->get($item['product_id']);
            $invStore->increment('stock_quantity', $item['quantity']);
        }

        // B. Registrar movimiento compensatorio de caja física si hubo efectivo
        if ($cashAmountBD->isGreaterThan(BigDecimal::zero()) && $cashSession) {
            $isCancellation = !empty($data['is_cancellation']);
            $cashSession->movements()->create([
                'sale_refund_id' => $refund->id,
                'user_id'        => $user?->id ?? $lockedSale->user_id,
                'type'           => 'expense',
                'amount'         => (float) (string) $cashAmountBD,
                'reason'         => $isCancellation ? 'sale_cancellation' : 'sale_refund',
                'description'    => $isCancellation
                    ? "Cancelación comercial de venta {$lockedSale->id}"
                    : "Devolución comercial de venta {$lockedSale->id}",
            ]);
        }

        return $refund->load(['items', 'payments', 'sale', 'store', 'user', 'cashMovement']);
    }

    /**
     * Valida y prepara el desglose de métodos de pago garantizando:
     * - SUM(payments) = refund.total exactamente.
     * - payment <= remaining_refundable_by_method.
     * - Soporte legacy (sale.payment_method si sale_payments está vacío).
     */
    protected function validateAndPrepareRefundPayments(Sale $sale, BigDecimal $refundTotalBD, array $data): array
    {
        $remainingMethods = $this->getRemainingByPaymentMethod($sale);
        $remainingMap = [];
        foreach ($remainingMethods as $rm) {
            $remainingMap[strtolower($rm['payment_method'])] = BigDecimal::of((string) $rm['remaining_amount'])->toScale(2, RoundingMode::HALF_UP);
        }

        $prepared = [];

        if (!empty($data['payments']) && is_array($data['payments'])) {
            $sumBD = BigDecimal::zero();

            foreach ($data['payments'] as $p) {
                $method = strtolower(trim($p['payment_method'] ?? 'efectivo'));
                $amountBD = BigDecimal::of((string) ($p['amount'] ?? 0))->toScale(2, RoundingMode::HALF_UP);

                if ($amountBD->isLessThanOrEqualTo(BigDecimal::zero())) {
                    throw ValidationException::withMessages(['payments' => 'El monto de cada pago de reembolso debe ser mayor a 0.']);
                }

                if (!isset($remainingMap[$method])) {
                    throw ValidationException::withMessages([
                        'payments' => "El método de pago '{$method}' no está habilitado o no fue utilizado en la venta original."
                    ]);
                }

                if ($amountBD->isGreaterThan($remainingMap[$method])) {
                    throw ValidationException::withMessages([
                        'payments' => "El monto a devolver por el método '{$method}' ({$amountBD}) supera el remanente disponible para dicho método ({$remainingMap[$method]})."
                    ]);
                }

                $sumBD = $sumBD->plus($amountBD);
                $remainingMap[$method] = $remainingMap[$method]->minus($amountBD);

                $prepared[] = [
                    'payment_method' => $method,
                    'amount'         => (float) (string) $amountBD,
                    'reference'      => $p['reference'] ?? null,
                ];
            }

            if ($sumBD->compareTo($refundTotalBD) !== 0) {
                throw ValidationException::withMessages([
                    'payments' => "La suma de los pagos de reembolso ({$sumBD}) no coincide exactamente con el total de la devolución ({$refundTotalBD})."
                ]);
            }
        } else {
            // Auto-asignación inteligente cuando solo hay un método con saldo suficiente
            $candidates = [];
            foreach ($remainingMap as $method => $availableBD) {
                if ($availableBD->isGreaterThanOrEqualTo($refundTotalBD)) {
                    $candidates[] = $method;
                }
            }

            if (count($candidates) === 1) {
                $chosenMethod = $candidates[0];
                $prepared[] = [
                    'payment_method' => $chosenMethod,
                    'amount'         => (float) (string) $refundTotalBD,
                    'reference'      => $data['reason'] ?? 'Reembolso comercial',
                ];
            } else {
                throw ValidationException::withMessages([
                    'payments' => 'Debe especificar el desglose de métodos de pago para esta devolución.'
                ]);
            }
        }

        return $prepared;
    }

    /**
     * Calcula los saldos originales, devueltos y remanentes agrupados por método de pago.
     */
    public function getRemainingByPaymentMethod(Sale $sale): array
    {
        $sale->loadMissing('payments');

        // 1. Fuentes originales
        $originalMap = [];
        if ($sale->payments->count() > 0) {
            foreach ($sale->payments as $p) {
                $m = strtolower(trim($p->payment_method ?: 'efectivo'));
                $a = BigDecimal::of((string) $p->amount)->toScale(2, RoundingMode::HALF_UP);
                $originalMap[$m] = ($originalMap[$m] ?? BigDecimal::zero())->plus($a);
            }
        } else {
            // Soporte Legacy: venta histórica sin registros en sale_payments
            $m = strtolower(trim($sale->payment_method ?: 'efectivo'));
            $originalMap[$m] = BigDecimal::of((string) $sale->total)->toScale(2, RoundingMode::HALF_UP);
        }

        // 2. Devoluciones previas completadas
        $previousRefundPayments = SaleRefundPayment::whereHas('refund', function ($q) use ($sale) {
            $q->where('sale_id', $sale->id)->where('status', 'completed');
        })->get();

        $refundedMap = [];
        foreach ($previousRefundPayments as $rp) {
            $m = strtolower(trim($rp->payment_method ?: 'efectivo'));
            $a = BigDecimal::of((string) $rp->amount)->toScale(2, RoundingMode::HALF_UP);
            $refundedMap[$m] = ($refundedMap[$m] ?? BigDecimal::zero())->plus($a);
        }

        $result = [];
        foreach ($originalMap as $method => $origBD) {
            $refBD = $refundedMap[$method] ?? BigDecimal::zero();
            $remBD = $origBD->minus($refBD);
            if ($remBD->isLessThan(BigDecimal::zero())) {
                $remBD = BigDecimal::zero();
            }

            $result[] = [
                'payment_method'   => $method,
                'original_amount'  => (float) (string) $origBD,
                'refunded_amount'  => (float) (string) $refBD,
                'remaining_amount' => (float) (string) $remBD,
            ];
        }

        return $result;
    }

    /**
     * Calcula de forma determinista y exacta el subtotal neto de cada línea después del descuento global.
     */
    protected function calculateLineNetTotals(Sale $sale, $details): array
    {
        $grossSubtotalBD = BigDecimal::zero();
        foreach ($details as $d) {
            $grossSubtotalBD = $grossSubtotalBD->plus(BigDecimal::of((string) $d->subtotal));
        }

        $discountBD = BigDecimal::of((string) ($sale->discount ?? 0))->toScale(2, RoundingMode::HALF_UP);
        $lineMap = [];

        if ($discountBD->isZero() || $grossSubtotalBD->isZero()) {
            foreach ($details as $d) {
                $subBD = BigDecimal::of((string) $d->subtotal)->toScale(2, RoundingMode::HALF_UP);
                $lineMap[$d->id] = [
                    'line_discount'  => BigDecimal::zero(),
                    'net_line_total' => $subBD,
                ];
            }
            return $lineMap;
        }

        $allocatedDiscount = BigDecimal::zero();
        $count = count($details);
        $i = 0;

        foreach ($details as $d) {
            $i++;
            $subBD = BigDecimal::of((string) $d->subtotal)->toScale(2, RoundingMode::HALF_UP);

            if ($i === $count) {
                // Última línea absorbe el residuo del centavo para garantizar la igualdad exacta
                $lineDiscBD = $discountBD->minus($allocatedDiscount);
            } else {
                $ratio = $subBD->dividedBy($grossSubtotalBD, 6, RoundingMode::HALF_UP);
                $lineDiscBD = $discountBD->multipliedBy($ratio)->toScale(2, RoundingMode::HALF_UP);
                $allocatedDiscount = $allocatedDiscount->plus($lineDiscBD);
            }

            $netBD = $subBD->minus($lineDiscBD);
            if ($netBD->isLessThan(BigDecimal::zero())) {
                $netBD = BigDecimal::zero();
            }

            $lineMap[$d->id] = [
                'line_discount'  => $lineDiscBD,
                'net_line_total' => $netBD,
            ];
        }

        return $lineMap;
    }

    /**
     * Valida que un reintento idempotente con el mismo UUID coincida exactamente en su carga útil.
     */
    protected function assertIdempotentPayloadMatches(SaleRefund $existing, string $saleId, array $data): void
    {
        if ($existing->sale_id !== $saleId) {
            throw new IdempotencyConflictException();
        }

        // Comparar ítems
        $existingItems = $existing->items->keyBy('sale_detail_id');
        $incomingConsolidated = [];
        foreach ($data['items'] as $item) {
            $dId = (string) $item['sale_detail_id'];
            $qty = (float) $item['quantity'];
            $incomingConsolidated[$dId] = ($incomingConsolidated[$dId] ?? 0.0) + $qty;
        }

        if (count($existingItems) !== count($incomingConsolidated)) {
            throw new IdempotencyConflictException();
        }

        foreach ($incomingConsolidated as $dId => $qty) {
            $existingItem = $existingItems->get($dId);
            if (!$existingItem || abs((float) $existingItem->quantity - $qty) > 0.0001) {
                throw new IdempotencyConflictException();
            }
        }

        // Comparar pagos si se enviaron
        if (!empty($data['payments'])) {
            $existingPayments = $existing->payments->groupBy(fn ($p) => strtolower($p->payment_method));
            $incomingPayments = collect($data['payments'])->groupBy(fn ($p) => strtolower($p['payment_method'] ?? 'efectivo'));

            if ($existingPayments->keys()->sort()->values()->toArray() !== $incomingPayments->keys()->sort()->values()->toArray()) {
                throw new IdempotencyConflictException();
            }

            foreach ($incomingPayments as $method => $pays) {
                $inSum = $pays->sum(fn ($p) => (float) ($p['amount'] ?? 0));
                $exSum = $existingPayments->get($method)->sum(fn ($p) => (float) $p->amount);
                if (abs($inSum - $exSum) > 0.01) {
                    throw new IdempotencyConflictException();
                }
            }
        }
    }
}
