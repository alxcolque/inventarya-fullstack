<?php

namespace App\Http\Controllers;

use App\Exceptions\IdempotencyConflictException;
use App\Models\Assignment;
use App\Models\Sale;
use App\Models\SaleRefund;
use App\Services\SaleRefundService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SaleRefundController extends Controller
{
    public function __construct(
        protected SaleRefundService $refundService
    ) {}

    /**
     * Consulta la información de saldos y cantidades reembolsables de una venta.
     */
    public function refundable(Request $request, string $saleId): JsonResponse
    {
        $sale = Sale::findOrFail($saleId);
        $this->authorizeStoreAccess($request->user(), $sale->store_id);

        $data = $this->refundService->getRefundableData($sale);

        return response()->json($data, 200);
    }

    /**
     * Lista el historial de devoluciones de una venta específica.
     */
    public function indexBySale(Request $request, string $saleId): JsonResponse
    {
        $sale = Sale::findOrFail($saleId);
        $this->authorizeStoreAccess($request->user(), $sale->store_id);

        $refunds = SaleRefund::with(['items', 'payments', 'user:id,name,email'])
            ->where('sale_id', $sale->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'sale_id' => $sale->id,
            'refunds' => $refunds,
        ], 200);
    }

    /**
     * Muestra el detalle de una devolución específica.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $refund = SaleRefund::with(['items', 'payments', 'sale', 'store:id,name,slug', 'user:id,name,email'])
            ->findOrFail($id);

        $this->authorizeStoreAccess($request->user(), $refund->store_id);

        return response()->json($refund, 200);
    }

    /**
     * Registra una devolución comercial sobre una venta existente.
     */
    public function store(Request $request, string $saleId): JsonResponse
    {
        $user = $request->user();

        if ($user && !$user->can('sales:refund')) {
            abort(403, 'No tienes permiso para registrar devoluciones.');
        }

        $sale = Sale::findOrFail($saleId);
        $this->authorizeStoreAccess($user, $sale->store_id);

        $request->validate([
            'id'                       => 'nullable|uuid',
            'reason'                   => 'nullable|string|max:255',
            'notes'                    => 'nullable|string|max:1000',
            'items'                    => 'required|array|min:1',
            'items.*.sale_detail_id'   => 'required|uuid',
            'items.*.quantity'         => 'required|numeric|gt:0',
            'payments'                 => 'nullable|array',
            'payments.*.payment_method'=> 'required_with:payments|string|max:50',
            'payments.*.amount'        => 'required_with:payments|numeric|gt:0',
            'payments.*.reference'     => 'nullable|string|max:255',
        ], [
            'items.required'           => 'Debe especificar al menos un ítem a devolver.',
            'items.*.quantity.gt'      => 'La cantidad a devolver debe ser mayor a 0.',
        ]);

        try {
            $refund = $this->refundService->processRefund($sale, $request->all(), $user);

            $isDuplicate = (bool) ($refund->is_duplicate ?? false);
            $statusCode = $isDuplicate ? 200 : 201;
            $message = $isDuplicate
                ? 'Devolución procesada previamente (idempotente)'
                : 'Devolución comercial registrada con éxito';

            return response()->json([
                'message'      => $message,
                'refund'       => $refund,
                'id'           => $refund->id,
                'is_duplicate' => $isDuplicate,
            ], $statusCode);
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
                'message' => $e->getMessage() ?: 'Error al procesar la devolución.',
            ], 400);
        }
    }

    /**
     * Valida el aislamiento multi-store para el usuario autenticado.
     */
    protected function authorizeStoreAccess($user, ?string $storeId): void
    {
        if (!$user) {
            return;
        }

        if ($user->can('stores:view-all')) {
            return;
        }

        if (!$storeId) {
            abort(403, 'La venta no tiene una tienda asociada válida.');
        }

        $isAssigned = Assignment::where('user_id', $user->id)
            ->where('store_id', $storeId)
            ->exists();

        abort_unless($isAssigned, 403, 'No tienes acceso a las ventas de esta tienda.');
    }
}
