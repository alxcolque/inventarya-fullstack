<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasFactory;
    protected $fillable = [
        'cinit',
        'name',
        'phone',
        'email',
        'address',
    ];

    /* Inventory */
    public function inventoryWarehouse(): HasMany
    {
        return $this->hasMany(InventoryWarehouse::class);
    }
}
