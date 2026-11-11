<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ElectronicInvoiceDetail extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'electronic_invoice_details';

    protected $fillable = [
        'electronic_invoice_id',
        'product_id',
        'product_code',
        'sin_product_code',
        'sin_activity_code',
        'sin_unit_code',
        'description',
        'quantity',
        'unit_price',
        'discount',
        'subtotal',
        'serial_number',
        'imei_number',
    ];

    protected $casts = [
        'sin_unit_code' => 'integer',
        'quantity' => 'decimal:3',
        'unit_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'subtotal' => 'decimal:2',
    ];

    public function electronicInvoice(): BelongsTo
    {
        return $this->belongsTo(ElectronicInvoice::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
