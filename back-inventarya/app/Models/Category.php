<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'color',
        'parent_id',
    ];

    protected $appends = ['full_path'];

    public const LIGHT_COLORS = \App\Http\Controllers\CategoryController::LIGHT_COLORS;

    /**
     * Obtener un color aleatorio de la paleta interna delegando al controlador.
     */
    public static function randomLightColor(): string
    {
        return \App\Http\Controllers\CategoryController::randomLightColor();
    }

    /**
     * El evento de arranque del modelo garantiza que ninguna categoría quede con color nulo.
     */
    protected static function booted(): void
    {
        static::creating(function (Category $category) {
            if (empty($category->color)) {
                $category->color = static::randomLightColor();
            }
        });

        static::saving(function (Category $category) {
            if (empty($category->color)) {
                $category->color = static::randomLightColor();
            }
        });
    }

    /**
     * Categoría padre superior inmediata.
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    /**
     * Subcategorías hijas directas.
     */
    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    /**
     * Productos asociados a esta categoría (nodo hoja o nivel).
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'category_id');
    }

    /**
     * Devuelve la lista ordenada de ancestros desde la raíz hasta el padre inmediato.
     *
     * @return array<Category>
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
     * Ruta completa jerárquica (ej: "Tecnología > Computación > Laptops").
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
     * Nombre simple de la categoría final (nodo hoja sin ancestros concatenados).
     */
    public function getLeafNameAttribute(): string
    {
        $raw = trim((string) $this->name);
        if ($raw === '') {
            return 'Sin categoría';
        }
        if (str_contains($raw, '>')) {
            $parts = explode('>', $raw);
            $last = trim(end($parts));
            return $last !== '' ? $last : $raw;
        }
        if (str_contains($raw, '/')) {
            $parts = explode('/', $raw);
            $last = trim(end($parts));
            return $last !== '' ? $last : $raw;
        }
        return $raw;
    }

    /**
     * Scope para consultar solo categorías raíz (sin padre superior).
     */
    public function scopeRoots($query)
    {
        return $query->whereNull('parent_id');
    }
}
