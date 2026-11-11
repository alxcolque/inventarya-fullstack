<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockMovement extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'stock_movements';

    protected $fillable = [
        'source_warehouse_id',
        'destination_store_id',
        'user_id',
        'document_type',
        'document_number',
        'status',
        'notes',
        'shipped_at',
        'received_at',
    ];

    protected $casts = [
        'shipped_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    /**
     * Tienda de destino del traslado.
     */
    public function destinationStore(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'destination_store_id');
    }

    /**
     * Usuario que autorizó / registró el traslado.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Detalle de productos dentro del movimiento.
     */
    public function items(): HasMany
    {
        return $this->hasMany(StockMovementItem::class, 'stock_movement_id');
    }
}
