<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryStore extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'product_id',
        'store_id',
        'quantity',
        'price',
        'restock_date',
        'stock_quantity',
        'min_stock',
        'unit',
        'sale_price',
        'expiration_date',
        'location_id',
        'metadata',
        'is_public',
    ];

    public function getSalepriceAttribute()
    {
        return $this->attributes['sale_price'] ?? null;
    }

    public function setSalepriceAttribute($value)
    {
        $this->attributes['sale_price'] = $value;
    }

    protected $casts = [
        'metadata' => 'array',
        'expiration_date' => 'date',
        'is_public' => 'boolean',
    ];

    /* Product */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    /* Store */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'id');
    }

    /* Location */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id', 'id');
    }
}
