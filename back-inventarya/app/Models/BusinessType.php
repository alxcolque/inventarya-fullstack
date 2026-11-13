<?php

namespace App\Models;

use App\Services\ProductAttributeService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BusinessType extends Model
{
    /**
     * Business types are central data, also when read from a tenant context.
     */
    protected $connection = 'central';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected static function booted(): void
    {
        $forget = fn (BusinessType $type) => app(ProductAttributeService::class)->forget((int) $type->getKey());

        static::saved($forget);
        static::deleted($forget);
    }

    public function fields(): HasMany
    {
        return $this->hasMany(BusinessTypeField::class)->orderBy('sort_order')->orderBy('id');
    }

    public function tenants(): HasMany
    {
        return $this->hasMany(Tenant::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}

