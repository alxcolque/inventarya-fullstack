<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Store extends Model
{
    use HasFactory, HasUuids;
    protected $fillable = [
        'name',
        'slug',
        'location',
        'phone',
        'front_image',
        'front_image_key',
        'address',
        'is_active',
        'api_status',
        'api_key',
        'api_secret',
        'enable_customers',
        'enable_payment',
        'enable_observations',
        'enable_discount',
        'enable_electronic_invoicing',
        'sin_branch_code',
        'sin_point_of_sale_code',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'api_status' => 'boolean',
        'enable_customers' => 'boolean',
        'enable_payment' => 'boolean',
        'enable_observations' => 'boolean',
        'enable_discount' => 'boolean',
        'enable_electronic_invoicing' => 'boolean',
        'sin_branch_code' => 'integer',
        'sin_point_of_sale_code' => 'integer',
    ];

    protected $hidden = [
        'api_secret',
    ];

    /**
     * Retorna la URL pública completa y concatenada para la imagen de la tienda.
     */
    public function getFrontImageAttribute($value): ?string
    {
        if (empty($value)) {
            return null;
        }
        return \App\Services\FileStorageService::getPublicUrl($this->front_image_key ?? $value);
    }
    /* Assignment */
    public function assignment(): BelongsToMany
    {
        return $this->belongsToMany(Assignment::class, "assignments", "store_id", "user_id");
    }

    /* Inventory */
    public function inventoryStore(): HasMany
    {
        return $this->hasMany(InventoryStore::class, 'store_id', 'id');
    }
    public function cashRegisterSessions(): HasMany { return $this->hasMany(CashRegisterSession::class); }

    public function electronicInvoices(): HasMany
    {
        return $this->hasMany(ElectronicInvoice::class);
    }

    public function siatCufds(): HasMany
    {
        return $this->hasMany(SiatCufd::class);
    }

    public function siatCuis(): HasMany
    {
        return $this->hasMany(SiatCuis::class);
    }
}
