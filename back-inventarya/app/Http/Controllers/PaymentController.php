<?php

namespace App\Http\Controllers;

use App\Http\Requests\PaymentRequest;
use App\Models\Payment;
use App\Services\TenantService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index()
    {
        return response()->json(
            Payment::with(['tenant', 'subscription', 'plan'])
                ->orderBy('id', 'desc')
                ->get()
        );
    }

    public function store(PaymentRequest $request)
    {
        $payment = Payment::create($request->validated());

        return response()->json(['message' => 'Pago registrado', 'payment' => $payment], 201);
    }

    public function show($id)
    {
        $payment = Payment::with(['tenant', 'subscription', 'plan'])->find($id);
        if (! $payment) {
            return response()->json(['message' => 'No encontrado'], 404);
        }

        return response()->json($payment);
    }

    public function update(PaymentRequest $request, $id, TenantService $tenantService)
    {
        $payment = Payment::find($id);
        if (! $payment) {
            return response()->json(['message' => 'No encontrado'], 404);
        }
        $previousStatus = $payment->status;
        $payment->update($request->validated());

        if ($previousStatus !== 'failed' && $payment->status === 'failed') {
            $tenantService->notifyTenantOwnersOfPayment($payment, false);
        }

        return response()->json(['message' => 'Actualizado', 'payment' => $payment], 200);
    }

    public function destroy($id)
    {
        $payment = Payment::find($id);
        if (! $payment) {
            return response()->json(['message' => 'No encontrado'], 404);
        }
        $payment->delete();

        return response()->json(['message' => 'Eliminado'], 200);
    }

    public function confirm(Request $request, $id, TenantService $tenantService)
    {
        $receipt = $request->input('receipt');
        $meta = $request->input('meta', []);

        $payment = $tenantService->confirmTenantPayment((int) $id, $receipt, $meta);

        return response()->json([
            'message' => 'Pago confirmado y tenant activado correctamente',
            'payment' => $payment,
        ], 200);
    }

    public function refund(Request $request, $id, TenantService $tenantService)
    {
        $payment = Payment::with(['tenant', 'subscription', 'plan'])->find($id);
        if (! $payment) {
            return response()->json(['message' => 'Pago no encontrado'], 404);
        }

        if ($payment->status !== 'paid') {
            return response()->json([
                'message' => 'Solo se pueden reembolsar pagos que se encuentren en estado pagado (paid).'
            ], 422);
        }

        $reason = $request->input('reason', 'Reembolso procesado por administración');

        $payment->status = 'refunded';
        $meta = $payment->meta ?? [];
        $meta['refunded_at'] = now()->toIso8601String();
        $meta['refund_reason'] = $reason;
        $payment->meta = $meta;
        $payment->save();

        // Notificar a los administradores del tenant
        $tenantService->notifyTenantOwnersOfRefund($payment, $reason);

        return response()->json([
            'message' => 'Pago reembolsado correctamente',
            'payment' => $payment,
        ], 200);
    }
}
