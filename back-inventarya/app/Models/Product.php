<?php

namespace App\Models;

use App\Services\FileStorageService;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Product extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'image',
        'category_id',
        'brand_id',
        'sku',
        'barcode',
        'sin_product_code',
        'sin_activity_code',
        'sin_unit_code',
        'attributes',
    ];

    protected $casts = [
        'attributes' => 'array',
    ];

    protected $appends = ['category_path'];

    protected static function booted(): void
    {
        static::creating(function ($product) {
            // 1. Limpiamos el nombre (quita tildes y caracteres raros)
            $cleanName = Str::slug($product->name ?? ''); // "Té" se convierte en "te"
            $cleanName = str_replace('-', '', $cleanName); // Quitamos guiones si los hay

            // 2. Tomamos las primeras 3 letras en mayúsculas
            $prefix = strtoupper(substr($cleanName, 0, 3));

            // 3. ¡SOLUCIÓN! Si tiene menos de 3 letras, lo rellenamos con "X" hasta completar 3
            if (strlen($prefix) < 3) {
                $prefix = str_pad($prefix, 3, 'X', STR_PAD_RIGHT);
            }

            // 4. Buscamos el consecutivo en la base de datos si no viene SKU manual
            if (empty($product->sku)) {
                $count = static::where('sku', 'LIKE', $prefix . '-%')->count();
                $nextNumber = str_pad($count + 1, 4, '0', STR_PAD_LEFT);
                $sku = $prefix . '-' . $nextNumber;

                // 5. Asignamos el SKU final garantizando unicidad
                $counter = $count + 1;
                while (static::where('sku', $sku)->exists()) {
                    $counter++;
                    $sku = $prefix . '-' . str_pad($counter, 4, '0', STR_PAD_LEFT);
                }
                $product->sku = $sku;
            }

            // Slug se genera internamente en el backend
            if (empty($product->slug) && !empty($product->name)) {
                $baseSlug = Str::slug($product->name);
                if (empty($baseSlug)) {
                    $baseSlug = 'producto';
                }
                $slug = $baseSlug;
                $counter = 1;
                while (static::where('slug', $slug)->exists()) {
                    $slug = "{$baseSlug}-{$counter}";
                    $counter++;
                }
                $product->slug = $slug;
            }

            // Default category GENERAL si no viene
            if (empty($product->category_id)) {
                $defaultCat = Category::where('name', 'VARIOS')->orWhere('slug', 'varios')->first();
                if ($defaultCat) {
                    $product->category_id = $defaultCat->id;
                }
            }

            // Default brand DESCONOCIDO si no viene
            if (empty($product->brand_id)) {
                $defaultBrand = Brand::where('name', 'DESCONOCIDO')->orWhere('slug', 'desconocido')->first();
                if ($defaultBrand) {
                    $product->brand_id = $defaultBrand->id;
                }
            }
        });

        static::updating(function ($product) {
            // Si el nombre cambió y no se especificó un slug nuevo
            if ($product->isDirty('name') && !$product->isDirty('slug')) {
                $baseSlug = Str::slug($product->name);
                $slug = $baseSlug;
                $counter = 1;
                while (static::where('slug', $slug)->where('id', '!=', $product->id)->exists()) {
                    $slug = "{$baseSlug}-{$counter}";
                    $counter++;
                }
                $product->slug = $slug;
            }
        });
    }

    /**
     * Dynamic business-type values. An empty set is stored as a JSON object
     * ({}) to match the column default, not as an empty JSON array.
     */
    public function setAttributesAttribute(?array $value): void
    {
        $this->attributes['attributes'] = json_encode(
            empty($value) ? new \stdClass : $value,
            JSON_UNESCAPED_UNICODE
        );
    }

    public function getImageAttribute($value): ?string
    {
        if (empty($value))
            return null;
        return FileStorageService::getPublicUrl($value);
    }

    public function getImageThumbAttribute($value): ?string
    {
        $val = $value ?: ($this->attributes['image'] ?? null);
        if (empty($val))
            return null;
        return FileStorageService::getPublicUrl($val);
    }

    public function getImageMediumAttribute($value): ?string
    {
        $val = $value ?: ($this->attributes['image'] ?? null);
        if (empty($val))
            return null;
        return FileStorageService::getPublicUrl($val);
    }

    /**
     * Categoría asociada (nodo hoja de la jerarquía).
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id', 'id');
    }

    /**
     * Ruta completa jerárquica de la categoría (ej. "Tecnología > Computación > Laptops").
     */
    public function getCategoryPathAttribute(): ?string
    {
        return $this->category?->full_path ?? $this->category?->name;
    }

    /* Brand */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /* Inventory Warehouse */
    public function inventoryWarehouses(): HasMany
    {
        return $this->hasMany(InventoryWarehouse::class, 'product_id', 'id');
    }

    /* Inventory store */
    public function inventoryStore(): HasMany
    {
        return $this->hasMany(InventoryStore::class, 'product_id', 'id');
    }

    /* Detail Sale */
    public function detailSale(): HasMany
    {
        return $this->hasMany(DetailSale::class);
    }

    /* Product Images */
    public function productImages(): HasMany
    {
        return $this->hasMany(ProductImage::class);
    }

    /* Electronic Invoice Details */
    public function electronicInvoiceDetails(): HasMany
    {
        return $this->hasMany(ElectronicInvoiceDetail::class);
    }
}