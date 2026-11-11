<?php

namespace App\Services;

use App\Exceptions\IdempotencyConflictException;
use App\Models\Sale;
use App\Models\SaleDetail;
use App\Models\SaleRefund;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaleCancellationService
{
    public function __construct(
        protected SaleRefundService $refundService
    ) {}

    /**
     * Cancela comercialmente una venta de forma atómica, total e idempotente.
     *
     * Invariantes Fase 6B.3D:
     * - Toda la operación se ejecuta en una única transacción de base de datos.
     * - Reutiliza autoritativamente el motor compensatorio (SaleRefundService).
     * - Restaura el 100% del stock.
     * - Compensa el 100% de los pagos (con movimiento de caja de egreso si hay efectivo).
     * - La venta original permanece inmutable como documento histórico (total, detalles, pagos intactos).
     * - Sale.status pasa a 'cancelled'.
     * - Desacoplado 100% de SIAT (0 llamadas al SIN, facturas electrónicas intactas).
     */
    public function cancelSale(Sale $sale, array $data, $user): array
    {
        return DB::transaction(function () use ($sale, $data, $user) {
            // 1. Bloqueo pesimista de la venta en PostgreSQL
            $lockedSale = Sale::where('id', $sale->id)->lockForUpdate()->firstOrFail();

            // 2. Comprobación de idempotencia: UUID del refund/cancelación
            if (!empty($data['id'])) {
                $existingRefund = SaleRefund::with(['items', 'payments', 'cashMovement'])->find($data['id']);
                if ($existingRefund) {
                    // Verificar si pertenece a esta misma venta
                    if ($existingRefund->sale_id !== $lockedSale->id) {
                        throw new IdempotencyConflictException();
                    }

                    // Verificar si el motivo coincide con el payload original
                    $incomingReason = array_key_exists('reason', $data) ? $data['reason'] : null;
                    if ($existingRefund->reason !== $incomingReason && !($existingRefund->reason === null && empty($incomingReason))) {
                        throw new IdempotencyConflictException();
                    }

                    return [
                        'message'                 => 'Venta cancelada previamente (idempotente)',
                        'sale_id'                 => $lockedSale->id,
                        'status'                  => $lockedSale->status,
                        'cancelled_at'            => $lockedSale->cancelled_at ? (string) $lockedSale->cancelled_at : null,
                        'cancelled_by'            => $lockedSale->cancelled_by,
                        'cancellation_reason'     => $lockedSale->cancellation_reason,
                        'cancellation_refund_id'  => $lockedSale->cancellation_refund_id ?? $existingRefund->id,
                        'refund'                  => $existingRefund,
                        'has_electronic_invoice'  => $lockedSale->has_electronic_invoice,
                        'fiscal_action_performed' => false,
                        'is_duplicate'            => true,
                    ];
                }
            }

            // 3. Reglas de cancelabilidad
            // A. ¿Ya se encuentra cancelada?
            if (in_array(strtolower((string) $lockedSale->status), ['cancelled', 'cancelado'], true) || !empty($lockedSale->cancellation_refund_id)) {
                throw ValidationException::withMessages([
                    'sale' => 'La venta ya se encuentra cancelada.',
                ]);
            }

            // B. ¿Está en estado completado?
            if (!in_array(strtolower((string) $lockedSale->status), ['completed', 'completado'], true)) {
                throw ValidationException::withMessages([
                    'sale' => 'Solo pueden cancelarse ventas en estado completado.',
                ]);
            }

            // C. ¿Posee devoluciones previas completadas?
            $hasPreviousRefunds = SaleRefund::where('sale_id', $lockedSale->id)
                ->where('status', 'completed')
                ->exists();

            if ($hasPreviousRefunds) {
                throw ValidationException::withMessages([
                    'sale' => 'La venta posee devoluciones previas y no puede cancelarse directamente. Complete la devolución mediante el flujo de devoluciones.',
                ]);
            }

            // 4. Construir la compensación total autoritativamente desde la venta original
            $allDetails = SaleDetail::where('sale_id', $lockedSale->id)
                ->orderBy('id', 'asc')
                ->lockForUpdate()
                ->get();

            if ($allDetails->isEmpty()) {
                throw ValidationException::withMessages([
                    'sale' => 'La venta no posee detalles para cancelar.',
                ]);
            }

            $consolidated = [];
            $sortedDetailIds = [];
            $items = [];

            foreach ($allDetails as $detail) {
                $dId = (string) $detail->id;
                $qty = (float) $detail->quantity;
                $consolidated[$dId] = $qty;
                $sortedDetailIds[] = $dId;
                $items[] = [
                    'sale_detail_id' => $dId,
                    'quantity'       => $qty,
                ];
            }
            sort($sortedDetailIds);

            // Desglose de pagos compensatorios
            $lockedSale->loadMissing('payments');
            $refundPayments = [];

            if ($lockedSale->payments->isNotEmpty()) {
                foreach ($lockedSale->payments as $p) {
                    $refundPayments[] = [
                        'payment_method' => $p->payment_method,
                        'amount'         => (float) $p->amount,
                        'reference'      => $p->reference ?? 'Compensación por cancelación de venta',
                    ];
                }
            } else {
                // Soporte legacy para ventas sin desglose en sale_payments
                $refundPayments[] = [
                    'payment_method' => $lockedSale->payment_method ?: 'efectivo',
                    'amount'         => (float) $lockedSale->total,
                    'reference'      => 'Compensación legacy por cancelación de venta',
                ];
            }

            // 5. Preparar carga útil del refund compensatorio total
            $cancellationUuid = !empty($data['id']) ? $data['id'] : (string) Str::uuid();
            $refundPayload = [
                'id'              => $cancellationUuid,
                'reason'          => $data['reason'] ?? 'Cancelación comercial de venta',
                'notes'           => $data['notes'] ?? 'Compensación total por cancelación comercial',
                'items'           => $items,
                'payments'        => $refundPayments,
                'is_cancellation' => true,
            ];

            // 6. Ejecutar el refund dentro de la misma transacción
            $refund = $this->refundService->executeRefundTransaction(
                $lockedSale,
                $refundPayload,
                $user,
                $consolidated,
                $sortedDetailIds
            );

            // 7. Marcar Sale como cancelada con auditoría completa
            $now = now();
            $cancelledByUserId = $user?->id ?? $lockedSale->user_id;
            $cancellationReason = $data['reason'] ?? 'Cancelación comercial de venta';

            $lockedSale->update([
                'status'                 => 'cancelled',
                'cancelled_at'           => $now,
                'cancelled_by'           => $cancelledByUserId,
                'cancellation_reason'    => $cancellationReason,
                'cancellation_refund_id' => $refund->id,
            ]);

            $lockedSale->loadMissing(['store', 'user', 'electronicInvoice']);

            return [
                'message'                 => 'Venta cancelada comercialmente con éxito',
                'sale_id'                 => $lockedSale->id,
                'status'                  => 'cancelled',
                'cancelled_at'            => (string) $lockedSale->cancelled_at,
                'cancelled_by'            => $lockedSale->cancelled_by,
                'cancellation_reason'     => $lockedSale->cancellation_reason,
                'cancellation_refund_id'  => $lockedSale->cancellation_refund_id,
                'refund'                  => $refund,
                'has_electronic_invoice'  => $lockedSale->electronicInvoice !== null,
                'fiscal_action_performed' => false,
                'is_duplicate'            => false,
            ];
        });
    }
}
