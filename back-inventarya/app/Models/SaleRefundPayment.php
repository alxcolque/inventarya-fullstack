<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleRefundPayment extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'id',
        'sale_refund_id',
        'payment_method',
        'amount',
        'reference',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function refund(): BelongsTo
    {
        return $this->belongsTo(SaleRefund::class, 'sale_refund_id');
    }
}
