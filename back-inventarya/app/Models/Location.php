<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'parent_id',
    ];

    protected $appends = ['full_path'];

    /**
     * Ubicación superior o contenedora inmediata (ej: Pasillo dentro de Almacén).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'parent_id');
    }

    /**
     * Sub-ubicaciones hijas inmediatas (ej: Estantes dentro de Pasillo).
     */
    public function children(): HasMany
    {
        return $this->hasMany(Location::class, 'parent_id');
    }

    /**
     * Ítems de almacén ubicados en este espacio físico.
     */
    public function inventoryWarehouses(): HasMany
    {
        return $this->hasMany(InventoryWarehouse::class, 'location_id');
    }

    /**
     * Ítems de tienda ubicados en este espacio físico.
     */
    public function inventoryStores(): HasMany
    {
        return $this->hasMany(InventoryStore::class, 'location_id');
    }

    /**
     * Devuelve la lista ordenada de ancestros desde la raíz hasta la ubicación inmediata.
     *
     * @return array<Location>
     */
    public function ancestors(): array
    {
        $ancestors = [];
        $current = $this->parent;

        while ($current !== null) {
            $ancestors[] = $current;
            $current = $current->parent;
        }

        return array_reverse($ancestors);
    }

    /**
     * Ruta completa jerárquica de ubicación (ej: "Almacén Central > Pasillo 2 > Estante A").
     */
    public function getFullPathAttribute(): string
    {
        $names = [];
        foreach ($this->ancestors() as $ancestor) {
            $names[] = $ancestor->name;
        }
        $names[] = $this->name;

        return implode(' > ', $names);
    }

    /**
     * Scope para consultar solo ubicaciones raíz.
     */
    public function scopeRoots($query)
    {
        return $query->whereNull('parent_id');
    }
}
