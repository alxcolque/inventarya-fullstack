<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class SaleDetail extends Model
{
    use HasFactory, HasUuids;
    protected $fillable = [
        'id',
        'sale_id',
        'product_id',
        'quantity',
        'price',
        'subtotal',
    ];

    /* Sale */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
    /* Product */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    /* Refund Items */
    public function refundItems(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SaleRefundItem::class, 'sale_detail_id');
    }

    public function getRefundedQuantityAttribute(): float
    {
        if ($this->relationLoaded('refundItems')) {
            return (float) $this->refundItems->filter(fn ($item) => $item->refund?->status === 'completed')->sum('quantity');
        }

        return (float) $this->refundItems()
            ->whereHas('refund', fn ($q) => $q->where('status', 'completed'))
            ->sum('quantity');
    }

    public function getRemainingRefundableQuantityAttribute(): float
    {
        return max(0.0, (float) $this->quantity - $this->refunded_quantity);
    }
}
