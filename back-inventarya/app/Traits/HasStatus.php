<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait HasStatus
{
    /**
     * Scope a query to only include active records.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope a query to only include inactive records.
     */
    public function scopeInactive(Builder $query): Builder
    {
        return $query->where('status', 'inactive');
    }

    /**
     * Check if the record is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
