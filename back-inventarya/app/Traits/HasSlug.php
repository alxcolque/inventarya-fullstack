<?php

namespace App\Traits;

use Illuminate\Support\Str;

trait HasSlug
{
    /**
     * Boot the trait.
     */
    protected static function bootHasSlug(): void
    {
        static::creating(function ($model) {
            $model->slug = $model->generateUniqueSlug($model->getSlugSourceString());
        });

        static::updating(function ($model) {
            if ($model->isDirty($model->getSlugSourceField())) {
                $model->slug = $model->generateUniqueSlug($model->getSlugSourceString());
            }
        });
    }

    /**
     * Get the source field for the slug.
     */
    protected function getSlugSourceField(): string
    {
        return 'name';
    }

    /**
     * Get the source string for the slug.
     */
    protected function getSlugSourceString(): string
    {
        return $this->{$this->getSlugSourceField()};
    }

    /**
     * Generate a unique slug.
     */
    protected function generateUniqueSlug(string $source): string
    {
        $slug = Str::slug($source);
        $originalSlug = $slug;
        $count = 1;

        while (static::where('slug', $slug)->where('id', '!=', $this->id)->exists()) {
            $slug = "{$originalSlug}-" . $count++;
        }

        return $slug;
    }
}
