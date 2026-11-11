<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovementItem extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'stock_movement_items';

    protected $fillable = [
        'stock_movement_id',
        'product_id',
        'quantity',
        'cost_price',
        'sale_price',
        'unit',
        'min_stock',
        'expiration_date',
    ];

    protected $casts = [
        'quantity'   => 'double',
        'cost_price' => 'double',
        'sale_price' => 'double',
        'min_stock'  => 'double',
    ];

    /**
     * Cabecera del movimiento.
     */
    public function movement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'stock_movement_id');
    }

    /**
     * Producto trasladado.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
