<?php

namespace App\Models;

use App\Services\FileStorageService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Carousel extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'link',
        'description',
        'visible_btn',
        'title_btn',
        'color_btn',
        'position_btn',
        'image',
        'image_key',
        'display_order',
        'status',
    ];

    protected $casts = [
        'visible_btn'   => 'boolean',
        'display_order' => 'integer',
    ];

    /**
     * Resolve the stored image path to a public URL on serialization.
     */
    public function getImageAttribute(?string $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        return FileStorageService::getPublicUrl($value);
    }

    /**
     * Scope for active carousels, ordered for display.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active')->orderBy('display_order')->orderBy('id');
    }
}
