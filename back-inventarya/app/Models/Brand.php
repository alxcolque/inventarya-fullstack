<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Brand extends Model
{
    use HasFactory;
    protected $fillable = ['name', 'slug', 'image', 'image_key'];

    public function getImageAttribute($value): ?string
    {
        if (empty($value)) {
            return null;
        }
        return \App\Services\FileStorageService::getPublicUrl($this->image_key ?? $value);
    }

    /* Products */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}