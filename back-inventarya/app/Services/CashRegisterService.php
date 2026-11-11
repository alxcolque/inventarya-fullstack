<?php
namespace App\Services;

use App\Models\{Assignment, CashRegisterSession, CashRegisterMovement, Store, User};
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashRegisterService
{
    public const COMPLETED = ['completado', 'completed'];
    public static function cents(string|int|float $amount): int
    {
        return BigDecimal::of((string) $amount)->toScale(2, RoundingMode::HALF_UP)->getUnscaledValue()->toInt();
    }
    public static function money(int $cents): string
    {
        return (string) BigDecimal::ofUnscaledValue($cents, 2);
    }
    public static function isCash(string $method): bool { return strtolower(trim($method)) === 'efectivo'; }

    public function authorize(User $user, string $storeId): void
    {
        abort_unless($user->can('pos:access') && ($user->can('stores:view-all') ||
            Assignment::where('user_id', $user->id)->where('store_id', $storeId)->exists()), 403, 'No tienes acceso a esta tienda.');
    }
    public function open(User $user, array $data): CashRegisterSession
    {
        $this->authorize($user, $data['store_id']);
        return DB::transaction(function () use ($user, $data) {
            Store::whereKey($data['store_id'])->lockForUpdate()->firstOrFail();
            if ($this->active($data['store_id'])) $this->invalid('Ya existe una caja abierta para esta tienda.');
            return CashRegisterSession::create($data + ['user_id' => $user->id, 'opened_at' => now(), 'status' => 'open']);
        });
    }
    public function active(string $storeId): ?CashRegisterSession
    {
        return CashRegisterSession::with(['user:id,name', 'store:id,name'])->where('store_id', $storeId)->where('status', 'open')->first();
    }
    public function lockedOpen(string $id): CashRegisterSession
    {
        $session = CashRegisterSession::whereKey($id)->lockForUpdate()->firstOrFail();
        if ($session->status !== 'open') $this->invalid('Esta caja está cerrada. La operación no se ha registrado.');
        return $session;
    }
    /** Called inside the sale transaction, holding this lock until stock and details are committed. */
    public function forSale(User $user, string $storeId, ?string $originalId, bool $clientGeneratedId): CashRegisterSession
    {
        $this->authorize($user, $storeId);
        if ($clientGeneratedId && !$originalId) {
            throw new \App\Exceptions\CashRegisterConflictException(
                'CASH_REGISTER_CONFLICT',
                'La venta pendiente no identifica su caja original. Requiere revisión antes de sincronizar.'
            );
        }

        if ($originalId) {
            $orig = CashRegisterSession::whereKey($originalId)->first();
            if (!$orig) {
                throw new \App\Exceptions\CashRegisterConflictException(
                    'CASH_REGISTER_NOT_FOUND',
                    'La sesión de caja original no existe.'
                );
            }
            if ((string) $orig->store_id !== (string) $storeId) {
                throw new \App\Exceptions\CashRegisterConflictException(
                    'CASH_REGISTER_STORE_MISMATCH',
                    'La caja original no corresponde a esta tienda. La venta permanece pendiente.'
                );
            }
            if ($orig->status !== 'open') {
                throw new \App\Exceptions\CashRegisterConflictException(
                    'CASH_REGISTER_CLOSED',
                    'La caja original está cerrada o no corresponde a esta tienda. La venta permanece pendiente.'
                );
            }
            $session = CashRegisterSession::whereKey($originalId)->where('status', 'open')->lockForUpdate()->first();
            if (!$session) {
                throw new \App\Exceptions\CashRegisterConflictException(
                    'CASH_REGISTER_CLOSED',
                    'La caja original está cerrada o no corresponde a esta tienda. La venta permanece pendiente.'
                );
            }
            return $session;
        }

        $session = CashRegisterSession::where('store_id', $storeId)->where('status', 'open')->lockForUpdate()->first();
        if (!$session) {
            throw new \App\Exceptions\CashRegisterConflictException(
                'CASH_REGISTER_CONFLICT',
                'No existe una caja abierta para esta tienda. Abre la caja antes de registrar ventas.'
            );
        }
        return $session;
    }
    /** Called inside the refund transaction, holding this lock until refund, stock and movements are committed. */
    public function forRefund(User $user, string $storeId): CashRegisterSession
    {
        $this->authorize($user, $storeId);
        $session = CashRegisterSession::where('store_id', $storeId)->where('status', 'open')->lockForUpdate()->first();
        if (!$session) {
            $this->invalid('No existe una caja abierta para registrar la devolución en efectivo.');
        }
        return $session;
    }
    public function addMovement(User $user, string $id, array $data): CashRegisterMovement
    {
        return DB::transaction(function () use ($user, $id, $data) {
            $session = $this->lockedOpen($id);
            $this->authorize($user, $session->store_id);
            return $session->movements()->create($data + ['user_id' => $user->id]);
        });
    }
    public function summary(CashRegisterSession $session): array
    {
        $payments = []; $cash = 0; $total = 0; $count = 0;
        $hasCancellationCol = \Illuminate\Support\Facades\Schema::hasColumn('sales', 'cancellation_refund_id');
        $sales = $session->sales()
            ->where(function ($q) use ($hasCancellationCol) {
                $q->whereIn('status', self::COMPLETED);
                if ($hasCancellationCol) {
                    $q->orWhereNotNull('cancellation_refund_id');
                }
            })
            ->with('payments')
            ->get();

        foreach ($sales as $sale) {
            $saleTotal = self::cents($sale->getRawOriginal('total'));
            $total += $saleTotal;
            $count++;

            if ($sale->payments->isNotEmpty()) {
                foreach ($sale->payments as $p) {
                    $pAmount = self::cents($p->getRawOriginal('amount'));
                    $method = $p->payment_method ?: 'sin_especificar';
                    $payments[$method] = ($payments[$method] ?? 0) + $pAmount;
                    if (self::isCash($method)) {
                        $cash += $pAmount;
                    }
                }
            } else {
                $method = $sale->payment_method ?: 'sin_especificar';
                $payments[$method] = ($payments[$method] ?? 0) + $saleTotal;
                if (self::isCash($method)) {
                    $cash += $saleTotal;
                }
            }
        }
        $income = 0; $expense = 0;
        foreach ($session->movements()->get() as $movement) {
            if ($movement->type === 'income') $income += self::cents($movement->amount);
            else $expense += self::cents($movement->amount);
        }
        $expected = self::cents($session->opening_amount) + $cash + $income - $expense;
        return [
            'session' => $session->load(['user:id,name', 'closedBy:id,name', 'store:id,name']),
            'sales' => ['count' => $count, 'total' => self::money($total), 'cash' => self::money($cash), 'by_method' => array_map(self::money(...), $payments)],
            'movements' => ['income' => self::money($income), 'expense' => self::money($expense)],
            'opening_amount' => $session->opening_amount,
            'expected_cash' => $session->status === 'closed' ? $session->expected_amount : self::money($expected),
        ];
    }
    public function close(User $user, string $id, array $data): CashRegisterSession
    {
        return DB::transaction(function () use ($user, $id, $data) {
            $session = $this->lockedOpen($id);
            $this->authorize($user, $session->store_id);
            $expected = $this->summary($session)['expected_cash'];
            $session->update($data + ['expected_amount' => $expected,
                'difference' => self::money(self::cents($data['closing_amount']) - self::cents($expected)),
                'closed_by' => $user->id, 'closed_at' => now(), 'status' => 'closed']);
            return $session->fresh();
        });
    }
    private function invalid(string $message): never { throw ValidationException::withMessages(['cash_register' => $message]); }
}
