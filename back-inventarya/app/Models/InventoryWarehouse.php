<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class InventoryWarehouse extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'product_id',
        'supplier_id',
        'quantity',
        'price',
        'sale_price',
        'restock_date',
        'stock_quantity',
        'min_stock',
        'expiration_date',
        'unit',
        'location_id',
        'metadata',
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
        'price' => 'double',
        'sale_price' => 'double',
        'expiration_date' => 'date:Y-m-d',
    ];

    /* Product */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    /* Location */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id', 'id');
    }

    /* Supplier */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    /* verify stock */
    public function verifyStock($id, $quantity)
    {
        $inventoryWarehouse = InventoryWarehouse::find($id);
        return $inventoryWarehouse->stock_quantity < $quantity;
    }

    /* verify restock */
    public function verifyRestock($id, $quantity)
    {
        $inventoryWarehouse = InventoryWarehouse::find($id);
        return $inventoryWarehouse->restock_date < now() && $inventoryWarehouse->stock_quantity < $inventoryWarehouse->quantity - $quantity;
    }

    /* Descontar stock del almacén */
    public function decreaseStock($id, $quantity)
    {
        $inventoryWarehouse = InventoryWarehouse::find($id);
        $inventoryWarehouse->stock_quantity -= $quantity;
        $inventoryWarehouse->save();
    }

    /* Aumentar stock del almacén */
    public function increaseStock($id, $quantity)
    {
        $inventoryWarehouse = InventoryWarehouse::find($id);
        $inventoryWarehouse->stock_quantity += $quantity;
        $inventoryWarehouse->save();
    }
}
