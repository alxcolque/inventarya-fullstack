<?php

namespace App\Services;

use Intervention\Image\Laravel\Facades\Image;
use Illuminate\Support\Str;

class ImageOptimizationService
{
    /**
     * Optimize and convert image to WebP.
     */
    public function optimize($imageData, int $width = 1200, int $quality = 80)
    {
        return Image::read($imageData)
            ->scale(width: $width)
            ->toWebp($quality);
    }

    /**
     * Generate a thumbnail.
     */
    public function thumbnail($imageData, int $size = 200, int $quality = 70)
    {
        return Image::read($imageData)
            ->cover($size, $size)
            ->toWebp($quality);
    }

    /**
     * Generate a medium sized image.
     */
    public function medium($imageData, int $width = 600, int $height = 600, int $quality = 75)
    {
        return Image::read($imageData)
            ->cover($width, $height)
            ->toWebp($quality);
    }
}
