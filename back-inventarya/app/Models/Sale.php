<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Sale extends Model
{
    use HasFactory, HasUuids;
    protected $fillable = [
        'id',
        'order_date',
        'cash_register_session_id',
        'customer_id',
        'total',
        'payment_method',
        'user_id',
        'status',
        'store_id',
        'discount',
        'name',
        'phone',
        'observation',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'cancellation_refund_id',
    ];

    protected $casts = [
        'cancelled_at' => 'datetime',
    ];

    protected $appends = [
        'fiscal_status',
        'refund_status',
        'total_refunded',
        'remaining_refundable',
        'has_electronic_invoice',
    ];

    public function getFiscalStatusAttribute(): string
    {
        return app(\App\Services\Siat\SiatReadinessService::class)->getSaleFiscalStatus($this);
    }

    public function getRefundStatusAttribute(): string
    {
        if (!$this->exists) {
            return 'none';
        }

        try {
            $details = $this->relationLoaded('saleDetails') ? $this->saleDetails : $this->saleDetails()->get();
            $totalSoldQty = (float) $details->sum('quantity');

            if ($totalSoldQty <= 0) {
                return 'none';
            }

            $completedRefunds = $this->relationLoaded('refunds')
                ? $this->refunds->where('status', 'completed')
                : $this->refunds()->where('status', 'completed')->with('items')->get();

            $totalRefundedQty = 0.0;
            foreach ($completedRefunds as $refund) {
                $items = $refund->relationLoaded('items') ? $refund->items : $refund->items()->get();
                $totalRefundedQty += (float) $items->sum('quantity');
            }

            if ($totalRefundedQty <= 0) {
                return 'none';
            }

            if ($totalRefundedQty >= ($totalSoldQty - 0.0001)) {
                return 'refunded';
            }

            return 'partially_refunded';
        } catch (\Throwable $e) {
            return 'none';
        }
    }

    public function getTotalRefundedAttribute(): float
    {
        if (!$this->exists) {
            return 0.0;
        }

        try {
            if ($this->relationLoaded('refunds')) {
                return (float) $this->refunds->where('status', 'completed')->sum('total');
            }

            return (float) $this->refunds()->where('status', 'completed')->sum('total');
        } catch (\Throwable $e) {
            return 0.0;
        }
    }

    public function getRemainingRefundableAttribute(): float
    {
        return max(0.0, round((float) $this->total - $this->total_refunded, 2));
    }

    public function getHasElectronicInvoiceAttribute(): bool
    {
        try {
            if ($this->relationLoaded('electronicInvoice')) {
                return $this->electronicInvoice !== null;
            }

            return $this->electronicInvoice()->exists();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /* User */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
    /* Customer */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id', 'id');
    }
    /* Detail sale */
    public function saleDetails(): HasMany
    {
        return $this->hasMany(SaleDetail::class);
    }

    /* Store */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'id');
    }
    public function cashRegisterSession(): BelongsTo { return $this->belongsTo(CashRegisterSession::class); }

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }

    public function electronicInvoice(): HasOne
    {
        return $this->hasOne(ElectronicInvoice::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(SaleRefund::class);
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by', 'id');
    }

    public function cancellationRefund(): BelongsTo
    {
        return $this->belongsTo(SaleRefund::class, 'cancellation_refund_id', 'id');
    }

    /**
     * Determina si la venta ya se encuentra en un estado comercialmente finalizado.
     */
    public function isFinalized(): bool
    {
        $finalizedStatuses = ['completed', 'completado', 'cancelled', 'cancelado', 'refunded', 'devuelto'];
        if (in_array(strtolower((string) $this->status), $finalizedStatuses, true)) {
            return true;
        }

        if ($this->refund_status !== 'none') {
            return true;
        }

        if (!empty($this->cash_register_session_id)) {
            return true;
        }

        return false;
    }
}
