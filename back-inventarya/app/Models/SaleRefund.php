<?php

namespace App\Models;

use DomainException;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SaleRefund extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'id',
        'sale_id',
        'store_id',
        'user_id',
        'status',
        'reason',
        'notes',
        'total',
    ];

    protected $casts = [
        'total' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::updating(function (SaleRefund $refund) {
            if ($refund->getOriginal('status') === 'completed') {
                throw new DomainException('Una devolución completada es inmutable y no puede modificarse.');
            }
        });

        static::deleting(function (SaleRefund $refund) {
            if ($refund->getOriginal('status') === 'completed') {
                throw new DomainException('Una devolución completada es inmutable y no puede eliminarse.');
            }
        });
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleRefundItem::class, 'sale_refund_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SaleRefundPayment::class, 'sale_refund_id');
    }

    public function cashMovement(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(CashRegisterMovement::class, 'sale_refund_id');
    }
}
