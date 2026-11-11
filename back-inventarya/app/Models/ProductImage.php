<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductImage extends Model
{
    use HasFactory;
    protected $fillable = ['product_id', 'image', 'image_key'];

    public function getImageAttribute($value): ?string
    {
        if (empty($value)) return null;
        return \App\Services\FileStorageService::getPublicUrl($this->image_key ?? $value);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
